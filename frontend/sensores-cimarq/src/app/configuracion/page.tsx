'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Paper,
  Alert,
  Snackbar,
  Divider,
  FormControl,
  FormLabel,
  InputAdornment
} from '@mui/material';
import {
  MdSettings,
  MdThermostat,
  MdScience,
  MdAir,
  MdSave,
  MdRestore
} from 'react-icons/md';

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
    maximo: 8.5,
    minimoOptimo: 6.8,
    maximoOptimo: 7.8
  },
  oxigeno: {
    minimo: 3.0,
    maximo: 15.0,
    minimoOptimo: 6.0,
    maximoOptimo: 10.0
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
      
      // Validar que mínimo < máximo
      if (rango.minimo >= rango.maximo) {
        setMensajeAlerta(`Error en ${sensor}: El valor mínimo debe ser menor al máximo`);
        setTipoAlerta('error');
        setMostrarAlerta(true);
        return false;
      }
      
      // Validar que rango óptimo esté dentro del rango general
      if (rango.minimoOptimo < rango.minimo || rango.maximoOptimo > rango.maximo) {
        setMensajeAlerta(`Error en ${sensor}: El rango óptimo debe estar dentro del rango general`);
        setTipoAlerta('error');
        setMostrarAlerta(true);
        return false;
      }
      
      // Validar que rango óptimo sea válido
      if (rango.minimoOptimo >= rango.maximoOptimo) {
        setMensajeAlerta(`Error en ${sensor}: El rango óptimo mínimo debe ser menor al máximo`);
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
      
      // Disparar evento personalizado para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('configuracionActualizada', { 
        detail: configuracion 
      }));
    } catch (error) {
      setMensajeAlerta('Error al guardar la configuración');
      setTipoAlerta('error');
      setMostrarAlerta(true);
    }
  };

  // Restaurar valores por defecto
  const restaurarDefecto = () => {
    setConfiguracion(configuracionPorDefecto);
  };

  // Descartar cambios
  const descartarCambios = () => {
    setConfiguracion(configuracionOriginal);
  };

  // Verificar si hay cambios sin guardar
  const hayCambiosSinGuardar = JSON.stringify(configuracion) !== JSON.stringify(configuracionOriginal);

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2 }}>
          <MdSettings size={40} color="#1976d2" />
          <Typography variant="h3" component="h1" sx={{ color: '#1f2937', flexGrow: 1 }}>
            Configuración de Rangos - CIMARQ
          </Typography>
        </Box>

        {/* Descripción */}
        <Alert severity="info" sx={{ mb: 4 }}>
          <Typography variant="body2">
            Configure los rangos aceptables para cada sensor. Los valores fuera del rango general generarán 
            alertas críticas, mientras que los valores fuera del rango óptimo generarán alertas preventivas.
          </Typography>
        </Alert>

        {/* Configuración de Temperatura */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <MdThermostat size={24} color="#f44336" />
              <Typography variant="h5" color="primary">
                Temperatura del Agua
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <FormControl>
                <FormLabel>Rango General</FormLabel>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <TextField
                    size="small"
                    label="Mínimo"
                    type="number"
                    value={configuracion.temperatura.minimo}
                    onChange={(e) => actualizarRango('temperatura', 'minimo', parseFloat(e.target.value) || 0)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°C</InputAdornment>
                    }}
                    sx={{ width: '120px' }}
                  />
                  <TextField
                    size="small"
                    label="Máximo"
                    type="number"
                    value={configuracion.temperatura.maximo}
                    onChange={(e) => actualizarRango('temperatura', 'maximo', parseFloat(e.target.value) || 0)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°C</InputAdornment>
                    }}
                    sx={{ width: '120px' }}
                  />
                </Box>
              </FormControl>
              
              <FormControl>
                <FormLabel>Rango Óptimo</FormLabel>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <TextField
                    size="small"
                    label="Mínimo Óptimo"
                    type="number"
                    value={configuracion.temperatura.minimoOptimo}
                    onChange={(e) => actualizarRango('temperatura', 'minimoOptimo', parseFloat(e.target.value) || 0)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°C</InputAdornment>
                    }}
                    sx={{ width: '120px' }}
                  />
                  <TextField
                    size="small"
                    label="Máximo Óptimo"
                    type="number"
                    value={configuracion.temperatura.maximoOptimo}
                    onChange={(e) => actualizarRango('temperatura', 'maximoOptimo', parseFloat(e.target.value) || 0)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">°C</InputAdornment>
                    }}
                    sx={{ width: '120px' }}
                  />
                </Box>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

        {/* Configuración de pH */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <MdScience size={24} color="#ff9800" />
              <Typography variant="h5" color="primary">
                pH del Agua
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <FormControl>
                <FormLabel>Rango General</FormLabel>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <TextField
                    size="small"
                    label="Mínimo"
                    type="number"
                    inputProps={{ step: 0.1 }}
                    value={configuracion.ph.minimo}
                    onChange={(e) => actualizarRango('ph', 'minimo', parseFloat(e.target.value) || 0)}
                    sx={{ width: '120px' }}
                  />
                  <TextField
                    size="small"
                    label="Máximo"
                    type="number"
                    inputProps={{ step: 0.1 }}
                    value={configuracion.ph.maximo}
                    onChange={(e) => actualizarRango('ph', 'maximo', parseFloat(e.target.value) || 0)}
                    sx={{ width: '120px' }}
                  />
                </Box>
              </FormControl>
              
              <FormControl>
                <FormLabel>Rango Óptimo</FormLabel>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <TextField
                    size="small"
                    label="Mínimo Óptimo"
                    type="number"
                    inputProps={{ step: 0.1 }}
                    value={configuracion.ph.minimoOptimo}
                    onChange={(e) => actualizarRango('ph', 'minimoOptimo', parseFloat(e.target.value) || 0)}
                    sx={{ width: '120px' }}
                  />
                  <TextField
                    size="small"
                    label="Máximo Óptimo"
                    type="number"
                    inputProps={{ step: 0.1 }}
                    value={configuracion.ph.maximoOptimo}
                    onChange={(e) => actualizarRango('ph', 'maximoOptimo', parseFloat(e.target.value) || 0)}
                    sx={{ width: '120px' }}
                  />
                </Box>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

        {/* Configuración de Oxígeno */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <MdAir size={24} color="#2196f3" />
              <Typography variant="h5" color="primary">
                Oxígeno Disuelto
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <FormControl>
                <FormLabel>Rango General</FormLabel>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <TextField
                    size="small"
                    label="Mínimo"
                    type="number"
                    inputProps={{ step: 0.1 }}
                    value={configuracion.oxigeno.minimo}
                    onChange={(e) => actualizarRango('oxigeno', 'minimo', parseFloat(e.target.value) || 0)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">mg/L</InputAdornment>
                    }}
                    sx={{ width: '120px' }}
                  />
                  <TextField
                    size="small"
                    label="Máximo"
                    type="number"
                    inputProps={{ step: 0.1 }}
                    value={configuracion.oxigeno.maximo}
                    onChange={(e) => actualizarRango('oxigeno', 'maximo', parseFloat(e.target.value) || 0)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">mg/L</InputAdornment>
                    }}
                    sx={{ width: '120px' }}
                  />
                </Box>
              </FormControl>
              
              <FormControl>
                <FormLabel>Rango Óptimo</FormLabel>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <TextField
                    size="small"
                    label="Mínimo Óptimo"
                    type="number"
                    inputProps={{ step: 0.1 }}
                    value={configuracion.oxigeno.minimoOptimo}
                    onChange={(e) => actualizarRango('oxigeno', 'minimoOptimo', parseFloat(e.target.value) || 0)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">mg/L</InputAdornment>
                    }}
                    sx={{ width: '120px' }}
                  />
                  <TextField
                    size="small"
                    label="Máximo Óptimo"
                    type="number"
                    inputProps={{ step: 0.1 }}
                    value={configuracion.oxigeno.maximoOptimo}
                    onChange={(e) => actualizarRango('oxigeno', 'maximoOptimo', parseFloat(e.target.value) || 0)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">mg/L</InputAdornment>
                    }}
                    sx={{ width: '120px' }}
                  />
                </Box>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <Paper sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<MdRestore />}
              onClick={restaurarDefecto}
            >
              Restaurar Defecto
            </Button>
            {hayCambiosSinGuardar && (
              <Button
                variant="outlined"
                color="warning"
                onClick={descartarCambios}
              >
                Descartar Cambios
              </Button>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {hayCambiosSinGuardar && (
              <Typography variant="body2" color="warning.main">
                Hay cambios sin guardar
              </Typography>
            )}
            <Button
              variant="contained"
              startIcon={<MdSave />}
              onClick={guardarConfiguracion}
              disabled={!hayCambiosSinGuardar}
            >
              Guardar Configuración
            </Button>
          </Box>
        </Paper>

        {/* Snackbar para alertas */}
        <Snackbar
          open={mostrarAlerta}
          autoHideDuration={4000}
          onClose={() => setMostrarAlerta(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setMostrarAlerta(false)}
            severity={tipoAlerta}
            sx={{ width: '100%' }}
          >
            {mensajeAlerta}
          </Alert>
        </Snackbar>
      </div>
    </div>
  );
}
