'use client';

import { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Chip, Paper, IconButton, 
  LinearProgress, FormControl, InputLabel, Select, MenuItem, 
  Button, CircularProgress, Switch, FormControlLabel, 
  Badge, Tabs, Tab, List, ListItem, ListItemText,
  ListItemIcon, Alert, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import { 
  MdInfo, MdNotifications, MdThermostat, 
  MdScience, MdAir, MdTimeline, MdRefresh, MdCheck, MdPlayArrow, 
  MdStop, MdClear, MdVisibility, MdExpandMore,
  MdTrendingUp, MdTrendingDown, MdTrendingFlat, MdEmail,
  MdBuild, MdEco, MdWarning as MdAlert
} from 'react-icons/md';
import { useMonitoreoAutomatico } from '../hooks/useMonitoreoAutomatico';

interface AlertaInterface {
  id: string;
  tipo?: 'temperatura' | 'ph' | 'oxigeno';
  sensor?: 'temperatura' | 'ph' | 'oxigeno';
  valor: number;
  nivel?: 'normal' | 'alerta' | 'critico';
  estado?: 'normal' | 'alerta' | 'critico';
  mensaje: string;
  timestamp: string;
  leida?: boolean;
  nivel_riesgo?: string;
  resuelto?: boolean;
  detalles_tecnicos?: {
    desviacion?: number;
    porcentaje_exceso?: number;
    tendencia?: string;
  };
  rangos?: {
    minimo: number;
    maximo: number;
  };
  impacto_ambiental?: string;
  acciones_recomendadas?: string[];
  prediccion?: {
    valor_futuro: number;
    tendencia: string;
    confianza: number;
  };
}

// Componente para mostrar alertas automáticas detalladas
const AlertaAutomaticaDetallada = ({ alerta, onMarcarLeida }: { 
  alerta: any, 
  onMarcarLeida: (id: string) => void 
}) => {
  const [expandida, setExpandida] = useState(false);

  const getTendenciaIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'subiendo': return <MdTrendingUp color="#f44336" />;
      case 'bajando': return <MdTrendingDown color="#2196f3" />;
      default: return <MdTrendingFlat color="#9e9e9e" />;
    }
  };

  const getRiesgoColor = (riesgo: string) => {
    switch (riesgo) {
      case 'critico': return '#f44336';
      case 'alto': return '#ff9800';
      case 'medio': return '#2196f3';
      default: return '#4caf50';
    }
  };

  return (
    <Accordion 
      expanded={expandida} 
      onChange={() => setExpandida(!expandida)}
      sx={{ 
        mb: 2, 
        borderLeft: `4px solid ${alerta.nivel === 'critico' ? '#f44336' : '#ff9800'}`,
        bgcolor: alerta.leida ? 'grey.50' : 'background.paper',
        opacity: alerta.leida ? 0.7 : 1
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
        <AccordionSummary 
          expandIcon={<MdExpandMore />}
          sx={{ flex: 1 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
            <Box sx={{ minWidth: '40px' }}>
              {alerta.tipo === 'temperatura' && <MdThermostat size={24} color="#ff5722" />}
              {alerta.tipo === 'ph' && <MdScience size={24} color="#3f51b5" />}
              {alerta.tipo === 'oxigeno' && <MdAir size={24} color="#00bcd4" />}
            </Box>
            
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: alerta.leida ? 'normal' : 'bold' }}>
                {alerta.mensaje}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {alerta.timestamp.toLocaleString()} • 
                Valor: {alerta.valor}
                {alerta.tipo === 'temperatura' && '°C'}
                {alerta.tipo === 'oxigeno' && ' mg/L'}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                label={alerta.nivel === 'critico' ? 'CRÍTICO' : 'ALERTA'}
                color={alerta.nivel === 'critico' ? 'error' : 'warning'}
                size="small"
              />
              
              <Chip
                label={alerta.nivel_riesgo?.toUpperCase() || 'MEDIO'}
                size="small"
                sx={{ bgcolor: getRiesgoColor(alerta.nivel_riesgo || 'medio'), color: 'white' }}
              />
            </Box>
          </Box>
        </AccordionSummary>
        
        {/* Botón de marcar como leída - FUERA del AccordionSummary */}
        {!alerta.leida && (
          <Box sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMarcarLeida(alerta.id);
              }}
              title="Marcar como leída"
            >
              <MdVisibility />
            </IconButton>
          </Box>
        )}
      </Box>
      
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Primera fila: Detalles Técnicos e Impacto Ambiental */}
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {/* Detalles Técnicos */}
            <Box sx={{ flex: 1, minWidth: '300px' }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MdBuild /> Detalles Técnicos
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Desviación del centro: <strong>{alerta.detalles_tecnicos?.desviacion || 0}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Exceso porcentual: <strong>{alerta.detalles_tecnicos?.porcentaje_exceso || 0}%</strong>
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">Tendencia:</Typography>
                      {getTendenciaIcon(alerta.detalles_tecnicos?.tendencia || 'estable')}
                      <Typography variant="body2">
                        {alerta.detalles_tecnicos?.tendencia || 'estable'}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Rangos Configurados:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Mínimo: {alerta.rangos?.minimo || 0} • Máximo: {alerta.rangos?.maximo || 0}
                    {(alerta.sensor || alerta.tipo) === 'temperatura' && '°C'}
                    {(alerta.sensor || alerta.tipo) === 'oxigeno' && ' mg/L'}
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Impacto Ambiental */}
            <Box sx={{ flex: 1, minWidth: '300px' }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MdEco /> Impacto Ambiental
                  </Typography>
                  <Alert 
                    severity={alerta.estado === 'critico' ? 'error' : 'warning'}
                    sx={{ mb: 2 }}
                  >
                    {alerta.impacto_ambiental}
                  </Alert>
                  
                  {alerta.estado === 'critico' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <MdEmail color="#1976d2" />
                      <Typography variant="body2" color="primary">
                        ✅ Correo de alerta crítica enviado
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Segunda fila: Acciones Recomendadas */}
          <Box>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MdAlert /> Acciones Recomendadas
                </Typography>
                <List dense>
                  {(alerta.acciones_recomendadas || []).map((accion: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <MdCheck color="#4caf50" />
                      </ListItemIcon>
                      <ListItemText primary={accion} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

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

// Función para verificar si el backend está disponible
const verificarBackend = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/estado`, { 
      method: 'GET',
      signal: AbortSignal.timeout(2000) // Timeout de 2 segundos
    });
    return response.ok;
  } catch (error) {
    console.warn('⚠️ Backend no disponible, funcionando en modo offline');
    return false;
  }
};

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
  const backendDisponible = await verificarBackend();
  if (!backendDisponible) {
    console.warn('⚠️ Backend no disponible - simulando predicciones');
    return true; // Simular éxito para que la UI funcione
  }

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
  const backendDisponible = await verificarBackend();
  if (!backendDisponible) {
    console.warn('⚠️ Backend no disponible - simulando monitoreo');
    return true; // Simular éxito para que la UI funcione
  }

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

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<AlertaPreventiva[]>([]);
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [procesandoRevisado, setProcesandoRevisado] = useState<string | null>(null);
  const [filtroRevisadas, setFiltroRevisadas] = useState<'todas' | 'sin_revisar' | 'revisadas'>('todas');
  const [vistaActiva, setVistaActiva] = useState<'automaticas' | 'preventivas'>('automaticas');
  const [limpiandoAlertas, setLimpiandoAlertas] = useState(false);
  const [limpiandoAlertasML, setLimpiandoAlertasML] = useState(false);
  const [emailsHabilitados, setEmailsHabilitados] = useState(true); // Valor por defecto
  // const [clienteInicializado, setClienteInicializado] = useState(false);
  
  // Hook de monitoreo automático
  const {
    alertasAutomaticas,
    monitoreoActivo,
    estadisticas,
    iniciarMonitoreo,
    detenerMonitoreo,
    marcarComoLeida,
    marcarTodasComoLeidas,
    limpiarAlertasLeidas,
    limpiarTodasLasAlertas
  } = useMonitoreoAutomatico();

  const cargarAlertas = async () => {
    setLoading(true);
    try {
      const alertasObtenidas = await obtenerAlertas();
      setAlertas(alertasObtenidas);
    } catch (error) {
      console.error('Error al cargar alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarPredicciones = async () => {
    setGenerando(true);
    try {
      const resultado = await generarPredicciones();
      if (resultado) {
        await cargarAlertas();
      }
    } catch (error) {
      console.error('Error al generar predicciones:', error);
    } finally {
      setGenerando(false);
    }
  };

  const handleMonitoreoTiempoReal = async () => {
    setGenerando(true);
    try {
      const resultado = await monitoreoTiempoReal();
      if (resultado) {
        await cargarAlertas();
      }
    } catch (error) {
      console.error('Error en monitoreo tiempo real:', error);
    } finally {
      setGenerando(false);
    }
  };

  const handleMarcarRevisada = async (alertaId: string) => {
    setProcesandoRevisado(alertaId);
    try {
      const resultado = await marcarAlertaComoRevisada(alertaId);
      if (resultado) {
        setAlertas(prev => prev.map(alerta => 
          alerta._id === alertaId 
            ? { ...alerta, resuelto: true }
            : alerta
        ));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setProcesandoRevisado(null);
    }
  };

  const limpiarAlertasAutomaticas = async () => {
    const totalAlertas = alertasAutomaticas.length;
    
    if (totalAlertas === 0) {
      alert('No hay alertas automáticas para limpiar');
      return;
    }
    
    const confirmacion = window.confirm(
      `¿Estás seguro de que quieres eliminar todas las ${totalAlertas} alertas automáticas?\n\nEsta acción no se puede deshacer.`
    );
    
    if (confirmacion) {
      setLimpiandoAlertas(true);
      
      try {
        console.log('🧹 Usuario confirmó limpiar alertas automáticas');
        console.log('📊 Alertas antes de limpiar:', totalAlertas);
        
        // Ejecutar limpieza
        limpiarTodasLasAlertas();
        
        // Esperar un momento para que el estado se actualice
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log('✅ Alertas limpiadas exitosamente');
        
        // Mostrar notificación de éxito (opcional)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🧹 Alertas Limpiadas', {
            body: `Se eliminaron ${totalAlertas} alertas automáticas`,
            icon: '/favicon.ico'
          });
        }
        
      } catch (error) {
        console.error('❌ Error al limpiar alertas:', error);
        alert('Hubo un error al limpiar las alertas. Inténtalo de nuevo.');
      } finally {
        setLimpiandoAlertas(false);
      }
    } else {
      console.log('❌ Usuario canceló limpiar alertas');
    }
  };

  // Función para limpiar alertas predictivas
  const limpiarAlertasPreventivas = async (soloRevisadas: boolean = false) => {
    const alertasALimpiar = soloRevisadas 
      ? alertas.filter(a => a.resuelto)
      : alertas;
    
    if (alertasALimpiar.length === 0) {
      alert(soloRevisadas ? 'No hay alertas revisadas para limpiar' : 'No hay alertas predictivas para limpiar');
      return;
    }
    
    const tipoLimpieza = soloRevisadas ? 'revisadas' : 'todas las';
    const confirmacion = window.confirm(
      `¿Estás seguro de que quieres eliminar ${tipoLimpieza} ${alertasALimpiar.length} alertas predictivas?\n\nEsta acción no se puede deshacer.`
    );
    
    if (confirmacion) {
      setLimpiandoAlertasML(true);
      
      try {
        console.log(`🤖 Limpiando ${tipoLimpieza} alertas predictivas:`, alertasALimpiar.length);
        
        // Por ahora, solo limpiar del estado local (hasta que el backend esté disponible)
        // TODO: Implementar eliminación del backend cuando esté disponible
        try {
          // Intentar eliminar del backend si está disponible
          const promesas = alertasALimpiar.map(async (alerta) => {
            try {
              const response = await fetch(`${API_BASE}/ml/alertas/${alerta._id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
              });
              if (!response.ok && response.status !== 404) {
                throw new Error(`HTTP ${response.status}`);
              }
              return true;
            } catch (error) {
              console.warn(`⚠️ No se pudo eliminar alerta ${alerta._id} del backend:`, error);
              return false; // Continuar con limpieza local
            }
          });
          
          await Promise.all(promesas);
        } catch (error) {
          console.warn('⚠️ Backend no disponible, limpiando solo localmente:', error);
        }
        
        // Actualizar estado local (siempre funciona)
        setAlertas(prev => prev.filter(alerta => 
          soloRevisadas ? !alerta.resuelto : false
        ));
        
        console.log('✅ Alertas predictivas limpiadas exitosamente');
        
        // Mostrar notificación de éxito
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🤖 Alertas Predictivas Limpiadas', {
            body: `Se eliminaron ${alertasALimpiar.length} alertas predictivas`,
            icon: '/favicon.ico'
          });
        }
        
      } catch (error) {
        console.error('❌ Error al limpiar alertas predictivas:', error);
        alert('Hubo un error al limpiar las alertas predictivas. Inténtalo de nuevo.');
      } finally {
        setLimpiandoAlertasML(false);
      }
    } else {
      console.log('❌ Usuario canceló limpiar alertas predictivas');
    }
  };

  // Función para alternar emails - FUNCIONA PARA TODOS LOS TIPOS DE ALERTAS
  const toggleEmails = async () => {
    const nuevoEstado = !emailsHabilitados;
    setEmailsHabilitados(nuevoEstado);
    
    // Guardar en localStorage solo si estamos en el cliente
    if (typeof window !== 'undefined') {
      localStorage.setItem('emails-habilitados', JSON.stringify(nuevoEstado));
    }
    
    console.log(`📧 Configuración de emails ${nuevoEstado ? 'ACTIVADA' : 'DESACTIVADA'} para:`);
    console.log('- ✅ Alertas automáticas por rangos');
    console.log('- 🤖 Alertas predictivas ML');
    
    // Enviar configuración al backend (con manejo de errores mejorado)
    try {
      const response = await fetch(`${API_BASE}/notificaciones/configuracion/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          habilitado: nuevoEstado,
          timestamp: new Date().toISOString(),
          tipos_alertas: ['automaticas', 'predictivas'] // Indica que aplica a ambos tipos
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Configuración de emails sincronizada con el backend');
    } catch (error) {
      console.warn('⚠️ No se pudo sincronizar con el backend, usando configuración local:', error);
      // La funcionalidad sigue funcionando con localStorage
    }

    // Mostrar notificación mejorada
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('📧 Configuración de Email Global', {
        body: `Notificaciones por email ${nuevoEstado ? 'ACTIVADAS' : 'DESACTIVADAS'} para alertas automáticas y predictivas`,
        icon: '/favicon.ico'
      });
    }
  };

  const limpiarSoloAlertasLeidas = async () => {
    const alertasLeidas = alertasAutomaticas.filter(a => a.leida).length;
    
    if (alertasLeidas === 0) {
      alert('No hay alertas leídas para limpiar');
      return;
    }
    
    const confirmacion = window.confirm(
      `¿Quieres eliminar solo las ${alertasLeidas} alertas que ya fueron leídas?\n\nLas alertas sin leer se mantendrán.`
    );
    
    if (confirmacion) {
      setLimpiandoAlertas(true);
      
      try {
        const eliminadas = limpiarAlertasLeidas();
        console.log(`✅ ${eliminadas} alertas leídas eliminadas`);
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🧹 Alertas Leídas Limpiadas', {
            body: `Se eliminaron ${eliminadas} alertas leídas`,
            icon: '/favicon.ico'
          });
        }
      } catch (error) {
        console.error('❌ Error al limpiar alertas leídas:', error);
        alert('Hubo un error al limpiar las alertas leídas.');
      } finally {
        setLimpiandoAlertas(false);
      }
    }
  };

  // Efecto para inicializar configuración de emails desde localStorage (solo cliente)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('emails-habilitados');
      if (saved) {
        setEmailsHabilitados(JSON.parse(saved));
      }
      // setClienteInicializado(true);
    }
  }, []);

  useEffect(() => {
    cargarAlertas();
  }, []);

  const alertasFiltradas = alertas.filter(alerta => {
    if (filtroRevisadas === 'sin_revisar') return !alerta.resuelto;
    if (filtroRevisadas === 'revisadas') return alerta.resuelto;
    return true;
  });

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          🚨 Centro de Alertas y Monitoreo
        </Typography>
        <Typography variant="body1">
          Sistema integrado de alertas automáticas por rangos y predicciones ML
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
          📧 Control global de notificaciones por email disponible en el panel de monitoreo
        </Typography>
      </Paper>

      {/* Panel de Control del Monitoreo Automático */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              ⚡ Monitoreo Automático en Tiempo Real
            </Typography>
            <Badge badgeContent={estadisticas.noLeidas} color="error">
              <MdNotifications size={24} />
            </Badge>
          </Box>

          {/* Debug Info - Temporal */}
          {process.env.NODE_ENV === 'development' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="caption">
                🔧 Debug: Alertas en estado: {alertasAutomaticas.length} | 
                En localStorage: {localStorage.getItem('alertasAutomaticas') ? JSON.parse(localStorage.getItem('alertasAutomaticas') || '[]').length : 0} |
                Leídas: {alertasAutomaticas.filter(a => a.leida).length} |
                No leídas: {alertasAutomaticas.filter(a => !a.leida).length}
              </Typography>
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Paper sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'white', minWidth: '150px' }}>
              <Typography variant="h4">{estadisticas.total}</Typography>
              <Typography variant="caption">Total Alertas</Typography>
            </Paper>
            <Paper sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: 'error.light', color: 'white', minWidth: '150px' }}>
              <Typography variant="h4">{estadisticas.criticas}</Typography>
              <Typography variant="caption">Críticas</Typography>
            </Paper>
            <Paper sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'white', minWidth: '150px' }}>
              <Typography variant="h4">{estadisticas.aceptables}</Typography>
              <Typography variant="caption">Aceptables</Typography>
            </Paper>
            <Paper sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'white', minWidth: '150px' }}>
              <Typography variant="h4">{estadisticas.noLeidas}</Typography>
              <Typography variant="caption">Sin Leer</Typography>
            </Paper>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={monitoreoActivo}
                  onChange={(e) => e.target.checked ? iniciarMonitoreo() : detenerMonitoreo()}
                  color="primary"
                />
              }
              label={`Monitoreo ${monitoreoActivo ? 'ACTIVO' : 'INACTIVO'}`}
            />
            
            {monitoreoActivo && (
              <Chip
                icon={<MdPlayArrow />}
                label="Monitoreando en tiempo real"
                color="success"
                variant="outlined"
              />
            )}

            {/* Divisor */}
            <Box sx={{ width: '1px', height: '30px', bgcolor: 'divider', mx: 1 }} />
            
            {/* Control de emails - GENERAL para todos los tipos de alertas */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                📧 Emails (Todas las Alertas):
              </Typography>
              <Button
                variant={emailsHabilitados ? "contained" : "outlined"}
                size="small"
                onClick={toggleEmails}
                color={emailsHabilitados ? "success" : "error"}
                startIcon={emailsHabilitados ? <MdEmail /> : <MdStop />}
                title={`${emailsHabilitados ? 'Desactivar' : 'Activar'} notificaciones por email para alertas automáticas y predictivas`}
              >
                {emailsHabilitados ? 'Activadas' : 'Desactivadas'}
              </Button>
              <Chip
                label={emailsHabilitados ? "GLOBAL ON" : "GLOBAL OFF"}
                color={emailsHabilitados ? "success" : "error"}
                size="small"
                variant="outlined"
              />
            </Box>

            {/* Divisor */}
            <Box sx={{ width: '1px', height: '30px', bgcolor: 'divider', mx: 1 }} />

            <Button
              variant="text"
              startIcon={<MdCheck />}
              onClick={marcarTodasComoLeidas}
              disabled={estadisticas.noLeidas === 0 || limpiandoAlertas}
              size="small"
            >
              Marcar Leídas ({estadisticas.noLeidas})
            </Button>

            <Button
              variant="outlined"
              startIcon={<MdClear />}
              onClick={limpiarSoloAlertasLeidas}
              disabled={alertasAutomaticas.filter(a => a.leida).length === 0 || limpiandoAlertas}
              size="small"
              color="warning"
            >
              Limpiar Leídas ({alertasAutomaticas.filter(a => a.leida).length})
            </Button>

            <Button
              variant="outlined"
              startIcon={limpiandoAlertas ? <CircularProgress size={16} /> : <MdClear />}
              onClick={limpiarAlertasAutomaticas}
              disabled={estadisticas.total === 0 || limpiandoAlertas}
              size="small"
              color={limpiandoAlertas ? "info" : "error"}
            >
              {limpiandoAlertas ? 'Limpiando...' : `Limpiar Todas (${estadisticas.total})`}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Pestañas de Navegación */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={vistaActiva}
          onChange={(_, newValue) => setVistaActiva(newValue)}
          centered
        >
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MdNotifications />
                Alertas Automáticas
                <Badge badgeContent={estadisticas.noLeidas} color="error" />
              </Box>
            }
            value="automaticas"
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MdTimeline />
                Alertas Predictivas ML
                <Badge badgeContent={alertas.filter(a => !a.resuelto).length} color="error" />
              </Box>
            }
            value="preventivas"
          />
        </Tabs>
      </Card>

      {/* Contenido de Alertas */}
      {vistaActiva === 'automaticas' ? (
        /* Vista de Alertas Automáticas */
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                🔔 Alertas Automáticas por Rangos
              </Typography>
              {estadisticas.total > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={marcarTodasComoLeidas}
                  startIcon={<MdVisibility />}
                >
                  Marcar Todas como Leídas
                </Button>
              )}
            </Box>

            {alertasAutomaticas.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                <MdInfo size={48} color="#9e9e9e" />
                <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
                  No hay alertas automáticas
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                  {monitoreoActivo 
                    ? 'El monitoreo está activo. Las alertas aparecerán cuando los valores se salgan de los rangos configurados.'
                    : 'Active el monitoreo automático para recibir alertas en tiempo real.'
                  }
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                {alertasAutomaticas.map((alerta) => (
                  <AlertaAutomaticaDetallada 
                    key={alerta.id}
                    alerta={alerta}
                    onMarcarLeida={marcarComoLeida}
                  />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Vista de Alertas Preventivas ML */
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🤖 Alertas Predictivas con Machine Learning
            </Typography>
            
            {/* Controles ML */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
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
                color="info"
              >
                Generar Predicciones (24h)
              </Button>
            </Box>

            {/* Controles de limpieza y configuración ML */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<MdClear />}
                onClick={() => limpiarAlertasPreventivas(true)}
                disabled={limpiandoAlertasML || alertas.filter(a => a.resuelto).length === 0}
                color="secondary"
                size="small"
              >
                Limpiar Revisadas ({alertas.filter(a => a.resuelto).length})
              </Button>
              <Button
                variant="outlined"
                startIcon={limpiandoAlertasML ? <CircularProgress size={16} /> : <MdClear />}
                onClick={() => limpiarAlertasPreventivas(false)}
                disabled={limpiandoAlertasML || alertas.length === 0}
                color="error"
                size="small"
              >
                Limpiar Todas ({alertas.length})
              </Button>
              
            </Box>

            {/* Filtros ML */}
            <Box sx={{ mb: 3 }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Filtrar alertas ML</InputLabel>
                <Select
                  value={filtroRevisadas}
                  label="Filtrar alertas ML"
                  onChange={(e) => setFiltroRevisadas(e.target.value as any)}
                >
                  <MenuItem value="todas">Todas ({alertas.length})</MenuItem>
                  <MenuItem value="sin_revisar">Sin revisar ({alertas.filter(a => !a.resuelto).length})</MenuItem>
                  <MenuItem value="revisadas">Revisadas ({alertas.filter(a => a.resuelto).length})</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {loading && (
              <Box sx={{ width: '100%', mb: 2 }}>
                <LinearProgress />
              </Box>
            )}

            {/* Lista de alertas ML */}
            {alertas.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                <MdTimeline size={48} color="#9e9e9e" />
                <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
                  No hay alertas predictivas ML
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                  Ejecute el monitoreo o genere predicciones para obtener alertas
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                {alertasFiltradas.map((alerta, index) => (
                  <Paper 
                    key={alerta._id || index}
                    sx={{ 
                      p: 2, 
                      mb: 2, 
                      borderLeft: `4px solid ${
                        alerta.nivel === 'CRITICO' ? '#f44336' : 
                        alerta.nivel === 'ALTO' ? '#ff9800' : 
                        alerta.nivel === 'MEDIO' ? '#2196f3' : '#4caf50'
                      }`,
                      bgcolor: alerta.resuelto ? 'grey.50' : 'background.paper',
                      opacity: alerta.resuelto ? 0.7 : 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ minWidth: '40px' }}>
                        {alerta.sensor === 'temperatura' && <MdThermostat size={24} color="#ff5722" />}
                        {alerta.sensor === 'ph' && <MdScience size={24} color="#3f51b5" />}
                        {alerta.sensor === 'oxigeno' && <MdAir size={24} color="#00bcd4" />}
                      </Box>
                      
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: alerta.resuelto ? 'normal' : 'bold' }}>
                          {alerta.mensaje}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(alerta.fecha_creacion).toLocaleString()} • 
                          Valor: {alerta.valor_actual}
                          {alerta.sensor === 'temperatura' && '°C'}
                          {alerta.sensor === 'oxigeno' && ' mg/L'}
                        </Typography>
                      </Box>
                      
                      <Box>
                        <Chip
                          label={alerta.nivel}
                          color={
                            alerta.nivel === 'CRITICO' ? 'error' : 
                            alerta.nivel === 'ALTO' ? 'warning' : 
                            alerta.nivel === 'MEDIO' ? 'info' : 'success'
                          }
                          size="small"
                        />
                      </Box>
                      
                      <Box sx={{ minWidth: '50px' }}>
                        {!alerta.resuelto && (
                          <IconButton
                            size="small"
                            onClick={() => handleMarcarRevisada(alerta._id!)}
                            disabled={procesandoRevisado === alerta._id}
                            title="Marcar como revisada"
                          >
                            {procesandoRevisado === alerta._id ? 
                              <CircularProgress size={16} /> : 
                              <MdCheck />
                            }
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}