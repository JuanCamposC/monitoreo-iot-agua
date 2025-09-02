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
        const response = await fetch('http://localhost:5000/oxigeno?limit=20');
        const data = await response.json();
        
        if (data.success) {
          const oxigenos = data.data;
          setHistorial(oxigenos);

          // Obtener el oxígeno más reciente (primer elemento ya ordenado por fecha desc)
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
    if (oxigeno < 5) return 'bg-red-100 text-red-800';      // Bajo - Rojo
    if (oxigeno > 9) return 'bg-blue-100 text-blue-800';    // Saturado - Azul
    return 'bg-green-100 text-green-800';                   // Óptimo - Verde
  };

  const getEstadoTexto = (oxigeno: number) => {
    if (oxigeno < 5) return 'Bajo';
    if (oxigeno > 9) return 'Saturado';
    return 'Óptimo';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gray-100 p-6 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando datos de oxígeno...</p>
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
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sensor de Oxígeno Disuelto</h1>
        
        {/* Gráfico detallado de oxígeno */}
        <div className="mb-6">
          <OxygenChart data={historial} title="Análisis Detallado de Oxígeno Disuelto" />
        </div>

        {/* Información técnica del sensor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">🌊 Información Técnica</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600"><strong>Sensor:</strong> Oxígeno Disuelto</p>
              <p className="text-sm text-gray-600"><strong>Rango:</strong> 0 - 20 mg/L</p>
              <p className="text-sm text-gray-600"><strong>Precisión:</strong> ±0.1 mg/L</p>
              <p className="text-sm text-gray-600"><strong>Frecuencia:</strong> Cada 30 segundos</p>
              <p className="text-sm text-gray-600"><strong>Aplicación:</strong> Acuicultura y calidad del agua</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">📊 Estadísticas</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600"><strong>Total de lecturas:</strong> {historial.length}</p>
              <p className="text-sm text-gray-600"><strong>Estado actual:</strong> 
                <span className={`ml-2 px-2 py-1 rounded text-xs ${oxigenoActual ? getEstadoColor(oxigenoActual) : 'bg-gray-100 text-gray-800'}`}>
                  {oxigenoActual ? getEstadoTexto(oxigenoActual) : 'Sin datos'}
                </span>
              </p>
              <p className="text-sm text-gray-600"><strong>Valor actual:</strong> {oxigenoActual ? `${oxigenoActual} mg/L` : 'Sin datos'}</p>
              <p className="text-sm text-gray-600"><strong>Nivel crítico:</strong> &lt; 4 mg/L</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OxigenoPage2() {
  return (
    <div>
      <h1>Oxígeno - Página 2</h1>
    </div>
  );
}