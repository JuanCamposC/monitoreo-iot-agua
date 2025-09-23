'use client';

import { useState, useEffect } from 'react';
import OxygenChart from '../../components/graficos/OxigenoChart';

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

  useEffect(() => {
    const fetchOxigeno = async () => {
      try {
        const response = await fetch('http://localhost:5000/oxigeno');
        const data = await response.json();
        
        if (data.success) {
          const oxigenos = data.data;
          setHistorial(oxigenos);
          
          // Obtener el oxígeno más reciente
          if (oxigenos.length > 0) {
            const ultimoOxigeno = oxigenos[0];
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
    return new Date(fecha).toLocaleString('es-ES');
  };

  const getEstadoColor = (oxigeno: number) => {
    if (oxigeno < 5) return 'bg-red-100 text-red-800';
    if (oxigeno < 7) return 'bg-yellow-100 text-yellow-800';
    if (oxigeno > 12) return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  const getEstadoTexto = (oxigeno: number) => {
    if (oxigeno < 5) return 'Crítico';
    if (oxigeno < 7) return 'Bajo';
    if (oxigeno > 12) return 'Alto';
    return 'Óptimo';
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sensor de Oxígeno Disuelto</h1>
        
        {/* Gráfico histórico (prioridad principal) */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Análisis Histórico de Oxígeno Disuelto</h2>
          <OxygenChart data={historial} title="Tendencias de Oxígeno en el Tiempo" />
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
                      <span className="font-bold text-green-600 text-lg">
                        {Number(item.oxigeno || item.valor || 0).toFixed(2)} mg/L
                      </span>
                      <span className={`${getEstadoColor(Number(item.oxigeno || item.valor || 0))} px-2 py-1 rounded-full text-xs font-medium`}>
                        {getEstadoTexto(Number(item.oxigeno || item.valor || 0))}
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

        {/* Información técnica */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Información Técnica (Texto de prueba)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">"MODELO_SENSOR"</p>
              <p className="text-sm text-gray-600">Tipo de Sensor</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-600">±0.1 mg/L</p>
              <p className="text-sm text-gray-600">Precisión</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold text-purple-600">0-20 mg/L</p>
              <p className="text-sm text-gray-600">Rango de Medición</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-lg font-bold text-yellow-600">7-12 mg/L</p>
              <p className="text-sm text-gray-600">Rango Óptimo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}