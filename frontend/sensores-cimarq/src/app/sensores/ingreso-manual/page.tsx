'use client';

import { useState } from 'react';
import { Box, Typography, Card, CardContent, TextField, Button, Grid, Alert,Snackbar,InputAdornment,Chip,Paper,CircularProgress } from '@mui/material';
import { MdThermostat, MdScience, MdAir, MdSave, MdRefresh } from 'react-icons/md';
import { useConfiguracionRangos } from '../../hooks/useConfiguracionRangos';

interface DatosIngreso {
  temperatura: string;
  ph: string;
  oxigeno: string;
  fecha: string;
  hora: string;
}

export default function IngresoManualPage() {
  const [datos, setDatos] = useState<DatosIngreso>({
    temperatura: '',
    ph: '',
    oxigeno: '',
    fecha: new Date().toISOString().split('T')[0], // Fecha actual en formato YYYY-MM-DD
    hora: new Date().toTimeString().slice(0, 5) // Hora actual en formato HH:MM
  });

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'success' | 'error'>('success');
  const [mostrarSnackbar, setMostrarSnackbar] = useState(false);

  const { evaluarEstadoSensor } = useConfiguracionRangos();

  const handleInputChange = (campo: keyof DatosIngreso, valor: string) => {
    setDatos(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const validarDatos = (): boolean => {
    // Validar que todos los campos estén llenos
    if (!datos.temperatura || !datos.ph || !datos.oxigeno || !datos.fecha || !datos.hora) {
      setMensaje('Todos los campos son obligatorios');
      setTipoMensaje('error');
      setMostrarSnackbar(true);
      return false;
    }

    // Validar rangos básicos
    const temp = parseFloat(datos.temperatura);
    const ph = parseFloat(datos.ph);
    const oxigeno = parseFloat(datos.oxigeno);

    if (isNaN(temp) || temp < -50 || temp > 100) {
      setMensaje('La temperatura debe estar entre -50°C y 100°C');
      setTipoMensaje('error');
      setMostrarSnackbar(true);
      return false;
    }

    if (isNaN(ph) || ph < 0 || ph > 14) {
      setMensaje('El pH debe estar entre 0 y 14');
      setTipoMensaje('error');
      setMostrarSnackbar(true);
      return false;
    }

    if (isNaN(oxigeno) || oxigeno < 0 || oxigeno > 30) {
      setMensaje('El oxígeno debe estar entre 0 y 30 mg/L');
      setTipoMensaje('error');
      setMostrarSnackbar(true);
      return false;
    }

    return true;
  };

  const guardarDatos = async () => {
    if (!validarDatos()) return;

    setGuardando(true);

    try {
      // Combinar fecha y hora para crear timestamp ISO
      const fechaCompleta = new Date(`${datos.fecha}T${datos.hora}:00`);
      
      // Preparar datos para envío
      const datosEnvio = {
        temperatura: parseFloat(datos.temperatura),
        ph: parseFloat(datos.ph),
        oxigeno: parseFloat(datos.oxigeno),
        fecha: fechaCompleta.toISOString(),
        fuente: 'manual', // Identificar que es ingreso manual
        usuario: 'admin' // Podría ser dinámico en el futuro
      };

      // Envío unificado al backend (datos completos en una sola petición)
      try {
        const response = await fetch('http://localhost:5000/api/v1/sensores/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            temperatura: datosEnvio.temperatura,
            ph: datosEnvio.ph,
            oxigeno: datosEnvio.oxigeno,
            fecha: datosEnvio.fecha,
            fuente: datosEnvio.fuente,
            usuario: datosEnvio.usuario
          })
        });

        if (response.ok) {
          const resultado = await response.json();
          setMensaje('Datos guardados exitosamente en la base de datos');
          setTipoMensaje('success');
          
          // Limpiar formulario después del éxito
          setTimeout(() => {
            limpiarFormulario();
          }, 2000);
        } else {
          // Intentar obtener el error del response
          let errorMessage = 'Error al guardar datos';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = `Error ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }
      } catch (networkError) {
        // Error de red o conexión
        const error = networkError as Error;
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error('Error de conexión: No se puede conectar al servidor. Verifique que el backend esté ejecutándose.');
        } else {
          throw new Error(error.message || 'Error desconocido');
        }
      }

    } catch (error) {
      console.error('Error al guardar datos:', error);
      setMensaje('Error al guardar los datos. Verifique la conexión con el servidor.');
      setTipoMensaje('error');
    } finally {
      setGuardando(false);
      setMostrarSnackbar(true);
    }
  };

  const limpiarFormulario = () => {
    setDatos({
      temperatura: '',
      ph: '',
      oxigeno: '',
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().slice(0, 5)
    });
  };

  const establecerFechaHoraActual = () => {
    const ahora = new Date();
    setDatos(prev => ({
      ...prev,
      fecha: ahora.toISOString().split('T')[0],
      hora: ahora.toTimeString().slice(0, 5)
    }));
  };

  const getEstadoSensor = (valor: string, tipo: 'temperatura' | 'ph' | 'oxigeno') => {
    if (!valor || isNaN(parseFloat(valor))) return null;
    return evaluarEstadoSensor(tipo, parseFloat(valor));
  };

  const getColorEstado = (estado: string | null) => {
    if (!estado) return 'default';
    const colorMap: Record<string, 'success' | 'warning' | 'error'> = {
      'óptimo': 'success',
      'aceptable': 'warning',
      'crítico': 'error'
    };
    return colorMap[estado] || 'default';
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Ingreso Manual de Datos
        </Typography>
        <Typography variant="h6">
          Registre manualmente los valores de los sensores en el sistema
        </Typography>
      </Paper>

      {/* Información importante */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Instrucciones:</strong> Complete todos los campos con los valores medidos. 
          El sistema validará que los datos estén dentro de rangos lógicos antes de guardarlos.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* Formulario de datos */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Fecha y Hora del Registro
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Fecha"
                    type="date"
                    value={datos.fecha}
                    onChange={(e) => handleInputChange('fecha', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Hora"
                    type="time"
                    value={datos.hora}
                    onChange={(e) => handleInputChange('hora', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={establecerFechaHoraActual}
                    startIcon={<MdRefresh />}
                  >
                    Usar Fecha/Hora Actual
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Valores de Sensores
              </Typography>

              <Grid container spacing={2}>
                {/* Temperatura */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card variant="outlined" sx={{ p: 2, bgcolor: '#fff3e0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <MdThermostat size={24} color="#ff5722" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        Temperatura
                      </Typography>
                      {datos.temperatura && (
                        <Chip 
                          label={getEstadoSensor(datos.temperatura, 'temperatura')?.toUpperCase() || 'VALIDANDO'} 
                          color={getColorEstado(getEstadoSensor(datos.temperatura, 'temperatura'))}
                          size="small"
                        />
                      )}
                    </Box>
                    <TextField
                      fullWidth
                      label="Valor"
                      type="number"
                      value={datos.temperatura}
                      onChange={(e) => handleInputChange('temperatura', e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                      }}
                      size="small"
                      placeholder="Ej: 22.5"
                    />
                  </Card>
                </Grid>

                {/* pH */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card variant="outlined" sx={{ p: 2, bgcolor: '#e3f2fd' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <MdScience size={24} color="#2196f3" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        pH
                      </Typography>
                      {datos.ph && (
                        <Chip 
                          label={getEstadoSensor(datos.ph, 'ph')?.toUpperCase() || 'VALIDANDO'} 
                          color={getColorEstado(getEstadoSensor(datos.ph, 'ph'))}
                          size="small"
                        />
                      )}
                    </Box>
                    <TextField
                      fullWidth
                      label="Valor"
                      type="number"
                      value={datos.ph}
                      onChange={(e) => handleInputChange('ph', e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">pH</InputAdornment>,
                      }}
                      size="small"
                      placeholder="Ej: 7.2"
                      inputProps={{ step: 0.1 }}
                    />
                  </Card>
                </Grid>

                {/* Oxígeno */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card variant="outlined" sx={{ p: 2, bgcolor: '#e8f5e8' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <MdAir size={24} color="#4caf50" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        Oxígeno
                      </Typography>
                      {datos.oxigeno && (
                        <Chip 
                          label={getEstadoSensor(datos.oxigeno, 'oxigeno')?.toUpperCase() || 'VALIDANDO'} 
                          color={getColorEstado(getEstadoSensor(datos.oxigeno, 'oxigeno'))}
                          size="small"
                        />
                      )}
                    </Box>
                    <TextField
                      fullWidth
                      label="Valor"
                      type="number"
                      value={datos.oxigeno}
                      onChange={(e) => handleInputChange('oxigeno', e.target.value)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">mg/L</InputAdornment>,
                      }}
                      size="small"
                      placeholder="Ej: 8.5"
                      inputProps={{ step: 0.1 }}
                    />
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={guardarDatos}
                    disabled={guardando}
                    startIcon={guardando ? <CircularProgress size={20} /> : <MdSave />}
                    sx={{ py: 1.5 }}
                  >
                    {guardando ? 'Guardando...' : 'Guardar Datos'}
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={limpiarFormulario}
                    disabled={guardando}
                    startIcon={<MdRefresh />}
                    sx={{ py: 1.5 }}
                  >
                    Limpiar Formulario
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Panel de información */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                💡 Información
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Los datos ingresados manualmente se almacenarán con la marca de tiempo especificada y serán incluidos en todos los análisis y gráficos.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Rangos válidos:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Temperatura: -50°C a 100°C<br/>
                • pH: 0 a 14<br/>
                • Oxígeno: 0 a 30 mg/L
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔍 Vista Previa
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Fecha/Hora: {datos.fecha} {datos.hora}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  🌡️ Temperatura: {datos.temperatura || '--'} °C
                </Typography>
                <Typography variant="body2">
                  ⚗️ pH: {datos.ph || '--'}
                </Typography>
                <Typography variant="body2">
                  💨 Oxígeno: {datos.oxigeno || '--'} mg/L
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar para mensajes */}
      <Snackbar
        open={mostrarSnackbar}
        autoHideDuration={6000}
        onClose={() => setMostrarSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setMostrarSnackbar(false)} 
          severity={tipoMensaje}
          sx={{ width: '100%' }}
        >
          {mensaje}
        </Alert>
      </Snackbar>
    </Box>
  );
}