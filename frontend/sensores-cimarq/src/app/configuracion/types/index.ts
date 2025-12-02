// Tipos para la configuración general del sistema

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

export interface ConfiguracionGeneral {
  sistema: {
    nombre: string;
    timezone: string;
  };
}

export interface ConfiguracionSistemaCompleta {
  rangos: ConfiguracionRangos;
  general: ConfiguracionGeneral;
  version: string;
  fechaUltimaActualizacion: string;
}

// Configuraciones por defecto
export const configuracionRangosPorDefecto: ConfiguracionRangos = {
  temperatura: {
    minimo: 5,
    maximo: 25,
    minimoOptimo: 12,
    maximoOptimo: 18
  },
  ph: {
    minimo: 6.0,
    maximo: 9.0,
    minimoOptimo: 7.0,
    maximoOptimo: 8.2
  },
  oxigeno: {
    minimo: 3.0,
    maximo: 15.0,
    minimoOptimo: 5.0,
    maximoOptimo: 9.0
  }
};

export const configuracionGeneralPorDefecto: ConfiguracionGeneral = {
  sistema: {
    nombre: 'CIMARQ IoT Monitor',
    timezone: 'America/Santiago'
  }
};

export const configuracionSistemaCompleta: ConfiguracionSistemaCompleta = {
  rangos: configuracionRangosPorDefecto,
  general: configuracionGeneralPorDefecto,
  version: '1.0.0',
  fechaUltimaActualizacion: new Date().toISOString()
};