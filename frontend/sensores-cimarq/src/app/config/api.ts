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
    VERIFY: '/api/v1/auth/verify',
    STATUS: '/api/v1/auth/status',
    UPDATE_PROFILE: '/api/v1/auth/update-profile',
  },

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
  
  console.log(`API Request: ${options.method || 'GET'} ${url}`);
  
  // Merge correcto de headers
  const mergedOptions: RequestInit = {
    ...defaultFetchOptions,
    ...options,
    headers: {
      ...defaultFetchOptions.headers,
      ...(options.headers || {}),
    },
  };
  
  console.log('Headers enviados:', mergedOptions.headers);
  
  const response = await fetch(url, mergedOptions);
  
  console.log(`API Response: ${response.status} ${response.statusText}`);
  
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
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // Si no se puede parsear la respuesta, usar el mensaje por defecto
    }
    
    throw new Error(errorMessage);
  }
  
  return await response.json();
};

// Helper para peticiones que devuelven archivos (Blob)
export const apiRequestBlob = async (
  endpoint: string, 
  options: RequestInit = {},
  params?: Record<string, string>
): Promise<{ blob: Blob; filename?: string }> => {
  const response = await apiRequest(endpoint, options, params);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  // Obtener el nombre del archivo desde los headers
  const contentDisposition = response.headers.get('content-disposition');
  const filename = contentDisposition?.match(/filename="(.+)"/)?.[1];
  
  const blob = await response.blob();
  
  return { blob, filename };
};

/**
 * Crea un cliente de API para un servicio externo
 * @param baseUrl - URL base del servicio externo
 * @returns Función para hacer peticiones a ese servicio
 */
export const createApiClient = (baseUrl: string) => {
  return async <T = any>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> => {
    const url = `${baseUrl}${endpoint}`;
    
    console.log(`API Request (External): ${options?.method || 'GET'} ${url}`);
    if (options?.body) {
      console.log('Request body:', options.body);
    }

    const mergedOptions: RequestInit = {
      ...defaultFetchOptions,
      ...options,
      headers: {
        ...defaultFetchOptions.headers,
        ...options?.headers,
      } as HeadersInit,
    };

    const response = await fetch(url, mergedOptions);
    
    console.log(`API Response (External): ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // Si no se puede parsear el error, usar el mensaje por defecto
      }
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  };
};