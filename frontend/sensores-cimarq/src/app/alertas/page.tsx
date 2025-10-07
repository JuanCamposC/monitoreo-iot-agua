'use client';

import { useState } from 'react';
import { Box, Typography, Card, CardContent, Chip, Alert,Paper,IconButton,Collapse,LinearProgress,FormControl,InputLabel,Select,MenuItem,SelectChangeEvent} from '@mui/material';

// Iconos usando react-icons
import { MdWarning,MdError,MdInfo,MdExpandMore,MdExpandLess,MdNotifications,MdThermostat,MdScience,MdAir,MdTimeline} from 'react-icons/md';

interface AlertaPreventiva {
  id: string;
  tipo: 'temperatura' | 'ph' | 'oxigeno';
  severidad: 'alta' | 'media' | 'baja';
  titulo: string;
  descripcion: string;
  timestamp: string;
  piscina: string;
  prediccion: {
    probabilidad: number;
    tiempoEstimado: string;
    valorActual: number;
    valorPrediccion: number;
    unidad: string;
  };
  acciones: string[];
  estado: 'activa' | 'resuelta';
}

// Datos simulados de alertas preventivas - CIMARQ Acuicultura
const alertasSimuladas: AlertaPreventiva[] = [
  {
    id: 'alert-001',
    tipo: 'temperatura',
    severidad: 'alta',
    titulo: 'Temperatura Crítica en Piscina A',
    descripcion: 'La temperatura del agua está aumentando y podría afectar el bienestar de los peces.',
    timestamp: '2025-10-07T14:30:00',
    piscina: 'Piscina A - Salmones',
    prediccion: {
      probabilidad: 85,
      tiempoEstimado: '2 horas',
      valorActual: 18.5,
      valorPrediccion: 22.0,
      unidad: '°C'
    },
    acciones: [
      'Activar sistema de enfriamiento',
      'Aumentar flujo de agua fresca',
      'Monitorear comportamiento de peces'
    ],
    estado: 'activa'
  },
  {
    id: 'alert-002',
    tipo: 'ph',
    severidad: 'media',
    titulo: 'pH Descendente en Piscina B',
    descripcion: 'El pH está bajando gradualmente, se requiere intervención preventiva.',
    timestamp: '2025-10-07T13:15:00',
    piscina: 'Piscina B - Truchas',
    prediccion: {
      probabilidad: 78,
      tiempoEstimado: '4 horas',
      valorActual: 7.2,
      valorPrediccion: 6.5,
      unidad: ''
    },
    acciones: [
      'Aplicar buffer alcalino',
      'Verificar sistema de filtración',
      'Revisar alimentación de peces'
    ],
    estado: 'activa'
  },
  {
    id: 'alert-003',
    tipo: 'oxigeno',
    severidad: 'alta',
    titulo: 'Oxígeno Bajo en Piscina C',
    descripcion: 'Los niveles de oxígeno disuelto están cayendo rápidamente.',
    timestamp: '2025-10-07T12:45:00',
    piscina: 'Piscina C - Juveniles',
    prediccion: {
      probabilidad: 92,
      tiempoEstimado: '1 hora',
      valorActual: 6.2,
      valorPrediccion: 4.0,
      unidad: 'mg/L'
    },
    acciones: [
      'Activar aireadores de emergencia',
      'Reducir densidad de peces temporalmente',
      'Verificar sistema de oxigenación'
    ],
    estado: 'activa'
  },
  {
    id: 'alert-004',
    tipo: 'temperatura',
    severidad: 'baja',
    titulo: 'Variación Térmica Nocturna',
    descripcion: 'Se detecta un patrón de enfriamiento nocturno más pronunciado.',
    timestamp: '2025-10-07T06:20:00',
    piscina: 'Piscina D - Reproductores',
    prediccion: {
      probabilidad: 65,
      tiempoEstimado: '8 horas',
      valorActual: 15.8,
      valorPrediccion: 13.2,
      unidad: '°C'
    },
    acciones: [
      'Ajustar calefacción nocturna',
      'Revisar aislamiento térmico',
      'Monitorear estrés en reproductores'
    ],
    estado: 'resuelta'
  }
];

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<AlertaPreventiva[]>(alertasSimuladas);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [filtroSeveridad, setFiltroSeveridad] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  // Filtrar alertas según los filtros seleccionados
  const alertasFiltradas = alertas.filter(alerta => {
    const severidadMatch = filtroSeveridad === 'todas' || alerta.severidad === filtroSeveridad;
    const tipoMatch = filtroTipo === 'todos' || alerta.tipo === filtroTipo;
    const estadoMatch = filtroEstado === 'todos' || alerta.estado === filtroEstado;
    return severidadMatch && tipoMatch && estadoMatch;
  });

  // Obtener color según severidad
  const getSeveridadColor = (severidad: string) => {
    switch (severidad) {
      case 'alta': return 'error';
      case 'media': return 'warning';
      case 'baja': return 'info';
      default: return 'default';
    }
  };

  // Obtener icono según tipo
  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'temperatura': return <MdThermostat size={20} />;
      case 'ph': return <MdScience size={20} />;
      case 'oxigeno': return <MdAir size={20} />;
      default: return <MdInfo size={20} />;
    }
  };

  // Obtener icono según severidad
  const getSeveridadIcon = (severidad: string) => {
    switch (severidad) {
      case 'alta': return <MdError size={16} />;
      case 'media': return <MdWarning size={16} />;
      case 'baja': return <MdInfo size={16} />;
      default: return <MdInfo size={16} />;
    }
  };

  // Estadísticas simplificadas
  const estadisticas = {
    total: alertas.length,
    activas: alertas.filter(a => a.estado === 'activa').length,
    resueltas: alertas.filter(a => a.estado === 'resuelta').length,
    alta: alertas.filter(a => a.severidad === 'alta').length
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2 }}>
          <MdNotifications size={40} color="#1976d2" />
          <Typography variant="h3" component="h1" sx={{ color: '#1f2937', flexGrow: 1 }}>
            Alertas Preventivas - CIMARQ Acuicultura
          </Typography>
        </Box>

        {/* Descripción del sistema */}
        <Alert severity="info" sx={{ mb: 4 }}>
          <Typography variant="body2">
            <strong>Sistema en Desarrollo:</strong> Esta vista mostrará alertas preventivas basadas en Machine Learning 
            para monitorear temperatura, pH y oxígeno disuelto en las piscinas de acuicultura del CIMARQ.
            Los datos se obtendrán desde MongoDB y se procesarán con algoritmos predictivos.
          </Typography>
        </Alert>

        {/* Estadísticas */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
          <Card sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{estadisticas.total}</Typography>
              <Typography variant="body2" color="text.secondary">Total</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error">{estadisticas.activas}</Typography>
              <Typography variant="body2" color="text.secondary">Activas</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success">{estadisticas.resueltas}</Typography>
              <Typography variant="body2" color="text.secondary">Resueltas</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error">{estadisticas.alta}</Typography>
              <Typography variant="body2" color="text.secondary">Alta Prioridad</Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Filtros */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>Filtros</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <FormControl size="small" sx={{ minWidth: '150px' }}>
              <InputLabel>Severidad</InputLabel>
              <Select
                value={filtroSeveridad}
                label="Severidad"
                onChange={(e: SelectChangeEvent) => setFiltroSeveridad(e.target.value)}
              >
                <MenuItem value="todas">Todas</MenuItem>
                <MenuItem value="alta">Alta</MenuItem>
                <MenuItem value="media">Media</MenuItem>
                <MenuItem value="baja">Baja</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: '150px' }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={filtroTipo}
                label="Tipo"
                onChange={(e: SelectChangeEvent) => setFiltroTipo(e.target.value)}
              >
                <MenuItem value="todos">Todos</MenuItem>
                <MenuItem value="temperatura">Temperatura</MenuItem>
                <MenuItem value="ph">pH</MenuItem>
                <MenuItem value="oxigeno">Oxígeno</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: '150px' }}>
              <InputLabel>Estado</InputLabel>
              <Select
                value={filtroEstado}
                label="Estado"
                onChange={(e: SelectChangeEvent) => setFiltroEstado(e.target.value)}
              >
                <MenuItem value="todos">Todos</MenuItem>
                <MenuItem value="activa">Activas</MenuItem>
                <MenuItem value="resuelta">Resueltas</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>

        {/* Lista de Alertas */}
        <Typography variant="h5" gutterBottom>
          Alertas ({alertasFiltradas.length})
        </Typography>

        {alertasFiltradas.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No se encontraron alertas
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {alertasFiltradas.map((alerta) => (
              <Card key={alerta.id} sx={{ border: alerta.estado === 'activa' ? 2 : 1, borderColor: alerta.estado === 'activa' ? 'error.main' : 'divider' }}>
                <CardContent>
                  {/* Header de la alerta */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      {getTipoIcon(alerta.tipo)}
                      <Box>
                        <Typography variant="h6" component="div">
                          {alerta.titulo}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {alerta.piscina} - {new Date(alerta.timestamp).toLocaleString('es-CL')}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip 
                        icon={getSeveridadIcon(alerta.severidad)}
                        label={alerta.severidad.toUpperCase()}
                        color={getSeveridadColor(alerta.severidad) as any}
                        size="small"
                      />
                      <Chip 
                        label={alerta.estado.toUpperCase()}
                        variant={alerta.estado === 'activa' ? 'filled' : 'outlined'}
                        color={alerta.estado === 'activa' ? 'error' : 'success'}
                        size="small"
                      />
                      <IconButton 
                        onClick={() => setExpandedAlert(expandedAlert === alerta.id ? null : alerta.id)}
                        size="small"
                      >
                        {expandedAlert === alerta.id ? <MdExpandLess /> : <MdExpandMore />}
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Descripción */}
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {alerta.descripcion}
                  </Typography>

                  {/* Predicción ML */}
                  <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <MdTimeline size={20} color="#1976d2" />
                      <Typography variant="subtitle2" color="primary">
                        Predicción ML
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                        <Typography variant="body2" color="text.secondary">Probabilidad</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={alerta.prediccion.probabilidad} 
                            sx={{ flexGrow: 1, height: 8 }}
                            color={alerta.prediccion.probabilidad > 70 ? 'error' : 'warning'}
                          />
                          <Typography variant="body2" fontWeight="bold">
                            {alerta.prediccion.probabilidad}%
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ flex: '1 1 150px' }}>
                        <Typography variant="body2" color="text.secondary">Tiempo</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {alerta.prediccion.tiempoEstimado}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 120px' }}>
                        <Typography variant="body2" color="text.secondary">Actual</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {alerta.prediccion.valorActual} {alerta.prediccion.unidad}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: '1 1 120px' }}>
                        <Typography variant="body2" color="text.secondary">Predicción</Typography>
                        <Typography variant="body2" fontWeight="bold" color="error">
                          {alerta.prediccion.valorPrediccion} {alerta.prediccion.unidad}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>

                  {/* Detalles expandibles */}
                  <Collapse in={expandedAlert === alerta.id}>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom color="primary">
                        Acciones Recomendadas
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        {alerta.acciones.map((accion, index) => (
                          <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                            • {accion}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* Footer */}
        <Paper sx={{ p: 3, mt: 4, bgcolor: 'primary.dark', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <MdNotifications size={24} />
            <Typography variant="h6">Sistema Predictivo CIMARQ</Typography>
          </Box>
          <Typography variant="body2">
            Las alertas preventivas ayudarán a mantener las condiciones óptimas del agua para el 
            bienestar de los peces en las instalaciones de acuicultura del CIMARQ.
          </Typography>
        </Paper>
      </div>
    </div>
  );
}
