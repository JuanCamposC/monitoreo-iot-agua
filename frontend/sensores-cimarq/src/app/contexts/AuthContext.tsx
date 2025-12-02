'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequestJson, apiRequest, API_ENDPOINTS } from '../config/api';

interface User {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'usuario';
  fecha_creacion?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateProfile: (profileData: UpdateProfileData) => Promise<{ success: boolean; message?: string }>;
  isAuthenticated: boolean;
  sessionTimeRemaining: number; // Tiempo restante en milisegundos
  extendSession: () => void; // Función para extender la sesión manualmente
}

interface UpdateProfileData {
  nombre: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Constantes para la gestión de sesión
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos en milisegundos
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Verificar cada minuto

// Helper para localStorage seguro
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number>(0);

  // Función para actualizar el timestamp de última actividad
  const updateLastActivity = () => {
    const now = Date.now().toString();
    safeLocalStorage.setItem('last-activity', now);
  };

  // Función para verificar si la sesión ha expirado
  const isSessionExpired = (): boolean => {
    const lastActivity = safeLocalStorage.getItem('last-activity');
    if (!lastActivity) return true;
    
    const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
    return timeSinceLastActivity > INACTIVITY_TIMEOUT;
  };

  // Función para calcular tiempo restante de sesión
  const getSessionTimeRemaining = (): number => {
    const lastActivity = safeLocalStorage.getItem('last-activity');
    if (!lastActivity) return 0;
    
    const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
    const timeRemaining = INACTIVITY_TIMEOUT - timeSinceLastActivity;
    return Math.max(0, timeRemaining);
  };

  // Función para extender la sesión manualmente
  const extendSession = () => {
    updateLastActivity();
  };

  // Verificar token almacenado al cargar
  useEffect(() => {
    const checkAuth = async () => {
      const token = safeLocalStorage.getItem('auth-token');
      const userData = safeLocalStorage.getItem('user-data');
      
      if (token && userData) {
        // Verificar si la sesión ha expirado por inactividad
        if (isSessionExpired()) {
          console.log('Sesión expirada por inactividad');
          safeLocalStorage.removeItem('auth-token');
          safeLocalStorage.removeItem('user-data');
          safeLocalStorage.removeItem('last-activity');
          setLoading(false);
          return;
        }

        try {
          // Intentar verificar si el token sigue siendo válido
          // Si el endpoint VERIFY no existe, usar STATUS como fallback
          let isValidToken = false;
          
          try {
            await apiRequestJson(API_ENDPOINTS.AUTH.VERIFY, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            isValidToken = true;
          } catch (verifyError) {
            // Si VERIFY falla, intentar con STATUS
            try {
              await apiRequestJson(API_ENDPOINTS.AUTH.STATUS, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              isValidToken = true;
            } catch (statusError) {
              console.warn('Token inválido o endpoints no disponibles');
              isValidToken = false;
            }
          }

          if (isValidToken) {
            // Token válido, restaurar sesión
            setUser(JSON.parse(userData));
            updateLastActivity(); // Actualizar última actividad
          } else {
            // Token inválido, limpiar sesión
            safeLocalStorage.removeItem('auth-token');
            safeLocalStorage.removeItem('user-data');
            safeLocalStorage.removeItem('last-activity');
          }
        } catch (error) {
          // En caso de error de red o servidor, mantener la sesión local
          // La verificación real se hará en la próxima petición que requiera autenticación
          console.debug('No se pudo verificar el token, manteniendo sesión local:', error);
          setUser(JSON.parse(userData));
          updateLastActivity();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Efecto para monitorear actividad del usuario y verificar expiración de sesión
  useEffect(() => {
    if (!user) return;

    // Eventos que consideramos como actividad del usuario
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Handler para actualizar última actividad
    const handleUserActivity = () => {
      updateLastActivity();
    };

    // Agregar listeners de actividad
    activityEvents.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    // Verificar periódicamente si la sesión ha expirado y actualizar tiempo restante
    const sessionCheckInterval = setInterval(() => {
      const timeRemaining = getSessionTimeRemaining();
      setSessionTimeRemaining(timeRemaining);
      
      if (isSessionExpired()) {
        console.log('Sesión expirada por inactividad - desconectando usuario');
        logout();
      }
    }, ACTIVITY_CHECK_INTERVAL);

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
      clearInterval(sessionCheckInterval);
    };
  }, [user]);

  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const data = await apiRequestJson(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (data.success) {
        const { token, user: userData } = data;
        
        // Guardar en localStorage
        safeLocalStorage.setItem('auth-token', token);
        safeLocalStorage.setItem('user-data', JSON.stringify(userData));
        updateLastActivity(); // Establecer actividad inicial
        
        setUser(userData);
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Error de autenticación' };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, message: 'Contraseña o Correo incorrectos, Intente nuevamente' };
    }
  };



  const logout = () => {
    safeLocalStorage.removeItem('auth-token');
    safeLocalStorage.removeItem('user-data');
    safeLocalStorage.removeItem('last-activity');
    setUser(null);
  };

  const updateProfile = async (profileData: UpdateProfileData): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = safeLocalStorage.getItem('auth-token');
      if (!token) {
        return { success: false, message: 'No hay sesión activa' };
      }

      console.log('Enviando datos de actualización:', profileData);
      console.log('Token:', token);
      console.log('Endpoint:', API_ENDPOINTS.AUTH.UPDATE_PROFILE);

      // Usar apiRequest en lugar de apiRequestJson para manejar manualmente
      const response = await apiRequest(API_ENDPOINTS.AUTH.UPDATE_PROFILE, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      // Manejar respuesta manualmente
      if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Si no se puede parsear, usar mensaje por defecto
        }

        // Caso especial: "No se realizaron cambios"
        if (errorMessage.includes('No se realizaron cambios') || errorMessage.includes('no se detectaron cambios')) {
          return { 
            success: true, 
            message: 'No se detectaron cambios. Los datos ingresados son iguales a los actuales.' 
          };
        }

        // Para otros errores, retornar como error
        return { success: false, message: errorMessage };
      }

      const data = await response.json();

      console.log('Respuesta del servidor:', data);

      if (data.success) {
        // Actualizar datos del usuario en el contexto y localStorage
        const updatedUser = data.user;
        console.log('Actualizando usuario en contexto:', updatedUser);
        setUser(updatedUser);
        safeLocalStorage.setItem('user-data', JSON.stringify(updatedUser));
        
        // Si se generó un nuevo token, actualizarlo
        if (data.token) {
          safeLocalStorage.setItem('auth-token', data.token);
          console.log('Token actualizado');
        }
        
        return { success: true, message: data.message };
      } else {
        console.error('Error en respuesta del servidor:', data);
        return { success: false, message: data.message || 'Error al actualizar perfil' };
      }
    } catch (error) {
      console.error('Error en updateProfile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (errorMessage.includes('CORS')) {
        return { success: false, message: 'Error de configuración del servidor (CORS). Contacte al administrador.' };
      }
      
      // Caso especial: No se realizaron cambios (no es realmente un error)
      if (errorMessage.includes('No se realizaron cambios') || errorMessage.includes('no se detectaron cambios')) {
        return { 
          success: true, 
          message: 'No se detectaron cambios. Los datos ingresados son iguales a los actuales.' 
        };
      }
      
      // Retornar el mensaje de error específico del servidor
      return { success: false, message: errorMessage };
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateProfile,
    isAuthenticated: !!user,
    sessionTimeRemaining,
    extendSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}