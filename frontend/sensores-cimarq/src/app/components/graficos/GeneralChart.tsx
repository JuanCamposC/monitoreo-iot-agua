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
}

export default function GeneralChart({ temperatureData, phData, oxygenData }: GeneralChartProps) {
  // Preparar datos para el gráfico combinado
  const prepareChartData = (sensorData: SensorData[], field: string, limit: number = 20) => {
    const sortedData = sensorData
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      .slice(-limit);

    return sortedData.map(item => {
      const value = item[field as keyof SensorData] || item.valor;
      return value ? Number(value) : null;
    });
  };

  const temperatureChartData = prepareChartData(temperatureData, 'temperatura');
  const phChartData = prepareChartData(phData, 'ph');
  const oxygenChartData = prepareChartData(oxygenData, 'oxigeno');

  // Crear eje X basado en el dataset más largo
  const maxLength = Math.max(
    temperatureChartData.length,
    phChartData.length,
    oxygenChartData.length
  );

  const xAxisData = Array.from({ length: maxLength }, (_, i) => i + 1);

  // Rellenar arrays para que tengan la misma longitud
  const normalizeData = (data: (number | null)[], targetLength: number) => {
    if (data.length === targetLength) return data;
    const normalized = new Array(targetLength).fill(null);
    data.forEach((value, index) => {
      if (index < targetLength) normalized[index] = value;
    });
    return normalized;
  };

  const normalizedTempData = normalizeData(temperatureChartData, maxLength);
  const normalizedPhData = normalizeData(phChartData, maxLength);
  const normalizedOxygenData = normalizeData(oxygenChartData, maxLength);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Tendencias Generales de Sensores (Últimos 20 registros)
        </Typography>
        
        {maxLength > 0 ? (
          <Box sx={{ width: '100%', height: 400 }}>
            <LineChart
              width={1000}
              height={400}
              series={[
                {
                  data: normalizedTempData,
                  label: 'Temperatura (°C)',
                  color: '#1976d2',
                },
                {
                  data: normalizedPhData,
                  label: 'pH',
                  color: '#9c27b0',
                },
                {
                  data: normalizedOxygenData,
                  label: 'Oxígeno (mg/L)',
                  color: '#2e7d32',
                },
              ]}
              xAxis={[{ 
                data: xAxisData,
                scaleType: 'point',
                valueFormatter: (value) => `#${value}`
              }]}
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
