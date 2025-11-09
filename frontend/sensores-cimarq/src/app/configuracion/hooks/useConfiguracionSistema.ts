import { useState, useEffect } from 'react';
import { 
  ConfiguracionSistemaCompleta, 
  ConfiguracionRangos,
  ConfiguracionGeneral,
  ConfiguracionAlertas,
  configuracionSistemaCompleta as defaultConfig
} from '../types';

const STORAGE_KEY = 'configuracionSistemaCompleta';
const LEGACY_RANGOS_KEY = 'configuracionRangos'; // Para migración

export function useConfiguracionSistema() {
  const [configuracion, setConfiguracion] = useState<ConfiguracionSistemaCompleta>(defaultConfig);
  const [loading, setLoading] = useState(true);

  // Migrar configuración legacy si existe
  const migrarConfiguracionLegacy = () => {
    const rangosLegacy = localStorage.getItem(LEGACY_RANGOS_KEY);
    if (rangosLegacy) {
      try {
        const rangos = JSON.parse(rangosLegacy) as ConfiguracionRangos;
        const nuevaConfig: ConfiguracionSistemaCompleta = {
          ...defaultConfig,
          rangos,
          fechaUltimaActualizacion: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevaConfig));
        localStorage.removeItem(LEGACY_RANGOS_KEY); // Limpiar legacy
        return nuevaConfig;
      } catch (error) {
        console.error('Error migrando configuración legacy:', error);
        return defaultConfig;
      }
    }
    return null;
  };

  // Cargar configuración al inicializar
  useEffect(() => {
    const cargarConfiguracion = () => {
      try {
        // Intentar migración primero
        const configMigrada = migrarConfiguracionLegacy();
        if (configMigrada) {
          setConfiguracion(configMigrada);
          setLoading(false);
          return;
        }

        // Cargar configuración normal
        const configGuardada = localStorage.getItem(STORAGE_KEY);
        
        if (configGuardada) {
          const config = JSON.parse(configGuardada) as ConfiguracionSistemaCompleta;
          setConfiguracion(config);
        } else {
          setConfiguracion(defaultConfig);
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
        setConfiguracion(defaultConfig);
      } finally {
        setLoading(false);
      }
    };

    cargarConfiguracion();
  }, []);

  // Guardar configuración completa
  const guardarConfiguracion = (nuevaConfiguracion: ConfiguracionSistemaCompleta) => {
    try {
      const configConFecha = {
        ...nuevaConfiguracion,
        fechaUltimaActualizacion: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(configConFecha));
      setConfiguracion(configConFecha);

      // Mantener compatibilidad con el hook de rangos legacy
      localStorage.setItem(LEGACY_RANGOS_KEY, JSON.stringify(configConFecha.rangos));

      // Disparar eventos para compatibilidad
      window.dispatchEvent(new CustomEvent('configuracionActualizada', { 
        detail: configConFecha.rangos 
      }));
      
      window.dispatchEvent(new CustomEvent('configuracionSistemaActualizada', { 
        detail: configConFecha 
      }));

      return true;
    } catch (error) {
      console.error('Error guardando configuración:', error);
      return false;
    }
  };

  // Actualizar solo rangos
  const actualizarRangos = (nuevosRangos: ConfiguracionRangos) => {
    const nuevaConfiguracion = {
      ...configuracion,
      rangos: nuevosRangos
    };
    return guardarConfiguracion(nuevaConfiguracion);
  };

  // Actualizar configuración general
  const actualizarConfiguracionGeneral = (nuevaConfigGeneral: ConfiguracionGeneral) => {
    const nuevaConfiguracion = {
      ...configuracion,
      general: nuevaConfigGeneral
    };
    return guardarConfiguracion(nuevaConfiguracion);
  };

  // Actualizar configuración de alertas específicamente
  const actualizarConfiguracionAlertas = (nuevasAlertas: ConfiguracionAlertas) => {
    const nuevaConfiguracion = {
      ...configuracion,
      general: {
        ...configuracion.general,
        alertas: nuevasAlertas
      }
    };
    return guardarConfiguracion(nuevaConfiguracion);
  };

  // Restaurar configuración por defecto
  const restaurarDefecto = (seccion?: 'rangos' | 'general' | 'todo') => {
    let nuevaConfiguracion = { ...configuracion };

    switch (seccion) {
      case 'rangos':
        nuevaConfiguracion.rangos = defaultConfig.rangos;
        break;
      case 'general':
        nuevaConfiguracion.general = defaultConfig.general;
        break;
      default:
        nuevaConfiguracion = { ...defaultConfig };
    }

    return guardarConfiguracion(nuevaConfiguracion);
  };

  // Exportar configuración
  const exportarConfiguracion = () => {
    const dataStr = JSON.stringify(configuracion, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `configuracion-sistema-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Importar configuración
  const importarConfiguracion = (archivo: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const contenido = e.target?.result as string;
          const configImportada = JSON.parse(contenido) as ConfiguracionSistemaCompleta;
          
          // Validar estructura básica
          if (configImportada.rangos && configImportada.general) {
            const exito = guardarConfiguracion(configImportada);
            resolve(exito);
          } else {
            console.error('Archivo de configuración no válido');
            resolve(false);
          }
        } catch (error) {
          console.error('Error importando configuración:', error);
          resolve(false);
        }
      };
      reader.readAsText(archivo);
    });
  };

  return {
    configuracion,
    loading,
    guardarConfiguracion,
    actualizarRangos,
    actualizarConfiguracionGeneral,
    actualizarConfiguracionAlertas,
    restaurarDefecto,
    exportarConfiguracion,
    importarConfiguracion
  };
}