import { useState, useEffect } from 'react';
import { ConfiguracionAlertas } from '../configuracion/types';

const STORAGE_KEY = 'configuracionSistemaCompleta';

export const useConfiguracionAlertas = () => {
  const [configuracionAlertas, setConfiguracionAlertas] = useState<ConfiguracionAlertas>({
    criticas: true,
    advertencia: true,
    informativas: false
  });

  const [loading, setLoading] = useState(true);

  // Cargar configuración desde localStorage
  const cargarConfiguracion = () => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const configuracionCompleta = JSON.parse(stored);
          if (configuracionCompleta.general?.alertas) {
            setConfiguracionAlertas(configuracionCompleta.general.alertas);
          }
        }
      }
    } catch (error) {
      console.error('Error cargando configuración de alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para verificar si un tipo de alerta está habilitado
  const alertaHabilitada = (tipo: 'criticas' | 'advertencia' | 'informativas'): boolean => {
    return configuracionAlertas[tipo];
  };

  // Función para verificar si una alerta debe mostrarse basado en su nivel
  const deberMostrarAlerta = (nivel: string): boolean => {
    const nivelNormalizado = nivel.toUpperCase();
    
    switch (nivelNormalizado) {
      case 'CRITICO':
      case 'ALTO':
        return configuracionAlertas.criticas;
      case 'MEDIO':
        return configuracionAlertas.advertencia;
      case 'BAJO':
      case 'INFO':
      case 'INFORMATIVO':
        return configuracionAlertas.informativas;
      default:
        return true; // Por defecto mostrar si no se puede clasificar
    }
  };

  // Escuchar cambios en la configuración
  useEffect(() => {
    cargarConfiguracion();

    // Escuchar eventos de actualización de configuración
    const handleConfiguracionActualizada = () => {
      cargarConfiguracion();
    };

    window.addEventListener('configuracionSistemaActualizada', handleConfiguracionActualizada);
    
    return () => {
      window.removeEventListener('configuracionSistemaActualizada', handleConfiguracionActualizada);
    };
  }, []);

  return {
    configuracionAlertas,
    loading,
    alertaHabilitada,
    deberMostrarAlerta,
    recargarConfiguracion: cargarConfiguracion
  };
};