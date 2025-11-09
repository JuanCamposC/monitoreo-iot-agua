'use client';

import { useState, useEffect, useRef } from 'react';
import {Box,Typography,Card,CardContent,TextField,Button,Grid,Alert,Snackbar,FormControl,InputLabel,Select,MenuItem,Switch,FormControlLabel,Paper,Slider,Chip, Divider, CircularProgress,Dialog,DialogTitle,DialogContent,DialogActions,IconButton,Tooltip} from '@mui/material';
import {MdPlayArrow,MdStop,MdSettings,MdTrendingUp,MdTrendingDown,MdWarning,MdInfo,MdRefresh,MdTimer,MdThermostat,MdScience,MdAir,MdHelp, MdError} from 'react-icons/md';
import { useConfiguracionRangos } from '../hooks/useConfiguracionRangos';
import { useNombreSistema } from '../hooks/useNombreSistema';
import DynamicTitle from '../components/DynamicTitle';
import { Black_Han_Sans } from 'next/font/google';

interface ConfiguracionSimulador {
  activo: boolean;
  intervalo: number; // en segundos
  temperatura: {
    activo: boolean;
    tendencia: 'normal' | 'subiendo' | 'bajando' | 'critico';
  };
  ph: {
    activo: boolean;
    tendencia: 'normal' | 'subiendo' | 'bajando' | 'critico';
  };
  oxigeno: {
    activo: boolean;
    tendencia: 'normal' | 'subiendo' | 'bajando' | 'critico';
  };
}

interface DatoSimulacion {
  timestamp: string;
  temperatura?: number;
  ph?: number;
  oxigeno?: number;
  estado: 'enviado' | 'error';
}

export default function SimuladorPage() {
  const { configuracion: rangosConfiguracion } = useConfiguracionRangos();
  const nombreSistema = useNombreSistema();
  
  const [configuracion, setConfiguracion] = useState<ConfiguracionSimulador>({
    activo: false,
    intervalo: 30,
    temperatura: {
      activo: true,
      tendencia: 'normal'
    },
    ph: {
      activo: true,
      tendencia: 'normal'
    },
    oxigeno: {
      activo: true,
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
  const [modalAyuda, setModalAyuda] = useState(false);
  const [estadisticas, setEstadisticas] = useState({
    totalEnviados: 0,
    errores: 0,
    tiempoActivo: 0
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const contadorRef = useRef<NodeJS.Timeout | null>(null);
  const inicioSimulacionRef = useRef<Date | null>(null);

  // Efecto para actualizar rangos cuando cambie la configuración
  useEffect(() => {
    setConfiguracion(prev => ({
      ...prev,
      temperatura: {
        ...prev.temperatura,
        min: rangosConfiguracion.temperatura.minimo,
        max: rangosConfiguracion.temperatura.maximo
      },
      ph: {
        ...prev.ph,
        min: rangosConfiguracion.ph.minimo,
        max: rangosConfiguracion.ph.maximo
      },
      oxigeno: {
        ...prev.oxigeno,
        min: rangosConfiguracion.oxigeno.minimo,
        max: rangosConfiguracion.oxigeno.maximo
      }
    }));
  }, [rangosConfiguracion]);

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

    mostrarMensaje('Simulador iniciado correctamente', 'success');
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

    mostrarMensaje('Simulador detenido', 'info');
  };

  const generarValorSensor = (tendencia: 'normal' | 'subiendo' | 'bajando' | 'critico', tipoSensor: 'temperatura' | 'ph' | 'oxigeno', valorAnterior?: number): number => {
    let valor: number;
    const rangosReales = rangosConfiguracion[tipoSensor];
    
    switch (tendencia) {
      case 'subiendo':
        // Tendencia hacia la zona alta aceptable/óptima
        const zonaAlta = Math.random() > 0.7 
          ? rangosReales.maximoOptimo + Math.random() * (rangosReales.maximo - rangosReales.maximoOptimo) // Zona aceptable alta
          : rangosReales.minimoOptimo + Math.random() * (rangosReales.maximoOptimo - rangosReales.minimoOptimo); // Zona óptima
        valor = zonaAlta;
        break;
        
      case 'bajando':
        // Tendencia hacia la zona baja aceptable/óptima
        const zonaBaja = Math.random() > 0.7 
          ? rangosReales.minimo + Math.random() * (rangosReales.minimoOptimo - rangosReales.minimo) // Zona aceptable baja
          : rangosReales.minimoOptimo + Math.random() * (rangosReales.maximoOptimo - rangosReales.minimoOptimo); // Zona óptima
        valor = zonaBaja;
        break;
        
      case 'critico':
        // Valores en zona crítica (fuera del rango configurado)
        if (Math.random() > 0.5) {
          // Crítico bajo
          const margenBajo = rangosReales.minimo * 0.2;
          valor = Math.max(0, rangosReales.minimo - Math.random() * margenBajo);
        } else {
          // Crítico alto
          const margenAlto = rangosReales.maximo * 0.2;
          valor = rangosReales.maximo + Math.random() * margenAlto;
        }
        break;
        
      default: // 'normal'
        // Distribución normal que favorece la zona óptima (70% del tiempo)
        if (Math.random() > 0.3) {
          // Zona óptima (70% probabilidad)
          valor = rangosReales.minimoOptimo + Math.random() * (rangosReales.maximoOptimo - rangosReales.minimoOptimo);
        } else {
          // Zona aceptable (30% probabilidad)
          if (Math.random() > 0.5) {
            // Aceptable baja
            valor = rangosReales.minimo + Math.random() * (rangosReales.minimoOptimo - rangosReales.minimo);
          } else {
            // Aceptable alta
            valor = rangosReales.maximoOptimo + Math.random() * (rangosReales.maximo - rangosReales.maximoOptimo);
          }
        }
        break;
    }

    // Redondear según el tipo de sensor
    if (tipoSensor === 'ph') {
      return Math.round(valor * 10) / 10; // 1 decimal para pH
    } else {
      return Math.round(valor * 100) / 100; // 2 decimales para temperatura y oxígeno
    }
  };

  const enviarDatoSimulado = async () => {
    if (enviando) return;
    
    setEnviando(true);
    
    try {
      const datoSimulado: any = {
        fuente: 'simulador',
        usuario: 'simulador_web'
      };

      // Generar valores para sensores activos usando configuración global
      if (configuracion.temperatura.activo) {
        datoSimulado.temperatura = generarValorSensor(configuracion.temperatura.tendencia, 'temperatura');
      }
      
      if (configuracion.ph.activo) {
        datoSimulado.ph = generarValorSensor(configuracion.ph.tendencia, 'ph');
      }
      
      if (configuracion.oxigeno.activo) {
        datoSimulado.oxigeno = generarValorSensor(configuracion.oxigeno.tendencia, 'oxigeno');
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
        console.log('Dato simulado enviado:', datoSimulado);
        
      } else {
        throw new Error(`Error HTTP: ${respuesta.status}`);
      }
      
    } catch (error: any) {
      console.error('Error enviando dato simulado:', error);
      
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

      mostrarMensaje(`Error al enviar datos: ${error.message}`, 'error');
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
    mostrarMensaje('Estadísticas reiniciadas', 'info');
  };

  const aplicarTendencia = (sensor: keyof Pick<ConfiguracionSimulador, 'temperatura' | 'ph' | 'oxigeno'>, tendencia: 'normal' | 'subiendo' | 'bajando' | 'critico') => {
    setConfiguracion(prev => ({
      ...prev,
      [sensor]: {
        ...prev[sensor],
        tendencia
      }
    }));
    
    const nombreSensor = sensor === 'temperatura' ? 'Temperatura' : sensor === 'ph' ? 'pH' : 'Oxígeno';
    const descripcionTendencia: Record<string, string> = {
      'normal': 'valores normales',
      'subiendo': 'valores altos',
      'bajando': 'valores bajos',
      'critico': 'valores críticos'
    };
    const descripcion = descripcionTendencia[tendencia];
    
    mostrarMensaje(`${nombreSensor}: ${descripcion}`, 'info');
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

  const getColorTendencia = (tendencia: 'normal' | 'subiendo' | 'bajando' | 'critico') => {
    switch (tendencia) {
      case 'normal': return 'success';
      case 'subiendo': return 'warning';
      case 'bajando': return 'info';
      case 'critico': return 'error';
      default: return 'default';
    }
  };

  const getIconoTendencia = (tendencia: 'normal' | 'subiendo' | 'bajando' | 'critico') => {
    switch (tendencia) {
      case 'subiendo': return <MdTrendingUp />;
      case 'bajando': return <MdTrendingDown />;
      case 'critico': return <MdWarning />;
      default: return <MdInfo />;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <DynamicTitle pageName="Simulador" />
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Simulador - {nombreSistema}
        </Typography>
        <Typography variant="h6">
          Generador de datos IoT basado en configuraciones globales del sistema
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
          • Usa rangos configurados automáticamente • Configure intervalos de envío • Simule tendencias para probar alertas
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
                  Estado de Sensores (Rangos Configurados):
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Temperatura:</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {configuracion.temperatura.activo ? (
                        <>
                          <Chip size="small" label={`Rango: ${rangosConfiguracion.temperatura.minimo}-${rangosConfiguracion.temperatura.maximo}°C`} />
                          <Chip size="small" label={`Óptimo: ${rangosConfiguracion.temperatura.minimoOptimo}-${rangosConfiguracion.temperatura.maximoOptimo}°C`} color="success" />
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
                    <Typography variant="body2">pH:</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {configuracion.ph.activo ? (
                        <>
                          <Chip size="small" label={`Rango: ${rangosConfiguracion.ph.minimo}-${rangosConfiguracion.ph.maximo}`} />
                          <Chip size="small" label={`Óptimo: ${rangosConfiguracion.ph.minimoOptimo}-${rangosConfiguracion.ph.maximoOptimo}`} color="success" />
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
                    <Typography variant="body2">Oxígeno:</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {configuracion.oxigeno.activo ? (
                        <>
                          <Chip size="small" label={`Rango: ${rangosConfiguracion.oxigeno.minimo}-${rangosConfiguracion.oxigeno.maximo} mg/L`} />
                          <Chip size="small" label={`Óptimo: ${rangosConfiguracion.oxigeno.minimoOptimo}-${rangosConfiguracion.oxigeno.maximoOptimo} mg/L`} color="success" />
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
                <Grid size={{ xs: 4 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={enviarDatoSimulado}
                    disabled={enviando}
                    startIcon={enviando ? <CircularProgress size={16} /> : <MdRefresh />}
                    size="small"
                  >
                    {enviando ? 'Enviando...' : 'Enviar'}
                  </Button>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setModalAyuda(true)}
                    startIcon={<MdHelp />}
                    size="small"
                    color="info"
                  >
                    Cómo usar
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Estadísticas */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Estadísticas
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
                Control de Tendencias (Simulación de Criticidad)
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
                Historial de Envíos (Últimos 10)
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
                                <Chip label={`${dato.temperatura}°C`} size="small" />
                              )}
                              {dato.ph && (
                                <Chip label={`${dato.ph}`} size="small" />
                              )}
                              {dato.oxigeno && (
                                <Chip label={`${dato.oxigeno} mg/L`} size="small" />
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

      {/* Modal de Ayuda - Cómo usar el simulador */}
      <Dialog open={modalAyuda} onClose={() => setModalAyuda(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdHelp color="#2196f3" />
            Cómo usar el Simulador de Sensores IoT
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Introducción */}
            <Alert severity="info">
              <Typography variant="body1" gutterBottom>
                <strong>El Simulador de Sensores IoT</strong> te permite generar datos de prueba realistas para temperatura, pH y oxígeno disuelto,
                basándose automáticamente en los rangos configurados en tu sistema.
              </Typography>
            </Alert>

            {/* Paso 1 */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>1</span>
                  Configurar Rangos del Sistema
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Antes de usar el simulador, asegúrate de que los rangos de sensores estén configurados correctamente en la página de <strong>Configuración</strong>.
                </Typography>
                <Box sx={{ ml: 3 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>• Ve a la página de <strong>Configuración</strong> desde el menú lateral</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>• Define los rangos mínimo, máximo, mínimo óptimo y máximo óptimo para cada sensor</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>• El simulador usará automáticamente estos rangos para generar valores realistas</Typography>
                </Box>
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Importante:</strong> El simulador se sincroniza automáticamente con la configuración de rangos. 
                    Si cambias los rangos, el simulador se actualizará inmediatamente.
                  </Typography>
                </Alert>
              </CardContent>
            </Card>

            {/* Paso 2 */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>2</span>
                  Configurar Sensores y Tendencias
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  El simulador usa automáticamente las <strong>configuraciones globales</strong> del sistema para generar datos realistas.
                </Typography>
                <Box sx={{ ml: 3 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>• <strong>Rangos automáticos:</strong> Utiliza los rangos configurados en la página de Configuración</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>• <strong>Activar/Desactivar sensores:</strong> Elige cuáles sensores quieres simular</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>• <strong>Intervalo de envío:</strong> Define cada cuántos segundos se envían los datos (5s - 5min)</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>• <strong>Configurar tendencias:</strong> Personaliza el comportamiento de los datos generados</Typography>
                </Box>
                <Box sx={{ mt: 2, ml: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>Tipos de Tendencias:</Typography>
                  <Box sx={{ ml: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }} color='green'><strong>Normal:</strong> 70% valores óptimos, 30% aceptables (recomendado para pruebas generales)</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }} color='#B1B807'><strong>Subiendo:</strong> Valores en zona alta aceptable/óptima</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }} color='blue'><strong>Bajando:</strong> Valores en zona baja aceptable/óptima</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }} color='red'><strong>Crítico:</strong> Valores fuera del rango configurado (para probar alertas)</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Paso 3 */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>3</span>
                  Iniciar y Controlar la Simulación
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Una vez configurado, controla la simulación con los botones de acción.
                </Typography>
                <Box sx={{ ml: 3 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}><strong>Iniciar Simulador:</strong> Comienza la generación automática de datos</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}><strong>Detener Simulador:</strong> Pausa la generación automática</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}><strong>Enviar Ahora:</strong> Genera y envía un dato inmediatamente</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}><strong>Configurar:</strong> Ajusta tendencias y sensores activos</Typography>
                </Box>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    El simulador mostrará un contador regresivo hasta el próximo envío automático cuando esté activo.
                  </Typography>
                </Alert>
              </CardContent>
            </Card>

            {/* Paso 4 */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>4</span>
                  Monitorear y Verificar Datos
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  El simulador te proporciona información detallada sobre los datos generados y su estado.
                </Typography>
                <Box sx={{ ml: 3 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}><strong>Estadísticas:</strong> Total enviados, errores y tiempo activo</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}><strong>Historial:</strong> Últimos datos enviados con timestamps</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}><strong>Estado:</strong> Confirmación de envío exitoso o errores</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}><strong>Verificación:</strong> Ve a las páginas de sensores para ver los datos en tiempo real</Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Consideraciones importantes */}
            <Card variant="outlined" sx={{ bgcolor: '#fff3e0' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#f57c00' }}>
                  <MdWarning />
                  Consideraciones Importantes
                </Typography>
                <Box sx={{ ml: 1 }}>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      <strong>El simulador funciona únicamente mientras te encuentres en esta página. Si navegas a otra sección, la simulación se detendrá automáticamente.</strong>
                    </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Datos Realistas:</strong> Los valores generados respetan las zonas configuradas (óptimo, aceptable, crítico)
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Intervalo Mínimo:</strong> El intervalo mínimo es 5 segundos para evitar sobrecarga del sistema
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Sincronización:</strong> Los rangos se sincronizan automáticamente con la configuración del sistema
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Pruebas:</strong> Usa la tendencia &quot;Crítico&quot; para probar sistemas de alertas y notificaciones
                  </Typography>
                  <Typography variant="body2">
                    <strong>Monitoreo:</strong> Los datos simulados aparecen en todas las páginas de sensores y gráficos en tiempo real
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Casos de uso */}
            <Card variant="outlined" sx={{ bgcolor: '#e8f5e8' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#2e7d32' }}>
                  <MdInfo />
                  Casos de Uso Comunes
                </Typography>
                <Box sx={{ ml: 1 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Desarrollo:</strong> Genera datos para probar nuevas funcionalidades sin sensores físicos
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Pruebas de Alertas:</strong> Usa tendencia &quot;Crítico&quot; para verificar notificaciones de emergencia
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Análisis de Tendencias:</strong> Genera patrones específicos para probar algoritmos de análisis
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Demostraciones:</strong> Presenta el sistema con datos dinámicos y realistas
                  </Typography>
                  <Typography variant="body2">
                    <strong>Validación:</strong> Comprueba que los rangos configurados funcionen correctamente en toda la aplicación
                  </Typography>
                </Box>
              </CardContent>
            </Card>

          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalAyuda(false)} color="primary">
            Entendido
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setModalAyuda(false);
              window.location.href = '/configuracion';
            }}
            startIcon={<MdSettings />}
          >
            Ir a Configuración Global
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