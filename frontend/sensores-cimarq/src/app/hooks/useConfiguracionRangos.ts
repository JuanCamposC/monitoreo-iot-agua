import { useState, useEffect } from 'react';

export interface RangoSensor {
  minimo: number;
  maximo: number;
  minimoOptimo: number;
  maximoOptimo: number;
}

export interface ConfiguracionRangos {
  temperatura: RangoSensor;
  ph: RangoSensor;
  oxigeno: RangoSensor;
}

// Configuración por defecto para acuicultura
const configuracionPorDefecto: ConfiguracionRangos = {
  temperatura: {
    minimo: 5,
    maximo: 25,
    minimoOptimo: 12,
    maximoOptimo: 18
  },
  ph: {
    minimo: 6.0,
    maximo: 8.5,
    minimoOptimo: 6.8,
    maximoOptimo: 7.8
  },
  oxigeno: {
    minimo: 3.0,
    maximo: 15.0,
    minimoOptimo: 6.0,
    maximoOptimo: 10.0
  }
};

export type EstadoSensor = 'optimo' | 'aceptable' | 'critico';

export function useConfiguracionRangos() {
  const [configuracion, setConfiguracion] = useState<ConfiguracionRangos>(configuracionPorDefecto);

  // Cargar configuración desde localStorage
  useEffect(() => {
    const configGuardada = localStorage.getItem('configuracionRangos');
    if (configGuardada) {
      try {
        const config = JSON.parse(configGuardada);
        setConfiguracion(config);
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      }
    }
  }, []);

  // Escuchar cambios en la configuración
  useEffect(() => {
    const handleConfiguracionActualizada = (event: CustomEvent) => {
      setConfiguracion(event.detail);
    };

    window.addEventListener('configuracionActualizada', handleConfiguracionActualizada as EventListener);
    
    return () => {
      window.removeEventListener('configuracionActualizada', handleConfiguracionActualizada as EventListener);
    };
  }, []);

  // Función para evaluar el estado de un sensor
  const evaluarEstadoSensor = (tipo: keyof ConfiguracionRangos, valor: number): EstadoSensor => {
    const rango = configuracion[tipo];
    
    // Crítico: fuera del rango general
    if (valor < rango.minimo || valor > rango.maximo) {
      return 'critico';
    }
    
    // Óptimo: dentro del rango óptimo
    if (valor >= rango.minimoOptimo && valor <= rango.maximoOptimo) {
      return 'optimo';
    }
    
    // Aceptable: dentro del rango general pero fuera del óptimo
    return 'aceptable';
  };

  // Función para obtener el color según el estado
  const obtenerColorEstado = (estado: EstadoSensor): string => {
    switch (estado) {
      case 'optimo': return '#4caf50'; // Verde
      case 'aceptable': return '#ff9800'; // Naranja
      case 'critico': return '#f44336'; // Rojo
    }
  };

  // Función para obtener el texto del estado
  const obtenerTextoEstado = (estado: EstadoSensor): string => {
    switch (estado) {
      case 'optimo': return 'Óptimo';
      case 'aceptable': return 'Aceptable';
      case 'critico': return 'Crítico';
    }
  };

  return {
    configuracion,
    evaluarEstadoSensor,
    obtenerColorEstado,
    obtenerTextoEstado
  };
}