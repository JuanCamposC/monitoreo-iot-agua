'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SessionWarning: React.FC = () => {
  const { sessionTimeRemaining, extendSession, logout, isAuthenticated } = useAuth();
  const [showWarning, setShowWarning] = useState(false);

  // Mostrar advertencia cuando quedan menos de 5 minutos
  const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutos en milisegundos

  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarning(false);
      return;
    }

    // Mostrar advertencia si queda poco tiempo
    if (sessionTimeRemaining > 0 && sessionTimeRemaining <= WARNING_THRESHOLD) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [sessionTimeRemaining, isAuthenticated]);

  const formatTime = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleExtendSession = () => {
    extendSession();
    setShowWarning(false);
  };

  const handleLogoutNow = () => {
    logout();
  };

  if (!showWarning || !isAuthenticated) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-yellow-400 text-xl">⚠️</span>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              Sesión expirando pronto
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Tu sesión expirará en{' '}
                <span className="font-mono font-bold">
                  {formatTime(sessionTimeRemaining)}
                </span>
              </p>
              <p className="mt-1">
                ¿Deseas continuar trabajando?
              </p>
            </div>
            <div className="mt-4 flex space-x-2">
              <button
                onClick={handleExtendSession}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
              >
                Continuar sesión
              </button>
              <button
                onClick={handleLogoutNow}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-sm font-medium transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={() => setShowWarning(false)}
              className="text-yellow-400 hover:text-yellow-600 transition-colors"
            >
              <span className="sr-only">Cerrar</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionWarning;