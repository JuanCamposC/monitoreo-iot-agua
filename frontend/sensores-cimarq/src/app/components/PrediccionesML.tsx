'use client';

import React, { useState, useEffect } from 'react';
import { useMLApi } from '../hooks/useMLApi';

interface PrediccionesMLProps {
  className?: string;
}

interface SensorData {
  exito: boolean;
  prediccion?: number;
  nivel_riesgo?: {
    nivel: string;
    color: string;
    mensaje: string;
    valor: number;
    unidad: string;
  };
  error?: string;
  datos_entrada?: number[];
  confidence?: number;
  tendencia?: {
    direction: string;
    change: number;
    change_percent: number;
    volatility: string;
  };
  analisis_datos?: {
    values_used: number[];
    data_points: number;
    current_avg: number;
    current_min: number;
    current_max: number;
    current_std: number;
    latest_value: number;
    oldest_value: number;
    data_range: number;
  };
  rendimiento_modelo?: {
    rmse: number;
    mae: number;
    mse: number;
    training_samples: number;
  };
}

const PrediccionesML: React.FC<PrediccionesMLProps> = ({ className = '' }) => {
  const { obtenerPredicciones, obtenerTodasPredicciones, entrenarModelos, verificarEstadoAPI, loading, error } = useMLApi();
  const [predicciones, setPredicciones] = useState<{[key: string]: SensorData}>({});
  const [alertasGeneradas, setAlertasGeneradas] = useState<any[]>([]);
  const [sensorSeleccionado, setSensorSeleccionado] = useState<string>('');
  const [epochsEntrenamiento, setEpochsEntrenamiento] = useState(50);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  const sensores = [
    { id: 'temperatura', nombre: 'Temperatura', icono: '🌡️', unidad: '°C' },
    { id: 'ph', nombre: 'pH', icono: '⚖️', unidad: 'pH' },
    { id: 'oxigeno', nombre: 'Oxígeno', icono: '💨', unidad: 'mg/L' }
  ];

  const cargarPredicciones = async () => {
    try {
      // Verificar disponibilidad de API ML primero
      console.log('🔍 Verificando disponibilidad de API ML...');
      let apiDisponible = false;
      
      try {
        const estadoAPI = await verificarEstadoAPI();
        apiDisponible = estadoAPI.status !== 'error';
        console.log(`📡 Estado API ML: ${apiDisponible ? 'Disponible' : 'No disponible'}`);
      } catch (error) {
        console.warn('⚠️ API ML no responde, usando modo fallback');
        apiDisponible = false;
      }
      
      if (!apiDisponible) {
        // Modo fallback: API ML no disponible
        const prediccionesFallback: Record<string, any> = {};
        
        ['temperatura', 'ph', 'oxigeno'].forEach(sensor => {
          prediccionesFallback[sensor] = {
            exito: false,
            error: 'API ML no disponible',
            nivel_riesgo: {
              nivel: 'error',
              color: 'orange',
              mensaje: 'Servicio ML fuera de línea',
              valor: 0,
              unidad: sensor === 'temperatura' ? '°C' : sensor === 'ph' ? 'pH' : 'mg/L'
            }
          };
        });
        
        setPredicciones(prediccionesFallback);
        setAlertasGeneradas([]);
        setUltimaActualizacion(new Date());
        return;
      }
      
      const prediccionesAdaptadas: Record<string, any> = {};

      if (sensorSeleccionado) {
        // Predicción para sensor específico
        try {
          const response = await obtenerPredicciones(sensorSeleccionado, 10);
          
          // Validar que prediction exista y no sea null
          if (response.prediction !== null && response.prediction !== undefined) {
            prediccionesAdaptadas[sensorSeleccionado] = {
              exito: true,
              prediccion: response.prediction,
              nivel_riesgo: {
                nivel: 'normal',
                color: 'green', 
                mensaje: `Predicción: ${response.prediction.toFixed(2)}`,
                valor: response.prediction,
                unidad: sensorSeleccionado === 'temperatura' ? '°C' : sensorSeleccionado === 'ph' ? 'pH' : 'mg/L'
              },
              confidence: response.confidence
            };
          } else {
            prediccionesAdaptadas[sensorSeleccionado] = {
              exito: false,
              error: `Datos insuficientes para ${sensorSeleccionado} (mínimo 10 registros)`,
              nivel_riesgo: {
                nivel: 'error',
                color: 'orange',
                mensaje: 'Datos insuficientes (mínimo 10 registros)',
                valor: 0,
                unidad: sensorSeleccionado === 'temperatura' ? '°C' : sensorSeleccionado === 'ph' ? 'pH' : 'mg/L'
              }
            };
          }
        } catch (sensorError: any) {
          console.error(`Error en predicción de ${sensorSeleccionado}:`, sensorError);
          
          // Determinar si el error es por falta de datos (400) o error del servidor
          const errorMsg = sensorError.message?.includes('400') 
            ? 'Datos insuficientes (mínimo 10 registros)'
            : `Error en predicción de ${sensorSeleccionado}`;
          
          prediccionesAdaptadas[sensorSeleccionado] = {
            exito: false,
            error: errorMsg,
            nivel_riesgo: {
              nivel: 'error',
              color: sensorError.message?.includes('400') ? 'orange' : 'red',
              mensaje: errorMsg,
              valor: 0,
              unidad: sensorSeleccionado === 'temperatura' ? '°C' : sensorSeleccionado === 'ph' ? 'pH' : 'mg/L'
            }
          };
        }
      } else {
        // Predicciones para todos los sensores usando el endpoint /predict/all
        try {
          const response = await obtenerTodasPredicciones();
          
          if (response.predictions) {
            // Procesar predicciones detalladas para cada sensor
            const sensores = ['temperatura', 'ph', 'oxigeno'];
            
            for (const sensor of sensores) {
              const prediccionData = response.predictions[sensor as keyof typeof response.predictions];
              
              // Validar que existan los datos y prediction no sea null
              if (prediccionData && prediccionData.prediction && prediccionData.prediction.value !== null && prediccionData.prediction.value !== undefined) {
                const unidad = sensor === 'temperatura' ? '°C' : sensor === 'ph' ? 'pH' : 'mg/L';
                
                prediccionesAdaptadas[sensor] = {
                  exito: true,
                  prediccion: prediccionData.prediction.value,
                  nivel_riesgo: {
                    nivel: prediccionData.prediction.confidence_level || 'low',
                    color: prediccionData.prediction.confidence_level === 'high' ? 'green' : 
                           prediccionData.prediction.confidence_level === 'medium' ? 'orange' : 'red',
                    mensaje: `Predicción: ${prediccionData.prediction.value.toFixed(2)} (${(prediccionData.prediction.confidence * 100).toFixed(1)}% confianza)`,
                    valor: prediccionData.prediction.value,
                    unidad: unidad
                  },
                  confidence: prediccionData.prediction.confidence,
                  tendencia: prediccionData.trend_analysis,
                  analisis_datos: prediccionData.data_analysis,
                  rendimiento_modelo: prediccionData.model_performance
                };
              } else {
                // Determinar el mensaje de error apropiado
                const errorMsg = prediccionData ? 'Datos insuficientes (mínimo 10 registros)' : 'Sin datos disponibles';
                const unidad = sensor === 'temperatura' ? '°C' : sensor === 'ph' ? 'pH' : 'mg/L';
                
                prediccionesAdaptadas[sensor] = {
                  exito: false,
                  error: errorMsg,
                  nivel_riesgo: {
                    nivel: 'error',
                    color: 'orange',
                    mensaje: errorMsg,
                    valor: 0,
                    unidad: unidad
                  }
                };
              }
            }
          }
        } catch (allError) {
          console.error('Error en predicciones generales:', allError);
          // Fallback: intentar predicciones individuales
          const sensoresData = ['temperatura', 'ph', 'oxigeno'];
          
          for (const sensor of sensoresData) {
            try {
              const response = await obtenerPredicciones(sensor, 10);
              
              // Validar que prediction exista y no sea null
              if (response.prediction !== null && response.prediction !== undefined) {
                prediccionesAdaptadas[sensor] = {
                  exito: true,
                  prediccion: response.prediction,
                  nivel_riesgo: {
                    nivel: 'normal',
                    color: 'green',
                    mensaje: `Predicción: ${response.prediction.toFixed(2)}`,
                    valor: response.prediction,
                    unidad: sensor === 'temperatura' ? '°C' : sensor === 'ph' ? 'pH' : 'mg/L'
                  },
                  confidence: response.confidence
                };
              } else {
                prediccionesAdaptadas[sensor] = {
                  exito: false,
                  error: `Datos insuficientes para ${sensor} (mínimo 10 registros)`,
                  nivel_riesgo: {
                    nivel: 'error',
                    color: 'orange',
                    mensaje: 'Datos insuficientes (mínimo 10 registros)',
                    valor: 0,
                    unidad: sensor === 'temperatura' ? '°C' : sensor === 'ph' ? 'pH' : 'mg/L'
                  }
                };
              }
            } catch (sensorError: any) {
              console.error(`Error en predicción individual de ${sensor}:`, sensorError);
              
              // Determinar si el error es por falta de datos (400) o error del servidor
              const errorMsg = sensorError.message?.includes('400') 
                ? 'Datos insuficientes (mínimo 10 registros)'
                : `Error en predicción de ${sensor}`;
              
              prediccionesAdaptadas[sensor] = {
                exito: false,
                error: errorMsg,
                nivel_riesgo: {
                  nivel: 'error',
                  color: sensorError.message?.includes('400') ? 'orange' : 'red',
                  mensaje: errorMsg,
                  valor: 0,
                  unidad: sensor === 'temperatura' ? '°C' : sensor === 'ph' ? 'pH' : 'mg/L'
                }
              };
            }
          }
        }
      }
      
      setPredicciones(prediccionesAdaptadas);
      setAlertasGeneradas([]);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error('Error cargando predicciones:', err);
      setPredicciones({});
    }
  };

  const entrenarModelosHandler = async () => {
    try {
      console.log(`🎓 Iniciando entrenamiento${sensorSeleccionado ? ` para ${sensorSeleccionado}` : ' de todos los parámetros'}...`);
      const response = await entrenarModelos(sensorSeleccionado || undefined);
      
      if (response.status === 'success' || response.status === 'completed' || response.message) {
        console.log('✅ Entrenamiento completado:', response.message);
        
        // Mostrar información de configuración de entrenamiento
        if (response.training_info) {
          console.log('⚙️ Configuración de entrenamiento:', {
            datos_usados: response.training_info.data_used_for_training,
            minimo_requerido: response.training_info.minimum_data_required,
            window_size: response.training_info.window_size_default,
            secuencias_creadas: response.training_info.sequences_created_per_param
          });
        }
        
        // Mostrar información detallada si está disponible
        if (response.summary) {
          console.log('📊 Resumen del entrenamiento:', {
            modelos_exitosos: response.summary.successful_models,
            tasa_exito: `${response.summary.success_rate * 100}%`,
            tiempo_total: `${response.summary.total_training_time}s`,
            limitacion_datos: response.summary.data_limitation
          });
        }
        
        if (response.detailed_results) {
          Object.entries(response.detailed_results).forEach(([sensor, details]) => {
            console.log(`🔬 ${sensor.toUpperCase()}:`, {
              datos_utilizados: details.training_data_used?.length || details.data_stats?.count,
              valores_entrenamiento: details.training_data_used,
              secuencias_creadas: details.training_config?.sequences_created,
              rmse: details.performance_metrics?.rmse?.toFixed(4),
              mae: details.performance_metrics?.mae?.toFixed(4)
            });
          });
        }
        
        // Recargar predicciones después del entrenamiento
        await cargarPredicciones();
      }
    } catch (err) {
      console.error('❌ Error entrenando modelos:', err);
    }
  };

  useEffect(() => {
    cargarPredicciones();
  }, [sensorSeleccionado]);

  const getNivelRiesgoStyle = (nivel: string) => {
    switch (nivel) {
      case 'CRITICO':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'ADVERTENCIA':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'NORMAL':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getNivelRiesgoIcon = (nivel: string) => {
    switch (nivel) {
      case 'CRITICO': return '🚨';
      case 'ADVERTENCIA': return '⚠️';
      case 'NORMAL': return '✅';
      default: return '❓';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            🔮 Predicciones Machine Learning
          </h3>
          <button
            onClick={cargarPredicciones}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '🔄' : '↻'} Actualizar
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Controles */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sensor
              </label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                <span className="font-semibold">Todos los sensores</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Épocas de entrenamiento
              </label>
              <input
                type="number"
                min="10"
                max="200"
                step="10"
                value={epochsEntrenamiento}
                onChange={(e) => setEpochsEntrenamiento(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={entrenarModelosHandler}
                disabled={loading}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? '🔄 Entrenando...' : '🎓 Entrenar Modelos'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">❌ Error: {error}</p>
          </div>
        )}

        {/* Alerta de datos insuficientes */}
        {Object.keys(predicciones).length > 0 && 
         Object.values(predicciones).some((p: any) => p.error?.includes('insuficientes')) && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-300 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="font-semibold text-orange-800 mb-1">Datos Insuficientes</h4>
                <p className="text-sm text-orange-700 mb-2">
                  Algunos sensores no tienen suficientes datos para hacer predicciones.
                </p>
                <div className="text-xs text-orange-600 space-y-1">
                  <div>• <strong>Mínimo requerido:</strong> 10 registros por sensor</div>
                  <div>• <strong>Solución:</strong> Ingresa más datos manualmente o espera que el simulador MQTT genere más lecturas</div>
                  <div>• <strong>Tip:</strong> Ve a "Sensores → Ingreso Manual" para agregar datos</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Información de entrenamiento */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
            📚 Información de Entrenamiento
          </h3>
          <div className="text-xs text-blue-600 space-y-1">
            <div>• <strong>Datos para entrenamiento:</strong> 10 registros más recientes por sensor</div>
            <div>• <strong>Mínimo requerido:</strong> 10 datos por parámetro</div>
            <div>• <strong>Window Size (por defecto):</strong> 5 valores por secuencia</div>
            <div>• <strong>Secuencias creadas:</strong> 5 secuencias por parámetro (10 - 5 = 5)</div>
            <div>• <strong>Ventaja:</strong> Entrenamiento optimizado con datos recientes</div>
          </div>
        </div>

        {/* Predicciones */}
        {Object.keys(predicciones).length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              📊 Resultados de Predicciones
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sensores.map(sensor => {
                const data = predicciones[sensor.id];
                if (!data) return null;

                return (
                  <div key={sensor.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{sensor.icono}</span>
                      <h5 className="font-medium text-gray-900">{sensor.nombre}</h5>
                    </div>

                    {data.exito ? (
                      <div className="space-y-3">
                        {/* Valor Predicho */}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {data.prediccion?.toFixed(2)} {sensor.unidad}
                          </div>
                          <div className="text-sm text-gray-500">Valor predicho</div>
                          {data.confidence && (
                            <div className="text-xs text-gray-400">
                              Confianza: {(data.confidence * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>

                        {/* Nivel de Riesgo */}
                        {data.nivel_riesgo && (
                          <div className={`p-2 rounded-lg border text-center ${getNivelRiesgoStyle(data.nivel_riesgo.nivel)}`}>
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <span>{getNivelRiesgoIcon(data.nivel_riesgo.nivel)}</span>
                              <span className="font-medium">{data.nivel_riesgo.nivel}</span>
                            </div>
                            <div className="text-xs">{data.nivel_riesgo.mensaje}</div>
                          </div>
                        )}

                        {/* Tendencia */}
                        {data.tendencia && (
                          <div className="bg-blue-50 p-2 rounded text-xs">
                            <div className="font-medium text-blue-800 mb-1">📈 Tendencia</div>
                            {data.tendencia.direction && (
                              <div className="text-blue-700">
                                Dirección: {data.tendencia.direction === 'up' ? '↗️ Subiendo' : 
                                          data.tendencia.direction === 'down' ? '↘️ Bajando' : 
                                          '➡️ Estable'}
                              </div>
                            )}
                            {data.tendencia.change_percent !== undefined && (
                              <div className="text-blue-600">
                                Cambio: {data.tendencia.change_percent.toFixed(1)}%
                              </div>
                            )}
                            {data.tendencia.volatility && (
                              <div className="text-blue-600">
                                Volatilidad: {data.tendencia.volatility}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Análisis de Datos */}
                        {data.analisis_datos && (
                          <div className="bg-green-50 p-2 rounded text-xs">
                            <div className="font-medium text-green-800 mb-1">🔍 Análisis</div>
                            <div className="grid grid-cols-2 gap-1 text-green-700 text-xs">
                              {data.analisis_datos.data_points !== undefined && (
                                <div>Puntos: {data.analisis_datos.data_points}</div>
                              )}
                              {data.analisis_datos.current_avg !== undefined && (
                                <div>Promedio: {data.analisis_datos.current_avg.toFixed(2)}</div>
                              )}
                              {data.analisis_datos.current_min !== undefined && (
                                <div>Mín: {data.analisis_datos.current_min.toFixed(2)}</div>
                              )}
                              {data.analisis_datos.current_max !== undefined && (
                                <div>Máx: {data.analisis_datos.current_max.toFixed(2)}</div>
                              )}
                              {data.analisis_datos.current_std !== undefined && (
                                <div>Desv: {data.analisis_datos.current_std.toFixed(3)}</div>
                              )}
                              {data.analisis_datos.data_range !== undefined && (
                                <div>Rango: {data.analisis_datos.data_range.toFixed(3)}</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Rendimiento del Modelo */}
                        {data.rendimiento_modelo && (
                          <div className="bg-purple-50 p-2 rounded text-xs">
                            <div className="font-medium text-purple-800 mb-1">🎯 Modelo</div>
                            <div className="grid grid-cols-2 gap-1 text-purple-700">
                              {data.rendimiento_modelo.rmse !== undefined && (
                                <div>RMSE: {data.rendimiento_modelo.rmse.toFixed(2)}</div>
                              )}
                              {data.rendimiento_modelo.mae !== undefined && (
                                <div>MAE: {data.rendimiento_modelo.mae.toFixed(2)}</div>
                              )}
                              {data.rendimiento_modelo.mse !== undefined && (
                                <div>MSE: {data.rendimiento_modelo.mse.toFixed(2)}</div>
                              )}
                              {data.rendimiento_modelo.training_samples !== undefined && (
                                <div>Muestras: {data.rendimiento_modelo.training_samples}</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Datos de Entrada */}
                        {data.datos_entrada && (
                          <div className="text-xs text-gray-500">
                            <div className="font-medium mb-1">Datos de entrada:</div>
                            <div className="flex flex-wrap gap-1">
                              {data.datos_entrada.map((valor, index) => (
                                <span key={index} className="bg-gray-100 px-1 rounded">
                                  {valor.toFixed(1)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        {data.error?.includes('insuficientes') ? (
                          <>
                            <div className="text-3xl mb-2">📊</div>
                            <div className="text-sm font-medium text-orange-600 mb-1">
                              Datos Insuficientes
                            </div>
                            <div className="text-xs text-orange-500 mb-2">
                              Mínimo 10 registros
                            </div>
                            <div className="text-xs text-gray-500">
                              {data.error}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-red-500 mb-2">❌</div>
                            <div className="text-sm text-red-600">
                              {data.error || 'Error en predicción'}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Alertas Generadas */}
        {alertasGeneradas.length > 0 && (
          <div className="mt-6 space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              🚨 Alertas Generadas
            </h4>
            <div className="space-y-2">
              {alertasGeneradas.map((alerta, index) => (
                <div key={index} className={`p-3 rounded-lg border ${getNivelRiesgoStyle(alerta.nivel)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span>{getNivelRiesgoIcon(alerta.nivel)}</span>
                      <div>
                        <div className="font-medium">
                          {sensores.find(s => s.id === alerta.sensor)?.nombre} - {alerta.nivel}
                        </div>
                        <div className="text-sm">{alerta.mensaje}</div>
                        <div className="text-xs">
                          Valor predicho: {alerta.valor_predicho?.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {alerta.alerta_id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Información de actualización */}
        {ultimaActualizacion && (
          <div className="mt-4 pt-4 border-t text-sm text-gray-500 text-center">
            Última actualización: {ultimaActualizacion.toLocaleString('es-CL')}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrediccionesML;