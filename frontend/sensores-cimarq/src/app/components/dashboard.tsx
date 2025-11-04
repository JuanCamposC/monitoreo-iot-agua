'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Chip, Alert, CircularProgress, Paper, CardActionArea, FormControl, InputLabel, Select, MenuItem, List, ListItem, ListItemIcon, ListItemText, Divider, Button } from '@mui/material';
import Grid from '@mui/material/Grid';
import Link from 'next/link';
import GeneralChart from './graficos/GeneralChart';
import { useConfiguracionRangos } from '../hooks/useConfiguracionRangos';
import { useNotificaciones, AlertaNotificacion } from '../hooks/useNotificaciones';
import { ModalAlertaEmergencia } from './ModalAlertaEmergencia';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WaterIcon from '@mui/icons-material/Water';
import AirIcon from '@mui/icons-material/Air';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VisibilityIcon from '@mui/icons-material/Visibility';

interface SensorData {
  _id: string;
  temperatura?: number;
  ph?: number;
  oxigeno?: number;
  valor?: number;
  fecha: string;
}

interface DashboardData {
  temperatura: SensorData[];
  ph: SensorData[];
  oxigeno: SensorData[];
}

interface AlertaHistorica {
  _id: string;
  sensor: string;
  nivel: string;
  mensaje: string;
  valor_actual: number;
  fecha_creacion: string;
  resuelto: boolean;
  prioridad: number;
  sugerencias?: string[];
}

interface ApiResponse {
  success: boolean;
  data: DashboardData;
  mqtt_status: {
    connected: boolean;
    last_message: string | null;
  };
}

export default function SensoresPage() {
  const [data, setData] = useState<DashboardData>({ temperatura: [], ph: [], oxigeno: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mqttStatus, setMqttStatus] = useState<{ connected: boolean; last_message: string | null }>({ 
    connected: false, 
    last_message: null 
  });
  const [timeFilter, setTimeFilter] = useState('24h'); // Estado para el filtro de tiempo
  const [alertasHistoricas, setAlertasHistoricas] = useState<AlertaHistorica[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(false);
  const [alertasNoRevisadas, setAlertasNoRevisadas] = useState(0);

  // Función para cargar alertas revisadas del localStorage
  const cargarAlertasRevisadasLocales = (): Set<string> => {
    try {
      const stored = localStorage.getItem('alertas_revisadas_cimarq');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };
  
  const { evaluarEstadoSensor } = useConfiguracionRangos();
  
  // Hook de notificaciones
  const {
    alertaActiva,
    modalAbierto,
    mostrarAlerta,
    cerrarModal,
    enviarNotificacionEmail,
    enviandoEmail,
    solicitarPermisos,
    diagnosticarSistema,
    probarNotificaciones
  } = useNotificaciones();

  // Obtener datos del backend Flask
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/v1/sensores');
        const result: ApiResponse = await response.json();
        
        if (result.success) {
          setData(result.data);
          setMqttStatus(result.mqtt_status);
          setError(null);
        } else {
          setError('Error al cargar datos');
        }
      } catch (err) {
        setError('Error de conexión con la API');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Actualizar cada 5 segundos
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Cargar alertas históricas
  useEffect(() => {
    const fetchAlertas = async () => {
      setLoadingAlertas(true);
      try {
        const response = await fetch('http://localhost:5000/api/v1/alertas?limite=10');
        const result = await response.json();
        
        if (result.success) {
          // Aplicar estado local de alertas revisadas
          const revisadasLocales = cargarAlertasRevisadasLocales();
          const alertasConEstadoLocal = (result.alertas || []).map((alerta: AlertaHistorica) => ({
            ...alerta,
            resuelto: alerta.resuelto || revisadasLocales.has(alerta._id)
          }));
          
          setAlertasHistoricas(alertasConEstadoLocal);
          
          // Contar alertas no revisadas con estado local aplicado
          const noRevisadas = alertasConEstadoLocal.filter((alerta: AlertaHistorica) => !alerta.resuelto).length;
          setAlertasNoRevisadas(noRevisadas);
          
          // Detectar nuevas alertas críticas para notificar
          const alertasCriticas = alertasConEstadoLocal.filter(
            (alerta: AlertaHistorica) => 
              alerta.nivel === 'CRITICO' && 
              !alerta.resuelto &&
              // Solo notificar si es nueva (creada en los últimos 2 minutos)
              new Date().getTime() - new Date(alerta.fecha_creacion).getTime() < 2 * 60 * 1000
          );
          
          // Mostrar notificación para la primera alerta crítica nueva
          if (alertasCriticas.length > 0) {
            const alertaCritica = alertasCriticas[0] as AlertaNotificacion;
            mostrarAlerta(alertaCritica);
          }
          
        } else {
          console.error('Error al cargar alertas:', result.error);
        }
      } catch (err) {
        console.error('Error de conexión al cargar alertas:', err);
      } finally {
        setLoadingAlertas(false);
      }
    };

    fetchAlertas();
    // Actualizar alertas cada 30 segundos
    const alertasInterval = setInterval(fetchAlertas, 30000);
    return () => clearInterval(alertasInterval);
  }, [mostrarAlerta]);

  // Solicitar permisos de notificación al cargar
  useEffect(() => {
    const inicializarNotificaciones = async () => {
      await solicitarPermisos();
    };
    inicializarNotificaciones();
  }, [solicitarPermisos]);

  // Función para filtrar datos por tiempo
  const filterDataByTime = (data: SensorData[], filter: string) => {
    if (filter === 'Todo') return data;
    
    const now = new Date();
    let timeLimit: Date;
    
    switch (filter) {
      case '1h':
        timeLimit = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        timeLimit = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        timeLimit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        return data;
    }
    
    return data.filter(item => {
      const itemDate = new Date(item.fecha);
      return itemDate >= timeLimit;
    });
  };

  // Funciones auxiliares
  const getLatestValue = (sensorData: SensorData[], field: string) => {
    if (sensorData.length === 0) return null;
    
    // Ordenar por fecha para asegurar que obtenemos el más reciente
    const sortedData = [...sensorData].sort((a, b) => {
      const fechaA = new Date(a.fecha || 0);
      const fechaB = new Date(b.fecha || 0);
      return fechaB.getTime() - fechaA.getTime(); // Más reciente primero
    });
    
    const latest = sortedData[0];
    const value = latest[field as keyof SensorData] || latest.valor || null;
    
    // Debug: console para verificar qué datos se están obteniendo
    if (process.env.NODE_ENV === 'development') {
      console.log(`Dashboard - ${field}:`, {
        totalRecords: sensorData.length,
        latestDate: latest.fecha,
        latestValue: value,
        allDates: sensorData.map(item => item.fecha).slice(0, 3) // Primeras 3 fechas
      });
    }
    
    return value;
  };

  // Función para obtener la fecha del último registro
  const getLatestDate = (sensorData: SensorData[]) => {
    if (sensorData.length === 0) return null;
    
    const sortedData = [...sensorData].sort((a, b) => {
      const fechaA = new Date(a.fecha || 0);
      const fechaB = new Date(b.fecha || 0);
      return fechaB.getTime() - fechaA.getTime();
    });
    
    return sortedData[0].fecha;
  };

  const formatFecha = (fecha: string) => {
    if (!fecha) return '';
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTemperaturaEstado = (temp: number) => {
    const estado = evaluarEstadoSensor('temperatura', temp);
    const colorMap: Record<string, string> = {
      'crítico': 'error',
      'aceptable': 'warning', 
      'óptimo': 'success'
    };
    return { 
      color: colorMap[estado] || 'default', 
      text: estado.charAt(0).toUpperCase() + estado.slice(1) 
    };
  };

  const getPhEstado = (ph: number) => {
    const estado = evaluarEstadoSensor('ph', ph);
    const colorMap: Record<string, string> = {
      'crítico': 'error',
      'aceptable': 'warning', 
      'óptimo': 'success'
    };
    return { 
      color: colorMap[estado] || 'default', 
      text: estado.charAt(0).toUpperCase() + estado.slice(1) 
    };
  };

  const getOxigenoEstado = (oxigeno: number) => {
    const estado = evaluarEstadoSensor('oxigeno', oxigeno);
    const colorMap: Record<string, string> = {
      'crítico': 'error',
      'aceptable': 'warning', 
      'óptimo': 'success'
    };
    return { 
      color: colorMap[estado] || 'default', 
      text: estado.charAt(0).toUpperCase() + estado.slice(1) 
    };
  };

  // Funciones auxiliares para alertas
  const getNivelAlertaColor = (nivel: string) => {
    const colorMap: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
      'CRITICO': 'error',
      'ALTO': 'warning',
      'MEDIO': 'info',
      'NORMAL': 'success'
    };
    return colorMap[nivel] || 'info';
  };

  const formatFechaAlerta = (fecha: string) => {
    try {
      const date = new Date(fecha);
      return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  };

  const getSensorIcon = (sensor: string) => {
    const iconMap: Record<string, string> = {
      'temperatura': '🌡️',
      'ph': '🧪',
      'oxigeno': '💨'
    };
    return iconMap[sensor] || '📊';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const latestTemp = getLatestValue(data.temperatura, 'temperatura');
  const latestPh = getLatestValue(data.ph, 'ph');
  const latestOxigeno = getLatestValue(data.oxigeno, 'oxigeno');

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h3" component="h1" sx={{ color: '#1f2937', flexGrow: 1, textAlign: { xs: 'center', md: 'left' } }}>
            Dashboard de Sensores CIMARQ
          </Typography>
          
          {/* Selector de período */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Período de Análisis</InputLabel>
            <Select
              value={timeFilter}
              label="Período de Análisis"
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <MenuItem value="1h">Última hora</MenuItem>
              <MenuItem value="6h">Últimas 6h</MenuItem>
              <MenuItem value="24h">Últimas 24h</MenuItem>
              <MenuItem value="7d">Últimos 7 días</MenuItem>
              <MenuItem value="Todo">Todos los datos</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        {/* Estado MQTT */}
        <Paper sx={{ p: 3, mb: 4, borderRadius: 2, boxShadow: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Estado de los Sensores</Typography>
            <Chip label={mqttStatus.connected ? "Conectado" : "Desconectado"} color={mqttStatus.connected ? "success" : "error"} size="small"/>
          </Box>
          {mqttStatus.last_message && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: "right" }}>
              Último registro: {new Date(mqttStatus.last_message).toLocaleString()}
            </Typography>
          )}
        </Paper>

        {/* Cards de sensores */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Temperatura */}
        <Grid size= {{xs: 12, md: 4}}>
          <Card sx={{ height: '100%' }}>
            <CardActionArea component={Link} href='/sensores/temperatura' sx={{ height: "100%"}}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" color="text.secondary">
                    Temperatura
                  </Typography>
                  {latestTemp && (
                    <Chip 
                      label={getTemperaturaEstado(Number(latestTemp)).text}
                      color={getTemperaturaEstado(Number(latestTemp)).color as any}
                      size="small"
                    />
                  )}
                </Box>
                <Typography variant="h3" component="div" color="primary">
                  {latestTemp ? `${Number(latestTemp).toFixed(1)}°C` : 'Sin datos'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Período: {filterDataByTime(data.temperatura, timeFilter).length} | Total: {data.temperatura.length}
                </Typography>
                {getLatestDate(data.temperatura) && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Último: {formatFecha(getLatestDate(data.temperatura) || '')}
                  </Typography>
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        {/* pH */}
        <Grid size= {{xs: 12, md: 4}}>
          <Card sx={{ height: '100%' }}>
            <CardActionArea component={Link} href='/sensores/ph' sx={{ height: "100%"}}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" color="text.secondary">
                    pH
                  </Typography>
                  {latestPh && (
                    <Chip 
                      label={getPhEstado(Number(latestPh)).text}
                      color={getPhEstado(Number(latestPh)).color as any}
                      size="small"
                    />
                  )}
                </Box>
                <Typography variant="h3" component="div" color="secondary">
                  {latestPh ? Number(latestPh).toFixed(1) : 'Sin datos'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Período: {filterDataByTime(data.ph, timeFilter).length} | Total: {data.ph.length}
                </Typography>
                {getLatestDate(data.ph) && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Último: {formatFecha(getLatestDate(data.ph) || '')}
                  </Typography>
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        {/* Oxígeno */}
        <Grid size= {{xs: 12, md: 4}}>
          <Card sx={{ height: '100%' }}>
            <CardActionArea component={Link} href='/sensores/oxigeno' sx={{ height: "100%"}}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" color="text.secondary">
                    Oxígeno
                  </Typography>
                  {latestOxigeno && (
                    <Chip 
                      label={getOxigenoEstado(Number(latestOxigeno)).text}
                      color={getOxigenoEstado(Number(latestOxigeno)).color as any}
                      size="small"
                    />
                  )}
                </Box>
                <Typography variant="h3" component="div" color="info.main">
                  {latestOxigeno ? `${Number(latestOxigeno).toFixed(1)} mg/L` : 'Sin datos'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Período: {filterDataByTime(data.oxigeno, timeFilter).length} | Total: {data.oxigeno.length}
                </Typography>
                {getLatestDate(data.oxigeno) && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Último: {formatFecha(getLatestDate(data.oxigeno) || '')}
                  </Typography>
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>

      {/* Gráfico general de tendencias */}
      <Box sx={{ mb: 4 }}>
        <GeneralChart 
          temperatureData={filterDataByTime(data.temperatura, timeFilter)}
          phData={filterDataByTime(data.ph, timeFilter)}
          oxygenData={filterDataByTime(data.oxigeno, timeFilter)}
          timeFilter={timeFilter}
        />
      </Box>

      {/* Información adicional */}
      {/* Alertas Históricas */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Alertas Históricas
          </Typography>
          <Link href="/alertas" passHref>
            <Button
              variant="outlined"
              startIcon={<NotificationsIcon />}
              size="small"
              sx={{ ml: 2 }}
              color={alertasNoRevisadas > 0 ? "warning" : "primary"}
            >
              Ver Todas
              {alertasNoRevisadas > 0 && (
                <Chip 
                  label={alertasNoRevisadas} 
                  size="small" 
                  color="error" 
                  sx={{ ml: 1, height: 20 }} 
                />
              )}
            </Button>
          </Link>
          
          {/* Botón temporal para diagnóstico */}
          <Button
            variant="outlined"
            size="small"
            onClick={async () => {
              console.log('🔧 Ejecutando diagnóstico...');
              await diagnosticarSistema();
              await probarNotificaciones();
            }}
            sx={{ ml: 1 }}
          >
            🔧 Diagnosticar
          </Button>
        </Box>
        {loadingAlertas ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        ) : alertasHistoricas.length === 0 ? (
          <Box display="flex" justifyContent="center" p={2}>
            <Typography variant="body2" color="text.secondary">
              No hay alertas históricas disponibles
            </Typography>
          </Box>
        ) : (
          <Card variant="outlined" sx={{ maxHeight: 400, overflowY: 'auto' }}>
            <List dense>
              {alertasHistoricas.slice(0, 10).map((alerta, index) => (
                <Box key={alerta._id}>
                  <ListItem>
                    <ListItemIcon>
                      {getSensorIcon(alerta.sensor)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#1976d2' }}>
                            {alerta.sensor.toUpperCase()}
                          </span>
                          <Chip 
                            size="small" 
                            label={alerta.nivel}
                            color={getNivelAlertaColor(alerta.nivel)}
                            variant="outlined"
                          />
                          {!alerta.resuelto && (
                            <Chip 
                              size="small" 
                              label="Sin revisar"
                              color="error"
                              variant="filled"
                            />
                          )}
                        </span>
                      }
                      secondary={
                        <span>
                          <span style={{ display: 'block', fontSize: '0.875rem', color: '#555', marginBottom: '4px', lineHeight: '1.4' }}>
                            {alerta.mensaje}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#777', fontWeight: '500' }}>
                            Valor: {alerta.valor_actual} - {formatFechaAlerta(alerta.fecha_creacion)}
                          </span>
                        </span>
                      }
                    />
                  </ListItem>
                  {index < Math.min(alertasHistoricas.length - 1, 9) && <Divider />}
                </Box>
              ))}
            </List>
          </Card>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom textAlign="center">
          Información del Sistema
        </Typography>
        <Grid container spacing={2}>
          <Grid size= {{xs: 12, md: 4}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              🔄 Actualización: cada 5 segundos
            </Typography>
          </Grid>
          <Grid size= {{xs: 12, md: 4}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              📊 Período: {timeFilter === '1h' ? 'Última hora' : timeFilter === '6h' ? 'Últimas 6h' : timeFilter === '24h' ? 'Últimas 24h' : timeFilter === '7d' ? 'Últimos 7 días' : 'Todos los datos'}
            </Typography>
          </Grid>
          <Grid size= {{xs: 12, md: 4}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              ⚡ CIMARQ v1.0.0 - Sistema Preventivo ML
            </Typography>
          </Grid>
          <Grid size= {{xs: 12}} sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
              🕒 Última actualización: {new Date().toLocaleTimeString()} | 🤖 IA Predictiva: Activa | 🚨 Alertas: Tiempo Real
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Modal de Alerta de Emergencia */}
      <ModalAlertaEmergencia
        open={modalAbierto}
        alerta={alertaActiva}
        onClose={cerrarModal}
        onEnviarEmail={alertaActiva ? async () => { await enviarNotificacionEmail(alertaActiva); } : undefined}
        enviandoEmail={enviandoEmail}
      />
      
      </div>
    </div>
  );
}