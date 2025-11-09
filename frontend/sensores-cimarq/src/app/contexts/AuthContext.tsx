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
}

interface UpdateProfileData {
  nombre: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  // Verificar token almacenado al cargar
  useEffect(() => {
    const checkAuth = async () => {
      const token = safeLocalStorage.getItem('auth-token');
      const userData = safeLocalStorage.getItem('user-data');
      
      if (token && userData) {
        try {
          // Verificar si el token sigue siendo válido
          const response = await apiRequestJson(API_ENDPOINTS.AUTH.VERIFY, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          // Si llega aquí, el token es válido
          setUser(JSON.parse(userData));
        } catch (error) {
          console.warn('Error verificando token:', error);
          // Token inválido o error de red, limpiar sesión
          safeLocalStorage.removeItem('auth-token');
          safeLocalStorage.removeItem('user-data');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

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