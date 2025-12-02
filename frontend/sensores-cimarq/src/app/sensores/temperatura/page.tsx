'use client';

import { useState, useEffect } from 'react';
import TemperatureChart from '../../components/graficos/TemperaturaChart';
import { useConfiguracionRangos } from '../../hooks/useConfiguracionRangos';
import { useNombreSistema } from '../../hooks/useNombreSistema';
import DynamicTitle from '../../components/DynamicTitle';
import InfoRangos from '../../components/InfoRangos';
import { MdThermostat } from 'react-icons/md';
import { apiRequestJson } from '../../config/api';

interface TemperaturaData {
  _id: string;
  temperatura?: number;
  valor?: number;
  fecha: string;
  timestamp?: string;
}

export default function TemperaturaPage() {
  const [temperaturaActual, setTemperaturaActual] = useState<number | null>(null);
  const [historial, setHistorial] = useState<TemperaturaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { evaluarEstadoSensor, configuracion } = useConfiguracionRangos();
  const nombreSistema = useNombreSistema();

  useEffect(() => {
    const fetchTemperatura = async () => {
      try {
        const data = await apiRequestJson<any>('/api/v1/temperatura');
        
        if (data.success) {
          const temperaturas = data.data;
          
          // Ordenar por fecha descendente (más reciente primero)
          const temperaturasOrdenadas = temperaturas.sort((a: TemperaturaData, b: TemperaturaData) => {
            const fechaA = new Date(a.fecha || a.timestamp || 0);
            const fechaB = new Date(b.fecha || b.timestamp || 0);
            return fechaB.getTime() - fechaA.getTime();
          });
          
          setHistorial(temperaturasOrdenadas);
          
          // Obtener la temperatura más reciente
          if (temperaturasOrdenadas.length > 0) {
            const ultimaTemperatura = temperaturasOrdenadas[0];
            setTemperaturaActual(ultimaTemperatura.temperatura || ultimaTemperatura.valor || 0);
          }
          setError(null);
        } else {
          setError('Error al cargar datos');
        }
      } catch (err) {
        setError('Error de conexión con la API');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemperatura();

    // Actualizar datos cada 5 segundos
    const interval = setInterval(fetchTemperatura, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const formatFecha = (fecha: string) => {
    if (!fecha) return 'Fecha no disponible';
    const date = new Date(fecha);
    
    // Verificar si la fecha es válida
    if (isNaN(date.getTime())) return 'Fecha inválida';
    
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getEstadoColor = (temperatura: number) => {
    const estado = evaluarEstadoSensor('temperatura', temperatura);
    const colorMap: Record<string, string> = {
      'critico': 'bg-red-100 text-red-800',
      'aceptable': 'bg-yellow-100 text-yellow-800',
      'optimo': 'bg-green-100 text-green-800'
    };
    return colorMap[estado] || 'bg-gray-100 text-gray-800';
  };

  const getEstadoTexto = (temperatura: number) => {
    const estado = evaluarEstadoSensor('temperatura', temperatura);
    return estado.charAt(0).toUpperCase() + estado.slice(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gray-100 p-6 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando datos de temperatura...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center bg-gray-100 p-6 min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-xl">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 p-6 min-h-screen">
      <DynamicTitle pageName="Sensor de Temperatura" />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Temperatura - {nombreSistema}</h1>
        
        {/* Información de rangos configurados */}
        <InfoRangos
          titulo="Sensor de Temperatura"
          valorActual={temperaturaActual}
          rango={configuracion.temperatura}
          estado={temperaturaActual !== null ? evaluarEstadoSensor('temperatura', temperaturaActual) : 'critico'}
          unidad="°C"
          icono={MdThermostat}
          colorBase="#ff5722"
        />

        {/* Gráfico histórico (prioridad principal) */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Análisis Histórico de Temperatura</h2>
          <TemperatureChart data={historial} title="Variaciones de Temperatura en el Tiempo" />
        </div>

        {/* Grid con historial detallado y lectura actual */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Historial detallado (2/3 del espacio) */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-700">
                Registro Histórico ({historial.length} lecturas)
              </h3>
              <div className="text-xs text-gray-500">
                Ordenado por fecha (más reciente primero)
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {historial.length > 0 ? (
                historial.map((item, index) => {
                  const fechaObj = new Date(item.fecha || item.timestamp || '');
                  const esReciente = index < 3; // Marcar las 3 más recientes
                  
                  return (
                    <div key={item._id} className={`flex justify-between items-center py-3 px-4 border-b hover:bg-gray-50 rounded ${esReciente ? 'bg-blue-50 border-blue-200' : ''}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700 text-sm font-medium">
                            {formatFecha(item.fecha || item.timestamp || '')}
                          </span>
                          {index === 0 && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                              MÁS RECIENTE
                            </span>
                          )}
                          {esReciente && index > 0 && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                              RECIENTE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Hace {Math.floor((Date.now() - fechaObj.getTime()) / (1000 * 60))} min | Registro #{historial.length - index}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-blue-600 text-lg">
                          {Number(item.temperatura || item.valor || 0).toFixed(1)}°C
                        </span>
                        <span className={`${getEstadoColor(Number(item.temperatura || item.valor || 0))} px-2 py-1 rounded-full text-xs font-medium`}>
                          {getEstadoTexto(Number(item.temperatura || item.valor || 0))}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-500 py-8">
                  No hay datos históricos disponibles
                </div>
              )}
            </div>
          </div>

          {/* Lectura actual (1/3 del espacio) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Lectura Actual</h2>
              <div className={`${temperaturaActual ? getEstadoColor(temperaturaActual) : 'bg-gray-100 text-gray-800'} px-3 py-1 rounded-full text-sm font-medium`}>
                {temperaturaActual ? getEstadoTexto(temperaturaActual) : 'Sin Datos'}
              </div>
            </div>
            
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {temperaturaActual ? `${Number(temperaturaActual).toFixed(1)}` : 'Sin Datos'}
              </div>
              <div className="text-lg text-gray-500 mb-1">°C</div>
              <p className="text-xs text-gray-500">
                {historial.length > 0 ? 
                  `${formatFecha(historial[0]?.fecha || historial[0]?.timestamp || '')}` : 
                  'Sin datos disponibles'
                }
              </p>
            </div>

            {/* Termómetro visual con rangos configurados */}
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Escala de Temperatura:</div>
              <div className="relative h-4 rounded-full overflow-hidden border border-gray-200">
                {/* Fondo con zonas de color según rangos configurados */}
                <div className="absolute inset-0 flex">
                  {(() => {
                    const rangoTotal = configuracion.temperatura.maximo - configuracion.temperatura.minimo;
                    const anchoCriticoBajo = ((configuracion.temperatura.minimoOptimo - configuracion.temperatura.minimo) / rangoTotal) * 50; // 50% para la mitad izquierda
                    const anchoOptimo = ((configuracion.temperatura.maximoOptimo - configuracion.temperatura.minimoOptimo) / rangoTotal) * 100;
                    const anchoCriticoAlto = ((configuracion.temperatura.maximo - configuracion.temperatura.maximoOptimo) / rangoTotal) * 50; // 50% para la mitad derecha
                    const anchoAceptableBajo = 50 - anchoCriticoBajo;
                    const anchoAceptableAlto = 50 - anchoCriticoAlto;
                    
                    return (
                      <>
                        {/* Zona crítica baja */}
                        <div 
                          className="bg-red-400" 
                          style={{ 
                            width: `${anchoCriticoBajo}%`
                          }}
                        ></div>
                        {/* Zona aceptable baja */}
                        <div 
                          className="bg-yellow-400" 
                          style={{ 
                            width: `${anchoAceptableBajo}%`
                          }}
                        ></div>
                        {/* Zona óptima */}
                        <div 
                          className="bg-green-400" 
                          style={{ 
                            width: `${anchoOptimo}%`
                          }}
                        ></div>
                        {/* Zona aceptable alta */}
                        <div 
                          className="bg-yellow-400" 
                          style={{ 
                            width: `${anchoAceptableAlto}%`
                          }}
                        ></div>
                        {/* Zona crítica alta */}
                        <div 
                          className="bg-red-400" 
                          style={{ 
                            width: `${anchoCriticoAlto}%`
                          }}
                        ></div>
                      </>
                    );
                  })()}
                </div>
                
                {/* Indicador de temperatura actual */}
                {temperaturaActual && (
                  <div 
                    className="absolute top-0 w-1 h-4 bg-black shadow-lg" 
                    style={{ 
                      left: `${Math.max(0, Math.min(100, ((temperaturaActual - configuracion.temperatura.minimo) / (configuracion.temperatura.maximo - configuracion.temperatura.minimo)) * 100))}%` 
                    }}
                  ></div>
                )}
              </div>
              
              {/* Etiquetas de valores con posiciones dinámicas */}
              <div className="relative mt-1 h-4">
                <span 
                  className="absolute text-xs text-gray-500 transform -translate-x-1/2" 
                  style={{ left: '0%' }}
                >
                  {configuracion.temperatura.minimo}°C
                </span>
                <span 
                  className="absolute text-xs text-yellow-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${((configuracion.temperatura.minimoOptimo - configuracion.temperatura.minimo) / (configuracion.temperatura.maximo - configuracion.temperatura.minimo)) * 100}%` 
                  }}
                >
                  {configuracion.temperatura.minimoOptimo}°C
                </span>
                <span 
                  className="absolute text-xs text-green-600 font-bold transform -translate-x-1/2" 
                  style={{ 
                    left: `${((configuracion.temperatura.minimoOptimo + configuracion.temperatura.maximoOptimo) / 2 - configuracion.temperatura.minimo) / (configuracion.temperatura.maximo - configuracion.temperatura.minimo) * 100}%` 
                  }}
                >
                  ÓPTIMO
                </span>
                <span 
                  className="absolute text-xs text-yellow-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${((configuracion.temperatura.maximoOptimo - configuracion.temperatura.minimo) / (configuracion.temperatura.maximo - configuracion.temperatura.minimo)) * 100}%` 
                  }}
                >
                  {configuracion.temperatura.maximoOptimo}°C
                </span>
                <span 
                  className="absolute text-xs text-gray-500 transform -translate-x-1/2" 
                  style={{ left: '100%' }}
                >
                  {configuracion.temperatura.maximo}°C
                </span>
              </div>
              
              {/* Etiquetas de zonas con posiciones dinámicas */}
              <div className="relative mt-2 h-4">
                <span 
                  className="absolute text-xs text-red-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${((configuracion.temperatura.minimo + configuracion.temperatura.minimoOptimo) / 2 - configuracion.temperatura.minimo) / (configuracion.temperatura.maximo - configuracion.temperatura.minimo) * 50}%` 
                  }}
                >
                  Crítico
                </span>
                <span 
                  className="absolute text-xs text-yellow-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${25 + ((configuracion.temperatura.minimoOptimo - configuracion.temperatura.minimo) / (configuracion.temperatura.maximo - configuracion.temperatura.minimo)) * 25}%` 
                  }}
                >
                  Aceptable
                </span>
                <span 
                  className="absolute text-xs text-yellow-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${75 - ((configuracion.temperatura.maximo - configuracion.temperatura.maximoOptimo) / (configuracion.temperatura.maximo - configuracion.temperatura.minimo)) * 25}%` 
                  }}
                >
                  Aceptable
                </span>
                <span 
                  className="absolute text-xs text-red-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${50 + ((configuracion.temperatura.maximoOptimo + configuracion.temperatura.maximo) / 2 - configuracion.temperatura.minimo) / (configuracion.temperatura.maximo - configuracion.temperatura.minimo) * 50}%` 
                  }}
                >
                  Crítico
                </span>
              </div>
            </div>

            {/* Estadísticas del historial */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Promedio:</span>
                <span className="font-medium text-blue-600">
                  {historial.length > 0 ? 
                    (historial.reduce((sum, item) => sum + Number(item.temperatura || item.valor || 0), 0) / historial.length).toFixed(1) + '°C' : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Máximo:</span>
                <span className="font-medium text-red-600">
                  {historial.length > 0 ? 
                    Math.max(...historial.map(item => Number(item.temperatura || item.valor || 0))).toFixed(1) + '°C' : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Mínimo:</span>
                <span className="font-medium text-blue-600">
                  {historial.length > 0 ? 
                    Math.min(...historial.map(item => Number(item.temperatura || item.valor || 0))).toFixed(1) + '°C' : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Total Registros:</span>
                <span className="font-medium text-gray-600">{historial.length}</span>
              </div>
            </div>
            
            <div className="mt-4 text-xs text-gray-500 text-center border-t pt-2">
              Actualización automática cada 5 segundos
            </div>
          </div>
        </div>

        {/* Información técnica actualizada con rangos configurados */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Información Técnica del Sensor</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-600">Termómetro SIMULADO</p>
              <p className="text-sm text-gray-600">Tipo de Sensor</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">±0.1°C</p>
              <p className="text-sm text-gray-600">Precisión</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-lg font-bold text-red-600">
                {configuracion.temperatura.minimo}°C - {configuracion.temperatura.maximo}°C
              </p>
              <p className="text-sm text-gray-600">Rango Crítico</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">
                {configuracion.temperatura.minimoOptimo}°C - {configuracion.temperatura.maximoOptimo}°C
              </p>
              <p className="text-sm text-gray-600">Rango Óptimo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}