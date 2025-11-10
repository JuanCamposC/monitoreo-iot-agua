'use client';

import { useState } from 'react';
import { Box, Typography, Card, CardContent, Chip, Paper, IconButton, LinearProgress, Button, CircularProgress, Badge, List, ListItem, ListItemText, ListItemIcon, Alert, Accordion, AccordionSummary, AccordionDetails, Switch, FormControlLabel} from '@mui/material';
import { MdInfo, MdNotifications, MdThermostat, MdScience, MdAir, MdTimeline, MdCheck, MdPlayArrow, MdClear, MdVisibility, MdExpandMore, MdTrendingUp, MdTrendingDown, MdTrendingFlat, MdBuild, MdEco, MdWarning as MdAlert} from 'react-icons/md';
import { useMonitoreoAutomatico } from '../hooks/useMonitoreoAutomatico';
import { useConfiguracionAlertas } from '../hooks/useConfiguracionAlertas';
import { useAlertasML, AlertaML } from '../hooks/useAlertasML';

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
        borderLeft: `4px solid ${alerta.estado === 'critico' ? '#f44336' : '#ff9800'}`,
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
                {alerta.sensor === 'registro_completo' ? (
                  `${alerta.sensores_afectados?.length || 0} sensores afectados`
                ) : (
                  <>
                    Valor: {alerta.valor}
                    {alerta.sensor === 'temperatura' && '°C'}
                    {alerta.sensor === 'oxigeno' && ' mg/L'}
                  </>
                )}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                label={alerta.estado === 'critico' ? 'CRÍTICO' : alerta.estado === 'aceptable' ? 'ADVERTENCIA' : 'ÓPTIMO'}
                color={alerta.estado === 'critico' ? 'error' : alerta.estado === 'aceptable' ? 'warning' : 'success'}
                size="small"
              />
              
              <Chip
                label={alerta.nivel_riesgo?.toUpperCase() || 'medio'}
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
    </Accordion>
  );
};

// Función para agrupar alertas automáticas
const agruparAlertasAutomaticas = (alertas: any[]) => {
  const grupos: any[] = [];
  
  alertas.forEach(alerta => {
    const clave = `${alerta.sensor}_${alerta.estado}`;
    let grupo = grupos.find(g => g.clave === clave);
    
    if (!grupo) {
      grupo = {
        clave,
        sensor: alerta.sensor,
        estado: alerta.estado,
        alertas: [],
        timestamp: alerta.timestamp
      };
      grupos.push(grupo);
    }
    
    grupo.alertas.push(alerta);
    if (alerta.timestamp > grupo.timestamp) {
      grupo.timestamp = alerta.timestamp;
    }
  });
  
  return grupos.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export default function AlertasPage() {
  const [limpiandoAlertas, setLimpiandoAlertas] = useState(false);

  // Hooks
  const { deberMostrarAlerta } = useConfiguracionAlertas();
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

  const {
    alertas: alertasML,
    alertasNoLeidas,
    loading: cargandoML,
    generarAlertasML,
    marcarComoLeida: marcarComoLeidaML,
    limpiarAlertasLeidas: limpiarAlertasLeidasML
  } = useAlertasML();

  // Estadísticas unificadas del sistema completo
  const estadisticasUnificadas = {
    totalAlertas: alertasAutomaticas.length + alertasML.length,
    alertasCriticas: alertasAutomaticas.filter(a => a.estado === 'critico').length + alertasML.filter(a => a.nivel === 'critico').length,
    alertasAdvertencia: alertasAutomaticas.filter(a => a.estado === 'aceptable').length + alertasML.filter(a => a.nivel === 'advertencia').length,
    alertasSinLeer: estadisticas.noLeidas + alertasNoLeidas,
    alertasAutomaticas: alertasAutomaticas.length,
    alertasML: alertasML.length
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
        console.log('Usuario confirmó limpiar alertas automáticas');
        console.log('Alertas antes de limpiar:', totalAlertas);
        
        // Ejecutar limpieza
        limpiarTodasLasAlertas();
        
        // Esperar un momento para que el estado se actualice
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log('Alertas limpiadas exitosamente');
        
        // Mostrar notificación de éxito (opcional)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Alertas Limpiadas', {
            body: `Se eliminaron ${totalAlertas} alertas automáticas`,
            icon: '/favicon.ico'
          });
        }
        
      } catch (error) {
        console.error('Error al limpiar alertas:', error);
        alert('Hubo un error al limpiar las alertas. Inténtalo de nuevo.');
      } finally {
        setLimpiandoAlertas(false);
      }
    } else {
      console.log('Usuario canceló limpiar alertas');
    }
  };

  const getNivelColor = (estado: string) => {
    switch (estado) {
      case 'critico': return '#f44336';      // Rojo
      case 'aceptable': return '#ff9800';    // Naranja
      case 'optimo': return '#4caf50';       // Verde
      default: return '#9e9e9e';             // Gris
    }
  };

  // Obtener alertas automáticas agrupadas
  const alertasAutomaticasAgrupadas = agruparAlertasAutomaticas(alertasAutomaticas);

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header Unificado */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Centro Unificado de Alertas
        </Typography>
        <Typography variant="body1">
          Sistema integrado con alertas automáticas por rangos y análisis inteligente ML
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, mt: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdNotifications />
            <Typography variant="body2">
              {estadisticasUnificadas.totalAlertas} alertas totales
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdAlert />
            <Typography variant="body2">
              {estadisticasUnificadas.alertasCriticas} críticas
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdInfo />
            <Typography variant="body2">
              {estadisticasUnificadas.alertasSinLeer} sin leer
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Panel de Control del Monitoreo Automático */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Control del Sistema de Alertas
            </Typography>
            <Badge badgeContent={estadisticasUnificadas.alertasSinLeer} color="error">
              <MdNotifications size={24} />
            </Badge>
          </Box>

          {/* Estadísticas Unificadas */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Paper sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'white', minWidth: '150px' }}>
              <Typography variant="h4">{estadisticasUnificadas.totalAlertas}</Typography>
              <Typography variant="caption">Total Alertas</Typography>
            </Paper>
            <Paper sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: 'error.light', color: 'white', minWidth: '150px' }}>
              <Typography variant="h4">{estadisticasUnificadas.alertasCriticas}</Typography>
              <Typography variant="caption">Críticas</Typography>
            </Paper>
            <Paper sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'white', minWidth: '150px' }}>
              <Typography variant="h4">{estadisticasUnificadas.alertasAutomaticas}</Typography>
              <Typography variant="caption">Automáticas</Typography>
            </Paper>
            <Paper sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'white', minWidth: '150px' }}>
              <Typography variant="h4">{estadisticasUnificadas.alertasML}</Typography>
              <Typography variant="caption">Inteligentes ML</Typography>
            </Paper>
          </Box>

          {/* Controles */}
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

            <Button
              variant="contained"
              onClick={generarAlertasML}
              disabled={cargandoML}
              startIcon={cargandoML ? <CircularProgress size={16} /> : <MdTimeline />}
              color="primary"
            >
              Generar Alertas ML
            </Button>

            <Button
              variant="text"
              startIcon={<MdCheck />}
              onClick={marcarTodasComoLeidas}
              disabled={estadisticasUnificadas.alertasSinLeer === 0 || limpiandoAlertas}
              size="small"
            >
              Marcar Leídas ({estadisticasUnificadas.alertasSinLeer})
            </Button>

            <Button
              variant="outlined"
              startIcon={<MdClear />}
              onClick={limpiarAlertasLeidas}
              disabled={alertasAutomaticas.filter(a => a.leida).length === 0 || limpiandoAlertas}
              size="small"
              color="warning"
            >
              Limpiar Automáticas Leídas ({alertasAutomaticas.filter(a => a.leida).length})
            </Button>

            <Button
              variant="outlined"
              startIcon={<MdClear />}
              onClick={limpiarAlertasLeidasML}
              disabled={cargandoML || alertasML.filter(a => a.leida).length === 0}
              size="small"
              color="secondary"
            >
              Limpiar ML Leídas ({alertasML.filter(a => a.leida).length})
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Vista Unificada de Alertas */}
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        
        {/* Columna izquierda: Alertas Automáticas */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MdNotifications />
              <Typography variant="h6">
                Alertas Automáticas por Rangos
              </Typography>
              <Badge badgeContent={estadisticas.noLeidas} color="error" />
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
                {alertasAutomaticasAgrupadas.map((grupo) => (
                  <Accordion key={grupo.clave} sx={{ mb: 2 }}>
                    <AccordionSummary 
                      expandIcon={<MdExpandMore />}
                      sx={{ 
                        bgcolor: `${getNivelColor(grupo.estado)}20`,
                        '&:hover': { bgcolor: `${getNivelColor(grupo.estado)}30` }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Box sx={{ minWidth: '40px' }}>
                          {grupo.sensor === 'temperatura' && <MdThermostat size={24} color="#ff5722" />}
                          {grupo.sensor === 'ph' && <MdScience size={24} color="#3f51b5" />}
                          {grupo.sensor === 'oxigeno' && <MdAir size={24} color="#00bcd4" />}
                        </Box>
                        
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {grupo.sensor === 'temperatura' ? 'Temperatura' : 
                             grupo.sensor === 'ph' ? 'pH' : 'Oxígeno'} - 
                            {grupo.estado === 'critico' ? ' CRÍTICO' : grupo.estado === 'aceptable' ? ' ADVERTENCIA' : ' ÓPTIMO'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {grupo.alertas.length} alerta{grupo.alertas.length > 1 ? 's' : ''} • 
                            Última: {new Date(grupo.timestamp).toLocaleString()}
                          </Typography>
                        </Box>
                        
                        <Box>
                          <Chip
                            label={grupo.estado === 'critico' ? 'CRÍTICO' : grupo.estado === 'aceptable' ? 'ADVERTENCIA' : 'ÓPTIMO'}
                            color={grupo.estado === 'critico' ? 'error' : grupo.estado === 'aceptable' ? 'warning' : 'success'}
                            size="small"
                          />
                        </Box>
                      </Box>
                    </AccordionSummary>
                    
                    <AccordionDetails>
                      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {grupo.alertas.map((alerta: any, index: number) => (
                          <AlertaAutomaticaDetallada 
                            key={alerta.id || index}
                            alerta={alerta}
                            onMarcarLeida={marcarComoLeida}
                          />
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Columna derecha: Alertas ML */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MdTimeline />
              <Typography variant="h6">
                Alertas Inteligentes ML
              </Typography>
              <Badge badgeContent={alertasNoLeidas} color="error" />
            </Box>

            {cargandoML && (
              <Box sx={{ width: '100%', mb: 2 }}>
                <LinearProgress />
              </Box>
            )}

            {alertasML.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                <MdTimeline size={48} color="#9e9e9e" />
                <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
                  No hay alertas inteligentes ML
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                  Haga clic en &quot;Generar Alertas ML&quot; para analizar los datos con ML
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                {alertasML.map((alerta: AlertaML) => (
                  <Accordion key={alerta.id} 
                    sx={{ 
                      mb: 2, 
                      borderLeft: `4px solid ${
                        alerta.nivel === 'critico' ? '#f44336' : 
                        alerta.nivel === 'advertencia' ? '#ff9800' : '#2196f3'
                      }`,
                      bgcolor: alerta.leida ? 'grey.50' : 'background.paper',
                      opacity: alerta.leida ? 0.7 : 1
                    }}
                  >
                    <AccordionSummary expandIcon={<MdExpandMore />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Box sx={{ minWidth: '40px' }}>
                          {alerta.sensor === 'temperatura' && <MdThermostat size={24} color="#ff5722" />}
                          {alerta.sensor === 'ph' && <MdScience size={24} color="#3f51b5" />}
                          {alerta.sensor === 'oxigeno' && <MdAir size={24} color="#00bcd4" />}
                          {!['temperatura', 'ph', 'oxigeno'].includes(alerta.sensor) && <MdAlert size={24} color="#ff9800" />}
                        </Box>
                        
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: alerta.leida ? 'normal' : 'bold' }}>
                            {alerta.mensaje}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(alerta.timestamp).toLocaleString()} • 
                            Confianza: {(alerta.confianza * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip
                            label={alerta.nivel.toUpperCase()}
                            color={
                              alerta.nivel === 'critico' ? 'error' : 
                              alerta.nivel === 'advertencia' ? 'warning' : 'info'
                            }
                            size="small"
                          />
                          
                          {!alerta.leida && (
                            <Box
                              component="div"
                              onClick={(e) => {
                                e.stopPropagation();
                                marcarComoLeidaML(alerta.id);
                              }}
                              sx={{
                                display: 'inline-flex',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '50%',
                                transition: 'background-color 0.2s',
                                '&:hover': {
                                  bgcolor: 'action.hover'
                                }
                              }}
                              title="Marcar como leída"
                            >
                              <MdCheck size={20} />
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </AccordionSummary>
                    
                    <AccordionDetails>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Información del sensor y valor */}
                        <Card variant="outlined">
                          <CardContent sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Detalles del Sensor</Typography>
                            <Typography variant="body2">
                              <strong>Sensor:</strong> {alerta.sensor === 'temperatura' ? 'Temperatura' : 
                                                       alerta.sensor === 'ph' ? 'pH' : 
                                                       alerta.sensor === 'oxigeno' ? 'Oxígeno' : alerta.sensor}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Valor Actual:</strong> {alerta.valor_actual}
                              {alerta.sensor === 'temperatura' && '°C'}
                              {alerta.sensor === 'oxigeno' && ' mg/L'}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Predicción:</strong> {alerta.valor_predicho}
                              {alerta.sensor === 'temperatura' && '°C'}
                              {alerta.sensor === 'oxigeno' && ' mg/L'}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Tendencia:</strong> {alerta.tendencia.direccion} ({alerta.tendencia.cambio_porcentual.toFixed(1)}%)
                            </Typography>
                            <Typography variant="body2">
                              <strong>Confianza:</strong> {alerta.nivel_confianza} ({(alerta.confianza * 100).toFixed(1)}%)
                            </Typography>
                          </CardContent>
                        </Card>
                        
                        {/* Acciones recomendadas */}
                        {alerta.acciones_recomendadas && alerta.acciones_recomendadas.length > 0 && (
                          <Card variant="outlined">
                            <CardContent sx={{ p: 2 }}>
                              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MdBuild /> Acciones Recomendadas
                              </Typography>
                              <List dense>
                                {alerta.acciones_recomendadas.map((accion: string, index: number) => (
                                  <ListItem key={index} sx={{ py: 0 }}>
                                    <ListItemIcon sx={{ minWidth: '30px' }}>
                                      <MdPlayArrow size={16} />
                                    </ListItemIcon>
                                    <ListItemText 
                                      primary={accion}
                                      primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* Información adicional */}
                        <Card variant="outlined">
                          <CardContent sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Análisis Adicional</Typography>
                            <Typography variant="body2">
                              <strong>Tipo de Alerta:</strong> {alerta.tipo}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Impacto Estimado:</strong> {alerta.impacto_estimado}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Tiempo de Respuesta:</strong> {alerta.tiempo_respuesta}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}