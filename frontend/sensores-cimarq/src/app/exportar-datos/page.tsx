'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, TextField, Button, Grid, Alert,Snackbar,FormControl,InputLabel,Select,MenuItem,Chip,Paper,CircularProgress,Table,TableBody,TableCell,TableContainer,TableHead,TableRow,TablePagination,Checkbox,FormControlLabel,Dialog,DialogTitle,DialogContent,DialogActions} from '@mui/material';
import { MdDownload, MdEmail, MdFilterList,MdRefresh,MdDateRange,MdTableChart,MdFileDownload,MdSend} from 'react-icons/md';
import { useConfiguracionRangos } from '../hooks/useConfiguracionRangos';
import { apiRequestJson, apiRequestBlob } from '../config/api';

interface DatoSensor {
  _id: string;
  temperatura?: number;
  ph?: number;
  oxigeno?: number;
  fecha: string;
}

interface FiltrosExportacion {
  fechaInicio: string;
  fechaFin: string;
  formatoExportacion: 'csv' | 'excel';
}

export default function ExportarDatosPage() {
  const [datos, setDatos] = useState<DatoSensor[]>([]);
  const [datosFiltrados, setDatosFiltrados] = useState<DatoSensor[]>([]);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  
  // Estados para filtros
  const [filtros, setFiltros] = useState<FiltrosExportacion>(() => {
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 7);
    
    // Formatear fechas para input date (YYYY-MM-DD) usando fecha local
    const formatearFechaInput = (fecha: Date) => {
      const año = fecha.getFullYear();
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const dia = fecha.getDate().toString().padStart(2, '0');
      return `${año}-${mes}-${dia}`;
    };

    return {
      fechaInicio: formatearFechaInput(hace7Dias),
      fechaFin: formatearFechaInput(hoy),
      formatoExportacion: 'csv'
    };
  });

  // Estados para paginación
  const [pagina, setPagina] = useState(0);
  const [filasPorPagina, setFilasPorPagina] = useState(25);

  // Estados para email
  const [modalEmail, setModalEmail] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');

  // Estados para notificaciones
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'success' | 'error'>('success');
  const [mostrarSnackbar, setMostrarSnackbar] = useState(false);

  const { evaluarEstadoSensor } = useConfiguracionRangos();

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatos();
  }, []);

  // Aplicar filtros cuando cambien
  useEffect(() => {
    aplicarFiltros();
  }, [datos, filtros]);

  const cargarDatosInterno = async (reintentos = 3) => {
    try {
      const url = '/api/v1/sensores';
      console.log('Cargando datos desde:', url, `(intentos restantes: ${reintentos})`);
      
      const resultado = await apiRequestJson<any>(url);
      
      console.log('Respuesta recibida con éxito');
      
      // Agrupar datos por fecha/timestamp para combinar registros del mismo momento
      const registrosAgrupados: { [key: string]: DatoSensor } = {};
      
      // Procesar datos de temperatura
      if (resultado.data.temperatura) {
        resultado.data.temperatura.forEach((item: any) => {
          const claveFecha = new Date(item.fecha).toISOString();
          if (!registrosAgrupados[claveFecha]) {
            registrosAgrupados[claveFecha] = {
              _id: item._id,
              fecha: item.fecha
            };
          }
          registrosAgrupados[claveFecha].temperatura = item.temperatura;
        });
      }

        // Procesar datos de pH
        if (resultado.data.ph) {
          resultado.data.ph.forEach((item: any) => {
            const claveFecha = new Date(item.fecha).toISOString();
            if (!registrosAgrupados[claveFecha]) {
              registrosAgrupados[claveFecha] = {
                _id: item._id,
                fecha: item.fecha
              };
            }
            registrosAgrupados[claveFecha].ph = item.ph;
          });
        }

        // Procesar datos de oxígeno
        if (resultado.data.oxigeno) {
          resultado.data.oxigeno.forEach((item: any) => {
            const claveFecha = new Date(item.fecha).toISOString();
            if (!registrosAgrupados[claveFecha]) {
              registrosAgrupados[claveFecha] = {
                _id: item._id,
                fecha: item.fecha
              };
            }
            registrosAgrupados[claveFecha].oxigeno = item.oxigeno;
          });
        }

        // Convertir el objeto agrupado en array y ordenar por fecha descendente
        const datosUnificados = Object.values(registrosAgrupados);
        datosUnificados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        
        setDatos(datosUnificados);
    } catch (error: any) {
      console.error('Error completo:', error);
      console.error('Tipo de error:', error.name);
      console.error('Mensaje de error:', error.message);
      
      let mensajeError = 'Error al cargar los datos del servidor';
      
      if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message === 'Failed to fetch')) {
        mensajeError = 'No se pudo conectar al servidor. Verifica que:\n• El backend esté ejecutándose en http://localhost:5000\n• No haya problemas de red o firewall\n• El servidor de desarrollo del frontend esté iniciado';
      } else if (error.message.includes('HTTP:')) {
        mensajeError = `Error del servidor: ${error.message}`;
      } else if (error.message.includes('timeout')) {
        mensajeError = 'Tiempo de espera agotado. El servidor no responde';
      } else {
        mensajeError = `Error desconocido: ${error.message}`;
      }
      
      // Reintentar si es un error de conexión y quedan reintentos
      if (reintentos > 1 && (error.name === 'TypeError' && (error.message.includes('fetch') || error.message === 'Failed to fetch'))) {
        console.log(`Reintentando... quedan ${reintentos - 1} intentos`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
        return cargarDatosInterno(reintentos - 1);
      }
      
      setMensaje(mensajeError);
      setTipoMensaje('error');
      setMostrarSnackbar(true);
      throw error; // Re-lanzar para que la función pública lo maneje
    }
  };

  const cargarDatos = async () => {
    setCargando(true);
    try {
      await cargarDatosInterno();
    } catch (error) {
      // Ya manejado en cargarDatosInterno
    } finally {
      setCargando(false);
    }
  };

  const aplicarFiltros = () => {
    let datosFilt = [...datos];

    // Filtro por fechas - normalizar a medianoche local
    if (filtros.fechaInicio) {
      const fechaInicio = new Date(filtros.fechaInicio + 'T00:00:00');
      datosFilt = datosFilt.filter(dato => {
        const fechaDato = new Date(dato.fecha);
        return fechaDato >= fechaInicio;
      });
    }

    if (filtros.fechaFin) {
      // Crear fecha fin al final del día (23:59:59.999)
      const fechaFin = new Date(filtros.fechaFin + 'T23:59:59.999');
      datosFilt = datosFilt.filter(dato => {
        const fechaDato = new Date(dato.fecha);
        return fechaDato <= fechaFin;
      });
    }

    // Debug: mostrar información de filtrado
    console.log('Filtrado de fechas:', {
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin,
      totalDatos: datos.length,
      datosFiltrados: datosFilt.length,
      rangoFechasDatos: datos.length > 0 ? {
        primera: new Date(datos[datos.length - 1]?.fecha).toLocaleDateString('es-CL'),
        ultima: new Date(datos[0]?.fecha).toLocaleDateString('es-CL')
      } : 'Sin datos'
    });

    setDatosFiltrados(datosFilt);
    setPagina(0); // Resetear paginación
  };

  const exportarDatos = async () => {
    if (datosFiltrados.length === 0) {
      setMensaje('No hay datos para exportar con los filtros actuales');
      setTipoMensaje('error');
      setMostrarSnackbar(true);
      return;
    }

    setExportando(true);
    try {
      // Preparar datos para exportación
      const datosExportacion = datosFiltrados.map(dato => ({
        ID: dato._id,
        Fecha: formatearFecha(dato.fecha),
        Temperatura: dato.temperatura || '',
        pH: dato.ph || '',
        Oxigeno: dato.oxigeno || '',
        Estado_Temperatura: dato.temperatura ? evaluarEstadoSensor('temperatura', dato.temperatura) : '',
        Estado_pH: dato.ph ? evaluarEstadoSensor('ph', dato.ph) : '',
        Estado_Oxigeno: dato.oxigeno ? evaluarEstadoSensor('oxigeno', dato.oxigeno) : ''
      }));

      if (filtros.formatoExportacion === 'csv') {
        exportarCSV(datosExportacion);
      } else {
        exportarExcel(datosExportacion);
      }

      setMensaje(`Datos exportados exitosamente (${datosFiltrados.length} registros)`);
      setTipoMensaje('success');
      setMostrarSnackbar(true);
    } catch (error) {
      console.error('Error en exportación:', error);
      setMensaje('Error al exportar los datos');
      setTipoMensaje('error');
      setMostrarSnackbar(true);
    } finally {
      setExportando(false);
    }
  };

  const exportarCSV = async (datos: any[]) => {
    try {
      setExportando(true);
      
      const { blob, filename } = await apiRequestBlob('/api/v1/notificaciones/descargar/csv', {
        method: 'POST',
        body: JSON.stringify({ datos })
      });

      // Descargar el archivo
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'datos_sensores.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setMensaje('CSV descargado exitosamente');
      setTipoMensaje('success');
    } catch (error) {
      console.error('Error descargando CSV:', error);
      setMensaje('Error al descargar CSV');
      setTipoMensaje('error');
    } finally {
      setExportando(false);
    }
  };

  const exportarExcel = async (datos: any[]) => {
    try {
      setExportando(true);
      
      const { blob, filename } = await apiRequestBlob('/api/v1/notificaciones/descargar/excel', {
        method: 'POST',
        body: JSON.stringify({ datos })
      });

      // Descargar el archivo
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'datos_sensores.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setMensaje('Excel descargado exitosamente');
      setTipoMensaje('success');
    } catch (error) {
      console.error('Error descargando Excel:', error);
      setMensaje('Error al descargar Excel');
      setTipoMensaje('error');
    } finally {
      setExportando(false);
    }
  };

  const enviarPorEmail = async () => {
    if (!emailDestino) {
      setMensaje('Ingrese un email de destino');
      setTipoMensaje('error');
      setMostrarSnackbar(true);
      return;
    }

    if (datosFiltrados.length === 0) {
      setMensaje('No hay datos para enviar');
      setTipoMensaje('error');
      setMostrarSnackbar(true);
      return;
    }

    setEnviandoEmail(true);
    try {
      // Preparar datos para enviar
      const datosParaEnviar = datosFiltrados.slice(0, 1000); // Limitar a 1000 registros por email
      
      // Preparar datos para exportación con valores por defecto
      const datosExportacion = datosFiltrados.map(dato => ({
        ID: dato._id,
        Fecha: formatearFecha(dato.fecha),
        Temperatura: dato.temperatura || '',
        pH: dato.ph || '',
        Oxigeno: dato.oxigeno || '',
        Estado_Temperatura: dato.temperatura ? evaluarEstadoSensor('temperatura', dato.temperatura) : '',
        Estado_pH: dato.ph ? evaluarEstadoSensor('ph', dato.ph) : '',
        Estado_Oxigeno: dato.oxigeno ? evaluarEstadoSensor('oxigeno', dato.oxigeno) : ''
      }));
      
      await apiRequestJson('/api/v1/notificaciones/exportar', {
        method: 'POST',
        body: JSON.stringify({
          destinatario: emailDestino,
          asunto: 'Exportación de Datos - Sistema de Monitoreo CIMARQ',
          mensaje: `Adjunto encontrará los datos exportados del sistema de monitoreo de sensores.

Período: ${filtros.fechaInicio} al ${filtros.fechaFin}
Total de registros: ${datosExportacion.length}
Fecha de generación: ${new Date().toLocaleString('es-CL')}

Este reporte incluye datos de temperatura, pH y oxígeno disuelto del sistema de acuicultura.`,
          datos_adjuntos: datosExportacion,
          formato: filtros.formatoExportacion
        })
      });

      setMensaje(`Datos enviados exitosamente a ${emailDestino}`);
      setTipoMensaje('success');
      setModalEmail(false);
      setEmailDestino('');
    } catch (error) {
      console.error('Error:', error);
      setMensaje('Error al enviar el email. Verifique la configuración del servidor');
      setTipoMensaje('error');
    } finally {
      setEnviandoEmail(false);
      setMostrarSnackbar(true);
    }
  };

  const formatearFecha = (fecha: string) => {
    const date = new Date(fecha);
    // Formato compatible sin caracteres especiales
    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    const año = date.getFullYear();
    const horas = date.getHours().toString().padStart(2, '0');
    const minutos = date.getMinutes().toString().padStart(2, '0');
    
    return `${dia}/${mes}/${año} ${horas}:${minutos}`;
  };

  const getColorEstado = (valor: number | undefined, tipo: 'temperatura' | 'ph' | 'oxigeno') => {
    if (valor === undefined) return 'default';
    const estado = evaluarEstadoSensor(tipo, valor);
    const colorMap: Record<string, 'success' | 'warning' | 'error'> = {
      'optimo': 'success',
      'aceptable': 'warning',
      'critico': 'error'
    };
    return colorMap[estado] || 'default';
  };

  const datosPaginados = datosFiltrados.slice(
    pagina * filasPorPagina,
    pagina * filasPorPagina + filasPorPagina
  );

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Exportación de Datos
        </Typography>
        <Typography variant="h6">
          Visualice, filtre y exporte todos los datos del sistema de monitoreo
        </Typography>
      </Paper>

      <Grid container spacing={3}>
        {/* Panel de Filtros */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MdFilterList /> Filtros de Exportación
              </Typography>
              
              {/* Rango de fechas */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    label="Fecha Inicio"
                    type="date"
                    value={filtros.fechaInicio}
                    onChange={(e) => setFiltros(prev => ({ ...prev, fechaInicio: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    label="Fecha Fin"
                    type="date"
                    value={filtros.fechaFin}
                    onChange={(e) => setFiltros(prev => ({ ...prev, fechaFin: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>
              </Grid>

              {/* Botones rápidos de fecha */}
              <Grid container spacing={1} sx={{ mb: 2 }}>
                <Grid size={{ xs: 4 }}>
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const hoy = new Date();
                      const ayer = new Date();
                      ayer.setDate(hoy.getDate() - 1);
                      setFiltros(prev => ({
                        ...prev,
                        fechaInicio: ayer.toISOString().split('T')[0],
                        fechaFin: hoy.toISOString().split('T')[0]
                      }));
                    }}
                  >
                    Hoy
                  </Button>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const hoy = new Date();
                      const hace7Dias = new Date();
                      hace7Dias.setDate(hoy.getDate() - 7);
                      setFiltros(prev => ({
                        ...prev,
                        fechaInicio: hace7Dias.toISOString().split('T')[0],
                        fechaFin: hoy.toISOString().split('T')[0]
                      }));
                    }}
                  >
                    7 días
                  </Button>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const hoy = new Date();
                      const hace30Dias = new Date();
                      hace30Dias.setDate(hoy.getDate() - 30);
                      setFiltros(prev => ({
                        ...prev,
                        fechaInicio: hace30Dias.toISOString().split('T')[0],
                        fechaFin: hoy.toISOString().split('T')[0]
                      }));
                    }}
                  >
                    30 días
                  </Button>
                </Grid>
              </Grid>



              {/* Formato de exportación */}
              <FormControl fullWidth sx={{ mb: 3 }} size="small">
                <InputLabel>Formato de Exportación</InputLabel>
                <Select
                  value={filtros.formatoExportacion}
                  label="Formato de Exportación"
                  onChange={(e) => setFiltros(prev => ({ ...prev, formatoExportacion: e.target.value as 'csv' | 'excel' }))}
                >
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="excel">Excel</MenuItem>
                </Select>
              </FormControl>

              {/* Botones de acción */}
              <Grid container spacing={1}>
                <Grid size={{ xs: 12 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={exportarDatos}
                    disabled={exportando || datosFiltrados.length === 0}
                    startIcon={exportando ? <CircularProgress size={20} /> : <MdDownload />}
                  >
                    {exportando ? 'Exportando...' : 'Descargar Datos'}
                  </Button>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="secondary"
                    onClick={() => setModalEmail(true)}
                    disabled={datosFiltrados.length === 0}
                    startIcon={<MdEmail />}
                  >
                    Enviar por Email
                  </Button>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button
                    fullWidth
                    variant="text"
                    onClick={cargarDatos}
                    disabled={cargando}
                    startIcon={cargando ? <CircularProgress size={20} /> : <MdRefresh />}
                  >
                    Actualizar Datos
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Estadísticas */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Estadísticas
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Total registros:</strong> {datos.length}
                </Typography>
                <Typography variant="body2">
                  <strong>Registros filtrados:</strong> {datosFiltrados.length}
                </Typography>
                <Typography variant="body2">
                  <strong>Período seleccionado:</strong> {filtros.fechaInicio} a {filtros.fechaFin}
                </Typography>
                {datos.length > 0 && (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Rango de datos:</strong> {new Date(datos[datos.length - 1]?.fecha).toLocaleDateString('es-CL')} a {new Date(datos[0]?.fecha).toLocaleDateString('es-CL')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Último dato:</strong> {formatearFecha(datos[0]?.fecha)}
                    </Typography>
                  </>
                )}
                <Typography variant="body2">
                  <strong>Formato:</strong> {filtros.formatoExportacion.toUpperCase()}
                </Typography>
                <Typography variant="body2" color="primary">
                  <strong>Datos unificados por timestamp</strong>
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Tabla de Datos */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MdTableChart /> Vista Previa de Datos ({datosFiltrados.length} registros)
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha</TableCell>
                      <TableCell align="center">Temp</TableCell>
                      <TableCell align="center">pH</TableCell>
                      <TableCell align="center">OD</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {datosPaginados.map((dato) => (
                      <TableRow key={dato._id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {formatearFecha(dato.fecha)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {dato.temperatura !== undefined ? (
                            <Chip
                              label={`${dato.temperatura}°C`}
                              color={getColorEstado(dato.temperatura, 'temperatura')}
                              size="small"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">Sin datos</Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {dato.ph !== undefined ? (
                            <Chip
                              label={dato.ph}
                              color={getColorEstado(dato.ph, 'ph')}
                              size="small"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">Sin datos</Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {dato.oxigeno !== undefined ? (
                            <Chip
                              label={`${dato.oxigeno} mg/L`}
                              color={getColorEstado(dato.oxigeno, 'oxigeno')}
                              size="small"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">Sin datos</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={datosFiltrados.length}
                rowsPerPage={filasPorPagina}
                page={pagina}
                onPageChange={(_, newPage) => setPagina(newPage)}
                onRowsPerPageChange={(e) => {
                  setFilasPorPagina(parseInt(e.target.value, 10));
                  setPagina(0);
                }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Modal de Email */}
      <Dialog open={modalEmail} onClose={() => setModalEmail(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Enviar Datos por Email</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Email de Destino"
              type="email"
              value={emailDestino}
              onChange={(e) => setEmailDestino(e.target.value)}
              placeholder="ejemplo@correo.com"
              autoFocus
              helperText="Ingresa el correo donde se enviarán los datos exportados"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalEmail(false)}>Cancelar</Button>
          <Button
            onClick={enviarPorEmail}
            variant="contained"
            disabled={enviandoEmail || !emailDestino}
            startIcon={enviandoEmail ? <CircularProgress size={20} /> : <MdSend />}
          >
            {enviandoEmail ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para notificaciones */}
      <Snackbar
        open={mostrarSnackbar}
        autoHideDuration={6000}
        onClose={() => setMostrarSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setMostrarSnackbar(false)} 
          severity={tipoMensaje}
          sx={{ width: '100%' }}
        >
          {mensaje}
        </Alert>
      </Snackbar>
    </Box>
  );
}