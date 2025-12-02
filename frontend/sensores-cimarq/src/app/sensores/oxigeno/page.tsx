'use client';

import { useState, useEffect } from 'react';
import OxigenoChart from '../../components/graficos/OxigenoChart';
import { useConfiguracionRangos } from '../../hooks/useConfiguracionRangos';
import { useNombreSistema } from '../../hooks/useNombreSistema';
import DynamicTitle from '../../components/DynamicTitle';
import InfoRangos from '../../components/InfoRangos';
import { MdAir } from 'react-icons/md';
import { apiRequestJson } from '../../config/api';

interface OxigenoData {
  _id: string;
  oxigeno?: number;
  valor?: number;
  fecha: string;
  timestamp?: string;
}

export default function OxigenoPage() {
  const [oxigenoActual, setOxigenoActual] = useState<number | null>(null);
  const [historial, setHistorial] = useState<OxigenoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { evaluarEstadoSensor, configuracion } = useConfiguracionRangos();
  const nombreSistema = useNombreSistema();

  useEffect(() => {
    const fetchOxigeno = async () => {
      try {
        const data = await apiRequestJson<any>('/api/v1/oxigeno');
        
        if (data.success) {
          const oxigenos = data.data;
          
          // Ordenar por fecha descendente (más reciente primero)
          const oxigenosOrdenados = oxigenos.sort((a: OxigenoData, b: OxigenoData) => {
            const fechaA = new Date(a.fecha || a.timestamp || 0);
            const fechaB = new Date(b.fecha || b.timestamp || 0);
            return fechaB.getTime() - fechaA.getTime();
          });
          
          setHistorial(oxigenosOrdenados);
          
          // Obtener el oxígeno más reciente
          if (oxigenosOrdenados.length > 0) {
            const ultimoOxigeno = oxigenosOrdenados[0];
            setOxigenoActual(ultimoOxigeno.oxigeno || ultimoOxigeno.valor || 0);
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

    fetchOxigeno();

    // Actualizar datos cada 5 segundos
    const interval = setInterval(fetchOxigeno, 5000);
    
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

  const getEstadoColor = (oxigeno: number) => {
    const estado = evaluarEstadoSensor('oxigeno', oxigeno);
    const colorMap: Record<string, string> = {
      'Critico': 'bg-red-100 text-red-800',
      'aceptable': 'bg-yellow-100 text-yellow-800',
      'optimo': 'bg-green-100 text-green-800'
    };
    return colorMap[estado] || 'bg-gray-100 text-gray-800';
  };

  const getEstadoTexto = (oxigeno: number) => {
    const estado = evaluarEstadoSensor('oxigeno', oxigeno);
    return estado.charAt(0).toUpperCase() + estado.slice(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gray-100 p-6 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando datos de oxígeno disuelto...</p>
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
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 p-6 min-h-screen">
      <DynamicTitle pageName="Sensor de Oxígeno" />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Oxígeno - {nombreSistema}</h1>
        
        {/* Información de rangos configurados */}
        <InfoRangos
          titulo="Sensor de Oxígeno Disuelto"
          valorActual={oxigenoActual}
          rango={configuracion.oxigeno}
          estado={oxigenoActual !== null ? evaluarEstadoSensor('oxigeno', oxigenoActual) : 'critico'}
          unidad="mg/L"
          icono={MdAir}
          colorBase="#4caf50"
        />

        {/* Gráfico histórico (prioridad principal) */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Análisis Histórico de Oxígeno Disuelto</h2>
          <OxigenoChart data={historial} title="Tendencias de Oxígeno en el Tiempo" />
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
                        <span className="font-bold text-green-600 text-lg">
                          {Number(item.oxigeno || item.valor || 0).toFixed(2)} mg/L
                        </span>
                        <span className={`${getEstadoColor(Number(item.oxigeno || item.valor || 0))} px-2 py-1 rounded-full text-xs font-medium`}>
                          {getEstadoTexto(Number(item.oxigeno || item.valor || 0))}
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
              <div className={`${oxigenoActual ? getEstadoColor(oxigenoActual) : 'bg-gray-100 text-gray-800'} px-3 py-1 rounded-full text-sm font-medium`}>
                {oxigenoActual ? getEstadoTexto(oxigenoActual) : 'Sin Datos'}
              </div>
            </div>
            
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {oxigenoActual ? `${Number(oxigenoActual).toFixed(2)}` : 'Sin Datos'}
              </div>
              <div className="text-lg text-gray-500 mb-1">mg/L</div>
              <p className="text-xs text-gray-500">
                {historial.length > 0 ? 
                  `${formatFecha(historial[0]?.fecha || historial[0]?.timestamp || '')}` : 
                  'Sin datos disponibles'
                }
              </p>
            </div>

            {/* Escala de Oxígeno visual con rangos configurados */}
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Escala de Oxígeno Disuelto:</div>
              <div className="relative h-4 rounded-full overflow-hidden border border-gray-200">
                {/* Fondo con zonas de color según rangos configurados */}
                <div className="absolute inset-0 flex">
                  {(() => {
                    const rangoTotal = configuracion.oxigeno.maximo - configuracion.oxigeno.minimo;
                    const anchoCriticoBajo = ((configuracion.oxigeno.minimoOptimo - configuracion.oxigeno.minimo) / rangoTotal) * 50;
                    const anchoOptimo = ((configuracion.oxigeno.maximoOptimo - configuracion.oxigeno.minimoOptimo) / rangoTotal) * 100;
                    const anchoCriticoAlto = ((configuracion.oxigeno.maximo - configuracion.oxigeno.maximoOptimo) / rangoTotal) * 50;
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
                
                {/* Indicador de oxígeno actual */}
                {oxigenoActual && (
                  <div 
                    className="absolute top-0 w-1 h-4 bg-black shadow-lg" 
                    style={{ 
                      left: `${Math.max(0, Math.min(100, ((oxigenoActual - configuracion.oxigeno.minimo) / (configuracion.oxigeno.maximo - configuracion.oxigeno.minimo)) * 100))}%` 
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
                  {configuracion.oxigeno.minimo}
                </span>
                <span 
                  className="absolute text-xs text-yellow-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${((configuracion.oxigeno.minimoOptimo - configuracion.oxigeno.minimo) / (configuracion.oxigeno.maximo - configuracion.oxigeno.minimo)) * 100}%` 
                  }}
                >
                  {configuracion.oxigeno.minimoOptimo}
                </span>
                <span 
                  className="absolute text-xs text-green-600 font-bold transform -translate-x-1/2" 
                  style={{ 
                    left: `${((configuracion.oxigeno.minimoOptimo + configuracion.oxigeno.maximoOptimo) / 2 - configuracion.oxigeno.minimo) / (configuracion.oxigeno.maximo - configuracion.oxigeno.minimo) * 100}%` 
                  }}
                >
                  ÓPTIMO
                </span>
                <span 
                  className="absolute text-xs text-yellow-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${((configuracion.oxigeno.maximoOptimo - configuracion.oxigeno.minimo) / (configuracion.oxigeno.maximo - configuracion.oxigeno.minimo)) * 100}%` 
                  }}
                >
                  {configuracion.oxigeno.maximoOptimo}
                </span>
                <span 
                  className="absolute text-xs text-gray-500 transform -translate-x-1/2" 
                  style={{ left: '100%' }}
                >
                  {configuracion.oxigeno.maximo}
                </span>
              </div>
              
              {/* Etiquetas de zonas con posiciones dinámicas */}
              <div className="relative mt-2 h-4">
                <span 
                  className="absolute text-xs text-red-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${((configuracion.oxigeno.minimo + configuracion.oxigeno.minimoOptimo) / 2 - configuracion.oxigeno.minimo) / (configuracion.oxigeno.maximo - configuracion.oxigeno.minimo) * 50}%` 
                  }}
                >
                  Crítico
                </span>
                <span 
                  className="absolute text-xs text-yellow-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${25 + ((configuracion.oxigeno.minimoOptimo - configuracion.oxigeno.minimo) / (configuracion.oxigeno.maximo - configuracion.oxigeno.minimo)) * 25}%` 
                  }}
                >
                  Aceptable
                </span>
                <span 
                  className="absolute text-xs text-yellow-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${75 - ((configuracion.oxigeno.maximo - configuracion.oxigeno.maximoOptimo) / (configuracion.oxigeno.maximo - configuracion.oxigeno.minimo)) * 25}%` 
                  }}
                >
                  Aceptable
                </span>
                <span 
                  className="absolute text-xs text-red-600 font-medium transform -translate-x-1/2" 
                  style={{ 
                    left: `${50 + ((configuracion.oxigeno.maximoOptimo + configuracion.oxigeno.maximo) / 2 - configuracion.oxigeno.minimo) / (configuracion.oxigeno.maximo - configuracion.oxigeno.minimo) * 50}%` 
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
                <span className="font-medium text-green-600">
                  {historial.length > 0 ? 
                    (historial.reduce((sum, item) => sum + Number(item.oxigeno || item.valor || 0), 0) / historial.length).toFixed(2) + ' mg/L' : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Máximo:</span>
                <span className="font-medium text-blue-600">
                  {historial.length > 0 ? 
                    Math.max(...historial.map(item => Number(item.oxigeno || item.valor || 0))).toFixed(2) + ' mg/L' : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Mínimo:</span>
                <span className="font-medium text-red-600">
                  {historial.length > 0 ? 
                    Math.min(...historial.map(item => Number(item.oxigeno || item.valor || 0))).toFixed(2) + ' mg/L' : 
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
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">Sensor Oxigeno Disuelto SIMULADO</p>
              <p className="text-sm text-gray-600">Tipo de Sensor</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-600">±0.1 mg/L</p>
              <p className="text-sm text-gray-600">Precisión</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-lg font-bold text-red-600">
                {configuracion.oxigeno.minimo} - {configuracion.oxigeno.maximo} mg/L
              </p>
              <p className="text-sm text-gray-600">Rango Crítico</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">
                {configuracion.oxigeno.minimoOptimo} - {configuracion.oxigeno.maximoOptimo} mg/L
              </p>
              <p className="text-sm text-gray-600">Rango Óptimo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}