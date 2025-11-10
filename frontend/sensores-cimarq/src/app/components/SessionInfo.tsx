'use client';

import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface SessionInfoProps {
  className?: string;
  showTimeRemaining?: boolean;
}

const SessionInfo: React.FC<SessionInfoProps> = ({ 
  className = '', 
  showTimeRemaining = false 
}) => {
  const { sessionTimeRemaining, isAuthenticated, extendSession } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  const formatTime = (milliseconds: number): string => {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getTimeColor = (): string => {
    const fiveMinutes = 5 * 60 * 1000;
    const tenMinutes = 10 * 60 * 1000;
    
    if (sessionTimeRemaining <= fiveMinutes) {
      return 'text-red-600';
    } else if (sessionTimeRemaining <= tenMinutes) {
      return 'text-yellow-600';
    }
    return 'text-green-600';
  };

  if (!showTimeRemaining) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center space-x-1 text-sm">
        <span className="text-gray-500">Sesión:</span>
        <span className={`font-medium ${getTimeColor()}`}>
          {formatTime(sessionTimeRemaining)}
        </span>
        <button
          onClick={extendSession}
          className="text-blue-500 hover:text-blue-700 text-xs underline ml-2"
          title="Extender sesión"
        >
          extender
        </button>
      </div>
    </div>
  );
};

export default SessionInfo;