'use client';

import { LineChart } from '@mui/x-charts/LineChart';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';

interface SensorData {
  _id: string;
  oxigeno?: number;
  valor?: number;
  fecha: string;
  timestamp?: string;
  sensor_id?: string;
}

interface OxygenChartProps {
  data: SensorData[];
  title?: string;
}

export default function OxygenChart({ data, title = "Análisis de Oxígeno Disuelto" }: OxygenChartProps) {
  // Preparar datos para el gráfico
  const processedData = data
    .map(item => ({
      oxigeno: item.oxigeno || item.valor || 0,
      fecha: new Date(item.fecha || item.timestamp || '').getTime(),
      fechaTexto: new Date(item.fecha || item.timestamp || '').toLocaleDateString()
    }))
    .filter(item => !isNaN(item.fecha))
    .sort((a, b) => a.fecha - b.fecha);

  // Calcular estadísticas
  const oxygenValues = processedData.map(d => d.oxigeno);
  const stats = {
    current: oxygenValues[oxygenValues.length - 1] || 0,
    average: oxygenValues.reduce((a, b) => a + b, 0) / oxygenValues.length || 0,
    min: Math.min(...oxygenValues) || 0,
    max: Math.max(...oxygenValues) || 0
  };

  // Determinar estado del oxígeno actual
  const getOxygenStatus = (oxygen: number) => {
    if (oxygen < 4) return { text: 'Crítico', color: 'error', bgColor: '#ffebee' };
    if (oxygen < 6) return { text: 'Bajo', color: 'warning', bgColor: '#fff3e0' };
    if (oxygen > 12) return { text: 'Alto', color: 'info', bgColor: '#e3f2fd' };
    return { text: 'Óptimo', color: 'success', bgColor: '#e8f5e8' };
  };

  const currentStatus = getOxygenStatus(stats.current);

  // Preparar datos para el chart
  const chartData = {
    xAxis: processedData.map(d => d.fecha),
    values: processedData.map(d => d.oxigeno)
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" color="text.secondary" textAlign="center">
            No hay datos de oxígeno disponibles
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
              {stats.current.toFixed(1)} mg/L
            </Typography>
            <Typography variant="caption">O₂ Actual</Typography>
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
            <Typography variant="h6">{stats.average.toFixed(1)} mg/L</Typography>
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
            <Typography variant="h6">{stats.min.toFixed(1)} mg/L</Typography>
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
            <Typography variant="h6">{stats.max.toFixed(1)} mg/L</Typography>
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
                color: '#00bcd4',
                area: true,
                label: 'Oxígeno Disuelto (mg/L)',
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
              <Typography variant="h6" gutterBottom>Rangos de Oxígeno</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Chip label="Crítico: < 4 mg/L" color="error" variant="outlined" size="small" />
                <Chip label="Bajo: 4-6 mg/L" color="warning" variant="outlined" size="small" />
                <Chip label="Óptimo: 6-12 mg/L" color="success" variant="outlined" size="small" />
                <Chip label="Alto: > 12 mg/L" color="info" variant="outlined" size="small" />
              </Box>
            </CardContent>
          </Card>
          
          <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Información</Typography>
              <Typography variant="body2" color="text.secondary">
                🐟 Lecturas totales: {data.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                📊 Variación: {(stats.max - stats.min).toFixed(1)} mg/L
              </Typography>
              <Typography variant="body2" color="text.secondary">
                🕒 Última lectura: {processedData[processedData.length - 1]?.fechaTexto || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                💡 Nivel crítico para peces: &lt; 4 mg/L
              </Typography>
              <Typography variant="body2" color="text.secondary">
                🌊 Óptimo para acuicultura: 6-8 mg/L
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </CardContent>
    </Card>
  );
}
