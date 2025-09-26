'use client';

import { LineChart } from '@mui/x-charts/LineChart';
import { Box, Typography, Card, CardContent, Chip, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useState } from 'react';

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

export default function TemperatureChart({
  data,
  title = 'Tendencia de Temperatura',
}: TemperatureChartProps) {
  // Estado para controlar el filtro de tiempo
  const [timeFilter, setTimeFilter] = useState('24h'); // 1h, 6h, 24h, 7d, todo

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
      const itemDate = new Date(item.fecha || item.timestamp || '');
      return itemDate >= timeLimit;
    });
  };

  // Función para reducir puntos de datos manteniendo la tendencia
  const downsampleData = (data: any[], maxPoints: number) => {
    if (data.length <= maxPoints) return data;
    
    const step = Math.ceil(data.length / maxPoints);
    const downsampled = [];
    
    for (let i = 0; i < data.length; i += step) {
      // Tomar el promedio de los puntos en el intervalo
      const slice = data.slice(i, i + step);
      const avgTemp = slice.reduce((sum, item) => sum + item.temperatura, 0) / slice.length;
      
      downsampled.push({
        ...slice[0], // Mantener la primera fecha del grupo
        temperatura: avgTemp
      });
    }
    
    return downsampled;
  };

  // Procesar datos con filtro de tiempo
  const filteredData = filterDataByTime(data, timeFilter);
  
  const processedData = filteredData
    .map(item => ({
      temperatura: item.temperatura ?? item.valor ?? 0,
      fecha: new Date(item.fecha || item.timestamp || '').getTime(),
      fechaTexto: new Date(item.fecha || item.timestamp || '').toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      fechaCompleta: new Date(item.fecha || item.timestamp || '').toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
    }))
    .filter(item => !isNaN(item.fecha))
    .sort((a, b) => a.fecha - b.fecha);

  // Reducir puntos para mejorar rendimiento
  const maxPoints = timeFilter === '1h' ? 60 : timeFilter === '6h' ? 120 : timeFilter === '24h' ? 200 : 300;
  const downsampledData = downsampleData(processedData, maxPoints);

  const temperaturas = processedData.map(d => d.temperatura);
  const stats = {
    current: temperaturas.at(-1) || 0,
    average: temperaturas.reduce((a, b) => a + b, 0) / temperaturas.length || 0,
    min: Math.min(...temperaturas) || 0,
    max: Math.max(...temperaturas) || 0,
  };

  // ======= ESTADO DE TEMPERATURA =======
  const getCurrentStatus = (temp: number) => {
    if (temp < 18) return { text: 'Frío', color: 'info', bgColor: '#e3f2fd' };
    if (temp > 25) return { text: 'Caliente', color: 'error', bgColor: '#ffebee' };
    return { text: 'Normal', color: 'success', bgColor: '#e8f5e8' };
  };
  const currentStatus = getCurrentStatus(stats.current);

  // ======= DATOS DEL GRÁFICO =======
  const chartData = {
    xAxis: downsampledData.map(d => d.fecha),
    values: downsampledData.map(d => d.temperatura),
    labels: downsampledData.map(d => d.fechaTexto),
    fullLabels: downsampledData.map(d => d.fechaCompleta),
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2">
            {title}
          </Typography>
          
          {/* Selector de rango de tiempo */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Período</InputLabel>
            <Select
              value={timeFilter}
              label="Período"
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

        {/* ======= ESTADÍSTICAS ======= */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box
            sx={{
              flex: '1 1 200px',
              minWidth: '150px',
              textAlign: 'center',
              p: 2,
              backgroundColor: currentStatus.bgColor,
              borderRadius: 1,
            }}
          >
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

          <Box
            sx={{
              flex: '1 1 200px',
              minWidth: '150px',
              textAlign: 'center',
              p: 2,
              backgroundColor: '#f5f5f5',
              borderRadius: 1,
            }}
          >
            <Typography variant="h6">{stats.average.toFixed(1)}°C</Typography>
            <Typography variant="caption">Promedio</Typography>
          </Box>

          <Box
            sx={{
              flex: '1 1 200px',
              minWidth: '150px',
              textAlign: 'center',
              p: 2,
              backgroundColor: '#f5f5f5',
              borderRadius: 1,
            }}
          >
            <Typography variant="h6">{stats.min.toFixed(1)}°C</Typography>
            <Typography variant="caption">Mínima</Typography>
          </Box>

          <Box
            sx={{
              flex: '1 1 200px',
              minWidth: '150px',
              textAlign: 'center',
              p: 2,
              backgroundColor: '#f5f5f5',
              borderRadius: 1,
            }}
          >
            <Typography variant="h6">{stats.max.toFixed(1)}°C</Typography>
            <Typography variant="caption">Máxima</Typography>
          </Box>
        </Box>

        {/* ======= GRÁFICO ======= */}
        {chartData.values.length > 0 ? (
          <Box sx={{ width: '100%', height: 400 }}>
            <LineChart
              xAxis={[
                {
                  data: chartData.xAxis,
                  scaleType: 'time',
                  valueFormatter: (value) => {
                    const date = new Date(value);
                    return date.toLocaleString('es-CL', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                  },
                },
              ]}
              series={[
                {
                  data: chartData.values,
                  color: '#2196f3',
                  area: true,
                  label: 'Temperatura (°C)',
                  curve: 'linear',
                },
              ]}
              height={400}
              margin={{ left: 70, right: 20, top: 20, bottom: 80 }}
              grid={{ vertical: true, horizontal: true }}
              sx={{
                '& .MuiLineElement-root': {
                  strokeWidth: 2,
                },
                '& .MuiAreaElement-root': {
                  fillOpacity: 0.1,
                },
                '& .MuiChartsAxis-tick': {
                  fontSize: '12px',
                },
                '& .MuiChartsAxis-tickLabel': {
                  fontSize: '11px',
                },
              }}
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Sin datos para mostrar en el período seleccionado
          </Typography>
        )}

        {/* ======= INFO EXTRA ======= */}
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Rangos de Temperatura
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Chip label="Frío: < 18°C" color="info" variant="outlined" size="small" />
                <Chip label="Normal: 18°C - 25°C" color="success" variant="outlined" size="small" />
                <Chip label="Caliente: > 25°C" color="error" variant="outlined" size="small" />
              </Box>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Análisis ({timeFilter})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Lecturas mostradas: {downsampledData.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total disponibles: {data.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Variación: {(stats.max - stats.min).toFixed(1)}°C
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Última lectura: {processedData.at(-1)?.fechaTexto || 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </CardContent>
    </Card>
  );
}
