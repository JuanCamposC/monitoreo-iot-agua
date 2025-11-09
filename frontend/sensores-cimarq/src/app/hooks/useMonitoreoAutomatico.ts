import { useState, useEffect, useRef } from 'react';
import { useConfiguracionRangos, EstadoSensor } from './useConfiguracionRangos';
import { useNotificaciones, AlertaNotificacion } from './useNotificaciones';

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
  sensor: 'temperatura' | 'ph' | 'oxigeno' | 'registro_completo'; // Nuevo tipo para registros completos
  valor: number | null; // Puede ser null para registros completos
  estado: EstadoSensor;
  timestamp: Date;
  mensaje: string;
  rangos?: {
    minimo: number;
    maximo: number;
    minimoOptimo: number;
    maximoOptimo: number;
  };
  // Nuevos campos para alertas de registro completo
  sensores_afectados?: {
    sensor: 'temperatura' | 'ph' | 'oxigeno';
    valor: number;
    estado: EstadoSensor;
    rangos: {
      minimo: number;
      maximo: number;
      minimoOptimo: number;
      maximoOptimo: number;
    };
  }[];
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

// Contador global para generar IDs únicos
let contadorUnicoGlobal = 0;

// Función para generar IDs únicos
const generarIdUnico = (sensor: string, datoId: string): string => {
  const timestamp = Date.now();
  const contador = ++contadorUnicoGlobal;
  const random = Math.random().toString(36).substring(2, 8);
  return `${sensor}_${datoId}_${timestamp}_${contador}_${random}`;
};

// Función para verificar si ya existe una alerta reciente para un registro completo
const existeAlertaRecienteRegistro = (
  alertasExistentes: AlertaAutomatica[], 
  registroId: string, 
  minutosRecientes: number = 3 // 3 minutos para registros completos
): boolean => {
  const ahora = new Date();
  const tiempoLimite = new Date(ahora.getTime() - (minutosRecientes * 60 * 1000));
  
  // Buscar alertas recientes del mismo registro o timeframe similar
  const alertaReciente = alertasExistentes.some(alerta => 
    (alerta.id.includes(registroId) || alerta.sensor === 'registro_completo') && 
    alerta.timestamp > tiempoLimite
  );
  
  if (alertaReciente) {
    console.log(`⚠️ Alerta reciente encontrada para registro ${registroId} - no duplicar`);
  }
  
  return alertaReciente;
};

// Funciones auxiliares para generar detalles de alertas
const generarAccionesRecomendadas = (sensor: string, estado: EstadoSensor, valor: number): string[] => {
  const acciones: string[] = [];
  
  if (sensor === 'temperatura') {
    if (estado === 'critico') {
      if (valor > 30) {
        acciones.push('Activar sistema de enfriamiento inmediatamente');
        acciones.push('Verificar bombas de circulación');
        acciones.push('Reducir carga térmica del sistema');
        acciones.push('Contactar equipo técnico urgente');
      } else {
        acciones.push('Activar calentadores de emergencia');
        acciones.push('Verificar sensores de temperatura');
        acciones.push('Revisar aislamiento térmico');
      }
    } else {
      acciones.push('Monitorear tendencia de temperatura');
      acciones.push('Verificar calibración de sensores');
    }
  } else if (sensor === 'ph') {
    if (estado === 'critico') {
      if (valor > 8.5) {
        acciones.push('Añadir solución ácida (HCl diluido)');
        acciones.push('Verificar sistema de dosificación');
        acciones.push('Aumentar frecuencia de medición');
      } else {
        acciones.push('Añadir solución básica (NaOH diluido)');
        acciones.push('Revisar sistema de neutralización');
        acciones.push('Calibrar medidores de pH');
      }
    } else {
      acciones.push('Continuar monitoreo regular');
      acciones.push('Programar calibración preventiva');
    }
  } else if (sensor === 'oxigeno') {
    if (estado === 'critico') {
      acciones.push('Activar sistema de aireación de emergencia');
      acciones.push('Verificar bombas de oxigenación');
      acciones.push('Evaluar carga biológica del sistema');
      acciones.push('Revisar difusores de aire');
    } else {
      acciones.push('Monitorear niveles de oxígeno');
      acciones.push('Verificar sistema de aireación');
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
      ? 'Riesgo alto: Puede afectar la supervivencia de organismos acuáticos y alterar el equilibrio del ecosistema'
      : 'Riesgo moderado: Posible estrés térmico en la fauna acuática';
  } else if (sensor === 'ph') {
    return estado === 'critico'
      ? 'Riesgo alto: Puede causar mortalidad masiva y desequilibrio químico del agua'
      : 'Riesgo moderado: Posible afectación en la reproducción y crecimiento de organismos';
  } else if (sensor === 'oxigeno') {
    return estado === 'critico'
      ? 'Riesgo crítico: Puede causar asfixia masiva y muerte de fauna acuática'
      : 'Riesgo moderado: Posible estrés respiratorio en organismos acuáticos';
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
      console.log('Correo crítico enviado exitosamente');
    } else {
      console.warn(`No se pudo enviar correo crítico (HTTP ${response.status})`);
    }
  } catch (error) {
    console.warn('Backend no disponible - correo crítico no enviado:', error);
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
  // Inicializar monitoreo activo por defecto, pero permitir override desde localStorage
  const [monitoreoActivo, setMonitoreoActivo] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('monitoreoActivo');
      return saved !== null ? JSON.parse(saved) : true; // Por defecto TRUE
    }
    return true; // Por defecto TRUE en servidor
  });
  const [ultimaRevision, setUltimaRevision] = useState<Date | null>(null);
  const { configuracion, evaluarEstadoSensor } = useConfiguracionRangos();
  const { mostrarAlerta } = useNotificaciones();
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
      console.log('Alertas guardadas en localStorage:', alertas.length);
    } catch (error) {
      console.error('Error al guardar alertas automáticas:', error);
      // Intentar limpiar localStorage si está lleno
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.log('localStorage lleno, limpiando alertas antiguas...');
        safeLocalStorage.removeItem('alertasAutomaticas');
      }
    }
  };

  // Obtener y agrupar datos NUEVOS por registro completo
  const obtenerRegistrosNuevos = async (): Promise<DatoSensor[]> => {
    try {
      const response = await fetch('http://localhost:5000/api/v1/sensores');
      if (!response.ok) throw new Error('Error al obtener datos');
      
      const data = await response.json();
      const ahora = new Date();
      const hace5Minutos = new Date(ahora.getTime() - 5 * 60 * 1000);
      
      // Agrupar datos por timestamp para formar registros completos
      const registrosPorTimestamp: { [key: string]: DatoSensor } = {};
      
      // Procesar temperatura
      if (data.data.temperatura) {
        data.data.temperatura
          .filter((item: any) => new Date(item.fecha) >= hace5Minutos)
          .forEach((item: any) => {
            const timestamp = new Date(item.fecha).toISOString();
            if (!registrosPorTimestamp[timestamp]) {
              registrosPorTimestamp[timestamp] = {
                _id: `registro_${timestamp}`,
                fecha: item.fecha,
                fuente: 'automatico'
              };
            }
            registrosPorTimestamp[timestamp].temperatura = item.temperatura;
          });
      }

      // Procesar pH
      if (data.data.ph) {
        data.data.ph
          .filter((item: any) => new Date(item.fecha) >= hace5Minutos)
          .forEach((item: any) => {
            const timestamp = new Date(item.fecha).toISOString();
            if (!registrosPorTimestamp[timestamp]) {
              registrosPorTimestamp[timestamp] = {
                _id: `registro_${timestamp}`,
                fecha: item.fecha,
                fuente: 'automatico'
              };
            }
            registrosPorTimestamp[timestamp].ph = item.ph;
          });
      }

      // Procesar oxígeno
      if (data.data.oxigeno) {
        data.data.oxigeno
          .filter((item: any) => new Date(item.fecha) >= hace5Minutos)
          .forEach((item: any) => {
            const timestamp = new Date(item.fecha).toISOString();
            if (!registrosPorTimestamp[timestamp]) {
              registrosPorTimestamp[timestamp] = {
                _id: `registro_${timestamp}`,
                fecha: item.fecha,
                fuente: 'automatico'
              };
            }
            registrosPorTimestamp[timestamp].oxigeno = item.oxigeno;
          });
      }

      // Convertir a array y ordenar por fecha
      const registrosCompletos = Object.values(registrosPorTimestamp)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      
      console.log(`📊 Registros completos encontrados en últimos 5 minutos: ${registrosCompletos.length}`);
      return registrosCompletos;

    } catch (error) {
      console.error('Error al obtener registros nuevos:', error);
      return [];
    }
  };

  // Generar mensaje de alerta
  const generarMensajeAlerta = (sensor: 'temperatura' | 'ph' | 'oxigeno', valor: number, estado: EstadoSensor): string => {
    const nombreSensor = sensor === 'temperatura' ? 'Temperatura' : sensor === 'ph' ? 'pH' : 'Oxígeno';
    const unidad = sensor === 'temperatura' ? '°C' : sensor === 'oxigeno' ? ' mg/L' : '';
    
    switch (estado) {
      case 'critico':
        return `${nombreSensor} en nivel CRÍTICO: ${valor}${unidad}. Requiere atención inmediata.`;
      case 'aceptable':
        return `${nombreSensor} fuera del rango óptimo: ${valor}${unidad}. Revisar condiciones.`;
      default:
        return `${nombreSensor} en rango óptimo: ${valor}${unidad}.`;
    }
  };

  // Función para convertir estado a nivel de notificación
  const convertirEstadoANivel = (estado: EstadoSensor): string => {
    switch (estado) {
      case 'critico':
        return 'CRITICO';
      case 'aceptable':
        return 'MEDIO';
      default:
        return 'BAJO';
    }
  };

  // Función para enviar notificación inmediata
  const enviarNotificacionInmediata = (sensor: 'temperatura' | 'ph' | 'oxigeno', valor: number, estado: EstadoSensor, timestamp: Date): void => {
    if (estado === 'optimo') return; // No notificar si está en rango óptimo

    const nombreSensor = sensor === 'temperatura' ? 'Temperatura' : sensor === 'ph' ? 'pH' : 'Oxígeno';
    const unidad = sensor === 'temperatura' ? '°C' : sensor === 'oxigeno' ? ' mg/L' : '';
    const nivel = convertirEstadoANivel(estado);
    
    const mensaje = estado === 'critico' 
      ? `🚨 ALERTA CRÍTICA: ${nombreSensor} fuera de rango seguro (${valor}${unidad}). Acción inmediata requerida.`
      : `⚠️ ADVERTENCIA: ${nombreSensor} fuera de rango óptimo (${valor}${unidad}). Revisar condiciones.`;

    const notificacion: AlertaNotificacion = {
      _id: `notif_${sensor}_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
      sensor: nombreSensor,
      nivel,
      mensaje,
      valor_actual: valor,
      fecha_creacion: timestamp.toISOString(),
      resuelto: false,
      prioridad: estado === 'critico' ? 1 : 2,
      sugerencias: estado === 'critico' 
        ? ['Verificar sistema inmediatamente', 'Contactar personal técnico', 'Revisar equipos de medición']
        : ['Monitorear tendencia', 'Verificar calibración', 'Revisar condiciones ambientales']
    };

    console.log(`🔔 Enviando notificación inmediata: ${nombreSensor} ${valor}${unidad} (${estado})`);
    mostrarAlerta(notificacion);
  };

  // Revisar registros completos y generar UNA alerta por registro
  const revisarDatos = async () => {
    const registrosNuevos = await obtenerRegistrosNuevos();
    
    // Si no hay registros nuevos, no hacer nada
    if (registrosNuevos.length === 0) {
      console.log('🔍 No hay registros nuevos para analizar');
      return;
    }

    console.log(`🔍 Analizando ${registrosNuevos.length} registros completos nuevos...`);
    const nuevasAlertas: AlertaAutomatica[] = [];
    const ahora = new Date();

    registrosNuevos.forEach((registro: DatoSensor) => {
      const registroAnterior = ultimosDatosRef.current[registro._id];

      // Solo procesar si es realmente un registro nuevo (no procesado antes)
      if (!registroAnterior && !existeAlertaRecienteRegistro(alertasAutomaticas, registro._id)) {

        // Evaluar TODOS los sensores del registro como conjunto
        const sensoresAfectados: any[] = [];
        let estadoGeneral: EstadoSensor = 'optimo';
        let nivelRiesgoMaximo: 'bajo' | 'medio' | 'alto' | 'critico' = 'bajo';
        
        // Evaluar cada sensor del registro
        if (registro.temperatura !== undefined) {
          const estado = evaluarEstadoSensor('temperatura', registro.temperatura);
          
          // 🔔 NOTIFICACIÓN INMEDIATA para temperatura
          enviarNotificacionInmediata('temperatura', registro.temperatura, estado, new Date(registro.fecha));
          
          if (estado !== 'optimo') {
            const detalles = generarDetallesTecnicos(registro.temperatura, configuracion.temperatura);
            const riesgo = determinarNivelRiesgo(estado, detalles.porcentaje_exceso);
            
            sensoresAfectados.push({
              sensor: 'temperatura',
              valor: registro.temperatura,
              estado,
              rangos: configuracion.temperatura
            });
            
            if (estado === 'critico') estadoGeneral = 'critico';
            else if (estado === 'aceptable' && estadoGeneral === 'optimo') estadoGeneral = 'aceptable';
            
            // Actualizar nivel de riesgo si es mayor
            const nivelesRiesgo = ['bajo', 'medio', 'alto', 'critico'];
            const indiceActual = nivelesRiesgo.indexOf(nivelRiesgoMaximo);
            const indiceNuevo = nivelesRiesgo.indexOf(riesgo);
            if (indiceNuevo > indiceActual) {
              nivelRiesgoMaximo = riesgo;
            }
          } else {
            console.log(`🌡️ Temperatura en rango óptimo: ${registro.temperatura}°C`);
          }
        }

        if (registro.ph !== undefined) {
          const estado = evaluarEstadoSensor('ph', registro.ph);
          
          // 🔔 NOTIFICACIÓN INMEDIATA para pH
          enviarNotificacionInmediata('ph', registro.ph, estado, new Date(registro.fecha));
          
          if (estado !== 'optimo') {
            const detalles = generarDetallesTecnicos(registro.ph, configuracion.ph);
            const riesgo = determinarNivelRiesgo(estado, detalles.porcentaje_exceso);
            
            sensoresAfectados.push({
              sensor: 'ph',
              valor: registro.ph,
              estado,
              rangos: configuracion.ph
            });
            
            if (estado === 'critico') estadoGeneral = 'critico';
            else if (estado === 'aceptable' && estadoGeneral === 'optimo') estadoGeneral = 'aceptable';
            
            // Actualizar nivel de riesgo si es mayor
            const nivelesRiesgo = ['bajo', 'medio', 'alto', 'critico'];
            const indiceActual = nivelesRiesgo.indexOf(nivelRiesgoMaximo);
            const indiceNuevo = nivelesRiesgo.indexOf(riesgo);
            if (indiceNuevo > indiceActual) {
              nivelRiesgoMaximo = riesgo;
            }
          } else {
            console.log(`🧪 pH en rango óptimo: ${registro.ph}`);
          }
        }

        if (registro.oxigeno !== undefined) {
          const estado = evaluarEstadoSensor('oxigeno', registro.oxigeno);
          
          // 🔔 NOTIFICACIÓN INMEDIATA para oxígeno
          enviarNotificacionInmediata('oxigeno', registro.oxigeno, estado, new Date(registro.fecha));
          
          if (estado !== 'optimo') {
            const detalles = generarDetallesTecnicos(registro.oxigeno, configuracion.oxigeno);
            const riesgo = determinarNivelRiesgo(estado, detalles.porcentaje_exceso);
            
            sensoresAfectados.push({
              sensor: 'oxigeno',
              valor: registro.oxigeno,
              estado,
              rangos: configuracion.oxigeno
            });
            
            if (estado === 'critico') estadoGeneral = 'critico';
            else if (estado === 'aceptable' && estadoGeneral === 'optimo') estadoGeneral = 'aceptable';
            
            // Actualizar nivel de riesgo si es mayor
            const nivelesRiesgo = ['bajo', 'medio', 'alto', 'critico'];
            const indiceActual = nivelesRiesgo.indexOf(nivelRiesgoMaximo);
            const indiceNuevo = nivelesRiesgo.indexOf(riesgo);
            if (indiceNuevo > indiceActual) {
              nivelRiesgoMaximo = riesgo;
            }
          } else {
            console.log(`💨 Oxígeno en rango óptimo: ${registro.oxigeno} mg/L`);
          }
        }

        // Solo generar alerta si hay sensores afectados
        if (sensoresAfectados.length > 0) {
          console.log(`🚨 Registro con ${sensoresAfectados.length} sensores fuera de rango`);
          
          // Generar mensaje combinado
          const sensoresNombres = sensoresAfectados.map(s => 
            s.sensor === 'temperatura' ? 'Temperatura' : 
            s.sensor === 'ph' ? 'pH' : 'Oxígeno'
          ).join(', ');
          
          const mensaje = `Alerta en registro: ${sensoresNombres} fuera de rango óptimo (${estadoGeneral})`;
          
          // Combinar acciones recomendadas de todos los sensores afectados
          const accionesCombinadas: string[] = [];
          sensoresAfectados.forEach(sensor => {
            const acciones = generarAccionesRecomendadas(sensor.sensor, sensor.estado, sensor.valor);
            acciones.forEach(accion => {
              if (!accionesCombinadas.includes(accion)) {
                accionesCombinadas.push(accion);
              }
            });
          });
          
          const alerta: AlertaAutomatica = {
            id: generarIdUnico('registro_completo', registro._id),
            sensor: 'registro_completo',
            valor: null,
            estado: estadoGeneral,
            timestamp: ahora,
            mensaje,
            sensores_afectados: sensoresAfectados,
            leida: false,
            acciones_recomendadas: accionesCombinadas,
            detalles_tecnicos: {
              desviacion: 0,
              porcentaje_exceso: 0,
              tendencia: 'estable'
            },
            impacto_ambiental: `Impacto combinado: ${sensoresAfectados.length} parámetros fuera de rango pueden afectar significativamente el ecosistema acuático`,
            nivel_riesgo: nivelRiesgoMaximo
          };
          
          nuevasAlertas.push(alerta);
          
          // Enviar correo si es crítico
          if (estadoGeneral === 'critico') {
            enviarCorreoCritico(alerta);
          }
        } else {
          console.log(`✅ Registro completo en rangos óptimos - No se genera alerta`);
        }

        // Actualizar referencia del registro
        ultimosDatosRef.current[registro._id] = registro;
      }
    });

    // Agregar nuevas alertas si las hay
    if (nuevasAlertas.length > 0) {
      console.log(`🚨 ${nuevasAlertas.length} nueva(s) alerta(s) generada(s)`);
      
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
          new Notification('Sistema de Monitoreo CIMARQ', {
            body: `${alertasCriticas.length} alerta(s) crítica(s) detectada(s)`,
            icon: '/favicon.ico'
          });
        }
      }
    } else {
      console.log('✅ Datos revisados - No se requieren alertas (todos en rango óptimo)');
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
    // Guardar estado en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('monitoreoActivo', 'true');
    }
    
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
    // Guardar estado en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('monitoreoActivo', 'false');
    }
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
      
      console.log(`Limpiando ${alertasLeidasCount} alertas leídas...`);
      
      setAlertasAutomaticas(alertasNoLeidas);
      guardarAlertas(alertasNoLeidas);
      
      console.log('Alertas leídas limpiadas exitosamente');
      return alertasLeidasCount;
    } catch (error) {
      console.error('Error limpiando alertas leídas:', error);
      return 0;
    }
  };

  // Limpiar todas las alertas
  const limpiarTodasLasAlertas = () => {
    try {
      const cantidadAntes = alertasAutomaticas.length;
      console.log('Limpiando todas las alertas automáticas...');
      console.log('Alertas antes de limpiar:', cantidadAntes);
      
      // Limpiar estado
      setAlertasAutomaticas([]);
      
      // Limpiar localStorage
      safeLocalStorage.removeItem('alertasAutomaticas');
      
      // Verificar que se limpió
      const alertasEnStorage = safeLocalStorage.getItem('alertasAutomaticas');
      if (alertasEnStorage) {
        console.warn('localStorage no se limpió correctamente, forzando...');
        safeLocalStorage.clear();
      }
      
      console.log('Alertas limpiadas exitosamente');
      console.log('localStorage limpiado');
      
      return true;
    } catch (error) {
      console.error('Error limpiando alertas:', error);
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

  // Auto-iniciar monitoreo después de que todas las funciones estén definidas
  useEffect(() => {
    if (monitoreoActivo && !intervalRef.current) {
      // Solicitar permisos de notificación si es necesario
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      
      // Revisión inicial
      revisarDatos();
      
      // Configurar intervalo de revisión (cada 30 segundos)
      intervalRef.current = setInterval(revisarDatos, 30000);
      
      console.log('Monitoreo automático iniciado por defecto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitoreoActivo]); // Solo depende de monitoreoActivo, revisarDatos es estable

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