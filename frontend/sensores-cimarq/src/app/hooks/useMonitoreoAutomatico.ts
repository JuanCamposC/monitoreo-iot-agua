import { useState, useEffect, useRef } from 'react';
import { useConfiguracionRangos, EstadoSensor } from './useConfiguracionRangos';

interface DatoSensor {
  _id: string;
  temperatura?: number;
  ph?: number;
  oxigeno?: number;
  fecha: string;
  fuente?: string;
}

interface AlertaAutomatica {
  id: string;
  sensor: 'temperatura' | 'ph' | 'oxigeno';
  valor: number;
  estado: EstadoSensor;
  timestamp: Date;
  mensaje: string;
  rangos: {
    minimo: number;
    maximo: number;
    minimoOptimo: number;
    maximoOptimo: number;
  };
  leida: boolean;
  acciones_recomendadas: string[];
  detalles_tecnicos: {
    desviacion: number;
    porcentaje_exceso: number;
    tendencia: 'subiendo' | 'bajando' | 'estable';
  };
  impacto_ambiental: string;
  nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'critico';
}

// Funciones auxiliares para generar detalles de alertas
const generarAccionesRecomendadas = (sensor: string, estado: EstadoSensor, valor: number): string[] => {
  const acciones: string[] = [];
  
  if (sensor === 'temperatura') {
    if (estado === 'critico') {
      if (valor > 30) {
        acciones.push('🌡️ Activar sistema de enfriamiento inmediatamente');
        acciones.push('🔧 Verificar bombas de circulación');
        acciones.push('⚡ Reducir carga térmica del sistema');
        acciones.push('📞 Contactar equipo técnico urgente');
      } else {
        acciones.push('🔥 Activar calentadores de emergencia');
        acciones.push('🌡️ Verificar sensores de temperatura');
        acciones.push('🏠 Revisar aislamiento térmico');
      }
    } else {
      acciones.push('📊 Monitorear tendencia de temperatura');
      acciones.push('🔧 Verificar calibración de sensores');
    }
  } else if (sensor === 'ph') {
    if (estado === 'critico') {
      if (valor > 8.5) {
        acciones.push('🧪 Añadir solución ácida (HCl diluido)');
        acciones.push('⚗️ Verificar sistema de dosificación');
        acciones.push('📈 Aumentar frecuencia de medición');
      } else {
        acciones.push('🧪 Añadir solución básica (NaOH diluido)');
        acciones.push('⚗️ Revisar sistema de neutralización');
        acciones.push('🔬 Calibrar medidores de pH');
      }
    } else {
      acciones.push('📊 Continuar monitoreo regular');
      acciones.push('🔧 Programar calibración preventiva');
    }
  } else if (sensor === 'oxigeno') {
    if (estado === 'critico') {
      acciones.push('💨 Activar sistema de aireación de emergencia');
      acciones.push('🔄 Verificar bombas de oxigenación');
      acciones.push('🐟 Evaluar carga biológica del sistema');
      acciones.push('⚡ Revisar difusores de aire');
    } else {
      acciones.push('📊 Monitorear niveles de oxígeno');
      acciones.push('🔧 Verificar sistema de aireación');
    }
  }
  
  return acciones;
};

const generarDetallesTecnicos = (valor: number, rangos: any) => {
  const centro = (rangos.minimo + rangos.maximo) / 2;
  const desviacion = Math.abs(valor - centro);
  const rango_total = rangos.maximo - rangos.minimo;
  const porcentaje_exceso = ((desviacion / rango_total) * 100);
  
  return {
    desviacion: Number(desviacion.toFixed(2)),
    porcentaje_exceso: Number(porcentaje_exceso.toFixed(1)),
    tendencia: 'estable' as const
  };
};

const generarImpactoAmbiental = (sensor: string, estado: EstadoSensor): string => {
  if (sensor === 'temperatura') {
    return estado === 'critico' 
      ? '🌡️ Riesgo alto: Puede afectar la supervivencia de organismos acuáticos y alterar el equilibrio del ecosistema'
      : '⚠️ Riesgo moderado: Posible estrés térmico en la fauna acuática';
  } else if (sensor === 'ph') {
    return estado === 'critico'
      ? '🧪 Riesgo alto: Puede causar mortalidad masiva y desequilibrio químico del agua'
      : '⚠️ Riesgo moderado: Posible afectación en la reproducción y crecimiento de organismos';
  } else if (sensor === 'oxigeno') {
    return estado === 'critico'
      ? '💨 Riesgo crítico: Puede causar asfixia masiva y muerte de fauna acuática'
      : '⚠️ Riesgo moderado: Posible estrés respiratorio en organismos acuáticos';
  }
  return 'Impacto no determinado';
};

const determinarNivelRiesgo = (estado: EstadoSensor, porcentaje_exceso: number): 'bajo' | 'medio' | 'alto' | 'critico' => {
  if (estado === 'critico') return 'critico';
  if (porcentaje_exceso > 30) return 'alto';
  if (porcentaje_exceso > 15) return 'medio';
  return 'bajo';
};

// Función para enviar correo crítico
const enviarCorreoCritico = async (alerta: AlertaAutomatica) => {
  // Verificar si los emails están habilitados localmente (solo en cliente)
  const emailsHabilitados = safeLocalStorage.getItem('emails-habilitados');
  if (emailsHabilitados && !JSON.parse(emailsHabilitados)) {
    console.log('📧 Emails deshabilitados - no se enviará correo crítico');
    return;
  }

  try {
    const response = await fetch('http://localhost:5000/api/v1/notificaciones/correo-critico', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tipo: 'alerta_critica',
        sensor: alerta.sensor,
        valor: alerta.valor,
        mensaje: alerta.mensaje,
        timestamp: alerta.timestamp.toISOString(),
        rangos: alerta.rangos,
        acciones_recomendadas: alerta.acciones_recomendadas,
        detalles_tecnicos: alerta.detalles_tecnicos,
        impacto_ambiental: alerta.impacto_ambiental,
        nivel_riesgo: alerta.nivel_riesgo
      }),
    });

    if (response.ok) {
      console.log('✅ Correo crítico enviado exitosamente');
    } else {
      console.warn(`⚠️ No se pudo enviar correo crítico (HTTP ${response.status})`);
    }
  } catch (error) {
    console.warn('⚠️ Backend no disponible - correo crítico no enviado:', error);
    // No mostrar como error crítico, solo como advertencia
  }
};

// Función auxiliar para usar localStorage de forma segura
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  },
  clear: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  }
};

export function useMonitoreoAutomatico() {
  const [alertasAutomaticas, setAlertasAutomaticas] = useState<AlertaAutomatica[]>([]);
  const [monitoreoActivo, setMonitoreoActivo] = useState(false);
  const [ultimaRevision, setUltimaRevision] = useState<Date | null>(null);
  const { configuracion, evaluarEstadoSensor } = useConfiguracionRangos();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const ultimosDatosRef = useRef<{ [key: string]: DatoSensor }>({});

  // Cargar alertas desde localStorage
  useEffect(() => {
    const alertasGuardadas = safeLocalStorage.getItem('alertasAutomaticas');
    if (alertasGuardadas) {
      try {
        const alertas = JSON.parse(alertasGuardadas).map((alerta: any) => ({
          ...alerta,
          timestamp: new Date(alerta.timestamp)
        }));
        setAlertasAutomaticas(alertas);
      } catch (error) {
        console.error('Error al cargar alertas automáticas:', error);
      }
    }
  }, []);

  // Guardar alertas en localStorage
  const guardarAlertas = (alertas: AlertaAutomatica[]) => {
    try {
      const alertasSerializadas = JSON.stringify(alertas);
      safeLocalStorage.setItem('alertasAutomaticas', alertasSerializadas);
      console.log('💾 Alertas guardadas en localStorage:', alertas.length);
    } catch (error) {
      console.error('❌ Error al guardar alertas automáticas:', error);
      // Intentar limpiar localStorage si está lleno
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.log('🧹 localStorage lleno, limpiando alertas antiguas...');
        safeLocalStorage.removeItem('alertasAutomaticas');
      }
    }
  };

  // Obtener datos más recientes del servidor
  const obtenerDatosRecientes = async (): Promise<DatoSensor[]> => {
    try {
      const response = await fetch('http://localhost:5000/api/v1/sensores');
      if (!response.ok) throw new Error('Error al obtener datos');
      
      const data = await response.json();
      
      // Procesar y unificar datos por timestamp
      const datosUnificados: { [key: string]: DatoSensor } = {};
      
      // Procesar temperatura
      if (data.data.temperatura) {
        data.data.temperatura.forEach((item: any) => {
          const timestamp = new Date(item.fecha).toISOString();
          if (!datosUnificados[timestamp]) {
            datosUnificados[timestamp] = {
              _id: item._id,
              fecha: item.fecha,
              fuente: 'automatico'
            };
          }
          datosUnificados[timestamp].temperatura = item.temperatura;
        });
      }

      // Procesar pH
      if (data.data.ph) {
        data.data.ph.forEach((item: any) => {
          const timestamp = new Date(item.fecha).toISOString();
          if (!datosUnificados[timestamp]) {
            datosUnificados[timestamp] = {
              _id: item._id,
              fecha: item.fecha,
              fuente: 'automatico'
            };
          }
          datosUnificados[timestamp].ph = item.ph;
        });
      }

      // Procesar oxígeno
      if (data.data.oxigeno) {
        data.data.oxigeno.forEach((item: any) => {
          const timestamp = new Date(item.fecha).toISOString();
          if (!datosUnificados[timestamp]) {
            datosUnificados[timestamp] = {
              _id: item._id,
              fecha: item.fecha,
              fuente: 'automatico'
            };
          }
          datosUnificados[timestamp].oxigeno = item.oxigeno;
        });
      }

      return Object.values(datosUnificados)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 10); // Solo los 10 más recientes

    } catch (error) {
      console.error('Error al obtener datos recientes:', error);
      return [];
    }
  };

  // Generar mensaje de alerta
  const generarMensajeAlerta = (sensor: 'temperatura' | 'ph' | 'oxigeno', valor: number, estado: EstadoSensor): string => {
    const nombreSensor = sensor === 'temperatura' ? 'Temperatura' : sensor === 'ph' ? 'pH' : 'Oxígeno';
    const unidad = sensor === 'temperatura' ? '°C' : sensor === 'oxigeno' ? ' mg/L' : '';
    
    switch (estado) {
      case 'critico':
        return `⚠️ ${nombreSensor} en nivel CRÍTICO: ${valor}${unidad}. Requiere atención inmediata.`;
      case 'aceptable':
        return `⚡ ${nombreSensor} fuera del rango óptimo: ${valor}${unidad}. Revisar condiciones.`;
      default:
        return `✅ ${nombreSensor} en rango óptimo: ${valor}${unidad}.`;
    }
  };

  // Revisar datos y generar alertas
  const revisarDatos = async () => {
    const datosRecientes = await obtenerDatosRecientes();
    if (datosRecientes.length === 0) return;

    const nuevasAlertas: AlertaAutomatica[] = [];
    const ahora = new Date();

    datosRecientes.forEach(dato => {
      const timestamp = new Date(dato.fecha);
      const datoAnterior = ultimosDatosRef.current[dato._id];

      // Solo procesar si es un dato nuevo o si ha cambiado
      if (!datoAnterior || 
          datoAnterior.temperatura !== dato.temperatura ||
          datoAnterior.ph !== dato.ph ||
          datoAnterior.oxigeno !== dato.oxigeno) {

        // Revisar temperatura
        if (dato.temperatura !== undefined) {
          const estado = evaluarEstadoSensor('temperatura', dato.temperatura);
          if (estado !== 'optimo') {
            const acciones = generarAccionesRecomendadas('temperatura', estado, dato.temperatura);
            const detalles = generarDetallesTecnicos(dato.temperatura, configuracion.temperatura);
            const impacto = generarImpactoAmbiental('temperatura', estado);
            const riesgo = determinarNivelRiesgo(estado, detalles.porcentaje_exceso);
            
            const alerta: AlertaAutomatica = {
              id: `temp_${dato._id}_${timestamp.getTime()}`,
              sensor: 'temperatura',
              valor: dato.temperatura,
              estado,
              timestamp: ahora,
              mensaje: generarMensajeAlerta('temperatura', dato.temperatura, estado),
              rangos: configuracion.temperatura,
              leida: false,
              acciones_recomendadas: acciones,
              detalles_tecnicos: detalles,
              impacto_ambiental: impacto,
              nivel_riesgo: riesgo
            };
            
            nuevasAlertas.push(alerta);
            
            // Enviar correo si es crítico
            if (estado === 'critico') {
              enviarCorreoCritico(alerta);
            }
          }
        }

        // Revisar pH
        if (dato.ph !== undefined) {
          const estado = evaluarEstadoSensor('ph', dato.ph);
          if (estado !== 'optimo') {
            const acciones = generarAccionesRecomendadas('ph', estado, dato.ph);
            const detalles = generarDetallesTecnicos(dato.ph, configuracion.ph);
            const impacto = generarImpactoAmbiental('ph', estado);
            const riesgo = determinarNivelRiesgo(estado, detalles.porcentaje_exceso);
            
            const alerta: AlertaAutomatica = {
              id: `ph_${dato._id}_${timestamp.getTime()}`,
              sensor: 'ph',
              valor: dato.ph,
              estado,
              timestamp: ahora,
              mensaje: generarMensajeAlerta('ph', dato.ph, estado),
              rangos: configuracion.ph,
              leida: false,
              acciones_recomendadas: acciones,
              detalles_tecnicos: detalles,
              impacto_ambiental: impacto,
              nivel_riesgo: riesgo
            };
            
            nuevasAlertas.push(alerta);
            
            // Enviar correo si es crítico
            if (estado === 'critico') {
              enviarCorreoCritico(alerta);
            }
          }
        }

        // Revisar oxígeno
        if (dato.oxigeno !== undefined) {
          const estado = evaluarEstadoSensor('oxigeno', dato.oxigeno);
          if (estado !== 'optimo') {
            const acciones = generarAccionesRecomendadas('oxigeno', estado, dato.oxigeno);
            const detalles = generarDetallesTecnicos(dato.oxigeno, configuracion.oxigeno);
            const impacto = generarImpactoAmbiental('oxigeno', estado);
            const riesgo = determinarNivelRiesgo(estado, detalles.porcentaje_exceso);
            
            const alerta: AlertaAutomatica = {
              id: `oxigeno_${dato._id}_${timestamp.getTime()}`,
              sensor: 'oxigeno',
              valor: dato.oxigeno,
              estado,
              timestamp: ahora,
              mensaje: generarMensajeAlerta('oxigeno', dato.oxigeno, estado),
              rangos: configuracion.oxigeno,
              leida: false,
              acciones_recomendadas: acciones,
              detalles_tecnicos: detalles,
              impacto_ambiental: impacto,
              nivel_riesgo: riesgo
            };
            
            nuevasAlertas.push(alerta);
            
            // Enviar correo si es crítico
            if (estado === 'critico') {
              enviarCorreoCritico(alerta);
            }
          }
        }

        // Actualizar referencia de datos
        ultimosDatosRef.current[dato._id] = dato;
      }
    });

    // Agregar nuevas alertas si las hay
    if (nuevasAlertas.length > 0) {
      setAlertasAutomaticas(prev => {
        const alertasActualizadas = [...nuevasAlertas, ...prev]
          .slice(0, 100); // Mantener solo las últimas 100 alertas
        guardarAlertas(alertasActualizadas);
        return alertasActualizadas;
      });

      // Mostrar notificación del navegador si está permitida
      if ('Notification' in window && Notification.permission === 'granted') {
        const alertasCriticas = nuevasAlertas.filter(a => a.estado === 'critico');
        if (alertasCriticas.length > 0) {
          new Notification('🚨 Sistema de Monitoreo CIMARQ', {
            body: `${alertasCriticas.length} alerta(s) crítica(s) detectada(s)`,
            icon: '/favicon.ico'
          });
        }
      }
    }

    setUltimaRevision(ahora);
  };

  // Iniciar monitoreo automático
  const iniciarMonitoreo = () => {
    if (monitoreoActivo) return;

    // Solicitar permisos de notificación
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    setMonitoreoActivo(true);
    
    // Revisión inicial
    revisarDatos();
    
    // Configurar intervalo de revisión (cada 30 segundos)
    intervalRef.current = setInterval(revisarDatos, 30000);
  };

  // Detener monitoreo automático
  const detenerMonitoreo = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setMonitoreoActivo(false);
  };

  // Marcar alerta como leída
  const marcarComoLeida = (alertaId: string) => {
    setAlertasAutomaticas(prev => {
      const alertasActualizadas = prev.map(alerta => 
        alerta.id === alertaId ? { ...alerta, leida: true } : alerta
      );
      guardarAlertas(alertasActualizadas);
      return alertasActualizadas;
    });
  };

  // Marcar todas como leídas
  const marcarTodasComoLeidas = () => {
    setAlertasAutomaticas(prev => {
      const alertasActualizadas = prev.map(alerta => ({ ...alerta, leida: true }));
      guardarAlertas(alertasActualizadas);
      return alertasActualizadas;
    });
  };

  // Limpiar alertas antiguas
  const limpiarAlertasAntiguas = () => {
    const hace24h = new Date();
    hace24h.setHours(hace24h.getHours() - 24);
    
    setAlertasAutomaticas(prev => {
      const alertasFiltradas = prev.filter(alerta => alerta.timestamp > hace24h);
      guardarAlertas(alertasFiltradas);
      return alertasFiltradas;
    });
  };

  // Limpiar solo alertas leídas
  const limpiarAlertasLeidas = () => {
    try {
      const alertasNoLeidas = alertasAutomaticas.filter(alerta => !alerta.leida);
      const alertasLeidasCount = alertasAutomaticas.length - alertasNoLeidas.length;
      
      console.log(`🧹 Limpiando ${alertasLeidasCount} alertas leídas...`);
      
      setAlertasAutomaticas(alertasNoLeidas);
      guardarAlertas(alertasNoLeidas);
      
      console.log('✅ Alertas leídas limpiadas exitosamente');
      return alertasLeidasCount;
    } catch (error) {
      console.error('❌ Error limpiando alertas leídas:', error);
      return 0;
    }
  };

  // Limpiar todas las alertas
  const limpiarTodasLasAlertas = () => {
    try {
      const cantidadAntes = alertasAutomaticas.length;
      console.log('🧹 Limpiando todas las alertas automáticas...');
      console.log('📊 Alertas antes de limpiar:', cantidadAntes);
      
      // Limpiar estado
      setAlertasAutomaticas([]);
      
      // Limpiar localStorage
      safeLocalStorage.removeItem('alertasAutomaticas');
      
      // Verificar que se limpió
      const alertasEnStorage = safeLocalStorage.getItem('alertasAutomaticas');
      if (alertasEnStorage) {
        console.warn('⚠️ localStorage no se limpió correctamente, forzando...');
        safeLocalStorage.clear();
      }
      
      console.log('✅ Alertas limpiadas exitosamente');
      console.log('💾 localStorage limpiado');
      
      return true;
    } catch (error) {
      console.error('❌ Error limpiando alertas:', error);
      return false;
    }
  };

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Estadísticas
  const estadisticas = {
    total: alertasAutomaticas.length,
    noLeidas: alertasAutomaticas.filter(a => !a.leida).length,
    criticas: alertasAutomaticas.filter(a => a.estado === 'critico').length,
    aceptables: alertasAutomaticas.filter(a => a.estado === 'aceptable').length,
    porSensor: {
      temperatura: alertasAutomaticas.filter(a => a.sensor === 'temperatura').length,
      ph: alertasAutomaticas.filter(a => a.sensor === 'ph').length,
      oxigeno: alertasAutomaticas.filter(a => a.sensor === 'oxigeno').length,
    }
  };

  return {
    alertasAutomaticas,
    monitoreoActivo,
    ultimaRevision,
    estadisticas,
    iniciarMonitoreo,
    detenerMonitoreo,
    marcarComoLeida,
    marcarTodasComoLeidas,
    limpiarAlertasAntiguas,
    limpiarAlertasLeidas,
    limpiarTodasLasAlertas,
    revisarDatos
  };
}