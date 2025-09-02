'use client';

import { LineChart } from '@mui/x-charts/LineChart';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';

interface SensorData {
  _id: string;
  ph?: number;
  valor?: number;
  fecha: string;
  timestamp?: string;
  sensor_id?: string;
}

interface PhChartProps {
  data: SensorData[];
  title?: string;
}

export default function PhChart({ data, title = "Análisis de pH" }: PhChartProps) {
  // Preparar datos para el gráfico
  const processedData = data
    .map(item => ({
      ph: item.ph || item.valor || 0,
      fecha: new Date(item.fecha || item.timestamp || '').getTime(),
      fechaTexto: new Date(item.fecha || item.timestamp || '').toLocaleDateString()
    }))
    .filter(item => !isNaN(item.fecha))
    .sort((a, b) => a.fecha - b.fecha);

  // Calcular estadísticas
  const phValues = processedData.map(d => d.ph);
  const stats = {
    current: phValues[phValues.length - 1] || 0,
    average: phValues.reduce((a, b) => a + b, 0) / phValues.length || 0,
    min: Math.min(...phValues) || 0,
    max: Math.max(...phValues) || 0
  };

  // Determinar estado del pH actual
  const getPhStatus = (ph: number) => {
    if (ph < 6.5) return { text: 'Ácido', color: 'error', bgColor: '#ffebee' };
    if (ph > 8.5) return { text: 'Básico', color: 'warning', bgColor: '#fff3e0' };
    return { text: 'Neutro', color: 'success', bgColor: '#e8f5e8' };
  };

  const currentStatus = getPhStatus(stats.current);

  // Preparar datos para el chart
  const chartData = {
    xAxis: processedData.map(d => d.fecha),
    values: processedData.map(d => d.ph)
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" color="text.secondary" textAlign="center">
            No hay datos de pH disponibles
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
              {stats.current.toFixed(2)}
            </Typography>
            <Typography variant="caption">pH Actual</Typography>
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
            <Typography variant="h6">{stats.average.toFixed(2)}</Typography>
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
            <Typography variant="h6">{stats.min.toFixed(2)}</Typography>
            <Typography variant="caption">Mínimo</Typography>
          </Box>
          
          <Box sx={{ 
            flex: '1 1 200px',
            minWidth: '150px',
            textAlign: 'center', 
            p: 2, 
            backgroundColor: '#f5f5f5', 
            borderRadius: 1 
          }}>
            <Typography variant="h6">{stats.max.toFixed(2)}</Typography>
            <Typography variant="caption">Máximo</Typography>
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
                color: '#4caf50',
                area: true,
                label: 'pH',
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
              <Typography variant="h6" gutterBottom>Rangos de pH</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Chip label="Ácido: < 6.5" color="error" variant="outlined" size="small" />
                <Chip label="Neutro: 6.5 - 8.5" color="success" variant="outlined" size="small" />
                <Chip label="Básico: > 8.5" color="warning" variant="outlined" size="small" />
              </Box>
            </CardContent>
          </Card>
          
          <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Información</Typography>
              <Typography variant="body2" color="text.secondary">
                🧪 Lecturas totales: {data.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                📊 Variación: {(stats.max - stats.min).toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                🕒 Última lectura: {processedData[processedData.length - 1]?.fechaTexto || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                💡 pH óptimo para acuicultura: 6.5 - 8.5
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </CardContent>
    </Card>
  );
}
