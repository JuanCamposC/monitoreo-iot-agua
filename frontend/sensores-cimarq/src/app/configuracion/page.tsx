'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Container,
  Paper,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  MdSettings,
  MdThermostat,
  MdInfo
} from 'react-icons/md';

// Importar hooks y componentes
import { useConfiguracionSistema } from './hooks/useConfiguracionSistema';
import { useNombreSistema } from '../hooks/useNombreSistema';
import DynamicTitle from '../components/DynamicTitle';
import ConfiguracionRangos from './components/ConfiguracionRangos';
import ConfiguracionGeneral from './components/ConfiguracionGeneral';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`configuracion-tabpanel-${index}`}
      aria-labelledby={`configuracion-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `configuracion-tab-${index}`,
    'aria-controls': `configuracion-tabpanel-${index}`,
  };
}

export default function ConfiguracionPage() {
  const {
    configuracion,
    loading,
    actualizarRangos,
    actualizarConfiguracionGeneral,
    restaurarDefecto
  } = useConfiguracionSistema();

  const nombreSistema = useNombreSistema();
  const [tabActiva, setTabActiva] = useState(0);

  const handleChangeTab = (event: React.SyntheticEvent, nuevaTab: number) => {
    setTabActiva(nuevaTab);
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Cargando configuración del sistema...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <DynamicTitle pageName="Configuración" />
      <Box sx={{ py: 3 }}>
        {/* Encabezado */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            <MdSettings style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Configuración - {nombreSistema}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Gestiona todos los aspectos de la configuración del sistema IoT de monitoreo de agua.
          </Typography>
          
          {/* Información de versión */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              label={`Versión: ${configuracion.version}`} 
              size="small" 
              color="primary" 
              variant="outlined" 
            />
            <Chip 
              label={`Última actualización: ${new Date(configuracion.fechaUltimaActualizacion).toLocaleDateString()}`} 
              size="small" 
              color="info" 
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Información importante */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <MdInfo style={{ verticalAlign: 'middle', marginRight: 4 }} />
            <strong>Importante:</strong> Los cambios en la configuración se aplicarán inmediatamente en todo el sistema.
            Asegúrate de guardar cada sección antes de cambiar de pestaña.
          </Typography>
        </Alert>

        {/* Pestañas de configuración */}
        <Paper sx={{ bgcolor: 'background.paper' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={tabActiva} 
              onChange={handleChangeTab} 
              aria-label="configuracion tabs"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab 
                label="Rangos de Sensores"
                icon={<MdThermostat />}
                iconPosition="start"
                {...a11yProps(0)} 
              />
              <Tab 
                label="Configuración General"
                icon={<MdSettings />}
                iconPosition="start"
                {...a11yProps(1)} 
              />
            </Tabs>
          </Box>

          {/* Panel de Rangos de Sensores */}
          <TabPanel value={tabActiva} index={0}>
            <ConfiguracionRangos
              configuracion={configuracion.rangos}
              onActualizar={actualizarRangos}
              onRestaurar={() => restaurarDefecto('rangos')}
            />
          </TabPanel>

          {/* Panel de Configuración General */}
          <TabPanel value={tabActiva} index={1}>
            <ConfiguracionGeneral
              configuracion={configuracion.general}
              onActualizar={actualizarConfiguracionGeneral}
              onRestaurar={() => restaurarDefecto('general')}
            />
          </TabPanel>
        </Paper>

        {/* Información adicional */}
        <Paper sx={{ p: 3, mt: 3, bgcolor: '#f5f5f5' }}>
          <Typography variant="h6" gutterBottom>
            Información del Sistema
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {nombreSistema} - Sistema de monitoreo IoT para calidad del agua. 
            Esta configuración centralizada permite gestionar todos los aspectos del sistema desde una sola ubicación.
            Para soporte técnico o consultas, contacta al administrador del sistema.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}