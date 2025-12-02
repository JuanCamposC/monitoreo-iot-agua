'use client';

import React, { useState } from 'react';
import EstadoAPIML from '../components/EstadoAPIML';
import PrediccionesML from '../components/PrediccionesML';
import { useMLApi } from '../hooks/useMLApi';

const MachineLearningPage = () => {
  const { obtenerMuestraDatos, loading, error } = useMLApi();
  const [muestraDatos, setMuestraDatos] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('predicciones');

  const tabs = [
    { id: 'predicciones', name: 'Predicciones', icon: '🔮' },
    { id: 'estado', name: 'Estado API', icon: '🤖' },
    { id: 'datos', name: 'Datos', icon: '📊' }
  ];

  const cargarMuestraDatos = async () => {
    try {
      const result = await obtenerMuestraDatos();
      setMuestraDatos(result);
    } catch (err) {
      console.error('Error cargando muestra:', err);
    }
  };



  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Sistema Machine Learning
        </h1>
        <p className="text-gray-600">
          Predicciones, entrenamiento y monitoreo inteligente de sensores
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Error global */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">❌ {error}</p>
        </div>
      )}

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'predicciones' && (
          <PrediccionesML />
        )}

        {activeTab === 'estado' && (
          <EstadoAPIML />
        )}



        {activeTab === 'datos' && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  Muestra de Datos
                </h3>
                <button
                  onClick={cargarMuestraDatos}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? '🔄 Cargando...' : '↻ Cargar Muestra'}
                </button>
              </div>
            </div>

            <div className="p-4">
              {muestraDatos ? (
                <div className="space-y-4">
                  {/* Estado de la consulta */}
                  {muestraDatos.status === 'success' && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span>✅</span>
                        <span className="font-medium text-green-800">
                          Datos de entrenamiento obtenidos de {muestraDatos.collection}
                        </span>
                      </div>
                      <div className="text-sm text-green-600 mt-1">
                        {muestraDatos.description || `Últimos ${muestraDatos.sample_size} registros por sensor (datos de entrenamiento)`}
                      </div>
                      {muestraDatos.training_info && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <div className="text-sm text-blue-800 font-medium">📚 Información de Entrenamiento:</div>
                          <div className="text-xs text-blue-600 mt-1">
                            • Window Size: {muestraDatos.training_info.window_size} valores por secuencia<br/>
                            • Secuencias creadas: {muestraDatos.training_info.sequences_created} por sensor<br/>
                            • {muestraDatos.training_info.explanation || `Con ${muestraDatos.sample_size} datos y window_size=${muestraDatos.training_info.window_size}, se crean ${muestraDatos.training_info.sequences_created} secuencias de entrenamiento`}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resumen de datos */}
                  {muestraDatos.total_records && (
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                        <div className="text-2xl">🌡️</div>
                        <div className="font-medium text-blue-800">Temperatura</div>
                        <div className="text-sm text-blue-600">{muestraDatos.total_records.temperatura} registros</div>
                      </div>
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                        <div className="text-2xl">⚖️</div>
                        <div className="font-medium text-green-800">pH</div>
                        <div className="text-sm text-green-600">{muestraDatos.total_records.ph} registros</div>
                      </div>
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-center">
                        <div className="text-2xl">💨</div>
                        <div className="font-medium text-purple-800">Oxígeno</div>
                        <div className="text-sm text-purple-600">{muestraDatos.total_records.oxigeno} registros</div>
                      </div>
                    </div>
                  )}

                  {/* Datos de muestra por sensor */}
                  {muestraDatos.data && (
                    <div className="space-y-6">
                      {['temperatura', 'ph', 'oxigeno'].map((sensor) => (
                        <div key={sensor} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              {sensor === 'temperatura' ? '🌡️ Temperatura' : 
                               sensor === 'ph' ? '⚖️ pH' : '💨 Oxígeno'}
                              <span className="text-sm text-gray-500">
                                ({muestraDatos.data[sensor as keyof typeof muestraDatos.data]?.length || 0} registros)
                              </span>
                            </h4>
                          </div>
                          <div className="p-4">
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pos.</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Temp</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">pH</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">O₂</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {muestraDatos.data[sensor as keyof typeof muestraDatos.data]?.slice(0, 10).map((item: any, index: number) => (
                                    <tr key={item._id} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 text-sm text-center">
                                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                          {item.position_in_training || (index + 1)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-sm font-medium text-gray-900">
                                        {item.value.toFixed(2)}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-500">
                                        {new Date(item.timestamp).toLocaleString('es-CL')}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-500">
                                        {item.original_data.temperatura.toFixed(2)}°C
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-500">
                                        {item.original_data.ph.toFixed(3)}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-500">
                                        {item.original_data.oxigeno.toFixed(2)} mg/L
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {muestraDatos.data[sensor as keyof typeof muestraDatos.data]?.length > 10 && (
                                <div className="text-center text-sm text-gray-500 mt-2">
                                  ... y {muestraDatos.data[sensor as keyof typeof muestraDatos.data].length - 10} registros más
                                </div>
                              )}
                              {muestraDatos.data[sensor as keyof typeof muestraDatos.data]?.length === 10 && (
                                <div className="text-center text-sm text-blue-600 mt-2 font-medium">
                                  Estos son todos los datos de entrenamiento (últimos 10 registros)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Haz clic en &quot;Cargar Muestra&quot; para obtener datos de ejemplo de la API ML externa
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MachineLearningPage;