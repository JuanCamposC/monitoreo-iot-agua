'use client';

import { useState, useCallback } from 'react';

// URL de tu API ML externa
const ML_API_BASE_URL = 'https://ml-monitoreo-production.up.railway.app';

interface MLApiResponse {
  [key: string]: any;
}

interface PrediccionResponse {
  // Para predicción individual
  prediction?: number;
  parameter?: string;
  confidence?: number;
  data_used?: {
    count: number;
    values: number[];
    avg: number;
    min: number;
    max: number;
    latest_timestamp: number;
    oldest_timestamp: number;
  };
  model_info?: {
    window_size: number;
    metrics: any;
  };
  timestamp?: string;
  message?: string;
  error?: string;
  
  // Para /predict/all - estructura real
  predictions?: {
    temperatura?: {
      prediction: {
        value: number;
        confidence: number;
        confidence_level: string;
      };
      trend_analysis: {
        direction: string;
        change: number;
        change_percent: number;
        volatility: string;
      };
      data_analysis: {
        values_used: number[];
        data_points: number;
        current_avg: number;
        current_min: number;
        current_max: number;
        current_std: number;
        latest_value: number;
        oldest_value: number;
        data_range: number;
      };
      model_performance: {
        rmse: number;
        mae: number;
        mse: number;
        training_samples: number;
      };
    };
    ph?: {
      prediction: {
        value: number;
        confidence: number;
        confidence_level: string;
      };
      trend_analysis: {
        direction: string;
        change: number;
        change_percent: number;
        volatility: string;
      };
      data_analysis: {
        values_used: number[];
        data_points: number;
        current_avg: number;
        current_min: number;
        current_max: number;
        current_std: number;
        latest_value: number;
        oldest_value: number;
        data_range: number;
      };
      model_performance: {
        rmse: number;
        mae: number;
        mse: number;
        training_samples: number;
      };
    };
    oxigeno?: {
      prediction: {
        value: number;
        confidence: number;
        confidence_level: string;
      };
      trend_analysis: {
        direction: string;
        change: number;
        change_percent: number;
        volatility: string;
      };
      data_analysis: {
        values_used: number[];
        data_points: number;
        current_avg: number;
        current_min: number;
        current_max: number;
        current_std: number;
        latest_value: number;
        oldest_value: number;
        data_range: number;
      };
      model_performance: {
        rmse: number;
        mae: number;
        mse: number;
        training_samples: number;
      };
    };
  };
  summary?: {
    confidence_analysis: {
      average: number;
      minimum: number;
      maximum: number;
    };
    trend_overview: {
      up: number;
      down: number;
      stable: number;
    };
  };
  next_actions?: {
    retrain_needed: boolean;
    ready_for_monitoring: boolean;
  };
}

interface EntrenamientoResponse {
  // Para entrenamiento individual
  status?: string;
  message?: string;
  parameter?: string;
  metrics?: {
    mae: number;
    mse: number;
    rmse: number;
    final_loss: number;
    epochs_trained: number;
    window_size: number;
    training_samples: number;
  };
  data_points?: number;
  
  // Para entrenamiento de todos los parámetros - estructura real
  summary?: {
    successful_models: number;
    success_rate: number;
    total_training_time: number;
    avg_training_time_per_model: number;
  };
  performance_overview?: {
    average_rmse: number;
    best_rmse: number;
    worst_rmse: number;
    models_ready_for_prediction: number;
  };
  detailed_results?: {
    temperatura?: {
      data_stats: {
        count: number;
        min: number;
        max: number;
        mean: number;
        std: number;
      };
      performance_metrics: {
        rmse: number;
        mae: number;
        mse: number;
      };
      training_config: {
        window_size: number;
        epochs: number;
        sequences_created: number;
      };
    };
    ph?: {
      data_stats: {
        count: number;
        min: number;
        max: number;
        mean: number;
        std: number;
      };
      performance_metrics: {
        rmse: number;
        mae: number;
        mse: number;
      };
      training_config: {
        window_size: number;
        epochs: number;
        sequences_created: number;
      };
    };
    oxigeno?: {
      data_stats: {
        count: number;
        min: number;
        max: number;
        mean: number;
        std: number;
      };
      performance_metrics: {
        rmse: number;
        mae: number;
        mse: number;
      };
      training_config: {
        window_size: number;
        epochs: number;
        sequences_created: number;
      };
    };
  };
  timestamp?: string;
  error?: string;
}

interface EstadoAPIResponse {
  status: string;
  database: string;
  models_loaded: {
    temperatura: boolean;
    ph: boolean;
    oxigeno: boolean;
  };
}

interface MuestraDatosResponse {
  status: string;
  collection: string;
  sample_size: number;
  data: {
    temperatura: Array<{
      _id: string;
      timestamp: number;
      value: number;
      original_data: {
        temperatura: number;
        ph: number;
        oxigeno: number;
      };
    }>;
    ph: Array<{
      _id: string;
      timestamp: number;
      value: number;
      original_data: {
        temperatura: number;
        ph: number;
        oxigeno: number;
      };
    }>;
    oxigeno: Array<{
      _id: string;
      timestamp: number;
      value: number;
      original_data: {
        temperatura: number;
        ph: number;
        oxigeno: number;
      };
    }>;
  };
  total_records: {
    temperatura: number;
    ph: number;
    oxigeno: number;
  };
}

interface ModelInfoResponse {
  overview: {
    total_models: number;
    trained_models: number;
    readiness_percentage: number;
    all_models_ready: boolean;
  };
  model_details: {
    temperatura?: {
      status: string;
      performance: {
        rmse: number;
        mae: number;
      };
      training_info: {
        epochs_trained: number;
        window_size: number;
        training_samples: number;
      };
      model_config: {
        learning_rate: number;
        n_weights: number;
        bias: number;
      };
    };
    ph?: {
      status: string;
      performance: {
        rmse: number;
        mae: number;
      };
      training_info: {
        epochs_trained: number;
        window_size: number;
        training_samples: number;
      };
      model_config: {
        learning_rate: number;
        n_weights: number;
        bias: number;
      };
    };
    oxigeno?: {
      status: string;
      performance: {
        rmse: number;
        mae: number;
      };
      training_info: {
        epochs_trained: number;
        window_size: number;
        training_samples: number;
      };
      model_config: {
        learning_rate: number;
        n_weights: number;
        bias: number;
      };
    };
  };
}

export const useMLApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${ML_API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || `Error ${response.status}`);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Verificar estado de la API ML externa
  const verificarEstadoAPI = useCallback(async (): Promise<EstadoAPIResponse> => {
    return apiCall('/health');
  }, [apiCall]);

  // Obtener predicciones automáticas para un parámetro específico
  const obtenerPredicciones = useCallback(async (parameter: string, windowSize: number = 5): Promise<PrediccionResponse> => {
    return apiCall('/predict', {
      method: 'POST',
      body: JSON.stringify({
        parameter: parameter,
        collection_name: 'datos',
        window_size: windowSize
      }),
    });
  }, [apiCall]);

  // Obtener predicciones para todos los parámetros
  const obtenerTodasPredicciones = useCallback(async (): Promise<PrediccionResponse> => {
    return apiCall('/predict/all', {
      method: 'POST',
      body: JSON.stringify({
        collection_name: 'datos'
      }),
    });
  }, [apiCall]);

  // Entrenar modelos
  const entrenarModelos = useCallback(async (sensor?: string): Promise<EntrenamientoResponse> => {
    if (sensor) {
      // Entrenar sensor específico
      return apiCall('/train', {
        method: 'POST',
        body: JSON.stringify({
          parameter: sensor,
          collection_name: 'datos',
          window_size: 5
        }),
      });
    } else {
      // Entrenar todos los parámetros usando el endpoint específico
      return apiCall('/train/all-parameters', {
        method: 'POST',
        body: JSON.stringify({
          collection_name: 'datos',
          window_size: 5
        }),
      });
    }
  }, [apiCall]);

  // Entrenar sensor individual
  const entrenarSensorIndividual = useCallback(async (sensor: string): Promise<EntrenamientoResponse> => {
    return apiCall('/train', {
      method: 'POST',
      body: JSON.stringify({
        parameter: sensor,
        collection_name: 'datos',
        window_size: 5
      }),
    });
  }, [apiCall]);

  // Predicción individual automática
  const prediccionIndividual = useCallback(async (parameter: string, windowSize: number = 5): Promise<PrediccionResponse> => {
    return apiCall('/predict', {
      method: 'POST',
      body: JSON.stringify({
        parameter: parameter,
        collection_name: 'datos',
        window_size: windowSize
      }),
    });
  }, [apiCall]);

  // Obtener muestra de datos
  const obtenerMuestraDatos = useCallback(async (): Promise<MuestraDatosResponse> => {
    return apiCall('/data/sample/datos?limit=10');
  }, [apiCall]);

  // Obtener información detallada del modelo
  const obtenerInfoModelo = useCallback(async (): Promise<ModelInfoResponse> => {
    return apiCall('/model/info');
  }, [apiCall]);

  // Función adicional para obtener datos desde el backend local (para entrenar)
  const obtenerDatosBackend = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/v1/sensores');
      return await response.json();
    } catch (err) {
      console.error('Error obteniendo datos del backend:', err);
      return null;
    }
  }, []);

  return {
    loading,
    error,
    verificarEstadoAPI,
    obtenerPredicciones,
    obtenerTodasPredicciones,
    entrenarModelos,
    entrenarSensorIndividual,
    prediccionIndividual,
    obtenerMuestraDatos,
    obtenerInfoModelo,
    obtenerDatosBackend,
  };
};

export default useMLApi;