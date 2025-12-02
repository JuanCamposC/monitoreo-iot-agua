'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  InputAdornment,
  Chip,
  CardHeader,
  Avatar,
  Paper
} from '@mui/material';
import { MdThermostat, MdScience, MdAir, MdSave, MdRestore } from 'react-icons/md';
import { ConfiguracionRangos, RangoSensor, configuracionRangosPorDefecto } from '../types';

interface ConfiguracionRangosProps {
  configuracion: ConfiguracionRangos;
  onActualizar: (nuevosRangos: ConfiguracionRangos) => boolean;
  onRestaurar: () => boolean;
}

// Información adicional para cada sensor
const infoSensores = {
  temperatura: {
    icono: MdThermostat,
    color: '#ff5722',
    unidad: '°C',
    titulo: 'Temperatura del Agua',
    descripcion: 'Controla la temperatura ideal para el crecimiento de peces',
    rangoFisico: { min: 0, max: 35 },
    paso: 0.5
  },
  ph: {
    icono: MdScience,
    color: '#3f51b5',
    unidad: 'pH',
    titulo: 'Nivel de pH',
    descripcion: 'Mantiene el equilibrio ácido-base del agua',
    rangoFisico: { min: 0, max: 14 },
    paso: 0.1
  },
  oxigeno: {
    icono: MdAir,
    color: '#00bcd4',
    unidad: 'mg/L',
    titulo: 'Oxígeno Disuelto',
    descripcion: 'Asegura niveles óptimos de oxígeno para la vida acuática',
    rangoFisico: { min: 0, max: 20 },
    paso: 0.1
  }
};

export default function ConfiguracionRangosComponent({ 
  configuracion, 
  onActualizar, 
  onRestaurar 
}: ConfiguracionRangosProps) {
  const [rangosLocal, setRangosLocal] = useState<ConfiguracionRangos>(configuracion);
  const [mensajeAlerta, setMensajeAlerta] = useState('');
  const [tipoAlerta, setTipoAlerta] = useState<'success' | 'error'>('success');
  const [mostrarAlerta, setMostrarAlerta] = useState(false);

  // Actualizar rangos locales cuando cambien los props
  useEffect(() => {
    setRangosLocal(configuracion);
  }, [configuracion]);

  // Función para actualizar un rango específico
  const actualizarRango = (sensor: keyof ConfiguracionRangos, campo: keyof RangoSensor, valor: number) => {
    setRangosLocal(prev => ({
      ...prev,
      [sensor]: {
        ...prev[sensor],
        [campo]: valor
      }
    }));
  };

  // Validar rangos
  const validarRangos = (): boolean => {
    for (const sensor of Object.keys(rangosLocal) as Array<keyof ConfiguracionRangos>) {
      const rango = rangosLocal[sensor];
      
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

    const exito = onActualizar(rangosLocal);
    if (exito) {
      setMensajeAlerta('Rangos de sensores guardados exitosamente');
      setTipoAlerta('success');
    } else {
      setMensajeAlerta('Error al guardar los rangos de sensores');
      setTipoAlerta('error');
    }
    setMostrarAlerta(true);
  };

  // Restaurar configuración por defecto
  const restaurarDefecto = () => {
    const exito = onRestaurar();
    setRangosLocal(configuracionRangosPorDefecto);
    
    if (exito) {
      setMensajeAlerta('Rangos restaurados a valores por defecto');
      setTipoAlerta('success');
    } else {
      setMensajeAlerta('Error al restaurar rangos por defecto');
      setTipoAlerta('error');
    }
    setMostrarAlerta(true);
  };

  // Descartar cambios
  const descartarCambios = () => {
    setRangosLocal(configuracion);
    setMensajeAlerta('Cambios descartados');
    setTipoAlerta('success');
    setMostrarAlerta(true);
  };

  // Verificar si hay cambios sin guardar
  const hayCambiosSinGuardar = JSON.stringify(rangosLocal) !== JSON.stringify(configuracion);

  // Función para renderizar cada sensor
  const renderSensorConfig = (sensorKey: keyof ConfiguracionRangos) => {
    const sensor = rangosLocal[sensorKey];
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
          subheader={info.descripcion}
        />
        <CardContent>
          {/* Inputs de configuración */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth
                label="Mínimo"
                type="number"
                value={sensor.minimo}
                onChange={(e) => actualizarRango(sensorKey, 'minimo', parseFloat(e.target.value) || 0)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{info.unidad}</InputAdornment>,
                  inputProps: { 
                    min: info.rangoFisico.min, 
                    max: info.rangoFisico.max, 
                    step: info.paso 
                  }
                }}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth
                label="Mínimo Óptimo"
                type="number"
                value={sensor.minimoOptimo}
                onChange={(e) => actualizarRango(sensorKey, 'minimoOptimo', parseFloat(e.target.value) || 0)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{info.unidad}</InputAdornment>,
                  inputProps: { 
                    min: info.rangoFisico.min, 
                    max: info.rangoFisico.max, 
                    step: info.paso 
                  }
                }}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth
                label="Máximo Óptimo"
                type="number"
                value={sensor.maximoOptimo}
                onChange={(e) => actualizarRango(sensorKey, 'maximoOptimo', parseFloat(e.target.value) || 0)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{info.unidad}</InputAdornment>,
                  inputProps: { 
                    min: info.rangoFisico.min, 
                    max: info.rangoFisico.max, 
                    step: info.paso 
                  }
                }}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth
                label="Máximo"
                type="number"
                value={sensor.maximo}
                onChange={(e) => actualizarRango(sensorKey, 'maximo', parseFloat(e.target.value) || 0)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{info.unidad}</InputAdornment>,
                  inputProps: { 
                    min: info.rangoFisico.min, 
                    max: info.rangoFisico.max, 
                    step: info.paso 
                  }
                }}
                size="small"
              />
            </Grid>
          </Grid>

          {/* Barra visual de rangos */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fafafa' }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Visualización de Rangos:
            </Typography>
            <Box sx={{ position: 'relative', height: 40, bgcolor: '#e0e0e0', borderRadius: 1, overflow: 'hidden', mb: 1 }}>
              {/* Zona crítica inferior */}
              <Box sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${porcentajeMinimo}%`,
                height: '100%',
                bgcolor: '#f44336',
                opacity: 0.3
              }} />
              
              {/* Zona aceptable inferior */}
              <Box sx={{
                position: 'absolute',
                left: `${porcentajeMinimo}%`,
                top: 0,
                width: `${porcentajeMinimoOptimo - porcentajeMinimo}%`,
                height: '100%',
                bgcolor: '#ff9800',
                opacity: 0.5
              }} />
              
              {/* Zona óptima */}
              <Box sx={{
                position: 'absolute',
                left: `${porcentajeMinimoOptimo}%`,
                top: 0,
                width: `${porcentajeMaximoOptimo - porcentajeMinimoOptimo}%`,
                height: '100%',
                bgcolor: '#4caf50',
                opacity: 0.7
              }} />
              
              {/* Zona aceptable superior */}
              <Box sx={{
                position: 'absolute',
                left: `${porcentajeMaximoOptimo}%`,
                top: 0,
                width: `${porcentajeMaximo - porcentajeMaximoOptimo}%`,
                height: '100%',
                bgcolor: '#ff9800',
                opacity: 0.5
              }} />
              
              {/* Zona crítica superior */}
              <Box sx={{
                position: 'absolute',
                left: `${porcentajeMaximo}%`,
                top: 0,
                width: `${100 - porcentajeMaximo}%`,
                height: '100%',
                bgcolor: '#f44336',
                opacity: 0.3
              }} />
            </Box>
            
            {/* Leyenda */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, fontSize: '0.75rem' }}>
              <Chip label="Crítico" size="small" sx={{ bgcolor: '#f44336', color: 'white' }} />
              <Chip label="Aceptable" size="small" sx={{ bgcolor: '#ff9800', color: 'white' }} />
              <Chip label="Óptimo" size="small" sx={{ bgcolor: '#4caf50', color: 'white' }} />
            </Box>
          </Paper>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        Configuración de Rangos de Sensores
      </Typography>

      {/* Alerta de cambios */}
      {mostrarAlerta && (
        <Alert 
          severity={tipoAlerta} 
          sx={{ mb: 3 }} 
          onClose={() => setMostrarAlerta(false)}
        >
          {mensajeAlerta}
        </Alert>
      )}

      {/* Sensores */}
      {(Object.keys(infoSensores) as Array<keyof ConfiguracionRangos>).map(renderSensorConfig)}

      {/* Botones de acción */}
      <Paper sx={{ p: 2, mt: 3, bgcolor: hayCambiosSinGuardar ? '#fff3e0' : '#f5f5f5' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            {hayCambiosSinGuardar && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Tienes cambios sin guardar
              </Alert>
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={descartarCambios}
                disabled={!hayCambiosSinGuardar}
                size="small"
              >
                Descartar
              </Button>
              <Button
                variant="outlined"
                color="warning"
                onClick={restaurarDefecto}
                startIcon={<MdRestore />}
                size="small"
              >
                Restaurar
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={guardarConfiguracion}
                startIcon={<MdSave />}
                disabled={!hayCambiosSinGuardar}
              >
                Guardar Rangos
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}