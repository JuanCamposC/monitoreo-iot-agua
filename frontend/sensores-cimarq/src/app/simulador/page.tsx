'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Paper,
  Slider,
  Chip,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  MdPlayArrow,
  MdStop,
  MdSettings,
  MdTrendingUp,
  MdTrendingDown,
  MdWarning,
  MdInfo,
  MdRefresh,
  MdTimer,
  MdThermostat,
  MdScience,
  MdAir
} from 'react-icons/md';

interface ConfiguracionSensor {
  activo: boolean;
  min: number;
  max: number;
  tendencia: 'normal' | 'subiendo' | 'bajando' | 'critico';
}

interface ConfiguracionSimulador {
  activo: boolean;
  intervalo: number; // en segundos
  temperatura: ConfiguracionSensor;
  ph: ConfiguracionSensor;
  oxigeno: ConfiguracionSensor;
}

interface DatoSimulacion {
  timestamp: string;
  temperatura?: number;
  ph?: number;
  oxigeno?: number;
  estado: 'enviado' | 'error';
}

export default function SimuladorPage() {
  const [configuracion, setConfiguracion] = useState<ConfiguracionSimulador>({
    activo: false,
    intervalo: 30,
    temperatura: {
      activo: true,
      min: 15,
      max: 25,
      tendencia: 'normal'
    },
    ph: {
      activo: true,
      min: 6.5,
      max: 8.5,
      tendencia: 'normal'
    },
    oxigeno: {
      activo: true,
      min: 5,
      max: 12,
      tendencia: 'normal'
    }
  });

  const [historialDatos, setHistorialDatos] = useState<DatoSimulacion[]>([]);
  const [ultimoEnvio, setUltimoEnvio] = useState<string>('');
  const [proximoEnvio, setProximoEnvio] = useState<number>(0);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'success' | 'error' | 'info'>('info');
  const [mostrarSnackbar, setMostrarSnackbar] = useState(false);
  const [modalConfiguracion, setModalConfiguracion] = useState(false);
  const [estadisticas, setEstadisticas] = useState({
    totalEnviados: 0,
    errores: 0,
    tiempoActivo: 0
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const contadorRef = useRef<NodeJS.Timeout | null>(null);
  const inicioSimulacionRef = useRef<Date | null>(null);

  // Efecto para manejar el temporizador del simulador
  useEffect(() => {
    if (configuracion.activo) {
      iniciarSimulador();
    } else {
      detenerSimulador();
    }

    return () => {
      detenerSimulador();
    };
  }, [configuracion.activo, configuracion.intervalo]);

  // Efecto para el contador de próximo envío
  useEffect(() => {
    if (configuracion.activo && proximoEnvio > 0) {
      contadorRef.current = setInterval(() => {
        setProximoEnvio(prev => {
          if (prev <= 1) {
            return configuracion.intervalo;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (contadorRef.current) {
        clearInterval(contadorRef.current);
        contadorRef.current = null;
      }
    }

    return () => {
      if (contadorRef.current) {
        clearInterval(contadorRef.current);
      }
    };
  }, [configuracion.activo, proximoEnvio, configuracion.intervalo]);

  const iniciarSimulador = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    inicioSimulacionRef.current = new Date();
    setProximoEnvio(configuracion.intervalo);
    
    // Enviar primer dato inmediatamente
    enviarDatoSimulado();

    // Configurar intervalo para envíos posteriores
    intervalRef.current = setInterval(() => {
      enviarDatoSimulado();
    }, configuracion.intervalo * 1000);

    mostrarMensaje('🚀 Simulador iniciado correctamente', 'success');
  };

  const detenerSimulador = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (contadorRef.current) {
      clearInterval(contadorRef.current);
      contadorRef.current = null;
    }
    
    setProximoEnvio(0);
    
    if (inicioSimulacionRef.current) {
      const tiempoTotal = Math.floor((new Date().getTime() - inicioSimulacionRef.current.getTime()) / 1000);
      setEstadisticas(prev => ({
        ...prev,
        tiempoActivo: prev.tiempoActivo + tiempoTotal
      }));
      inicioSimulacionRef.current = null;
    }

    mostrarMensaje('⏹️ Simulador detenido', 'info');
  };

  const generarValorSensor = (config: ConfiguracionSensor, valorAnterior?: number): number => {
    let valor: number;
    
    switch (config.tendencia) {
      case 'subiendo':
        // Tendencia hacia valores más altos
        const rangoAlto = (config.max - config.min) * 0.7;
        valor = config.min + rangoAlto + Math.random() * (config.max - config.min - rangoAlto);
        break;
        
      case 'bajando':
        // Tendencia hacia valores más bajos
        const rangoBajo = (config.max - config.min) * 0.3;
        valor = config.min + Math.random() * rangoBajo;
        break;
        
      case 'critico':
        // Valores extremos (críticos)
        valor = Math.random() > 0.5 
          ? config.min - Math.random() * (config.min * 0.2) // Por debajo del mínimo
          : config.max + Math.random() * (config.max * 0.2); // Por encima del máximo
        break;
        
      default: // 'normal'
        valor = config.min + Math.random() * (config.max - config.min);
        break;
    }

    // Redondear según el tipo de sensor
    return Math.round(valor * 100) / 100;
  };

  const enviarDatoSimulado = async () => {
    if (enviando) return;
    
    setEnviando(true);
    
    try {
      const datoSimulado: any = {
        fuente: 'simulador',
        usuario: 'simulador_web'
      };

      // Generar valores para sensores activos
      if (configuracion.temperatura.activo) {
        datoSimulado.temperatura = generarValorSensor(configuracion.temperatura);
      }
      
      if (configuracion.ph.activo) {
        datoSimulado.ph = generarValorSensor(configuracion.ph);
      }
      
      if (configuracion.oxigeno.activo) {
        datoSimulado.oxigeno = generarValorSensor(configuracion.oxigeno);
      }

      // Enviar datos al endpoint manual
      const respuesta = await fetch('http://localhost:5000/api/v1/sensores/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datoSimulado)
      });

      const ahora = new Date().toISOString();
      
      if (respuesta.ok) {
        const resultado = await respuesta.json();
        
        // Agregar al historial
        const nuevoRegistro: DatoSimulacion = {
          timestamp: ahora,
          temperatura: datoSimulado.temperatura,
          ph: datoSimulado.ph,
          oxigeno: datoSimulado.oxigeno,
          estado: 'enviado'
        };
        
        setHistorialDatos(prev => [nuevoRegistro, ...prev.slice(0, 49)]); // Mantener últimos 50
        setUltimoEnvio(ahora);
        
        // Actualizar estadísticas
        setEstadisticas(prev => ({
          ...prev,
          totalEnviados: prev.totalEnviados + 1
        }));

        // Log de éxito
        console.log('📡 Dato simulado enviado:', datoSimulado);
        
      } else {
        throw new Error(`Error HTTP: ${respuesta.status}`);
      }
      
    } catch (error: any) {
      console.error('❌ Error enviando dato simulado:', error);
      
      // Agregar error al historial
      const registroError: DatoSimulacion = {
        timestamp: new Date().toISOString(),
        estado: 'error'
      };
      
      setHistorialDatos(prev => [registroError, ...prev.slice(0, 49)]);
      
      // Actualizar estadísticas de errores
      setEstadisticas(prev => ({
        ...prev,
        errores: prev.errores + 1
      }));

      mostrarMensaje(`❌ Error al enviar datos: ${error.message}`, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const mostrarMensaje = (mensaje: string, tipo: 'success' | 'error' | 'info') => {
    setMensaje(mensaje);
    setTipoMensaje(tipo);
    setMostrarSnackbar(true);
  };

  const reiniciarEstadisticas = () => {
    setEstadisticas({
      totalEnviados: 0,
      errores: 0,
      tiempoActivo: 0
    });
    setHistorialDatos([]);
    mostrarMensaje('📊 Estadísticas reiniciadas', 'info');
  };

  const aplicarTendencia = (sensor: keyof Pick<ConfiguracionSimulador, 'temperatura' | 'ph' | 'oxigeno'>, tendencia: ConfiguracionSensor['tendencia']) => {
    setConfiguracion(prev => ({
      ...prev,
      [sensor]: {
        ...prev[sensor],
        tendencia
      }
    }));
    
    const nombreSensor = sensor === 'temperatura' ? 'Temperatura' : sensor === 'ph' ? 'pH' : 'Oxígeno';
    const descripcionTendencia = {
      'normal': 'valores normales',
      'subiendo': 'valores altos',
      'bajando': 'valores bajos',
      'critico': 'valores críticos'
    }[tendencia];
    
    mostrarMensaje(`🎯 ${nombreSensor}: ${descripcionTendencia}`, 'info');
  };

  const formatearTiempo = (segundos: number): string => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    
    if (horas > 0) {
      return `${horas}h ${minutos}m ${segs}s`;
    } else if (minutos > 0) {
      return `${minutos}m ${segs}s`;
    } else {
      return `${segs}s`;
    }
  };

  const getColorTendencia = (tendencia: ConfiguracionSensor['tendencia']) => {
    switch (tendencia) {
      case 'normal': return 'success';
      case 'subiendo': return 'warning';
      case 'bajando': return 'info';
      case 'critico': return 'error';
      default: return 'default';
    }
  };

  const getIconoTendencia = (tendencia: ConfiguracionSensor['tendencia']) => {
    switch (tendencia) {
      case 'subiendo': return <MdTrendingUp />;
      case 'bajando': return <MdTrendingDown />;
      case 'critico': return <MdWarning />;
      default: return <MdInfo />;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Simulador de Sensores
        </Typography>
        <Typography variant="h6">
          Configuración avanzada para pruebas y validación del sistema de monitoreo
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
          • Configure intervalos de envío • Establezca rangos de valores • Simule criticidad para probar alertas
        </Typography>
      </Paper>

      <Grid container spacing={3}>
        {/* Panel de Control Principal */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MdSettings /> Control Principal
              </Typography>
              
              {/* Estado del Simulador */}
              <FormControlLabel
                control={
                  <Switch
                    checked={configuracion.activo}
                    onChange={(e) => setConfiguracion(prev => ({ ...prev, activo: e.target.checked }))}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {configuracion.activo ? '🟢 Activo' : '🔴 Inactivo'}
                  </Box>
                }
                sx={{ mb: 2 }}
              />

              {/* Intervalo de Envío */}
              <Typography gutterBottom>Intervalo de Envío: {configuracion.intervalo}s</Typography>
              <Slider
                value={configuracion.intervalo}
                onChange={(_, value) => setConfiguracion(prev => ({ ...prev, intervalo: value as number }))}
                min={5}
                max={300}
                step={5}
                marks={[
                  { value: 5, label: '5s' },
                  { value: 30, label: '30s' },
                  { value: 60, label: '1m' },
                  { value: 300, label: '5m' }
                ]}
                disabled={configuracion.activo}
                sx={{ mb: 2 }}
              />

              {/* Próximo Envío */}
              {configuracion.activo && (
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <Chip
                    icon={<MdTimer />}
                    label={`Próximo envío: ${proximoEnvio}s`}
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              )}

              {/* Estado de Sensores */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Estado de Sensores:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">🌡️ Temperatura:</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {configuracion.temperatura.activo ? (
                        <>
                          <Chip size="small" label={`${configuracion.temperatura.min}-${configuracion.temperatura.max}°C`} />
                          <Chip 
                            size="small" 
                            label={configuracion.temperatura.tendencia} 
                            color={getColorTendencia(configuracion.temperatura.tendencia) as any}
                          />
                        </>
                      ) : (
                        <Chip size="small" label="Inactivo" color="default" />
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">🧪 pH:</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {configuracion.ph.activo ? (
                        <>
                          <Chip size="small" label={`${configuracion.ph.min}-${configuracion.ph.max}`} />
                          <Chip 
                            size="small" 
                            label={configuracion.ph.tendencia} 
                            color={getColorTendencia(configuracion.ph.tendencia) as any}
                          />
                        </>
                      ) : (
                        <Chip size="small" label="Inactivo" color="default" />
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">💨 Oxígeno:</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {configuracion.oxigeno.activo ? (
                        <>
                          <Chip size="small" label={`${configuracion.oxigeno.min}-${configuracion.oxigeno.max} mg/L`} />
                          <Chip 
                            size="small" 
                            label={configuracion.oxigeno.tendencia} 
                            color={getColorTendencia(configuracion.oxigeno.tendencia) as any}
                          />
                        </>
                      ) : (
                        <Chip size="small" label="Inactivo" color="default" />
                      )}
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* Botones de Acción */}
              <Grid container spacing={1}>
                <Grid size={{ xs: 12 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    color={configuracion.activo ? 'error' : 'success'}
                    onClick={() => setConfiguracion(prev => ({ ...prev, activo: !prev.activo }))}
                    startIcon={configuracion.activo ? <MdStop /> : <MdPlayArrow />}
                    disabled={enviando}
                    sx={{ mb: 1 }}
                  >
                    {configuracion.activo ? 'Detener Simulador' : 'Iniciar Simulador'}
                  </Button>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={enviarDatoSimulado}
                    disabled={enviando}
                    startIcon={enviando ? <CircularProgress size={16} /> : <MdRefresh />}
                  >
                    {enviando ? 'Enviando...' : 'Enviar Ahora'}
                  </Button>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setModalConfiguracion(true)}
                    startIcon={<MdSettings />}
                  >
                    Configurar
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Estadísticas */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Estadísticas
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Datos enviados:</strong> {estadisticas.totalEnviados}
                </Typography>
                <Typography variant="body2">
                  <strong>Errores:</strong> {estadisticas.errores}
                </Typography>
                <Typography variant="body2">
                  <strong>Tiempo activo:</strong> {formatearTiempo(estadisticas.tiempoActivo)}
                </Typography>
                <Typography variant="body2">
                  <strong>Último envío:</strong> {ultimoEnvio ? new Date(ultimoEnvio).toLocaleTimeString() : 'N/A'}
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={reiniciarEstadisticas}
                  startIcon={<MdRefresh />}
                  sx={{ mt: 1 }}
                >
                  Reiniciar
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Controles de Tendencias */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🎯 Control de Tendencias (Simulación de Criticidad)
              </Typography>
              
              <Grid container spacing={2}>
                {/* Temperatura */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                      <MdThermostat /> Temperatura
                    </Typography>
                    <Chip
                      icon={getIconoTendencia(configuracion.temperatura.tendencia)}
                      label={configuracion.temperatura.tendencia}
                      color={getColorTendencia(configuracion.temperatura.tendencia) as any}
                      sx={{ mb: 2 }}
                    />
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.temperatura.tendencia === 'normal' ? 'contained' : 'outlined'}
                          onClick={() => aplicarTendencia('temperatura', 'normal')}
                        >
                          Normal
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.temperatura.tendencia === 'subiendo' ? 'contained' : 'outlined'}
                          color="warning"
                          onClick={() => aplicarTendencia('temperatura', 'subiendo')}
                        >
                          Alta
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.temperatura.tendencia === 'bajando' ? 'contained' : 'outlined'}
                          color="info"
                          onClick={() => aplicarTendencia('temperatura', 'bajando')}
                        >
                          Baja
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.temperatura.tendencia === 'critico' ? 'contained' : 'outlined'}
                          color="error"
                          onClick={() => aplicarTendencia('temperatura', 'critico')}
                        >
                          Crítico
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* pH */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                      <MdScience /> pH
                    </Typography>
                    <Chip
                      icon={getIconoTendencia(configuracion.ph.tendencia)}
                      label={configuracion.ph.tendencia}
                      color={getColorTendencia(configuracion.ph.tendencia) as any}
                      sx={{ mb: 2 }}
                    />
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.ph.tendencia === 'normal' ? 'contained' : 'outlined'}
                          onClick={() => aplicarTendencia('ph', 'normal')}
                        >
                          Normal
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.ph.tendencia === 'subiendo' ? 'contained' : 'outlined'}
                          color="warning"
                          onClick={() => aplicarTendencia('ph', 'subiendo')}
                        >
                          Alto
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.ph.tendencia === 'bajando' ? 'contained' : 'outlined'}
                          color="info"
                          onClick={() => aplicarTendencia('ph', 'bajando')}
                        >
                          Bajo
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.ph.tendencia === 'critico' ? 'contained' : 'outlined'}
                          color="error"
                          onClick={() => aplicarTendencia('ph', 'critico')}
                        >
                          Crítico
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* Oxígeno */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                      <MdAir /> Oxígeno
                    </Typography>
                    <Chip
                      icon={getIconoTendencia(configuracion.oxigeno.tendencia)}
                      label={configuracion.oxigeno.tendencia}
                      color={getColorTendencia(configuracion.oxigeno.tendencia) as any}
                      sx={{ mb: 2 }}
                    />
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.oxigeno.tendencia === 'normal' ? 'contained' : 'outlined'}
                          onClick={() => aplicarTendencia('oxigeno', 'normal')}
                        >
                          Normal
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.oxigeno.tendencia === 'subiendo' ? 'contained' : 'outlined'}
                          color="warning"
                          onClick={() => aplicarTendencia('oxigeno', 'subiendo')}
                        >
                          Alto
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.oxigeno.tendencia === 'bajando' ? 'contained' : 'outlined'}
                          color="info"
                          onClick={() => aplicarTendencia('oxigeno', 'bajando')}
                        >
                          Bajo
                        </Button>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Button
                          fullWidth
                          size="small"
                          variant={configuracion.oxigeno.tendencia === 'critico' ? 'contained' : 'outlined'}
                          color="error"
                          onClick={() => aplicarTendencia('oxigeno', 'critico')}
                        >
                          Crítico
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Historial de Envíos */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📋 Historial de Envíos (Últimos 10)
              </Typography>
              
              {historialDatos.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No hay datos enviados aún
                </Typography>
              ) : (
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {historialDatos.slice(0, 10).map((dato, index) => (
                    <Paper key={index} sx={{ p: 2, mb: 1, bgcolor: dato.estado === 'error' ? 'error.light' : 'success.light' }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 3 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {new Date(dato.timestamp).toLocaleTimeString()}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          {dato.estado === 'error' ? (
                            <Chip label="Error" color="error" size="small" />
                          ) : (
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {dato.temperatura && (
                                <Chip label={`🌡️ ${dato.temperatura}°C`} size="small" />
                              )}
                              {dato.ph && (
                                <Chip label={`🧪 ${dato.ph}`} size="small" />
                              )}
                              {dato.oxigeno && (
                                <Chip label={`💨 ${dato.oxigeno} mg/L`} size="small" />
                              )}
                            </Box>
                          )}
                        </Grid>
                        <Grid size={{ xs: 3 }}>
                          <Chip
                            label={dato.estado === 'error' ? 'Error' : 'Enviado'}
                            color={dato.estado === 'error' ? 'error' : 'success'}
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Modal de Configuración Avanzada */}
      <Dialog open={modalConfiguracion} onClose={() => setModalConfiguracion(false)} maxWidth="md" fullWidth>
        <DialogTitle>⚙️ Configuración Avanzada de Sensores</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Configuración Temperatura */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle1" gutterBottom>🌡️ Temperatura</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={configuracion.temperatura.activo}
                    onChange={(e) => setConfiguracion(prev => ({
                      ...prev,
                      temperatura: { ...prev.temperatura, activo: e.target.checked }
                    }))}
                  />
                }
                label="Activo"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Valor Mínimo (°C)"
                type="number"
                value={configuracion.temperatura.min}
                onChange={(e) => setConfiguracion(prev => ({
                  ...prev,
                  temperatura: { ...prev.temperatura, min: parseFloat(e.target.value) || 0 }
                }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Valor Máximo (°C)"
                type="number"
                value={configuracion.temperatura.max}
                onChange={(e) => setConfiguracion(prev => ({
                  ...prev,
                  temperatura: { ...prev.temperatura, max: parseFloat(e.target.value) || 0 }
                }))}
              />
            </Grid>

            {/* Configuración pH */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle1" gutterBottom>🧪 pH</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={configuracion.ph.activo}
                    onChange={(e) => setConfiguracion(prev => ({
                      ...prev,
                      ph: { ...prev.ph, activo: e.target.checked }
                    }))}
                  />
                }
                label="Activo"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Valor Mínimo"
                type="number"
                inputProps={{ step: 0.1 }}
                value={configuracion.ph.min}
                onChange={(e) => setConfiguracion(prev => ({
                  ...prev,
                  ph: { ...prev.ph, min: parseFloat(e.target.value) || 0 }
                }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Valor Máximo"
                type="number"
                inputProps={{ step: 0.1 }}
                value={configuracion.ph.max}
                onChange={(e) => setConfiguracion(prev => ({
                  ...prev,
                  ph: { ...prev.ph, max: parseFloat(e.target.value) || 0 }
                }))}
              />
            </Grid>

            {/* Configuración Oxígeno */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle1" gutterBottom>💨 Oxígeno</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={configuracion.oxigeno.activo}
                    onChange={(e) => setConfiguracion(prev => ({
                      ...prev,
                      oxigeno: { ...prev.oxigeno, activo: e.target.checked }
                    }))}
                  />
                }
                label="Activo"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Valor Mínimo (mg/L)"
                type="number"
                inputProps={{ step: 0.1 }}
                value={configuracion.oxigeno.min}
                onChange={(e) => setConfiguracion(prev => ({
                  ...prev,
                  oxigeno: { ...prev.oxigeno, min: parseFloat(e.target.value) || 0 }
                }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Valor Máximo (mg/L)"
                type="number"
                inputProps={{ step: 0.1 }}
                value={configuracion.oxigeno.max}
                onChange={(e) => setConfiguracion(prev => ({
                  ...prev,
                  oxigeno: { ...prev.oxigeno, max: parseFloat(e.target.value) || 0 }
                }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalConfiguracion(false)}>Cerrar</Button>
          <Button
            variant="contained"
            onClick={() => {
              setModalConfiguracion(false);
              mostrarMensaje('⚙️ Configuración guardada', 'success');
            }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para notificaciones */}
      <Snackbar
        open={mostrarSnackbar}
        autoHideDuration={4000}
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