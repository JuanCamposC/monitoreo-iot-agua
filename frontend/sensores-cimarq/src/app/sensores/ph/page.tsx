'use client';

import { useEffect, useState } from 'react';
import PhChart from '../../components/graficos/PhChart';

interface PhData {
  _id: string;
  ph?: number;
  valor?: number;
  fecha: string;
  timestamp?: string;
}

export default function PhPage() {
  const [phActual, setPhActual] = useState<number | null>(null);
  const [historial, setHistorial] = useState<PhData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPh = async () => {
      try {
        const response = await fetch('http://localhost:5000/ph?limit=20');
        const data = await response.json();
        
        if (data.success) {
          const phValues = data.data;
          setHistorial(phValues);

          // Obtener el pH más reciente (primer elemento ya ordenado por fecha desc)
          if (phValues.length > 0) {
            const ultimoPh = phValues[0];
            setPhActual(ultimoPh.ph || ultimoPh.valor || 0);
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

    fetchPh();

    // Actualizar datos cada 5 segundos
    const interval = setInterval(fetchPh, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatFecha = (fecha: string) => {
    if (!fecha) return 'Fecha no disponible';
    return new Date(fecha).toLocaleString('es-ES');
  };

  const getEstadoColor = (ph: number) => {
    if (ph < 6) return 'bg-blue-100 text-blue-800';
    if (ph > 8) return 'bg-red-100 text-red-800';
    return 'bg-green-100 text-green-800';
  };

  const getEstadoTexto = (ph: number) => {
    if (ph < 6) return 'Ácido';
    if (ph > 8) return 'Alcalino';
    return 'Neutral';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gray-100 p-6 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
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
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sensor de pH</h1>
        
        {/* Gráfico detallado de pH */}
        <div className="mb-6">
          <PhChart data={historial} title="Análisis Detallado de pH" />
        </div>

        {/* Información técnica del sensor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">🔬 Información Técnica</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600"><strong>Sensor:</strong> pH Digital</p>
              <p className="text-sm text-gray-600"><strong>Rango:</strong> 0 - 14 pH</p>
              <p className="text-sm text-gray-600"><strong>Precisión:</strong> ±0.1 pH</p>
              <p className="text-sm text-gray-600"><strong>Frecuencia:</strong> Cada 30 segundos</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">📊 Estadísticas</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600"><strong>Total de lecturas:</strong> {historial.length}</p>
              <p className="text-sm text-gray-600"><strong>Estado actual:</strong> 
                <span className={`ml-2 px-2 py-1 rounded text-xs ${phActual ? getEstadoColor(phActual) : 'bg-gray-100 text-gray-800'}`}>
                  {phActual ? getEstadoTexto(phActual) : 'Sin datos'}
                </span>
              </p>
              <p className="text-sm text-gray-600"><strong>Valor actual:</strong> {phActual ? `${phActual} pH` : 'Sin datos'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}