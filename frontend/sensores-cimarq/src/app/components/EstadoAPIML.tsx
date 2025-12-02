'use client';

import React, { useState, useEffect } from 'react';
import { useMLApi } from '../hooks/useMLApi';

interface EstadoAPIMLProps {
  className?: string;
}

const EstadoAPIML: React.FC<EstadoAPIMLProps> = ({ className = '' }) => {
  const { verificarEstadoAPI, loading, error } = useMLApi();
  const [estadoAPI, setEstadoAPI] = useState<any>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const cargarEstadoAPI = async () => {
    try {
      const response = await verificarEstadoAPI();
      setEstadoAPI(response);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error('Error cargando estado API ML:', err);
    }
  };

  useEffect(() => {
    cargarEstadoAPI();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(cargarEstadoAPI, 30000); // Cada 30 segundos
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getEstadoColor = (modeloCargado: boolean) => {
    if (modeloCargado) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getEstadoIcon = (modeloCargado: boolean) => {
    return modeloCargado ? '🟢' : '�';
    return '🟡';
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            🤖 Estado API Machine Learning
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-refresh
            </label>
            <button
              onClick={cargarEstadoAPI}
              disabled={loading}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? '🔄' : '↻'} Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">❌ Error: {error}</p>
          </div>
        )}

        {loading && !estadoAPI && (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">🔄 Verificando estado de la API...</div>
          </div>
        )}

        {estadoAPI && (
          <div className="space-y-4">
            {/* Estado Principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-3 rounded-lg border ${
                estadoAPI.status === 'healthy' 
                  ? 'bg-green-100 text-green-800 border-green-200' 
                  : 'bg-red-100 text-red-800 border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">
                    {estadoAPI.status === 'healthy' ? '🟢' : '🔴'}
                  </span>
                  <h4 className="font-medium">Estado del Servicio</h4>
                </div>
                <p className="text-sm">
                  API: {estadoAPI.status === 'healthy' ? 'Saludable' : 'No disponible'}
                </p>
                <p className="text-xs mt-1">
                  Base de datos: {estadoAPI.database === 'connected' ? 'Conectada' : 'Desconectada'}
                </p>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">�</span>
                  <h4 className="font-medium text-gray-800">Estado de Modelos</h4>
                </div>
                <div className="text-sm text-gray-700 space-y-2">
                  {estadoAPI.models_loaded && (
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between">
                        <span>🌡️ Temperatura:</span>
                        <span className={`px-2 py-1 rounded text-xs ${getEstadoColor(estadoAPI.models_loaded.temperatura)}`}>
                          {getEstadoIcon(estadoAPI.models_loaded.temperatura)} 
                          {estadoAPI.models_loaded.temperatura ? 'Entrenado' : 'No entrenado'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>⚖️ pH:</span>
                        <span className={`px-2 py-1 rounded text-xs ${getEstadoColor(estadoAPI.models_loaded.ph)}`}>
                          {getEstadoIcon(estadoAPI.models_loaded.ph)} 
                          {estadoAPI.models_loaded.ph ? 'Entrenado' : 'No entrenado'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>💨 Oxígeno:</span>
                        <span className={`px-2 py-1 rounded text-xs ${getEstadoColor(estadoAPI.models_loaded.oxigeno)}`}>
                          {getEstadoIcon(estadoAPI.models_loaded.oxigeno)} 
                          {estadoAPI.models_loaded.oxigeno ? 'Entrenado' : 'No entrenado'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Resumen de estado */}
            {estadoAPI.models_loaded && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <h4 className="font-medium text-indigo-800 mb-2 flex items-center gap-2">
                  � Resumen del Sistema
                </h4>
                <div className="text-sm text-indigo-700">
                  <p>Modelos entrenados: {Object.values(estadoAPI.models_loaded).filter(Boolean).length}/3</p>
                  <p>Sistema listo para predicciones: {
                    Object.values(estadoAPI.models_loaded).every(Boolean) ? '✅ Sí' : '❌ No'
                  }</p>
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center justify-between text-sm text-gray-500 pt-2 border-t">
              <span>
                Última verificación: {ultimaActualizacion?.toLocaleString('es-CL')}
              </span>
              <span>
                {autoRefresh && '🔄 Auto-refresh activo'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EstadoAPIML;