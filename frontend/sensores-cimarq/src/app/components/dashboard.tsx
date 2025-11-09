'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Chip, Alert, CircularProgress, Paper, CardActionArea, FormControl, InputLabel, Select, MenuItem, List, ListItem, ListItemIcon, ListItemText, Divider, Button, Badge } from '@mui/material';
import Grid from '@mui/material/Grid';
import Link from 'next/link';
import { apiRequestJson, API_ENDPOINTS } from '../config/api';
import GeneralChart from './graficos/GeneralChart';
import { useConfiguracionRangos } from '../hooks/useConfiguracionRangos';
import { useNotificaciones, AlertaNotificacion } from '../hooks/useNotificaciones';
import { useMonitoreoAutomatico } from '../hooks/useMonitoreoAutomatico';
import { useNombreSistema } from '../hooks/useNombreSistema';
import DynamicTitle from './DynamicTitle';
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
  const nombreSistema = useNombreSistema();
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
    solicitarPermisos
  } = useNotificaciones();

  // Hook de monitoreo automático
  const {
    alertasAutomaticas,
    monitoreoActivo,
    estadisticas,
    iniciarMonitoreo,
    detenerMonitoreo,
    marcarComoLeida,
    ultimaRevision
  } = useMonitoreoAutomatico();

  // Obtener datos del backend Flask
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🔄 Dashboard - Cargando datos usando API configurado');
        
        const result: ApiResponse = await apiRequestJson<ApiResponse>(API_ENDPOINTS.SENSORES);
        
        if (result.success) {
          setData(result.data);
          setMqttStatus(result.mqtt_status);
          setError(null);
        } else {
          setError('Error al cargar datos');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        console.error('🚨 Dashboard - Error completo:', err);
        
        if (errorMessage.includes('fetch') || errorMessage === 'Failed to fetch') {
          setError('🔌 No se pudo conectar al servidor backend. Verifica que esté ejecutándose correctamente');
        } else {
          setError(`Error de conexión con la API: ${errorMessage}`);
        }
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
        // Configurar URL del backend según el entorno
        const backendUrl = typeof window !== 'undefined' 
          ? 'http://localhost:5000' 
          : process.env.BACKEND_URL || 'http://localhost:5000';
        
        console.log('🔄 Dashboard - Cargando alertas desde:', `${backendUrl}/api/v1/alertas?limite=10`);
        
        const response = await fetch(`${backendUrl}/api/v1/alertas?limite=10`, {
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
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
          
          // Las alertas críticas se detectan pero ya no se muestra el modal
          if (alertasCriticas.length > 0) {
            console.log('Alerta crítica detectada:', alertasCriticas[0]);
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
  }, []);

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
      'optimo': 'success'
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
      'optimo': 'success'
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
      'optimo': 'success'
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
    <div className="bg-gray-50 p-4 lg:p-6">
      <DynamicTitle pageName="Dashboard" />
      <div className="max-w-7xl mx-auto">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h3" component="h1" sx={{ color: '#1f2937', flexGrow: 1, textAlign: { xs: 'center', md: 'left' } }}>
            Dashboard - {nombreSistema}
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

      {/* Sistema de Alertas Unificado */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Panel de Control de Monitoreo */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsIcon color="primary" />
              Monitoreo Automático
            </Typography>
            
            {/* Estado del monitoreo */}
            <Box sx={{ mb: 2 }}>
              <Chip
                label={monitoreoActivo ? "Activo" : "Inactivo"}
                color={monitoreoActivo ? "success" : "default"}
                icon={monitoreoActivo ? <VisibilityIcon /> : <ErrorIcon />}
                sx={{ mb: 1 }}
              />
              {ultimaRevision && (
                <Typography variant="caption" display="block" color="text.secondary">
                  Última revisión: {ultimaRevision.toLocaleTimeString()}
                </Typography>
              )}
            </Box>

            {/* Botones de control */}
            <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
              <Button
                variant={monitoreoActivo ? "outlined" : "contained"}
                color={monitoreoActivo ? "error" : "primary"}
                size="small"
                onClick={monitoreoActivo ? detenerMonitoreo : iniciarMonitoreo}
                startIcon={monitoreoActivo ? <ErrorIcon /> : <VisibilityIcon />}
              >
                {monitoreoActivo ? "Detener" : "Iniciar"} Monitoreo
              </Button>
              
              <Link href="/alertas" passHref>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<NotificationsIcon />}
                  fullWidth
                >
                  Gestionar Alertas
                </Button>
              </Link>
            </Box>
          </Paper>
        </Grid>

        {/* Estadísticas de Alertas */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Estadísticas de Alertas
            </Typography>
            
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 2, color: 'white' }}>
                  <Typography variant="h4">{estadisticas.total}</Typography>
                  <Typography variant="caption">Total</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.light', borderRadius: 2, color: 'white' }}>
                  <Typography variant="h4">{estadisticas.criticas}</Typography>
                  <Typography variant="caption">Críticas</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 2, color: 'white' }}>
                  <Typography variant="h4">{estadisticas.aceptables}</Typography>
                  <Typography variant="caption">Aceptables</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.light', borderRadius: 2, color: 'white' }}>
                  <Typography variant="h4">{estadisticas.noLeidas}</Typography>
                  <Typography variant="caption">Sin Leer</Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Alertas por sensor */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Alertas por Sensor:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={<ThermostatIcon />}
                  label={`Temperatura: ${estadisticas.porSensor.temperatura}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<WaterIcon />}
                  label={`pH: ${estadisticas.porSensor.ph}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<AirIcon />}
                  label={`Oxígeno: ${estadisticas.porSensor.oxigeno}`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Alertas Recientes Unificadas */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Alertas Recientes
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Badge con total de alertas no leídas */}
            <Chip
              label={`${alertasAutomaticas.filter(a => !a.leida).length + alertasNoRevisadas} sin revisar`}
              color={alertasAutomaticas.filter(a => !a.leida).length + alertasNoRevisadas > 0 ? "error" : "success"}
              size="small"
              variant="filled"
            />
            
            <Link href="/alertas" passHref>
              <Button
                variant="outlined"
                startIcon={<NotificationsIcon />}
                size="small"
              >
                Ver Todas
              </Button>
            </Link>
          </Box>
        </Box>

        {/* Combinar alertas automáticas y históricas */}
        {(loadingAlertas || alertasAutomaticas.length === 0) && alertasHistoricas.length === 0 ? (
          <Box display="flex" justifyContent="center" p={2}>
            {loadingAlertas ? (
              <CircularProgress />
            ) : (
              <Alert severity="info" sx={{ width: '100%' }}>
                <Typography variant="body2">
                  No hay alertas disponibles. El sistema está monitoreando continuamente.
                </Typography>
              </Alert>
            )}
          </Box>
        ) : (
          <Card variant="outlined" sx={{ maxHeight: 500, overflowY: 'auto' }}>
            <List dense>
              {/* Mostrar primero las alertas automáticas más recientes */}
              {alertasAutomaticas.slice(0, 5).map((alerta, index) => (
                <Box key={alerta.id}>
                  <ListItem
                    sx={{
                      bgcolor: !alerta.leida ? 'action.hover' : 'transparent',
                      borderLeft: `4px solid ${alerta.estado === 'critico' ? '#f44336' : '#ff9800'}`
                    }}
                  >
                    <ListItemIcon>
                      {alerta.sensor === 'temperatura' && <ThermostatIcon color={alerta.estado === 'critico' ? 'error' : 'warning'} />}
                      {alerta.sensor === 'ph' && <WaterIcon color={alerta.estado === 'critico' ? 'error' : 'warning'} />}
                      {alerta.sensor === 'oxigeno' && <AirIcon color={alerta.estado === 'critico' ? 'error' : 'warning'} />}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography component="span" variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {alerta.sensor.toUpperCase()}
                          </Typography>
                          <Chip
                            size="small"
                            label={alerta.estado === 'critico' ? 'CRÍTICO' : 'ALERTA'}
                            color={alerta.estado === 'critico' ? 'error' : 'warning'}
                            variant="filled"
                          />
                          <Chip
                            size="small"
                            label="AUTOMÁTICA"
                            color="info"
                            variant="outlined"
                          />
                          {!alerta.leida && (
                            <Chip
                              size="small"
                              label="NUEVA"
                              color="error"
                              variant="filled"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography component="div" variant="body2" sx={{ mb: 0.5, lineHeight: 1.4 }}>
                            {alerta.mensaje}
                          </Typography>
                          <Typography component="span" variant="caption" color="text.secondary">
                            Valor: {alerta.valor} • {alerta.timestamp.toLocaleString('es-CL')}
                          </Typography>
                        </Box>
                      }
                      primaryTypographyProps={{ component: 'div' }}
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => marcarComoLeida(alerta.id)}
                      disabled={alerta.leida}
                      sx={{ ml: 1 }}
                    >
                      {alerta.leida ? '✓' : 'Marcar'}
                    </Button>
                  </ListItem>
                  {index < Math.min(alertasAutomaticas.length - 1, 4) && <Divider />}
                </Box>
              ))}

              {/* Separador si hay ambos tipos de alertas */}
              {alertasAutomaticas.length > 0 && alertasHistoricas.length > 0 && (
                <Divider sx={{ my: 1, borderStyle: 'dashed' }}>
                  <Chip label="Alertas Históricas" size="small" />
                </Divider>
              )}

              {/* Mostrar alertas históricas */}
              {alertasHistoricas.slice(0, 5).map((alerta, index) => (
                <Box key={alerta._id}>
                  <ListItem sx={{ bgcolor: !alerta.resuelto ? 'action.hover' : 'transparent' }}>
                    <ListItemIcon>
                      {getSensorIcon(alerta.sensor)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography component="span" variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {alerta.sensor.toUpperCase()}
                          </Typography>
                          <Chip
                            size="small"
                            label={alerta.nivel}
                            color={getNivelAlertaColor(alerta.nivel)}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label="HISTÓRICA"
                            color="default"
                            variant="outlined"
                          />
                          {!alerta.resuelto && (
                            <Chip
                              size="small"
                              label="SIN REVISAR"
                              color="warning"
                              variant="filled"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography component="div" variant="body2" sx={{ mb: 0.5, lineHeight: 1.4 }}>
                            {alerta.mensaje}
                          </Typography>
                          <Typography component="span" variant="caption" color="text.secondary">
                            Valor: {alerta.valor_actual} • {formatFechaAlerta(alerta.fecha_creacion)}
                          </Typography>
                        </Box>
                      }
                      primaryTypographyProps={{ component: 'div' }}
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                  </ListItem>
                  {index < Math.min(alertasHistoricas.length - 1, 4) && <Divider />}
                </Box>
              ))}
            </List>

            {/* Mostrar más alertas disponibles */}
            {(alertasAutomaticas.length + alertasHistoricas.length) > 10 && (
              <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
                <Link href="/alertas" passHref>
                  <Button variant="text" size="small">
                    Ver {(alertasAutomaticas.length + alertasHistoricas.length) - 10} alertas más →
                  </Button>
                </Link>
              </Box>
            )}
          </Card>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom textAlign="center">
          Estado del Sistema
        </Typography>
        <Grid container spacing={2}>
          <Grid size= {{xs: 12, md: 3}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Actualización: cada 5 segundos
            </Typography>
          </Grid>
          <Grid size= {{xs: 12, md: 3}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Período: {timeFilter === '1h' ? 'Última hora' : timeFilter === '6h' ? 'Últimas 6h' : timeFilter === '24h' ? 'Últimas 24h' : timeFilter === '7d' ? 'Últimos 7 días' : 'Todos los datos'}
            </Typography>
          </Grid>
          <Grid size= {{xs: 12, md: 3}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Monitoreo: {monitoreoActivo ? 'Activo' : 'Inactivo'}
            </Typography>
          </Grid>
          <Grid size= {{xs: 12, md: 3}}>
            <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
              Última actualización: {new Date().toLocaleTimeString()}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      </div>
    </div>
  );
}