'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Chip, Alert, Paper, IconButton, Collapse, LinearProgress, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, Button, CircularProgress } from '@mui/material';
import { MdWarning, MdError, MdInfo, MdExpandMore, MdExpandLess, MdNotifications, MdThermostat, MdScience, MdAir, MdTimeline, MdRefresh, MdCheck } from 'react-icons/md';

interface AlertaPreventiva {
  _id?: string;
  sensor: 'temperatura' | 'ph' | 'oxigeno';
  nivel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO';
  mensaje: string;
  valor_actual: number;
  fecha_creacion: string;
  resuelto: boolean;
  prioridad: number;
  sugerencias: string[];
  acciones_recomendadas: string[];
}

const API_BASE = 'http://localhost:5000/api/v1';

const obtenerAlertas = async (): Promise<AlertaPreventiva[]> => {
  try {
    const response = await fetch(`${API_BASE}/alertas`);
    if (!response.ok) throw new Error('Error al obtener alertas');
    const data = await response.json();
    return data.alertas || [];
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};

const generarPredicciones = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/ml/sistema-completo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return response.ok;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
};

const monitoreoTiempoReal = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/ml/monitoreo-tiempo-real`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return response.ok;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
};

const marcarAlertaComoRevisada = async (alertaId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/alertas/${alertaId}/revisar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    console.error('Error al marcar alerta como revisada:', error);
    return false;
  }
};

const marcarTodasComoRevisadas = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/alertas/revisar-todas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    console.error('Error al marcar todas las alertas como revisadas:', error);
    return false;
  }
};

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<AlertaPreventiva[]>([]);
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [procesandoRevisado, setProcesandoRevisado] = useState<string | null>(null);
  const [filtroRevisadas, setFiltroRevisadas] = useState<'todas' | 'sin_revisar' | 'revisadas'>('todas');
  
  // Clave para almacenamiento local
  const LOCAL_STORAGE_KEY = 'alertas_revisadas_cimarq';

  // Cargar alertas revisadas del localStorage
  const cargarAlertasRevisadasLocales = (): Set<string> => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  // Guardar alerta como revisada en localStorage
  const guardarAlertaRevisadaLocal = (alertaId: string) => {
    try {
      const revisadas = cargarAlertasRevisadasLocales();
      revisadas.add(alertaId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...revisadas]));
    } catch (error) {
      console.error('Error al guardar en localStorage:', error);
    }
  };

  // Guardar todas como revisadas en localStorage
  const guardarTodasRevisadasLocal = (alertasIds: string[]) => {
    try {
      const revisadas = cargarAlertasRevisadasLocales();
      alertasIds.forEach(id => revisadas.add(id));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...revisadas]));
    } catch (error) {
      console.error('Error al guardar en localStorage:', error);
    }
  };

  useEffect(() => {
    cargarAlertas();
  }, []);

  const cargarAlertas = async () => {
    setLoading(true);
    const alertasObtenidas = await obtenerAlertas();
    
    // Aplicar estado local de alertas revisadas
    const revisadasLocales = cargarAlertasRevisadasLocales();
    const alertasConEstadoLocal = alertasObtenidas.map(alerta => ({
      ...alerta,
      resuelto: alerta.resuelto || revisadasLocales.has(alerta._id || '')
    }));
    
    setAlertas(alertasConEstadoLocal);
    setLoading(false);
  };

  const handleGenerarPredicciones = async () => {
    setGenerando(true);
    const exito = await generarPredicciones();
    if (exito) {
      setTimeout(cargarAlertas, 2000);
    }
    setGenerando(false);
  };

  const handleMonitoreoTiempoReal = async () => {
    setGenerando(true);
    const exito = await monitoreoTiempoReal();
    if (exito) {
      setTimeout(cargarAlertas, 1000); // Más rápido que las predicciones ML
    }
    setGenerando(false);
  };

  const handleMarcarComoRevisada = async (alertaId: string) => {
    setProcesandoRevisado(alertaId);
    
    // Siempre actualizar localmente primero para UX inmediata
    setAlertas(alertas.map(alerta => 
      alerta._id === alertaId ? { ...alerta, resuelto: true } : alerta
    ));
    guardarAlertaRevisadaLocal(alertaId);
    
    // Intentar sincronizar con el backend en segundo plano
    try {
      const exito = await marcarAlertaComoRevisada(alertaId);
      if (exito) {
        console.log('Alerta sincronizada con el backend exitosamente');
      } else {
        console.warn('Backend no disponible, cambio guardado localmente');
      }
    } catch (error) {
      console.warn('Error al sincronizar con backend:', error);
    }
    
    setProcesandoRevisado(null);
  };

  const handleMarcarTodasRevisadas = async () => {
    setProcesandoRevisado('todas');
    
    // Actualizar localmente primero para UX inmediata
    const alertasActualizadas = alertas.map(alerta => ({ ...alerta, resuelto: true }));
    setAlertas(alertasActualizadas);
    
    // Guardar en localStorage
    const alertasIds = alertas.filter(a => !a.resuelto).map(a => a._id!);
    guardarTodasRevisadasLocal(alertasIds);
    
    // Intentar sincronizar con el backend en segundo plano
    try {
      const exito = await marcarTodasComoRevisadas();
      if (exito) {
        console.log('Todas las alertas sincronizadas con el backend exitosamente');
      } else {
        console.warn('Backend no disponible, cambios guardados localmente');
      }
    } catch (error) {
      console.warn('Error al sincronizar con backend:', error);
    }
    
    setProcesandoRevisado(null);
  };

  // Filtrar alertas según el filtro seleccionado
  const alertasFiltradas = alertas.filter(alerta => {
    switch (filtroRevisadas) {
      case 'sin_revisar': return !alerta.resuelto;
      case 'revisadas': return alerta.resuelto;
      default: return true;
    }
  });

  const alertasSinRevisar = alertas.filter(alerta => !alerta.resuelto).length;

  return (
    <div className='min-h-screen bg-gray-50 p-4 lg:p-6'>
      <div className='max-w-7xl mx-auto'>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2 }}>
          <MdNotifications size={40} color='#1976d2' />
          <Typography variant='h3' component='h1' sx={{ color: '#1f2937', flexGrow: 1 }}>
            Alertas Preventivas ML - CIMARQ
          </Typography>
        </Box>

        <Alert severity='info' sx={{ mb: 4 }}>
          <Typography variant='body2'>
            <strong>Sistema de Alertas Automático:</strong> 
          </Typography>
          <Typography variant='body2' sx={{ mt: 1 }}>
            • <strong>Monitoreo Tiempo Real:</strong> Verifica valores actuales vs rangos permitidos y genera alertas inmediatas<br/>
            • <strong>Predicciones ML:</strong> Utiliza modelos Perceptron para predecir problemas futuros (24h)<br/>
            • <strong>Estado Revisado:</strong> Se guarda localmente y se sincroniza automáticamente con el servidor
          </Typography>
        </Alert>

        {/* Filtros y controles */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Filtrar alertas</InputLabel>
            <Select
              value={filtroRevisadas}
              label="Filtrar alertas"
              onChange={(e) => setFiltroRevisadas(e.target.value as any)}
            >
              <MenuItem value="todas">Todas ({alertas.length})</MenuItem>
              <MenuItem value="sin_revisar">Sin revisar ({alertasSinRevisar})</MenuItem>
              <MenuItem value="revisadas">Revisadas ({alertas.length - alertasSinRevisar})</MenuItem>
            </Select>
          </FormControl>

          {alertasSinRevisar > 0 && (
            <Button
              variant="contained"
              color="success"
              onClick={handleMarcarTodasRevisadas}
              disabled={procesandoRevisado === 'todas'}
              startIcon={procesandoRevisado === 'todas' ? <CircularProgress size={16} /> : <MdCheck />}
              size="small"
            >
              Marcar todas como revisadas
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            onClick={cargarAlertas}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <MdRefresh />}
          >
            Actualizar
          </Button>
          <Button
            variant="outlined"
            onClick={handleMonitoreoTiempoReal}
            disabled={generando}
            startIcon={generando ? <CircularProgress size={16} /> : <MdNotifications />}
            color="warning"
          >
            Monitorear Valores Actuales
          </Button>
          <Button
            variant="outlined"
            onClick={handleGenerarPredicciones}
            disabled={generando}
            startIcon={generando ? <CircularProgress size={16} /> : <MdTimeline />}
          >
            Generar Predicciones ML
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : alertasFiltradas.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant='h6' color='text.secondary'>
              {filtroRevisadas === 'todas' ? 'No hay alertas disponibles' :
               filtroRevisadas === 'sin_revisar' ? 'No hay alertas sin revisar' :
               'No hay alertas revisadas'}
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant='h5' gutterBottom>
              {filtroRevisadas === 'todas' ? `Todas las Alertas (${alertasFiltradas.length})` :
               filtroRevisadas === 'sin_revisar' ? `Alertas Sin Revisar (${alertasFiltradas.length})` :
               `Alertas Revisadas (${alertasFiltradas.length})`}
            </Typography>
            {alertasFiltradas.map((alerta) => (
              <Card key={alerta._id} sx={{ 
                border: !alerta.resuelto ? 2 : 1, 
                borderColor: !alerta.resuelto ? 'error.main' : 'divider' 
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant='h6' component='div'>
                          {alerta.sensor.toUpperCase()} - Prioridad {alerta.prioridad}
                        </Typography>
                        {alerta.resuelto && (
                          <Chip 
                            label="Revisada" 
                            color="success" 
                            size="small"
                            icon={<MdCheck />}
                          />
                        )}
                      </Box>
                      <Typography variant='body2' color='text.secondary'>
                        {new Date(alerta.fecha_creacion).toLocaleString('es-CL')}
                      </Typography>
                      <Typography variant='body1' sx={{ mt: 1 }}>
                        {alerta.mensaje}
                      </Typography>
                      <Typography variant='body2' color='primary' sx={{ mt: 1, fontWeight: 'bold' }}>
                        Valor actual: {alerta.valor_actual} {
                          alerta.sensor === 'temperatura' ? '°C' : 
                          alerta.sensor === 'ph' ? '' : 'mg/L'
                        }
                      </Typography>
                      {alerta.sugerencias && alerta.sugerencias.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant='body2' fontWeight='bold'>Sugerencias:</Typography>
                          {alerta.sugerencias.map((sugerencia, index) => (
                            <Typography key={index} variant='body2' sx={{ ml: 1 }}>
                              • {sugerencia}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: 1 }}>
                      <Chip 
                        label={alerta.nivel}
                        color={
                          alerta.nivel === 'CRITICO' ? 'error' : 
                          alerta.nivel === 'ALTO' ? 'warning' : 'info'
                        }
                        size='small'
                      />
                      {!alerta.resuelto && (
                        <Button
                          variant="outlined"
                          size="small"
                          color="success"
                          onClick={() => handleMarcarComoRevisada(alerta._id!)}
                          disabled={procesandoRevisado === alerta._id}
                          startIcon={procesandoRevisado === alerta._id ? <CircularProgress size={16} /> : <MdCheck />}
                        >
                          Marcar como revisada
                        </Button>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </div>
    </div>
  );
}
