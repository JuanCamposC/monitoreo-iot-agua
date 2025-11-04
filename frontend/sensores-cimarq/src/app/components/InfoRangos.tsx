'use client';

import { RangoSensor, EstadoSensor } from '../hooks/useConfiguracionRangos';
import { MdCheckCircle, MdWarning, MdError } from 'react-icons/md';

interface InfoRangosProps {
  titulo: string;
  valorActual: number | null;
  rango: RangoSensor;
  estado: EstadoSensor;
  unidad: string;
  icono: React.ComponentType<{ size?: number; color?: string }>;
  colorBase: string;
}

export default function InfoRangos({
  titulo,
  valorActual,
  rango,
  estado,
  unidad,
  icono: IconComponent,
  colorBase
}: InfoRangosProps) {
  
  const getEstadoInfo = () => {
    switch (estado) {
      case 'optimo':
        return {
          color: '#4caf50',
          bgColor: '#e8f5e8',
          icon: MdCheckCircle,
          texto: 'ÓPTIMO',
          descripcion: 'El valor está en el rango ideal para el sistema'
        };
      case 'aceptable':
        return {
          color: '#ff9800',
          bgColor: '#fff3e0',
          icon: MdWarning,
          texto: 'ACEPTABLE',
          descripcion: 'El valor está en rango crítico, requiere atención'
        };
      case 'critico':
        return {
          color: '#f44336',
          bgColor: '#ffebee',
          icon: MdError,
          texto: 'CRÍTICO',
          descripcion: 'El valor está fuera de los límites seguros'
        };
    }
  };

  const estadoInfo = getEstadoInfo();
  const EstadoIcon = estadoInfo.icon;

  // Calcular porcentajes para la barra visual
  const rangoTotal = rango.maximo - rango.minimo;
  const posicionValor = valorActual !== null 
    ? ((valorActual - rango.minimo) / rangoTotal) * 100 
    : 0;
  
  const posicionOptimoMin = ((rango.minimoOptimo - rango.minimo) / rangoTotal) * 100;
  const posicionOptimoMax = ((rango.maximoOptimo - rango.minimo) / rangoTotal) * 100;

  return (
    <div 
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: `2px solid ${estadoInfo.color}`,
        marginBottom: '20px'
      }}
    >
      {/* Header con icono y estado */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              backgroundColor: colorBase,
              borderRadius: '8px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <IconComponent size={24} color="white" />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#333', fontSize: '18px' }}>{titulo}</h3>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              Valor actual: <strong>{valorActual !== null ? `${valorActual.toFixed(1)} ${unidad}` : 'N/A'}</strong>
            </p>
          </div>
        </div>
        
        <div
          style={{
            backgroundColor: estadoInfo.bgColor,
            color: estadoInfo.color,
            padding: '8px 16px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          <EstadoIcon size={16} />
          {estadoInfo.texto}
        </div>
      </div>

      {/* Descripción del estado */}
      <p style={{ 
        margin: '0 0 16px 0', 
        color: '#666', 
        fontSize: '14px',
        fontStyle: 'italic' 
      }}>
        {estadoInfo.descripcion}
      </p>

      {/* Barra visual de rangos */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '8px',
          fontSize: '12px',
          color: '#666'
        }}>
          <span>Mínimo: {rango.minimo}</span>
          <span>Máximo: {rango.maximo}</span>
        </div>
        
        <div style={{
          position: 'relative',
          height: '32px',
          backgroundColor: '#f5f5f5',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          {/* Rango crítico completo */}
          <div
            style={{
              position: 'absolute',
              left: '0%',
              width: '100%',
              height: '100%',
              backgroundColor: '#ffeb3b',
              opacity: 0.3
            }}
          />
          
          {/* Rango óptimo */}
          <div
            style={{
              position: 'absolute',
              left: `${posicionOptimoMin}%`,
              width: `${posicionOptimoMax - posicionOptimoMin}%`,
              height: '100%',
              backgroundColor: '#4caf50',
              opacity: 0.6
            }}
          />
          
          {/* Indicador de valor actual */}
          {valorActual !== null && (
            <div
              style={{
                position: 'absolute',
                left: `${Math.max(0, Math.min(100, posicionValor))}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '4px',
                height: '24px',
                backgroundColor: estadoInfo.color,
                borderRadius: '2px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            />
          )}
        </div>
        
        {/* Etiquetas de rango óptimo */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '4px',
          fontSize: '11px',
          color: '#4caf50'
        }}>
          <span>Óptimo: {rango.minimoOptimo} - {rango.maximoOptimo}</span>
        </div>
      </div>

      {/* Información detallada de rangos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        fontSize: '12px'
      }}>
        <div style={{ 
          backgroundColor: '#fff9c4', 
          padding: '8px', 
          borderRadius: '6px',
          border: '1px solid #f57f17'
        }}>
          <strong style={{ color: '#f57f17' }}>🚨 Rango Crítico</strong><br />
          {rango.minimo} - {rango.maximo} {unidad}
        </div>
        <div style={{ 
          backgroundColor: '#e8f5e8', 
          padding: '8px', 
          borderRadius: '6px',
          border: '1px solid #4caf50'
        }}>
          <strong style={{ color: '#2e7d32' }}>✅ Rango Óptimo</strong><br />
          {rango.minimoOptimo} - {rango.maximoOptimo} {unidad}
        </div>
      </div>
    </div>
  );
}