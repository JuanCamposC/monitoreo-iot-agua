'use client';

import { useState, useEffect } from 'react';
import {Box,Typography,Card,CardContent,TextField,Button,Alert,FormControl,InputLabel,Select,MenuItem,Paper,CardHeader,Avatar,Grid} from '@mui/material';
import { MdSettings, MdSave, MdRestore, MdSchedule } from 'react-icons/md';
import { ConfiguracionGeneral, configuracionGeneralPorDefecto } from '../types';

interface ConfiguracionGeneralProps {
  configuracion: ConfiguracionGeneral;
  onActualizar: (nuevaConfigGeneral: ConfiguracionGeneral) => boolean;
  onRestaurar: () => boolean;
}

export default function ConfiguracionGeneralComponent({ 
  configuracion, 
  onActualizar, 
  onRestaurar 
}: ConfiguracionGeneralProps) {
  const [configLocal, setConfigLocal] = useState<ConfiguracionGeneral>(configuracion);
  const [mensajeAlerta, setMensajeAlerta] = useState('');
  const [tipoAlerta, setTipoAlerta] = useState<'success' | 'error'>('success');
  const [mostrarAlerta, setMostrarAlerta] = useState(false);

  // Actualizar configuración local cuando cambien los props
  useEffect(() => {
    setConfigLocal(configuracion);
  }, [configuracion]);

  // Guardar configuración
  const guardarConfiguracion = () => {
    const exito = onActualizar(configLocal);
    if (exito) {
      setMensajeAlerta('Configuración general guardada exitosamente');
      setTipoAlerta('success');
    } else {
      setMensajeAlerta('Error al guardar la configuración general');
      setTipoAlerta('error');
    }
    setMostrarAlerta(true);
  };

  // Restaurar configuración por defecto
  const restaurarDefecto = () => {
    const exito = onRestaurar();
    setConfigLocal(configuracionGeneralPorDefecto);
    
    if (exito) {
      setMensajeAlerta('Configuración general restaurada a valores por defecto');
      setTipoAlerta('success');
    } else {
      setMensajeAlerta('Error al restaurar configuración por defecto');
      setTipoAlerta('error');
    }
    setMostrarAlerta(true);
  };

  // Descartar cambios
  const descartarCambios = () => {
    setConfigLocal(configuracion);
    setMensajeAlerta('Cambios descartados');
    setTipoAlerta('success');
    setMostrarAlerta(true);
  };

  // Verificar si hay cambios sin guardar
  const hayCambiosSinGuardar = JSON.stringify(configLocal) !== JSON.stringify(configuracion);

  // Zonas horarias de Chile
  const zonasHorariaChile = [
    { value: 'America/Santiago', label: 'Santiago (Chile Continental)' },
    { value: 'Pacific/Easter', label: 'Isla de Pascua' }
  ];



  return (
    <Box>
      {/* Alertas */}
      {mostrarAlerta && (
        <Alert 
          severity={tipoAlerta} 
          onClose={() => setMostrarAlerta(false)}
          sx={{ mb: 3 }}
        >
          {mensajeAlerta}
        </Alert>
      )}

      {/* Información de cambios sin guardar */}
      {hayCambiosSinGuardar && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Tienes cambios sin guardar. No olvides guardar antes de cambiar de sección.
          </Typography>
        </Alert>
      )}

      {/* Configuración del Sistema */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<Avatar sx={{ bgcolor: 'primary.main' }}><MdSettings /></Avatar>}
          title="Configuración del Sistema"
          subheader="Configuración esencial: nombre del sistema y zona horaria"
        />
        <CardContent>
          <Grid container spacing={3}>
            {/* Nombre del Sistema */}
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                fullWidth
                label="Nombre del Sistema"
                value={configLocal.sistema.nombre}
                onChange={(e) =>
                  setConfigLocal({
                    ...configLocal,
                    sistema: { ...configLocal.sistema, nombre: e.target.value }
                  })
                }
                variant="outlined"
                helperText="Nombre identificativo del sistema"
                InputProps={{
                  startAdornment: <MdSettings style={{ marginRight: 8, color: '#666' }} />
                }}
              />
            </Grid>

            {/* Zona Horaria */}
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Zona Horaria</InputLabel>
                <Select
                  value={configLocal.sistema.timezone}
                  label="Zona Horaria"
                  onChange={(e) =>
                    setConfigLocal({
                      ...configLocal,
                      sistema: { ...configLocal.sistema, timezone: e.target.value }
                    })
                  }
                  startAdornment={<MdSchedule style={{ marginRight: 8, color: '#666' }} />}
                >
                  {zonasHorariaChile.map((zona) => (
                    <MenuItem key={zona.value} value={zona.value}>
                      {zona.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Información sobre la configuración */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f0f8ff' }}>
        <Typography variant="body2" color="text.secondary">
          <MdSchedule style={{ verticalAlign: 'middle', marginRight: 4 }} />
          <strong>Información:</strong> Esta sección permite configurar los aspectos esenciales del sistema.
          El sistema está configurado para la zona horaria de Chile.
          Durante el horario de verano chileno (octubre a marzo), Santiago utiliza UTC-3.
          Durante el horario de invierno (abril a septiembre), utiliza UTC-4.
          Las notificaciones están activadas por defecto para todos los niveles de alerta.
        </Typography>
      </Paper>

      {/* Botones de acción */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          onClick={descartarCambios}
          disabled={!hayCambiosSinGuardar}
        >
          Descartar Cambios
        </Button>
        
        <Button
          variant="outlined"
          color="warning"
          onClick={restaurarDefecto}
          startIcon={<MdRestore />}
        >
          Restaurar por Defecto
        </Button>
        
        <Button
          variant="contained"
          onClick={guardarConfiguracion}
          startIcon={<MdSave />}
          disabled={!hayCambiosSinGuardar}
        >
          Guardar Configuración
        </Button>
      </Box>
    </Box>
  );
}