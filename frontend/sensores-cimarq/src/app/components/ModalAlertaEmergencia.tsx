/**
 * Modal de emergencia para alertas críticas CIMARQ
 * Se muestra automáticamente cuando se detectan alertas críticas
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Slide,
  Alert
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import Link from 'next/link';

// Iconos
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WaterIcon from '@mui/icons-material/Water';
import AirIcon from '@mui/icons-material/Air';
import CloseIcon from '@mui/icons-material/Close';
import EmailIcon from '@mui/icons-material/Email';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import { AlertaNotificacion } from '../hooks/useNotificaciones';

interface ModalAlertaEmergenciaProps {
  open: boolean;
  alerta: AlertaNotificacion | null;
  onClose: () => void;
  onEnviarEmail?: () => Promise<void>;
  enviandoEmail?: boolean;
}

// Transición slide desde arriba
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="down" ref={ref} {...props} />;
});

export const ModalAlertaEmergencia: React.FC<ModalAlertaEmergenciaProps> = ({
  open,
  alerta,
  onClose,
  onEnviarEmail,
  enviandoEmail = false
}) => {
  
  if (!alerta) return null;

  /**
   * Obtener color según nivel de alerta
   */
  const obtenerColorNivel = (nivel: string) => {
    switch (nivel) {
      case 'CRITICO': return 'error';
      case 'ALTO': return 'warning';
      case 'MEDIO': return 'info';
      case 'BAJO': return 'success';
      default: return 'info';
    }
  };

  /**
   * Obtener icono según nivel de alerta
   */
  const obtenerIconoNivel = (nivel: string) => {
    switch (nivel) {
      case 'CRITICO': return <ErrorIcon />;
      case 'ALTO': return <WarningIcon />;
      default: return <InfoIcon />;
    }
  };

  /**
   * Obtener icono según tipo de sensor
   */
  const obtenerIconoSensor = (sensor: string) => {
    switch (sensor.toLowerCase()) {
      case 'temperatura': return <ThermostatIcon />;
      case 'ph': return <WaterIcon />;
      case 'oxigeno': return <AirIcon />;
      default: return <NotificationsIcon />;
    }
  };

  /**
   * Obtener unidad de medida por sensor
   */
  const obtenerUnidadSensor = (sensor: string) => {
    switch (sensor.toLowerCase()) {
      case 'temperatura': return '°C';
      case 'ph': return '';
      case 'oxigeno': return 'mg/L';
      default: return '';
    }
  };

  /**
   * Formatear fecha
   */
  const formatearFecha = (fecha: string) => {
    try {
      return new Date(fecha).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return fecha;
    }
  };

  const colorNivel = obtenerColorNivel(alerta.nivel);
  const isCritico = alerta.nivel === 'CRITICO';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      TransitionComponent={Transition}
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 3,
          ...(isCritico && {
            border: '2px solid #d32f2f',
            animation: 'pulse 2s infinite'
          })
        }
      }}
      sx={{
        '& .MuiDialog-backdrop': {
          backgroundColor: isCritico ? 'rgba(211, 47, 47, 0.2)' : 'rgba(0, 0, 0, 0.5)'
        },
        '@keyframes pulse': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' }
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          bgcolor: `${colorNivel}.main`,
          color: 'white',
          position: 'relative',
          pr: 6
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          {obtenerIconoNivel(alerta.nivel)}
          <Box>
            <Typography variant="h5" component="div" fontWeight="bold">
              🚨 ALERTA {alerta.nivel}
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
              Sistema CIMARQ - Monitoreo Acuícola
            </Typography>
          </Box>
        </Box>
        
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'white'
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Contenido */}
      <DialogContent sx={{ p: 3 }}>
        {/* Alerta crítica notice */}
        {isCritico && (
          <Alert 
            severity="error" 
            sx={{ mb: 3, fontWeight: 'bold' }}
            icon={<ErrorIcon />}
          >
            ⚠️ <strong>ACCIÓN INMEDIATA REQUERIDA</strong> - Esta alerta requiere atención urgente
          </Alert>
        )}

        {/* Información principal del sensor */}
        <Card 
          variant="outlined" 
          sx={{ 
            mb: 3, 
            borderColor: `${colorNivel}.main`,
            borderWidth: 2
          }}
        >
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              {obtenerIconoSensor(alerta.sensor)}
              <Typography variant="h6" component="div" color={`${colorNivel}.main`}>
                {alerta.sensor.toUpperCase()}
              </Typography>
              <Chip 
                label={alerta.nivel}
                color={colorNivel as any}
                size="small"
              />
            </Box>
            
            <Typography variant="h5" color={`${colorNivel}.main`} fontWeight="bold" mb={2}>
              {alerta.mensaje}
            </Typography>
            
            <Box display="flex" flexWrap="wrap" gap={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Valor Detectado
                </Typography>
                <Typography variant="h4" color={`${colorNivel}.main`} fontWeight="bold">
                  {alerta.valor_actual}{obtenerUnidadSensor(alerta.sensor)}
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Fecha de Detección
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatearFecha(alerta.fecha_creacion)}
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Prioridad
                </Typography>
                <Typography variant="h6" color={`${colorNivel}.main`}>
                  {alerta.prioridad}/5
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Sugerencias */}
        {alerta.sugerencias && alerta.sugerencias.length > 0 && (
          <Card variant="outlined" sx={{ bgcolor: 'rgba(46, 125, 50, 0.1)', borderColor: 'success.main' }}>
            <CardContent>
              <Typography variant="h6" color="success.dark" gutterBottom>
                💡 Acciones Recomendadas
              </Typography>
              <List dense>
                {alerta.sugerencias.map((sugerencia, index) => (
                  <ListItem key={index} disablePadding>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <PlayArrowIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={sugerencia}
                      primaryTypographyProps={{
                        variant: 'body2',
                        color: 'success.dark'
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}
      </DialogContent>

      {/* Acciones */}
      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="large"
        >
          Entendido
        </Button>

        {onEnviarEmail && (
          <Button
            onClick={onEnviarEmail}
            variant="outlined"
            startIcon={enviandoEmail ? <div>⏳</div> : <EmailIcon />}
            disabled={enviandoEmail}
            size="large"
          >
            {enviandoEmail ? 'Enviando...' : 'Enviar por Email'}
          </Button>
        )}

        <Button
          component={Link}
          href="/alertas"
          variant="contained"
          color={colorNivel as any}
          size="large"
          startIcon={<NotificationsIcon />}
        >
          Ver Todas las Alertas
        </Button>
      </DialogActions>
    </Dialog>
  );
};