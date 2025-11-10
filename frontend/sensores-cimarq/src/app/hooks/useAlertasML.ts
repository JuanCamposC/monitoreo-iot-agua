'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMLApi } from './useMLApi';
import { useConfiguracionRangos } from './useConfiguracionRangos';

export interface AlertaML {
  id: string;
  tipo: 'prediccion' | 'tendencia' | 'confianza' | 'anomalia';
  sensor: 'temperatura' | 'ph' | 'oxigeno';
  nivel: 'critico' | 'advertencia' | 'informativo';
  mensaje: string;
  timestamp: Date;
  leida: boolean;
  valor_actual: number;
  valor_predicho: number;
  confianza: number;
  nivel_confianza: string;
  tendencia: {
    direccion: string;
    cambio_porcentual: number;
    volatilidad: string;
  };
  datos_analisis: {
    promedio_actual: number;
    desviacion_estandar: number;
    rango_datos: number;
    anomalias_detectadas: number;
  };
  acciones_recomendadas: string[];
  impacto_estimado: string;
  tiempo_respuesta: string;
}

// Rangos ideales para cada sensor
const RANGOS_IDEALES = {
  temperatura: { min: 18, max: 25, optimo_min: 20, optimo_max: 23 },
  ph: { min: 6.0, max: 8.5, optimo_min: 6.5, optimo_max: 7.5 },
  oxigeno: { min: 5.0, max: 15.0, optimo_min: 7.0, optimo_max: 12.0 }
};

export const useAlertasML = () => {
  const { obtenerTodasPredicciones, loading } = useMLApi();
  const { configuracion } = useConfiguracionRangos();
  const [alertas, setAlertas] = useState<AlertaML[]>([]);
  const [alertasNoLeidas, setAlertasNoLeidas] = useState<number>(0);

  // Función para generar ID único
  const generarId = () => Math.random().toString(36).substr(2, 9);

  // Función para determinar el nivel de severidad basado en predicción
  const determinarNivelSeveridad = (
    sensor: keyof typeof RANGOS_IDEALES,
    valorPredicho: number,
    confianza: number,
    tendencia: any
  ): 'critico' | 'advertencia' | 'informativo' => {
    const rangos = RANGOS_IDEALES[sensor];
    
    // Si la confianza es muy baja, es informativo
    if (confianza < 0.7) return 'informativo';
    
    // Verificar si está fuera de rangos críticos
    if (valorPredicho < rangos.min || valorPredicho > rangos.max) {
      return 'critico';
    }
    
    // Verificar si está fuera de rangos óptimos
    if (valorPredicho < rangos.optimo_min || valorPredicho > rangos.optimo_max) {
      return 'advertencia';
    }
    
    // Verificar tendencias preocupantes
    if (Math.abs(tendencia.change_percent) > 20 && tendencia.volatility === 'high') {
      return 'advertencia';
    }
    
    return 'informativo';
  };

  // Función para generar mensaje descriptivo
  const generarMensaje = (
    sensor: string,
    tipo: string,
    valorActual: number,
    valorPredicho: number,
    tendencia: any,
    nivel: string
  ): string => {
    const sensorNombre = {
      temperatura: 'Temperatura',
      ph: 'pH',
      oxigeno: 'Oxígeno Disuelto'
    }[sensor as keyof typeof RANGOS_IDEALES] || sensor;

    const unidad = {
      temperatura: '°C',
      ph: '',
      oxigeno: ' mg/L'
    }[sensor as keyof typeof RANGOS_IDEALES] || '';

    switch (tipo) {
      case 'prediccion':
        if (nivel === 'critico') {
          return `⚠️ ${sensorNombre}: Predicción crítica de ${valorPredicho.toFixed(2)}${unidad}. Valor actual: ${valorActual.toFixed(2)}${unidad}. Requiere atención inmediata.`;
        } else if (nivel === 'advertencia') {
          return `⚡ ${sensorNombre}: Predicción fuera del rango óptimo: ${valorPredicho.toFixed(2)}${unidad}. Valor actual: ${valorActual.toFixed(2)}${unidad}.`;
        }
        return `📊 ${sensorNombre}: Predicción estable: ${valorPredicho.toFixed(2)}${unidad}. Valor actual: ${valorActual.toFixed(2)}${unidad}.`;
      
      case 'tendencia':
        const direccionTexto = tendencia.direction === 'up' ? 'ascendente' : 
                             tendencia.direction === 'down' ? 'descendente' : 'estable';
        return `📈 ${sensorNombre}: Tendencia ${direccionTexto} detectada (${tendencia.change_percent.toFixed(1)}% de cambio).`;
      
      case 'confianza':
        return `🤖 ${sensorNombre}: Confianza del modelo baja (${(valorPredicho * 100).toFixed(1)}%). Verificar datos de entrada.`;
      
      default:
        return `${sensorNombre}: Alerta generada automáticamente.`;
    }
  };

  // Función para generar acciones recomendadas
  const generarAccionesRecomendadas = (
    sensor: string,
    nivel: string,
    valorPredicho: number,
    tendencia: any
  ): string[] => {
    const acciones: string[] = [];
    
    if (nivel === 'critico') {
      acciones.push('🚨 Verificar sensor inmediatamente');
      acciones.push('📞 Notificar al supervisor');
      acciones.push('🔧 Revisar calibración del equipo');
    } else if (nivel === 'advertencia') {
      acciones.push('👀 Monitorear de cerca');
      acciones.push('📋 Registrar observación');
      acciones.push('⏰ Programar revisión en 2 horas');
    }
    
    // Acciones específicas por sensor
    if (sensor === 'temperatura') {
      if (valorPredicho > 25) {
        acciones.push('❄️ Activar sistema de enfriamiento');
      } else if (valorPredicho < 18) {
        acciones.push('🔥 Activar sistema de calentamiento');
      }
    } else if (sensor === 'ph') {
      if (valorPredicho > 8.5) {
        acciones.push('🧪 Añadir solución ácida');
      } else if (valorPredicho < 6.0) {
        acciones.push('🧪 Añadir solución básica');
      }
    } else if (sensor === 'oxigeno') {
      if (valorPredicho < 5.0) {
        acciones.push('💨 Activar aireación');
        acciones.push('🌊 Verificar flujo de agua');
      }
    }
    
    // Acciones basadas en tendencia
    if (Math.abs(tendencia.change_percent) > 30) {
      acciones.push('📊 Analizar causa de la variación');
      acciones.push('🔍 Revisar datos históricos');
    }
    
    return acciones;
  };

  // Función para generar alertas basadas en predicciones ML
  const generarAlertasML = useCallback(async () => {
    try {
      const predicciones = await obtenerTodasPredicciones();
      if (!predicciones.predictions) return;

      const nuevasAlertas: AlertaML[] = [];
      const sensores = ['temperatura', 'ph', 'oxigeno'] as const;

      for (const sensor of sensores) {
        const prediccionData = predicciones.predictions[sensor];
        if (!prediccionData) continue;

        const {
          prediction,
          trend_analysis,
          data_analysis,
        } = prediccionData;

        // Alerta de predicción principal
        const nivelPrediccion = determinarNivelSeveridad(
          sensor,
          prediction.value,
          prediction.confidence,
          trend_analysis
        );

        if (nivelPrediccion === 'critico' || nivelPrediccion === 'advertencia') {
          nuevasAlertas.push({
            id: generarId(),
            tipo: 'prediccion',
            sensor,
            nivel: nivelPrediccion,
            mensaje: generarMensaje(
              sensor,
              'prediccion',
              data_analysis.latest_value,
              prediction.value,
              trend_analysis,
              nivelPrediccion
            ),
            timestamp: new Date(),
            leida: false,
            valor_actual: data_analysis.latest_value,
            valor_predicho: prediction.value,
            confianza: prediction.confidence,
            nivel_confianza: prediction.confidence_level,
            tendencia: {
              direccion: trend_analysis.direction,
              cambio_porcentual: trend_analysis.change_percent,
              volatilidad: trend_analysis.volatility
            },
            datos_analisis: {
              promedio_actual: data_analysis.current_avg,
              desviacion_estandar: data_analysis.current_std,
              rango_datos: data_analysis.data_range,
              anomalias_detectadas: 0 // Por ahora no hay datos de anomalías en la API
            },
            acciones_recomendadas: generarAccionesRecomendadas(
              sensor,
              nivelPrediccion,
              prediction.value,
              trend_analysis
            ),
            impacto_estimado: nivelPrediccion === 'critico' ? 'Alto' : 'Medio',
            tiempo_respuesta: nivelPrediccion === 'critico' ? 'Inmediato' : '2-4 horas'
          });
        }

        // Alerta de tendencia preocupante
        if (Math.abs(trend_analysis.change_percent) > 25) {
          nuevasAlertas.push({
            id: generarId(),
            tipo: 'tendencia',
            sensor,
            nivel: Math.abs(trend_analysis.change_percent) > 50 ? 'critico' : 'advertencia',
            mensaje: generarMensaje(
              sensor,
              'tendencia',
              data_analysis.latest_value,
              prediction.value,
              trend_analysis,
              'advertencia'
            ),
            timestamp: new Date(),
            leida: false,
            valor_actual: data_analysis.latest_value,
            valor_predicho: prediction.value,
            confianza: prediction.confidence,
            nivel_confianza: prediction.confidence_level,
            tendencia: {
              direccion: trend_analysis.direction,
              cambio_porcentual: trend_analysis.change_percent,
              volatilidad: trend_analysis.volatility
            },
            datos_analisis: {
              promedio_actual: data_analysis.current_avg,
              desviacion_estandar: data_analysis.current_std,
              rango_datos: data_analysis.data_range,
              anomalias_detectadas: 0
            },
            acciones_recomendadas: ['📈 Investigar causa del cambio', '📊 Revisar datos históricos'],
            impacto_estimado: 'Medio',
            tiempo_respuesta: '1-2 horas'
          });
        }

        // Alerta de confianza baja
        if (prediction.confidence < 0.8) {
          nuevasAlertas.push({
            id: generarId(),
            tipo: 'confianza',
            sensor,
            nivel: 'informativo',
            mensaje: generarMensaje(
              sensor,
              'confianza',
              data_analysis.latest_value,
              prediction.confidence,
              trend_analysis,
              'informativo'
            ),
            timestamp: new Date(),
            leida: false,
            valor_actual: data_analysis.latest_value,
            valor_predicho: prediction.value,
            confianza: prediction.confidence,
            nivel_confianza: prediction.confidence_level,
            tendencia: {
              direccion: trend_analysis.direction,
              cambio_porcentual: trend_analysis.change_percent,
              volatilidad: trend_analysis.volatility
            },
            datos_analisis: {
              promedio_actual: data_analysis.current_avg,
              desviacion_estandar: data_analysis.current_std,
              rango_datos: data_analysis.data_range,
              anomalias_detectadas: 0
            },
            acciones_recomendadas: ['🔍 Verificar calidad de datos', '🤖 Considerar reentrenamiento del modelo'],
            impacto_estimado: 'Bajo',
            tiempo_respuesta: '24 horas'
          });
        }
      }

      // Actualizar alertas y contar no leídas
      setAlertas(nuevasAlertas);
      setAlertasNoLeidas(nuevasAlertas.filter(a => !a.leida).length);

    } catch (error) {
      console.error('Error generando alertas ML:', error);
    }
  }, [obtenerTodasPredicciones]);

  // Función para marcar alerta como leída
  const marcarComoLeida = (id: string) => {
    setAlertas(prev => prev.map(alerta => 
      alerta.id === id ? { ...alerta, leida: true } : alerta
    ));
    setAlertasNoLeidas(prev => Math.max(0, prev - 1));
  };

  // Función para limpiar alertas leídas
  const limpiarAlertasLeidas = () => {
    setAlertas(prev => prev.filter(alerta => !alerta.leida));
  };

  // Generar alertas automáticamente cada 5 minutos
  useEffect(() => {
    generarAlertasML(); // Primera carga

    const interval = setInterval(() => {
      generarAlertasML();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [generarAlertasML]);

  return {
    alertas,
    alertasNoLeidas,
    loading,
    generarAlertasML,
    marcarComoLeida,
    limpiarAlertasLeidas
  };
};

export default useAlertasML;