'use client';

import { useState, useEffect } from 'react';
import TemperatureChart from '../../components/graficos/TemperaturaChart';

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

  useEffect(() => {
    const fetchTemperatura = async () => {
      try {
        const response = await fetch('http://localhost:5000/temperatura?limit=20');
        const data = await response.json();
        
        if (data.success) {
          const temperaturas = data.data;
          setHistorial(temperaturas);
          
          // Obtener la temperatura más reciente (el primer elemento ya que están ordenados por fecha desc)
          if (temperaturas.length > 0) {
            const ultimaTemperatura = temperaturas[0];
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
    return new Date(fecha).toLocaleString('es-ES');
  };

  const getEstadoColor = (temperatura: number) => {
    if (temperatura < 18) return 'bg-blue-100 text-blue-800';
    if (temperatura > 25) return 'bg-red-100 text-red-800';
    return 'bg-green-100 text-green-800';
  };

  const getEstadoTexto = (temperatura: number) => {
    if (temperatura < 18) return 'Frío';
    if (temperatura > 25) return 'Caliente';
    return 'Normal';
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sensor de Temperatura</h1>
        
        {/* Gráfico detallado */}
        <div className="mb-6">
          <TemperatureChart data={historial} title="Análisis Detallado de Temperatura" />
        </div>

        {/* Grid con información resumida */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card principal del sensor */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-700">Lectura Actual</h2>
              <div className={`${temperaturaActual ? getEstadoColor(temperaturaActual) : 'bg-gray-100 text-gray-800'} px-3 py-1 rounded-full text-sm font-medium`}>
                {temperaturaActual ? getEstadoTexto(temperaturaActual) : 'Sin Datos'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-5xl font-bold text-blue-600 mb-2">
                {temperaturaActual ? `${Number(temperaturaActual).toFixed(1)}°C` : 'Sin Datos'}
              </div>
              <p className="text-gray-500">
                {historial.length > 0 ? 
                  `Última actualización: ${formatFecha(historial[0]?.fecha || historial[0]?.timestamp || '')}` : 
                  'Sin datos disponibles'
                }
              </p>
            </div>

            {/* Información adicional del sensor */}
            <div className="mt-6 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">18-25°C</p>
                  <p className="text-sm text-gray-500">Rango Normal</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{historial.length}</p>
                  <p className="text-sm text-gray-500">Total Registros</p>
                </div>
              </div>
            </div>
          </div>

          {/* Historial reciente */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Historial Reciente (Últimos 10 registros)</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {historial.length > 0 ? (
                historial.slice(0, 10).map((item, index) => (
                  <div key={item._id} className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600 text-sm">
                      {formatFecha(item.fecha || item.timestamp || '')}
                    </span>
                    <span className="font-medium text-blue-600">
                      {Number(item.temperatura || item.valor || 0).toFixed(1)}°C
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">
                  No hay datos disponibles
                </div>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-500 text-center border-t pt-2">
              Actualización automática cada 5 segundos
            </div>
          </div>
        </div>

        {/* Información técnica */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Información Técnica</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-600">Termómetro Digital</p>
              <p className="text-sm text-gray-600">Tipo de Sensor</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">±0.1°C</p>
              <p className="text-sm text-gray-600">Precisión</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold text-purple-600">-10 a 50°C</p>
              <p className="text-sm text-gray-600">Rango de Medición</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}