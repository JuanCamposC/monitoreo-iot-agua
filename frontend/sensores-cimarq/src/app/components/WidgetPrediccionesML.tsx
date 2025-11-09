'use client';

import React, { useState, useEffect } from 'react';
import { useMLApi } from '../hooks/useMLApi';

interface WidgetPrediccionesMLProps {
  className?: string;
}

const WidgetPrediccionesML: React.FC<WidgetPrediccionesMLProps> = ({ className = '' }) => {
  const { verificarEstadoAPI, obtenerTodasPredicciones, loading } = useMLApi();
  const [predicciones, setPredicciones] = useState<any>({});
  const [estadoAPI, setEstadoAPI] = useState<any>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  const sensores = [
    { id: 'temperatura', nombre: 'Temperatura', icono: '🌡️', unidad: '°C' },
    { id: 'ph', nombre: 'pH', icono: '⚖️', unidad: 'pH' },
    { id: 'oxigeno', nombre: 'Oxígeno', icono: '💨', unidad: 'mg/L' }
  ];

  const cargarDatos = async () => {
    try {
      // Verificar estado de API primero
      const estado = await verificarEstadoAPI();
      setEstadoAPI(estado);

      if (estado.status === 'healthy') {
        // Usar el endpoint automático para obtener todas las predicciones
        try {
          const response = await obtenerTodasPredicciones();
          const prediccionesAdaptadas: Record<string, any> = {};
          const sensoresData = ['temperatura', 'ph', 'oxigeno'];
          
          if (response.predictions) {
            // Procesar predicciones detalladas para cada sensor
            const sensores = ['temperatura', 'ph', 'oxigeno'];
            
            for (const sensor of sensores) {
              const prediccionData = response.predictions[sensor as keyof typeof response.predictions];
              
              if (prediccionData) {
                const unidad = sensor === 'temperatura' ? '°C' : sensor === 'ph' ? 'pH' : 'mg/L';
                
                prediccionesAdaptadas[sensor] = {
                  exito: true,
                  prediccion: prediccionData.prediction.value,
                  nivel_riesgo: {
                    nivel: prediccionData.prediction.confidence_level,
                    color: prediccionData.prediction.confidence_level === 'high' ? 'green' : 
                           prediccionData.prediction.confidence_level === 'medium' ? 'orange' : 'red',
                    mensaje: `${prediccionData.prediction.value.toFixed(2)} ${unidad} (${(prediccionData.prediction.confidence * 100).toFixed(0)}%)`,
                    valor: prediccionData.prediction.value,
                    unidad: unidad
                  },
                  confidence: prediccionData.prediction.confidence,
                  tendencia: prediccionData.trend_analysis
                };
              }
            }
          }
          
          setPredicciones(prediccionesAdaptadas);
          setUltimaActualizacion(new Date());
        } catch (predError) {
          console.error('Error obteniendo predicciones:', predError);
        }
      }
    } catch (err) {
      console.error('Error cargando datos ML:', err);
    }
  };

  useEffect(() => {
    cargarDatos();
    
    // Auto-refresh cada 5 minutos
    const interval = setInterval(cargarDatos, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getNivelRiesgoColor = (nivel: string) => {
    switch (nivel) {
      case 'CRITICO': return 'text-red-600';
      case 'ADVERTENCIA': return 'text-yellow-600';
      case 'NORMAL': return 'text-green-600';
      default: return 'text-gray-600';
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

  const apiDisponible = estadoAPI?.status === 'healthy';

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            🔮 Predicciones ML
          </h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              apiDisponible ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <span className="text-xs text-gray-500">
              {apiDisponible ? 'API Activa' : 'API Inactiva'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        {!apiDisponible ? (
          <div className="text-center py-6">
            <div className="text-gray-400 mb-2">🤖</div>
            <div className="text-sm text-gray-500 mb-2">
              API Machine Learning no disponible
            </div>
            <div className="text-xs text-gray-400">
              {estadoAPI ? `Estado: ${estadoAPI.status} | BD: ${estadoAPI.database}` : 'Verificando conexión...'}
            </div>
          </div>
        ) : loading ? (
          <div className="text-center py-6">
            <div className="text-gray-400 mb-2">🔄</div>
            <div className="text-sm text-gray-500">
              Cargando predicciones...
            </div>
          </div>
        ) : Object.keys(predicciones).length === 0 ? (
          <div className="text-center py-6">
            <div className="text-gray-400 mb-2">📊</div>
            <div className="text-sm text-gray-500">
              No hay predicciones disponibles
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sensores.map(sensor => {
              const data = predicciones[sensor.id];
              if (!data || !data.exito) return null;

              return (
                <div key={sensor.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{sensor.icono}</span>
                      <div>
                        <div className="font-medium text-gray-900">{sensor.nombre}</div>
                        <div className="text-sm text-gray-600">
                          {data.prediccion?.toFixed(2)} {sensor.unidad}
                        </div>
                      </div>
                    </div>
                    
                    {data.nivel_riesgo && (
                      <div className="flex items-center gap-2">
                        <span>{getNivelRiesgoIcon(data.nivel_riesgo.nivel)}</span>
                        <span className={`text-sm font-medium ${getNivelRiesgoColor(data.nivel_riesgo.nivel)}`}>
                          {data.nivel_riesgo.nivel}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Información adicional */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      {data.confidence && (
                        <span>💯 {(data.confidence * 100).toFixed(0)}%</span>
                      )}
                      {data.tendencia && (
                        <span>
                          {data.tendencia.direction === 'up' ? '↗️' : 
                           data.tendencia.direction === 'down' ? '↘️' : '➡️'}
                          {Math.abs(data.tendencia.change_percent).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Última actualización */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {ultimaActualizacion
                    ? `Actualizado: ${ultimaActualizacion.toLocaleTimeString('es-CL')}`
                    : 'Sin actualizaciones'
                  }
                </span>
                <button
                  onClick={cargarDatos}
                  disabled={loading}
                  className="hover:text-blue-600 disabled:opacity-50"
                >
                  {loading ? '🔄' : '↻'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WidgetPrediccionesML;