/**
 * Configuración de API para el sistema CIMARQ
 */

// Detectar automáticamente la URL del backend
export const getBackendUrl = (): string => {
  // En el lado del cliente
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
  }
  
  // En el lado del servidor
  return process.env.BACKEND_URL || 'http://localhost:5000';
};

// URLs de los endpoints
export const API_ENDPOINTS = {
  SENSORES: '/api/v1/sensores',
  ALERTAS: '/api/v1/alertas',
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    VERIFY: '/api/v1/auth/verify',
    STATUS: '/api/v1/auth/status',
    UPDATE_PROFILE: '/api/v1/auth/update-profile',
  }
} as const;

// Función helper para construir URLs completas
export const buildApiUrl = (endpoint: string, params?: Record<string, string>): string => {
  const baseUrl = getBackendUrl();
  let url = `${baseUrl}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }
  
  return url;
};

// Configuración de fetch por defecto
export const defaultFetchOptions: RequestInit = {
  headers: {
    'Content-Type': 'application/json',
  },
};

// Helper para hacer peticiones con manejo de errores
export const apiRequest = async (
  endpoint: string, 
  options: RequestInit = {},
  params?: Record<string, string>
): Promise<Response> => {
  const url = buildApiUrl(endpoint, params);
  
  console.log(`🔄 API Request: ${options.method || 'GET'} ${url}`);
  
  // Merge correcto de headers
  const mergedOptions: RequestInit = {
    ...defaultFetchOptions,
    ...options,
    headers: {
      ...defaultFetchOptions.headers,
      ...(options.headers || {}),
    },
  };
  
  console.log('🔧 Headers enviados:', mergedOptions.headers);
  
  const response = await fetch(url, mergedOptions);
  
  console.log(`📡 API Response: ${response.status} ${response.statusText}`);
  
  return response;
};

// Helper para peticiones que devuelven JSON
export const apiRequestJson = async <T = any>(
  endpoint: string, 
  options: RequestInit = {},
  params?: Record<string, string>
): Promise<T> => {
  const response = await apiRequest(endpoint, options, params);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
};