'use client';

import { useState, useEffect } from 'react';
import {Box,Typography,Card,CardContent,TextField,Button,Paper,Alert,Snackbar, InputAdornment,Grid, Chip,Container,CardHeader,Avatar} from '@mui/material';
import {MdSettings,MdThermostat,MdScience,MdAir,MdSave,MdRestore,MdWarning,MdCheckCircle,MdInfo} from 'react-icons/md';

interface RangoSensor {
  minimo: number;
  maximo: number;
  minimoOptimo: number;
  maximoOptimo: number;
}

interface ConfiguracionRangos {
  temperatura: RangoSensor;
  ph: RangoSensor;
  oxigeno: RangoSensor;
}

// Configuración por defecto para acuicultura
const configuracionPorDefecto: ConfiguracionRangos = {
  temperatura: {
    minimo: 5,
    maximo: 25,
    minimoOptimo: 12,
    maximoOptimo: 18
  },
  ph: {
    minimo: 6.0,
    maximo: 9.0,
    minimoOptimo: 7.0,
    maximoOptimo: 8.2
  },
  oxigeno: {
    minimo: 3.0,
    maximo: 15.0,
    minimoOptimo: 5.0,
    maximoOptimo: 9.0
  }
};

// Información adicional para cada sensor
const infoSensores = {
  temperatura: {
    icono: MdThermostat,
    color: '#ff5722',
    unidad: '°C',
    titulo: 'Temperatura del Agua',
    descripcion: 'Controla la temperatura ideal para el crecimiento de peces',
    rangoFisico: { min: 0, max: 35 },
    recomendaciones: {
      critico: 'Temperaturas extremas pueden ser letales',
      optimo: 'Rango ideal para máximo crecimiento y salud'
    }
  },
  ph: {
    icono: MdScience,
    color: '#2196f3',
    unidad: 'pH',
    titulo: 'Nivel de pH',
    descripcion: 'Controla la acidez/alcalinidad del agua',
    rangoFisico: { min: 0, max: 14 },
    recomendaciones: {
      critico: 'pH extremos causan estrés y mortalidad',
      optimo: 'Mantiene el equilibrio químico ideal'
    }
  },
  oxigeno: {
    icono: MdAir,
    color: '#4caf50',
    unidad: 'mg/L',
    titulo: 'Oxígeno Disuelto',
    descripcion: 'Controla el oxígeno disponible para respiración',
    rangoFisico: { min: 0, max: 20 },
    recomendaciones: {
      critico: 'Niveles inadecuados causan asfixia o toxicidad',
      optimo: 'Garantiza respiración saludable'
    }
  }
};

export default function ConfiguracionPage() {
  const [configuracion, setConfiguracion] = useState<ConfiguracionRangos>(configuracionPorDefecto);
  const [configuracionOriginal, setConfiguracionOriginal] = useState<ConfiguracionRangos>(configuracionPorDefecto);
  const [mostrarAlerta, setMostrarAlerta] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState('');
  const [tipoAlerta, setTipoAlerta] = useState<'success' | 'error'>('success');

  // Cargar configuración desde localStorage al iniciar
  useEffect(() => {
    const configGuardada = localStorage.getItem('configuracionRangos');
    if (configGuardada) {
      try {
        const config = JSON.parse(configGuardada);
        setConfiguracion(config);
        setConfiguracionOriginal(config);
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      }
    }
  }, []);

  // Función para actualizar un rango específico
  const actualizarRango = (sensor: keyof ConfiguracionRangos, campo: keyof RangoSensor, valor: number) => {
    setConfiguracion(prev => ({
      ...prev,
      [sensor]: {
        ...prev[sensor],
        [campo]: valor
      }
    }));
  };

  // Validar rangos
  const validarRangos = (): boolean => {
    for (const sensor of Object.keys(configuracion) as Array<keyof ConfiguracionRangos>) {
      const rango = configuracion[sensor];
      
      if (rango.minimo >= rango.maximo) {
        setMensajeAlerta(`Error en ${sensor}: El valor mínimo debe ser menor que el máximo`);
        setTipoAlerta('error');
        setMostrarAlerta(true);
        return false;
      }
      
      if (rango.minimoOptimo < rango.minimo || rango.maximoOptimo > rango.maximo) {
        setMensajeAlerta(`Error en ${sensor}: El rango óptimo debe estar dentro del rango general`);
        setTipoAlerta('error');
        setMostrarAlerta(true);
        return false;
      }
      
      if (rango.minimoOptimo >= rango.maximoOptimo) {
        setMensajeAlerta(`Error en ${sensor}: El mínimo óptimo debe ser menor que el máximo óptimo`);
        setTipoAlerta('error');
        setMostrarAlerta(true);
        return false;
      }
    }
    
    return true;
  };

  // Guardar configuración
  const guardarConfiguracion = () => {
    if (!validarRangos()) return;

    try {
      localStorage.setItem('configuracionRangos', JSON.stringify(configuracion));
      setConfiguracionOriginal(configuracion);
      setMensajeAlerta('Configuración guardada exitosamente');
      setTipoAlerta('success');
      setMostrarAlerta(true);
    } catch (error) {
      setMensajeAlerta('Error al guardar configuración');
      setTipoAlerta('error');
      setMostrarAlerta(true);
    }
  };

  // Restaurar configuración por defecto
  const restaurarDefecto = () => {
    setConfiguracion(configuracionPorDefecto);
  };

  // Descartar cambios
  const descartarCambios = () => {
    setConfiguracion(configuracionOriginal);
  };

  // Verificar si hay cambios sin guardar
  const hayCambiosSinGuardar = JSON.stringify(configuracion) !== JSON.stringify(configuracionOriginal);

  // Función para renderizar cada sensor
  const renderSensorConfig = (sensorKey: keyof ConfiguracionRangos) => {
    const sensor = configuracion[sensorKey];
    const info = infoSensores[sensorKey];
    const IconComponent = info.icono;

    // Calcular porcentajes para las barras visuales
    const rangoTotal = info.rangoFisico.max - info.rangoFisico.min;
    const porcentajeMinimo = ((sensor.minimo - info.rangoFisico.min) / rangoTotal) * 100;
    const porcentajeMaximo = ((sensor.maximo - info.rangoFisico.min) / rangoTotal) * 100;
    const porcentajeMinimoOptimo = ((sensor.minimoOptimo - info.rangoFisico.min) / rangoTotal) * 100;
    const porcentajeMaximoOptimo = ((sensor.maximoOptimo - info.rangoFisico.min) / rangoTotal) * 100;

    return (
      <Card key={sensorKey} sx={{ mb: 3, boxShadow: 3 }}>
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: info.color, width: 56, height: 56 }}>
              <IconComponent size={28} />
            </Avatar>
          }
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6" component="div">
                {info.titulo}
              </Typography>
              <Chip 
                label={info.unidad} 
                size="small" 
                sx={{ bgcolor: info.color, color: 'white' }}
              />
            </Box>
          }
          subheader={
            <Typography variant="body2" color="text.secondary">
              {info.descripcion}
            </Typography>
          }
        />
        
        <Box sx={{ p: 3 }}>
          {/* Indicadores visuales de rangos */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Visualización de Rangos
            </Typography>
            <Box sx={{ position: 'relative', height: 40, bgcolor: '#f5f5f5', borderRadius: 2 }}>
              {/* Rango general (crítico) */}
              <Box
                sx={{
                  position: 'absolute',
                  left: `${porcentajeMinimo}%`,
                  width: `${porcentajeMaximo - porcentajeMinimo}%`,
                  height: '50%',
                  top: '25%',
                  bgcolor: '#ffeb3b',
                  borderRadius: 1,
                  border: '2px solid #f57f17'
                }}
              />
              {/* Rango óptimo */}
              <Box
                sx={{
                  position: 'absolute',
                  left: `${porcentajeMinimoOptimo}%`,
                  width: `${porcentajeMaximoOptimo - porcentajeMinimoOptimo}%`,
                  height: '70%',
                  top: '15%',
                  bgcolor: '#4caf50',
                  borderRadius: 1,
                  border: '2px solid #2e7d32'
                }}
              />
              {/* Etiquetas de valores */}
              <Typography 
                variant="caption" 
                sx={{ 
                  position: 'absolute', 
                  left: `${porcentajeMinimo}%`, 
                  top: -20, 
                  fontSize: '10px',
                  transform: 'translateX(-50%)'
                }}
              >
                {sensor.minimo}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  position: 'absolute', 
                  left: `${porcentajeMaximo}%`, 
                  top: -20, 
                  fontSize: '10px',
                  transform: 'translateX(-50%)'
                }}
              >
                {sensor.maximo}
              </Typography>
            </Box>
            
            {/* Leyenda */}
            <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 16, height: 8, bgcolor: '#ffeb3b', border: '1px solid #f57f17' }} />
                <Typography variant="caption">Rango Crítico</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 16, height: 8, bgcolor: '#4caf50', border: '1px solid #2e7d32' }} />
                <Typography variant="caption">Rango Óptimo</Typography>
              </Box>
            </Box>
          </Box>

          {/* Campos de entrada organizados en grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Rango Crítico */}
            <Card variant="outlined" sx={{ p: 2, bgcolor: '#fff9c4' }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#f57f17' }}>
                Rango Crítico
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {info.recomendaciones.critico}
              </Typography>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <TextField
                  fullWidth
                  label="Mínimo Crítico"
                  type="number"
                  value={sensor.minimo}
                  onChange={(e) => actualizarRango(sensorKey, 'minimo', parseFloat(e.target.value) || 0)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{info.unidad}</InputAdornment>,
                  }}
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Máximo Crítico"
                  type="number"
                  value={sensor.maximo}
                  onChange={(e) => actualizarRango(sensorKey, 'maximo', parseFloat(e.target.value) || 0)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{info.unidad}</InputAdornment>,
                  }}
                  size="small"
                />
              </div>
            </Card>

            {/* Rango Óptimo */}
            <Card variant="outlined" sx={{ p: 2, bgcolor: '#e8f5e8' }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                Rango Óptimo
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {info.recomendaciones.optimo}
              </Typography>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <TextField
                  fullWidth
                  label="Mínimo Óptimo"
                  type="number"
                  value={sensor.minimoOptimo}
                  onChange={(e) => actualizarRango(sensorKey, 'minimoOptimo', parseFloat(e.target.value) || 0)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{info.unidad}</InputAdornment>,
                  }}
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Máximo Óptimo"
                  type="number"
                  value={sensor.maximoOptimo}
                  onChange={(e) => actualizarRango(sensorKey, 'maximoOptimo', parseFloat(e.target.value) || 0)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{info.unidad}</InputAdornment>,
                  }}
                  size="small"
                />
              </div>
            </Card>
          </div>
        </Box>
      </Card>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Configuración de Rangos de Sensores
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Define los rangos óptimos y críticos para el monitoreo de calidad del agua
        </Typography>
      </Box>

      {/* Alerta de estado */}
      {mostrarAlerta && (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: tipoAlerta === 'success' ? '#e8f5e8' : '#ffebee',
              border: `1px solid ${tipoAlerta === 'success' ? '#4caf50' : '#f44336'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Typography variant="body1" sx={{ color: tipoAlerta === 'success' ? '#2e7d32' : '#c62828' }}>
              {tipoAlerta === 'success' ? '✅' : '❌'} {mensajeAlerta}
            </Typography>
            <Box sx={{ ml: 'auto' }}>
              <button 
                onClick={() => setMostrarAlerta(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  color: tipoAlerta === 'success' ? '#2e7d32' : '#c62828'
                }}
              >
                ✕
              </button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Configuraciones de sensores */}
      {Object.keys(configuracion).map(sensorKey => 
        renderSensorConfig(sensorKey as keyof ConfiguracionRangos)
      )}

      {/* Botones de acción */}
      <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={guardarConfiguracion}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          💾 Guardar Configuración
        </button>
        
        {hayCambiosSinGuardar && (
          <button
            onClick={descartarCambios}
            style={{
              padding: '12px 24px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            🔄 Descartar Cambios
          </button>
        )}
        
        <button
          onClick={restaurarDefecto}
          style={{
            padding: '12px 24px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          🏭 Restaurar Defecto
        </button>
      </Box>

      {/* Información adicional */}
      <Box sx={{ mt: 4, p: 3, bgcolor: '#f5f5f5', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
          📋 Información Importante
        </Typography>
        <Typography variant="body2" paragraph>
          • <strong>Rango Crítico:</strong> Límites absolutos que no deben superarse para evitar daños.
        </Typography>
        <Typography variant="body2" paragraph>
          • <strong>Rango Óptimo:</strong> Condiciones ideales para el máximo rendimiento y salud.
        </Typography>
        <Typography variant="body2" paragraph>
          • Los valores se guardan automáticamente en tu navegador y se aplicarán a todas las alertas.
        </Typography>
        <Typography variant="body2">
          • Estos rangos están basados en estándares de acuicultura chilena y pueden ajustarse según necesidades específicas.
        </Typography>
      </Box>
    </Container>
  );
}