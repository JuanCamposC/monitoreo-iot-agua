'use client';

import { useState, useEffect } from 'react';
import PHChart from '../../components/graficos/PhChart';

interface PHData {
  _id: string;
  ph?: number;
  valor?: number;
  fecha: string;
  timestamp?: string;
}

export default function PHPage() {
  const [phActual, setPhActual] = useState<number | null>(null);
  const [historial, setHistorial] = useState<PHData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPH = async () => {
      try {
        const response = await fetch('http://localhost:5000/ph');
        const data = await response.json();
        
        if (data.success) {
          const phs = data.data;
          setHistorial(phs);
          
          // Obtener el pH más reciente
          if (phs.length > 0) {
            const ultimoPH = phs[0];
            setPhActual(ultimoPH.ph || ultimoPH.valor || 0);
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

    fetchPH();

    // Actualizar datos cada 5 segundos
    const interval = setInterval(fetchPH, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const formatFecha = (fecha: string) => {
    if (!fecha) return 'Fecha no disponible';
    return new Date(fecha).toLocaleString('es-ES');
  };

  const getEstadoColor = (ph: number) => {
    if (ph < 6.5) return 'bg-red-100 text-red-800';
    if (ph < 7) return 'bg-orange-100 text-orange-800';
    if (ph > 8.5) return 'bg-blue-100 text-blue-800';
    if (ph > 7.5) return 'bg-cyan-100 text-cyan-800';
    return 'bg-green-100 text-green-800';
  };

  const getEstadoTexto = (ph: number) => {
    if (ph < 6.5) return 'Muy Ácido';
    if (ph < 7) return 'Ácido';
    if (ph > 8.5) return 'Muy Alcalino';
    if (ph > 7.5) return 'Alcalino';
    return 'Neutro';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gray-100 p-6 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando datos de pH...</p>
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
            className="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 p-6 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sensor de pH</h1>
        
        {/* Gráfico histórico (prioridad principal) */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Análisis Histórico del pH</h2>
          <PHChart data={historial} title="Variaciones de pH en el Tiempo" />
        </div>

        {/* Grid con historial detallado y lectura actual */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Historial detallado (2/3 del espacio) */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Registro Histórico Completo ({historial.length} lecturas)
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {historial.length > 0 ? (
                historial.map((item, index) => (
                  <div key={item._id} className="flex justify-between items-center py-3 px-4 border-b hover:bg-gray-50 rounded">
                    <div className="flex-1">
                      <span className="text-gray-600 text-sm">
                        {formatFecha(item.fecha || item.timestamp || '')}
                      </span>
                      <div className="text-xs text-gray-400">
                        Lectura #{historial.length - index}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-purple-600 text-lg">
                        {Number(item.ph || item.valor || 0).toFixed(2)}
                      </span>
                      <span className={`${getEstadoColor(Number(item.ph || item.valor || 0))} px-2 py-1 rounded-full text-xs font-medium`}>
                        {getEstadoTexto(Number(item.ph || item.valor || 0))}
                      </span>
                    </div>
                  </div>
                ))
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
              <div className={`${phActual ? getEstadoColor(phActual) : 'bg-gray-100 text-gray-800'} px-3 py-1 rounded-full text-sm font-medium`}>
                {phActual ? getEstadoTexto(phActual) : 'Sin Datos'}
              </div>
            </div>
            
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {phActual ? `${Number(phActual).toFixed(2)}` : 'Sin Datos'}
              </div>
              <div className="text-lg text-gray-500 mb-1">pH</div>
              <p className="text-xs text-gray-500">
                {historial.length > 0 ? 
                  `${formatFecha(historial[0]?.fecha || historial[0]?.timestamp || '')}` : 
                  'Sin datos disponibles'
                }
              </p>
            </div>

            {/* Escala de pH visual */}
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Escala de pH:</div>
              <div className="h-4 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 relative">
                {phActual && (
                  <div 
                    className="absolute top-0 w-2 h-4 bg-black rounded-full transform -translate-x-1" 
                    style={{ left: `${(phActual / 14) * 100}%` }}
                  ></div>
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0 (Ácido)</span>
                <span>7 (Neutro)</span>
                <span>14 (Alcalino)</span>
              </div>
            </div>

            {/* Estadísticas del historial */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Promedio:</span>
                <span className="font-medium text-purple-600">
                  {historial.length > 0 ? 
                    (historial.reduce((sum, item) => sum + Number(item.ph || item.valor || 0), 0) / historial.length).toFixed(2) : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Máximo:</span>
                <span className="font-medium text-blue-600">
                  {historial.length > 0 ? 
                    Math.max(...historial.map(item => Number(item.ph || item.valor || 0))).toFixed(2) : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Mínimo:</span>
                <span className="font-medium text-red-600">
                  {historial.length > 0 ? 
                    Math.min(...historial.map(item => Number(item.ph || item.valor || 0))).toFixed(2) : 
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

        {/* Información técnica */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Información Técnica (Texto de prueba)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold text-purple-600">Electrodo de Vidrio</p>
              <p className="text-sm text-gray-600">Tipo de Sensor</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-600">±0.01 pH</p>
              <p className="text-sm text-gray-600">Precisión</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">0-14 pH</p>
              <p className="text-sm text-gray-600">Rango de Medición</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-lg font-bold text-yellow-600">6.5-7.5 pH</p>
              <p className="text-sm text-gray-600">Rango Óptimo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}