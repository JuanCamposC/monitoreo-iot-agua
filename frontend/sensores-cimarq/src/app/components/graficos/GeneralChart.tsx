'use client';

import { LineChart } from '@mui/x-charts/LineChart';
import { Box, Typography, Card, CardContent } from '@mui/material';

interface SensorData {
  _id: string;
  temperatura?: number;
  ph?: number;
  oxigeno?: number;
  valor?: number;
  fecha: string;
}

interface GeneralChartProps {
  temperatureData: SensorData[];
  phData: SensorData[];
  oxygenData: SensorData[];
  timeFilter?: string;
}

export default function GeneralChart({ temperatureData, phData, oxygenData, timeFilter = '24h' }: GeneralChartProps) {
  // Preparar datos para el gráfico combinado
  const prepareChartData = (sensorData: SensorData[], field: string) => {
    // Usar TODOS los datos del período seleccionado (sin límites artificiales)
    const sortedData = sensorData
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    return {
      values: sortedData.map(item => {
        const value = item[field as keyof SensorData] || item.valor;
        return value ? Number(value) : null;
      }),
      timestamps: sortedData.map(item => new Date(item.fecha).getTime())
    };
  };

  const temperatureChartData = prepareChartData(temperatureData, 'temperatura');
  const phChartData = prepareChartData(phData, 'ph');
  const oxygenChartData = prepareChartData(oxygenData, 'oxigeno');

  // Crear eje X basado en timestamps (usar el conjunto con más datos)
  const maxLength = Math.max(
    temperatureChartData.values.length,
    phChartData.values.length,
    oxygenChartData.values.length
  );

  // Usar timestamps del conjunto de datos más grande
  let xAxisData: number[] = [];
  if (temperatureChartData.values.length === maxLength) {
    xAxisData = temperatureChartData.timestamps;
  } else if (phChartData.values.length === maxLength) {
    xAxisData = phChartData.timestamps;
  } else {
    xAxisData = oxygenChartData.timestamps;
  }

  // Rellenar arrays para que tengan la misma longitud
  const normalizeData = (data: (number | null)[], targetLength: number) => {
    if (data.length === targetLength) return data;
    const normalized = new Array(targetLength).fill(null);
    data.forEach((value, index) => {
      if (index < targetLength) normalized[index] = value;
    });
    return normalized;
  };

  const normalizedTempData = normalizeData(temperatureChartData.values, maxLength);
  const normalizedPhData = normalizeData(phChartData.values, maxLength);
  const normalizedOxygenData = normalizeData(oxygenChartData.values, maxLength);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2">
            Tendencias Generales de Sensores
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Período: {timeFilter === '1h' ? 'Última hora' : timeFilter === '6h' ? 'Últimas 6h' : timeFilter === '24h' ? 'Últimas 24h' : timeFilter === '7d' ? 'Últimos 7 días' : 'Todos los datos'} - {maxLength} registros completos
          </Typography>
        </Box>
        
        {maxLength > 0 ? (
          <Box sx={{ width: '100%', height: 400 }}>
            <LineChart
              xAxis={[{
                data: xAxisData,
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
              }]}
              series={[
                {
                  data: normalizedTempData,
                  label: 'Temperatura (°C)',
                  color: '#1976d2',
                  curve: 'linear',
                },
                {
                  data: normalizedPhData,
                  label: 'pH',
                  color: '#ff9800',
                  curve: 'linear',
                },
                {
                  data: normalizedOxygenData,
                  label: 'Oxígeno (mg/L)',
                  color: '#00acc1',
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
              }}
            />
          </Box>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" height={400}>
            <Typography color="text.secondary">
              No hay datos suficientes para mostrar gráficos
            </Typography>
          </Box>
        )}
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <Box>
            <Typography variant="body2" color="primary">
              Temperatura: {temperatureData.length} registros
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="secondary">
              pH: {phData.length} registros
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" sx={{ color: '#2e7d32' }}>
              Oxígeno: {oxygenData.length} registros
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
