'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Chip, Alert, CircularProgress, Paper, CardActionArea, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import Grid from '@mui/material/Grid';
import Link from 'next/link';
import GeneralChart from './graficos/GeneralChart';
import { useConfiguracionRangos } from '../hooks/useConfiguracionRangos';

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
  const { evaluarEstadoSensor } = useConfiguracionRangos();

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
    const latest = sensorData[0];
    return latest[field as keyof SensorData] || latest.valor || null;
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
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom textAlign="center">
          Información del Sistema
        </Typography>
        <Grid container spacing={2}>
          <Grid size= {{xs: 12, md: 3}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Actualización automática: cada 5 segundos
            </Typography>
          </Grid>
          <Grid size= {{xs: 12, md: 3}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Período activo: {timeFilter === '1h' ? 'Última hora' : timeFilter === '6h' ? 'Últimas 6h' : timeFilter === '24h' ? 'Últimas 24h' : timeFilter === '7d' ? 'Últimos 7 días' : 'Todos los datos'}
            </Typography>
          </Grid>
          <Grid size= {{xs: 12, md: 3}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Version 0.3.0
            </Typography>
          </Grid>
          <Grid size= {{xs: 12, md: 3}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Última actualización: {new Date().toLocaleTimeString()}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
      </div>
    </div>
  );
}