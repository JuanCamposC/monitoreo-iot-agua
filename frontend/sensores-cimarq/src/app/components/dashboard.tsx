'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Chip, Alert, CircularProgress, Paper, CardActionArea } from '@mui/material';
import Grid from '@mui/material/Grid';
import Link from 'next/link';
import GeneralChart from './graficos/GeneralChart';

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

  // Obtener datos del backend Flask
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/sensores');
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

  // Funciones auxiliares
  const getLatestValue = (sensorData: SensorData[], field: string) => {
    if (sensorData.length === 0) return null;
    const latest = sensorData[sensorData.length -1 ];
    return latest[field as keyof SensorData] || latest.valor || null;
  };

  const getTemperaturaEstado = (temp: number) => {
    if (temp < 18) return { color: 'primary', text: 'Frío' };
    if (temp > 25) return { color: 'error', text: 'Caliente' };
    return { color: 'success', text: 'Normal' };
  };

  const getPhEstado = (ph: number) => {
    if (ph < 6.5) return { color: 'warning', text: 'Ácido' };
    if (ph > 7.5) return { color: 'error', text: 'Alcalino' };
    return { color: 'success', text: 'Neutro' };
  };

  const getOxigenoEstado = (oxigeno: number) => {
    if (oxigeno < 5) return { color: 'error', text: 'Bajo' };
    if (oxigeno > 9) return { color: 'warning', text: 'Alto' };
    return { color: 'success', text: 'Óptimo' };
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
        <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ mb: 4, color: '#1f2937' }}>
          Dashboard de Sensores CIMARQ
        </Typography>
        
        {/* Estado MQTT */}
        <Paper sx={{ p: 3, mb: 4, borderRadius: 2, boxShadow: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Estado</Typography>
            <Chip label={mqttStatus.connected ? "Conectado" : "Desconectado"} color={mqttStatus.connected ? "success" : "error"} size="small"/>
          </Box>
          {mqttStatus.last_message && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: "right" }}>
              Último mensaje: {new Date(mqttStatus.last_message).toLocaleString()}
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
                  Total de registros: {data.temperatura.length}
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
                  Total de registros: {data.ph.length}
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
                  Total de registros: {data.oxigeno.length}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>

      {/* Gráfico general de tendencias */}
      <Box sx={{ mb: 4 }}>
        <GeneralChart 
          temperatureData={data.temperatura}
          phData={data.ph}
          oxygenData={data.oxigeno}
        />
      </Box>

      {/* Información adicional */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom textAlign="center">
          Información del Sistema
        </Typography>
        <Grid container spacing={2}>
          <Grid size= {{xs: 12, md: 4}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Actualización automática: cada 5 segundos
            </Typography>
          </Grid>
          <Grid size= {{xs: 12, md: 4}}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Version 0.3.0
            </Typography>
          </Grid>
          <Grid size= {{xs: 12, md: 4}}>
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