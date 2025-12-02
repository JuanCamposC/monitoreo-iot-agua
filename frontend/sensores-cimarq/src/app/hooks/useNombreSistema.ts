'use client';

import { useState, useEffect } from 'react';
import { configuracionGeneralPorDefecto } from '../configuracion/types';

export function useNombreSistema() {
  const [nombreSistema, setNombreSistema] = useState(configuracionGeneralPorDefecto.sistema.nombre);

  useEffect(() => {
    // Cargar nombre del sistema desde localStorage
    const cargarNombreSistema = () => {
      try {
        const configCompleta = localStorage.getItem('configuracionSistemaCompleta');
        if (configCompleta) {
          const config = JSON.parse(configCompleta);
          if (config?.general?.sistema?.nombre) {
            setNombreSistema(config.general.sistema.nombre);
          }
        }
      } catch (error) {
        console.error('Error cargando nombre del sistema:', error);
      }
    };

    cargarNombreSistema();

    // Escuchar cambios en la configuración
    const handleConfiguracionChange = () => {
      cargarNombreSistema();
    };

    window.addEventListener('configuracionActualizada', handleConfiguracionChange);
    
    return () => {
      window.removeEventListener('configuracionActualizada', handleConfiguracionChange);
    };
  }, []);

  return nombreSistema;
}