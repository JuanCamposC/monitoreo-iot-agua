import { useState } from 'react';

/**
 * Hook simplificado de configuración de alertas.
 * Las notificaciones están activadas por defecto para todos los niveles.
 */
export const useConfiguracionAlertas = () => {
  const [loading, setLoading] = useState(false);

  // Las alertas siempre están habilitadas por defecto
  const configuracionAlertas = {
    criticas: true,
    advertencia: true,
    informativas: true
  };

  // Función para verificar si un tipo de alerta está habilitado (siempre true)
  const alertaHabilitada = (tipo: 'criticas' | 'advertencia' | 'informativas'): boolean => {
    return true;
  };

  // Función para verificar si una alerta debe mostrarse basado en su nivel (siempre true)
  const deberMostrarAlerta = (nivel: string): boolean => {
    return true;
  };

  // Función dummy para mantener compatibilidad
  const recargarConfiguracion = () => {
    // No hace nada, las alertas siempre están activadas
  };

  return {
    configuracionAlertas,
    loading,
    alertaHabilitada,
    deberMostrarAlerta,
    recargarConfiguracion
  };
};