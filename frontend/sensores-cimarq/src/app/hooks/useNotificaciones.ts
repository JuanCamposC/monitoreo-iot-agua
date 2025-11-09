/**
 * Hook personalizado para el sistema de notificaciones CIMARQ
 * Maneja notificaciones web, modales de emergencia y comunicación con API
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface AlertaNotificacion {
  _id: string;
  sensor: string;
  nivel: string;
  mensaje: string;
  valor_actual: number;
  fecha_creacion: string;
  resuelto: boolean;
  prioridad: number;
  sugerencias?: string[];
}

export interface ConfiguracionNotificaciones {
  habilitarWebPush: boolean;
  habilitarSonido: boolean;
  habilitarModal: boolean;
  habilitarEmail: boolean;
  nivelesNotificacion: {
    CRITICO: boolean;
    ALTO: boolean;
    MEDIO: boolean;
    BAJO: boolean;
  };
  destinatariosEmail: string[];
}

interface UseNotificacionesReturn {
  // Estados
  alertaActiva: AlertaNotificacion | null;
  modalAbierto: boolean;
  notificacionesHabilitadas: boolean;
  configuracion: ConfiguracionNotificaciones;
  
  // Funciones
  mostrarAlerta: (alerta: AlertaNotificacion) => void;
  cerrarModal: () => void;
  solicitarPermisos: () => Promise<boolean>;
  enviarNotificacionEmail: (alerta: AlertaNotificacion, destinatarios?: string[]) => Promise<boolean>;
  probarNotificaciones: () => Promise<boolean>;
  actualizarConfiguracion: (nuevaConfig: Partial<ConfiguracionNotificaciones>) => void;
  diagnosticarSistema: () => Promise<any>;
  
  // Estados de carga
  enviandoEmail: boolean;
  probandoSistema: boolean;
}

const CONFIGURACION_DEFAULT: ConfiguracionNotificaciones = {
  habilitarWebPush: true,
  habilitarSonido: true,
  habilitarModal: true,
  habilitarEmail: true,
  nivelesNotificacion: {
    CRITICO: true,
    ALTO: true,
    MEDIO: false,
    BAJO: false
  },
  destinatariosEmail: []
};

const API_BASE = 'http://localhost:5000/api/v1';

export const useNotificaciones = (): UseNotificacionesReturn => {
  // Estados principales
  const [alertaActiva, setAlertaActiva] = useState<AlertaNotificacion | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [notificacionesHabilitadas, setNotificacionesHabilitadas] = useState(false);
  const [configuracion, setConfiguracion] = useState<ConfiguracionNotificaciones>(CONFIGURACION_DEFAULT);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [probandoSistema, setProbandoSistema] = useState(false);
  
  // Referencias para audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const alertasProcessadasRef = useRef<Set<string>>(new Set());

  /**
   * Cargar configuración desde localStorage
   */
  useEffect(() => {
    const cargarConfiguracion = () => {
      try {
        const configGuardada = localStorage.getItem('cimarq_notificaciones_config');
        if (configGuardada) {
          const configParseada = JSON.parse(configGuardada);
          setConfiguracion({ ...CONFIGURACION_DEFAULT, ...configParseada });
        }
      } catch (error) {
        console.error('Error cargando configuración de notificaciones:', error);
      }
    };

    cargarConfiguracion();
  }, []);

  /**
   * Guardar configuración en localStorage
   */
  const actualizarConfiguracion = useCallback((nuevaConfig: Partial<ConfiguracionNotificaciones>) => {
    const configActualizada = { ...configuracion, ...nuevaConfig };
    setConfiguracion(configActualizada);
    
    try {
      localStorage.setItem('cimarq_notificaciones_config', JSON.stringify(configActualizada));
    } catch (error) {
      console.error('Error guardando configuración:', error);
    }
  }, [configuracion]);

  /**
   * Solicitar permisos de notificación del navegador
   */
  const solicitarPermisos = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('Este navegador no soporta notificaciones web');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const habilitadas = permission === 'granted';
      setNotificacionesHabilitadas(habilitadas);
      return habilitadas;
    } catch (error) {
      console.error('Error solicitando permisos de notificación:', error);
      return false;
    }
  }, []);

  /**
   * Verificar permisos al cargar el componente
   */
  useEffect(() => {
    if ('Notification' in window) {
      setNotificacionesHabilitadas(Notification.permission === 'granted');
    }
  }, []);

  /**
   * Generar tono de emergencia programáticamente
   */
  const generarTonoEmergencia = useCallback(() => {
    if (!configuracion.habilitarSonido) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;
      const duracion = 0.3;
      const frecuencias = [880, 1100, 880]; // Patrón de emergencia

      frecuencias.forEach((freq, index) => {
        setTimeout(() => {
          const oscilador = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscilador.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscilador.frequency.value = freq;
          oscilador.type = 'square';

          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duracion);

          oscilador.start();
          oscilador.stop(audioContext.currentTime + duracion);
        }, index * 400);
      });
    } catch (error) {
      console.error('Error generando tono de emergencia:', error);
    }
  }, [configuracion.habilitarSonido]);

  /**
   * Mostrar notificación web del navegador
   */
  const mostrarNotificacionWeb = useCallback((alerta: AlertaNotificacion) => {
    if (!configuracion.habilitarWebPush || !notificacionesHabilitadas) return;

    try {
      const notification = new Notification(
        `CIMARQ - ${alerta.nivel} ${alerta.sensor.toUpperCase()}`,
        {
          body: `${alerta.mensaje}\nValor actual: ${alerta.valor_actual}`,
          icon: '/favicon.ico',
          badge: '/badge-192x192.png',
          tag: `alerta-${alerta._id}`,
          requireInteraction: alerta.nivel === 'CRITICO',
          silent: false,
          data: {
            alertaId: alerta._id,
            sensor: alerta.sensor,
            nivel: alerta.nivel,
            timestamp: Date.now()
          }
        }
      );

      // Manejar click en la notificación
      notification.onclick = () => {
        window.focus();
        // Abrir página de alertas
        window.open('/alertas', '_blank');
        notification.close();
      };

      // Auto-cerrar después de 10 segundos para alertas no críticas
      if (alerta.nivel !== 'CRITICO') {
        setTimeout(() => {
          notification.close();
        }, 10000);
      }

    } catch (error) {
      console.error('Error mostrando notificación web:', error);
    }
  }, [configuracion.habilitarWebPush, notificacionesHabilitadas]);

  /**
   * Función principal para mostrar una alerta
   */
  const mostrarAlerta = useCallback((alerta: AlertaNotificacion) => {
    // Evitar procesar la misma alerta múltiples veces
    if (alertasProcessadasRef.current.has(alerta._id)) {
      return;
    }

    // Verificar si este nivel debe ser notificado
    const debeNotificar = configuracion.nivelesNotificacion[alerta.nivel as keyof typeof configuracion.nivelesNotificacion];
    if (!debeNotificar) {
      return;
    }

    // Marcar como procesada
    alertasProcessadasRef.current.add(alerta._id);

    // Establecer alerta activa
    setAlertaActiva(alerta);

    // Mostrar modal si está habilitado
    if (configuracion.habilitarModal) {
      setModalAbierto(true);
    }

    // Mostrar notificación web
    mostrarNotificacionWeb(alerta);

    // Reproducir sonido de alerta
    if (configuracion.habilitarSonido) {
      generarTonoEmergencia();
    }

    // Enviar email automáticamente para alertas críticas
    if (configuracion.habilitarEmail && alerta.nivel === 'CRITICO') {
      enviarNotificacionEmail(alerta).catch(console.error);
    }

    console.log(`Alerta ${alerta.nivel} procesada:`, alerta.mensaje);
  }, [
    configuracion,
    mostrarNotificacionWeb,
    generarTonoEmergencia,
    configuracion.habilitarEmail
  ]);

  /**
   * Cerrar modal de alerta
   */
  const cerrarModal = useCallback(() => {
    setModalAbierto(false);
    // No limpiar alertaActiva inmediatamente para permitir animaciones
    setTimeout(() => {
      setAlertaActiva(null);
    }, 300);
  }, []);

  /**
   * Enviar notificación por email
   */
  const enviarNotificacionEmail = useCallback(async (
    alerta: AlertaNotificacion,
    destinatarios?: string[]
  ): Promise<boolean> => {
    if (!configuracion.habilitarEmail) {
      console.log('Notificaciones por email están deshabilitadas');
      return false;
    }

    setEnviandoEmail(true);

    try {
      const response = await fetch(`${API_BASE}/notificaciones/enviar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo: 'critica',
          alerta_id: alerta._id,
          canales: ['email'],
          destinatarios: destinatarios || configuracion.destinatariosEmail
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('📧 Email enviado exitosamente:', result);
        
        // Mostrar notificación de éxito
        if (notificacionesHabilitadas) {
          new Notification('✅ Email Enviado', {
            body: `Notificación de ${alerta.sensor.toUpperCase()} enviada por email`,
            icon: '/favicon.ico',
            tag: 'email-success'
          });
        }
        
        return true;
      } else {
        const errorMsg = result.errores?.join(', ') || 'Error desconocido';
        console.error('Error enviando email:', {
          errores: result.errores,
          mensaje: result.mensaje,
          configuracion_activa: result.configuracion || 'No disponible'
        });
        
        // Mostrar notificación de error si las notificaciones están habilitadas
        if (notificacionesHabilitadas) {
          new Notification('Error enviando Email', {
            body: `No se pudo enviar: ${errorMsg}`,
            icon: '/favicon.ico',
            tag: 'email-error'
          });
        }
        
        return false;
      }

    } catch (error) {
      console.error('🚨 Error de conexión al enviar email:', {
        error: error,
        endpoint: `${API_BASE}/notificaciones/enviar`,
        alerta_id: alerta._id,
        sensor: alerta.sensor
      });
      
      // Mostrar notificación de error de conexión
      if (notificacionesHabilitadas) {
        new Notification('Error de Conexión', {
          body: 'No se pudo conectar al servidor para enviar email',
          icon: '/favicon.ico',
          tag: 'connection-error'
        });
      }
      
      return false;
    } finally {
      setEnviandoEmail(false);
    }
  }, [configuracion.habilitarEmail, configuracion.destinatariosEmail]);

  /**
   * Diagnosticar configuración del sistema
   */
  const diagnosticarSistema = useCallback(async () => {
    console.log('=== DIAGNÓSTICO SISTEMA NOTIFICACIONES ===');
    
    try {
      // 1. Verificar configuración del servidor
      const configResponse = await fetch(`${API_BASE}/notificaciones/configuracion`);
      const configData = await configResponse.json();
      
      console.log('Configuración servidor:', {
        success: configData.success,
        email_habilitado: configData.configuracion?.email?.habilitado,
        smtp_server: configData.configuracion?.email?.servidor_smtp,
        remitente: configData.configuracion?.email?.remitente,
        destinatarios: configData.configuracion?.email?.destinatarios_default
      });
      
      // 2. Verificar permisos del navegador
      console.log('Permisos navegador:', {
        notificaciones_soportadas: 'Notification' in window,
        permiso_actual: Notification.permission,
        habilitadas: notificacionesHabilitadas
      });
      
      // 3. Verificar configuración local
      console.log('Configuración local:', configuracion);
      
      return configData;
      
    } catch (error) {
      console.error('Error en diagnóstico:', error);
      return null;
    }
  }, [notificacionesHabilitadas, configuracion]);

  /**
   * Probar sistema de notificaciones
   */
  const probarNotificaciones = useCallback(async (): Promise<boolean> => {
    setProbandoSistema(true);

    try {
      // Probar notificación web
      if (configuracion.habilitarWebPush && notificacionesHabilitadas) {
        const testNotification = new Notification('CIMARQ - Prueba del Sistema', {
          body: 'Si ves este mensaje, las notificaciones web están funcionando correctamente.',
          icon: '/favicon.ico',
          tag: 'test-notification'
        });

        setTimeout(() => testNotification.close(), 5000);
      }

      // Probar sonido
      if (configuracion.habilitarSonido) {
        generarTonoEmergencia();
      }

      // Probar email
      let emailExitoso = false;
      if (configuracion.habilitarEmail) {
        try {
          const response = await fetch(`${API_BASE}/notificaciones/probar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });

          const result = await response.json();
          emailExitoso = result.success;
        } catch (error) {
          console.error('Error probando email:', error);
        }
      }

      console.log('Prueba de notificaciones completada');
      return true;

    } catch (error) {
      console.error('Error en prueba de notificaciones:', error);
      return false;
    } finally {
      setProbandoSistema(false);
    }
  }, [
    configuracion,
    notificacionesHabilitadas,
    generarTonoEmergencia
  ]);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    // Estados
    alertaActiva,
    modalAbierto,
    notificacionesHabilitadas,
    configuracion,

    // Funciones
    mostrarAlerta,
    cerrarModal,
    solicitarPermisos,
    enviarNotificacionEmail,
    probarNotificaciones,
    actualizarConfiguracion,
    diagnosticarSistema,

    // Estados de carga
    enviandoEmail,
    probandoSistema
  };
};