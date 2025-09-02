'use client';

import { LineChart } from '@mui/x-charts/LineChart';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';

interface SensorData {
  _id: string;
  temperatura?: number;
  valor?: number;
  fecha: string;
  timestamp?: string;
  sensor_id?: string;
}

interface TemperatureChartProps {
  data: SensorData[];
  title?: string;
}

export default function TemperatureChart({ data, title = "Tendencia de Temperatura" }: TemperatureChartProps) {
  // Preparar datos para el gráfico
  const processedData = data
    .map(item => ({
      temperatura: item.temperatura || item.valor || 0,
      fecha: new Date(item.fecha || item.timestamp || '').getTime(),
      fechaTexto: new Date(item.fecha || item.timestamp || '').toLocaleDateString()
    }))
    .filter(item => !isNaN(item.fecha))
    .sort((a, b) => a.fecha - b.fecha);

  // Calcular estadísticas
  const temperaturas = processedData.map(d => d.temperatura);
  const stats = {
    current: temperaturas[temperaturas.length - 1] || 0,
    average: temperaturas.reduce((a, b) => a + b, 0) / temperaturas.length || 0,
    min: Math.min(...temperaturas) || 0,
    max: Math.max(...temperaturas) || 0
  };

  // Determinar estado de la temperatura actual
  const getCurrentStatus = (temp: number) => {
    if (temp < 18) return { text: 'Frío', color: 'info', bgColor: '#e3f2fd' };
    if (temp > 25) return { text: 'Caliente', color: 'error', bgColor: '#ffebee' };
    return { text: 'Normal', color: 'success', bgColor: '#e8f5e8' };
  };

  const currentStatus = getCurrentStatus(stats.current);

  // Preparar datos para el chart
  const chartData = {
    xAxis: processedData.map(d => d.fecha),
    values: processedData.map(d => d.temperatura)
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" color="text.secondary" textAlign="center">
            No hay datos de temperatura disponibles
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          {title}
        </Typography>
        
        {/* Estadísticas */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ 
            flex: '1 1 200px',
            minWidth: '150px',
            textAlign: 'center', 
            p: 2, 
            backgroundColor: currentStatus.bgColor, 
            borderRadius: 1 
          }}>
            <Typography variant="h6" color={currentStatus.color}>
              {stats.current.toFixed(1)}°C
            </Typography>
            <Typography variant="caption">Actual</Typography>
            <Chip 
              label={currentStatus.text} 
              color={currentStatus.color as any} 
              size="small" 
              sx={{ mt: 1, display: 'block' }}
            />
          </Box>
          
          <Box sx={{ 
            flex: '1 1 200px',
            minWidth: '150px',
            textAlign: 'center', 
            p: 2, 
            backgroundColor: '#f5f5f5', 
            borderRadius: 1 
          }}>
            <Typography variant="h6">{stats.average.toFixed(1)}°C</Typography>
            <Typography variant="caption">Promedio</Typography>
          </Box>
          
          <Box sx={{ 
            flex: '1 1 200px',
            minWidth: '150px',
            textAlign: 'center', 
            p: 2, 
            backgroundColor: '#f5f5f5', 
            borderRadius: 1 
          }}>
            <Typography variant="h6">{stats.min.toFixed(1)}°C</Typography>
            <Typography variant="caption">Mínima</Typography>
          </Box>
          
          <Box sx={{ 
            flex: '1 1 200px',
            minWidth: '150px',
            textAlign: 'center', 
            p: 2, 
            backgroundColor: '#f5f5f5', 
            borderRadius: 1 
          }}>
            <Typography variant="h6">{stats.max.toFixed(1)}°C</Typography>
            <Typography variant="caption">Máxima</Typography>
          </Box>
        </Box>

        {/* Gráfico */}
        {chartData.values.length > 0 ? (
          <Box sx={{ width: '100%', height: 350 }}>
            <LineChart
              xAxis={[{
                data: chartData.xAxis,
                scaleType: 'time',
                valueFormatter: (value) => new Date(value).toLocaleDateString()
              }]}
              series={[{
                data: chartData.values,
                color: '#2196f3',
                area: true,
                label: 'Temperatura (°C)',
                curve: 'linear'
              }]}
              width={undefined}
              height={350}
              margin={{ left: 60, right: 20, top: 20, bottom: 60 }}
              grid={{ vertical: true, horizontal: true }}
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Sin datos para mostrar
          </Typography>
        )}

        {/* Información adicional */}
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Rangos de Temperatura</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Chip label="Frío: < 18°C" color="info" variant="outlined" size="small" />
                <Chip label="Normal: 18°C - 25°C" color="success" variant="outlined" size="small" />
                <Chip label="Caliente: > 25°C" color="error" variant="outlined" size="small" />
              </Box>
            </CardContent>
          </Card>
          
          <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Análisis</Typography>
              <Typography variant="body2" color="text.secondary">
                Lecturas totales: {data.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Variación: {(stats.max - stats.min).toFixed(1)}°C
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Última lectura: {processedData[processedData.length - 1]?.fechaTexto || 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </CardContent>
    </Card>
  );
}
