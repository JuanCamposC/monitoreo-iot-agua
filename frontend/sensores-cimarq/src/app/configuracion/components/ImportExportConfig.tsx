'use client';

import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  Paper,
  CardHeader,
  Avatar,
  Divider,
  Chip
} from '@mui/material';
import { 
  MdImportExport,
  MdDownload,
  MdUpload,
  MdInfo,
  MdWarning
} from 'react-icons/md';
import { useNombreSistema } from '../../hooks/useNombreSistema';

interface ImportExportConfigProps {
  onExportar: () => void;
  onImportar: (archivo: File) => Promise<boolean>;
}

export default function ImportExportConfig({ 
  onExportar, 
  onImportar 
}: ImportExportConfigProps) {
  const [mensajeAlerta, setMensajeAlerta] = useState('');
  const [tipoAlerta, setTipoAlerta] = useState<'success' | 'error' | 'info'>('info');
  const [mostrarAlerta, setMostrarAlerta] = useState(false);
  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nombreSistema = useNombreSistema();

  const manejarExportacion = () => {
    try {
      onExportar();
      setMensajeAlerta(`Configuración de ${nombreSistema} exportada exitosamente`);
      setTipoAlerta('success');
      setMostrarAlerta(true);
    } catch (error) {
      setMensajeAlerta(`Error al exportar la configuración de ${nombreSistema}`);
      setTipoAlerta('error');
      setMostrarAlerta(true);
    }
  };

  const manejarImportacion = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    if (!archivo.name.endsWith('.json')) {
      setMensajeAlerta('Por favor selecciona un archivo JSON válido');
      setTipoAlerta('error');
      setMostrarAlerta(true);
      return;
    }

    setImportando(true);
    try {
      const exito = await onImportar(archivo);
      if (exito) {
        setMensajeAlerta('Configuración importada exitosamente. La página se recargará para aplicar los cambios.');
        setTipoAlerta('success');
        
        // Recargar la página después de 2 segundos para aplicar cambios
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMensajeAlerta('Error al importar la configuración. Verifica que el archivo sea válido.');
        setTipoAlerta('error');
      }
    } catch (error) {
      setMensajeAlerta('Error al procesar el archivo de configuración');
      setTipoAlerta('error');
    } finally {
      setImportando(false);
      setMostrarAlerta(true);
      // Limpiar el input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const abrirSelectorArchivo = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        Importar/Exportar Configuración
      </Typography>

      {/* Alerta de cambios */}
      {mostrarAlerta && (
        <Alert 
          severity={tipoAlerta} 
          sx={{ mb: 3 }} 
          onClose={() => setMostrarAlerta(false)}
        >
          {mensajeAlerta}
        </Alert>
      )}

      {/* Card principal */}
      <Card>
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: '#607d8b' }}>
              <MdImportExport />
            </Avatar>
          }
          title="Gestión de Configuración"
          subheader="Exporta o importa la configuración completa del sistema"
        />
        <CardContent>
          {/* Información importante */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Importante:</strong> La exportación incluye toda la configuración del sistema: 
              rangos de sensores, notificaciones y configuración general. 
              Al importar, se sobrescribirá la configuración actual.
            </Typography>
          </Alert>

          <Grid container spacing={3}>
            {/* Exportar configuración */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <MdDownload size={48} color="#4caf50" style={{ marginBottom: 16 }} />
                  <Typography variant="h6" gutterBottom>
                    Exportar Configuración
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Descarga un archivo JSON con toda la configuración actual de {nombreSistema}
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Chip label="Rangos de sensores" size="small" sx={{ m: 0.5 }} />
                    <Chip label="Notificaciones" size="small" sx={{ m: 0.5 }} />
                    <Chip label="Configuración general" size="small" sx={{ m: 0.5 }} />
                  </Box>

                  <Button
                    variant="contained"
                    color="success"
                    onClick={manejarExportacion}
                    startIcon={<MdDownload />}
                    fullWidth
                  >
                    Exportar Configuración
                  </Button>
                </Box>
              </Paper>
            </Grid>

            {/* Importar configuración */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <MdUpload size={48} color="#2196f3" style={{ marginBottom: 16 }} />
                  <Typography variant="h6" gutterBottom>
                    Importar Configuración
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Sube un archivo JSON para restaurar una configuración previamente exportada
                  </Typography>

                  <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
                    <Typography variant="body2">
                      <MdWarning style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      <strong>Atención:</strong> Esto sobrescribirá toda la configuración actual
                    </Typography>
                  </Alert>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={manejarImportacion}
                    accept=".json"
                    style={{ display: 'none' }}
                  />

                  <Button
                    variant="contained"
                    color="primary"
                    onClick={abrirSelectorArchivo}
                    startIcon={<MdUpload />}
                    fullWidth
                    disabled={importando}
                  >
                    {importando ? 'Importando...' : 'Seleccionar Archivo'}
                  </Button>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Información adicional */}
          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Información Técnica
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Formato del archivo:</strong> JSON
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Codificación:</strong> UTF-8
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Tamaño típico:</strong> 1-5 KB
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Compatibilidad:</strong> Misma versión del sistema
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Ubicación de guardado:</strong> localStorage del navegador
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Efecto:</strong> Inmediato tras importación exitosa
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {/* Casos de uso */}
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Casos de uso típicos:</strong>
            </Typography>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Backup de configuración antes de cambios importantes</li>
              <li>Migración de configuración entre diferentes instalaciones</li>
              <li>Restauración después de problemas o reseteos</li>
              <li>Compartir configuración optimizada entre equipos</li>
            </ul>
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}