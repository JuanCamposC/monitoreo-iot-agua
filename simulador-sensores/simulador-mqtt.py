#!/usr/bin/env python3
"""
Simulador IoT de Sensores de Acuicultura CIMARQ - Zona Central Chile
Reemplaza el hardware físico manteniendo compatibilidad completa con el backend existente.

Características:
- Usa configuración exacta del backend (MongoDB y MQTT)
- Simula condiciones realistas de acuicultura marina (Valparaíso/Quintay)
- Inserción directa en colecciones existentes con formato idéntico
- Publicación MQTT cada 5 minutos (300s) continua
- Trends suaves y progresivos, no valores aleatorios puros
- Dockerizable y robusto para producción 24/7
"""

import os
import sys
import time
import json
import logging
import signal
import random
from datetime import datetime, timedelta
from math import sin, cos, pi
import pytz
from typing import Dict, Any, List, Optional
import threading
from pathlib import Path

# Dependencias externas
try:
    import paho.mqtt.client as mqtt
    from pymongo import MongoClient, errors
    from dotenv import load_dotenv
except ImportError as e:
    print(f"❌ Error: Dependencia faltante: {e}")
    print("💡 Instala con: pip install paho-mqtt pymongo python-dotenv")
    sys.exit(1)

# Configuración de zona horaria Chile (GMT-3)
CHILE_TZ = pytz.timezone('America/Santiago')

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/app/logs/simulador_iot.log', mode='a')
    ]
)
logger = logging.getLogger('SimuladorCIMARQ')

def get_chile_time():
    """Obtiene la hora actual en zona horaria de Chile (America/Santiago)"""
    return datetime.now(CHILE_TZ)

class SensorSimulator:
    """Simulador principal de sensores IoT para acuicultura marina"""
    
    def __init__(self, config_path: str = None):
        """Inicializa el simulador con configuración del backend"""
        self.running = True
        self.setup_signal_handlers()
        
        # Cargar configuración desde backend
        self.load_backend_config(config_path)
        
        # Inicializar conexiones
        self.mongo_client = None
        self.db = None
        self.mqtt_client = None
        self.mqtt_connected = False
        
        # Estado de simulación
        self.simulation_time = 0
        self.last_execution = get_chile_time()
        
        # Configuración de sensores especializados (zona central Chile)
        self.specialized_sensors = self.setup_sensor_parameters()
        
        logger.info("🚀 Simulador CIMARQ inicializado")
        
    def setup_signal_handlers(self):
        """Configura manejadores para parada limpia"""
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
    def _signal_handler(self, sig, frame):
        """Maneja señales de terminación"""
        logger.info("🛑 Señal de parada recibida, cerrando simulador...")
        self.running = False
        
    def load_backend_config(self, config_path: str = None):
        """Carga configuración exacta del backend"""
        # Buscar archivo .env del backend si no se especifica
        if config_path is None:
            backend_env = Path(__file__).parent.parent / "backend" / ".env"
            if backend_env.exists():
                config_path = str(backend_env)
                logger.info(f"📂 Usando configuración del backend: {config_path}")
            
        # Cargar variables de entorno
        if config_path and os.path.exists(config_path):
            load_dotenv(config_path)
        else:
            load_dotenv()  # Buscar .env local
            
        # Configuración MongoDB (idéntica al backend)
        self.mongo_uri = os.getenv("MONGO_URI", "mongodb+srv://cimarq:eGEr87FyYHIadm4p@proyectotitulo.idqwtmo.mongodb.net/")
        self.db_name = os.getenv("DB_NAME", "cimarqdb")
        
        # Configuración MQTT (idéntica al backend)
        self.mqtt_broker = os.getenv("MQTT_BROKER", "test.mosquitto.org")
        self.mqtt_port = int(os.getenv("MQTT_PORT", 1883))
        self.mqtt_username = os.getenv("MQTT_USERNAME", "")
        self.mqtt_password = os.getenv("MQTT_PASSWORD", "")
        
        # Tópicos MQTT (exactos del backend)
        self.temperatura_topic = os.getenv("TEMPERATURA_TOPIC", "cimarq/temperatura/update")
        self.ph_topic = os.getenv("PH_TOPIC", "cimarq/ph/update")
        self.oxigeno_topic = os.getenv("OXIGENO_TOPIC", "cimarq/oxigeno/update")
        
        # Configuración del simulador
        self.interval = float(os.getenv("SIMULATION_INTERVAL", 30))  # 30 segundos para pruebas
        
        logger.info(f"⚙️ Configuración cargada - Intervalo: {self.interval}s, Sensores especializados: 3")
        
    def setup_sensor_parameters(self):
        """Configura parámetros realistas para zona central de Chile"""
        
        # Condiciones base para Valparaíso/Quintay
        self.base_conditions = {
            'temperatura': {
                'base': 16.0,          # Temperatura base °C
                'daily_amplitude': 1.5,  # Variación diaria
                'seasonal_amplitude': 4.0,  # Variación estacional  
                'min': 12.0, 'max': 20.0,
                'trend_speed': 0.001     # Velocidad de cambios graduales
            },
            'ph': {
                'base': 7.9,           # pH base marino
                'daily_amplitude': 0.15, # Variación por fotosíntesis
                'seasonal_amplitude': 0.2,
                'min': 7.5, 'max': 8.3,
                'trend_speed': 0.0005
            },
            'oxigeno': {
                'base': 7.0,           # mg/L base
                'daily_amplitude': 1.5, # Variación por temperatura/fotosíntesis
                'seasonal_amplitude': 1.0,
                'min': 5.0, 'max': 9.0,
                'trend_speed': 0.002
            }
        }
        
        # Sensores especializados: uno para cada parámetro
        self.specialized_sensors = {
            'temperatura_sensor': {
                'device_id': 'CIMARQ_TEMP_001',
                'location': 'Bahía Quintay - Superficie',
                'parameter': 'temperatura',
                'state': {
                    'current': self.base_conditions['temperatura']['base'],
                    'trend': random.uniform(-0.1, 0.1),
                    'noise_offset': random.uniform(-0.5, 0.5),
                    'calibration_drift': 0.0  # Deriva de calibración
                }
            },
            'ph_sensor': {
                'device_id': 'CIMARQ_PH_001', 
                'location': 'Bahía Quintay - Profundidad Media',
                'parameter': 'ph',
                'state': {
                    'current': self.base_conditions['ph']['base'],
                    'trend': random.uniform(-0.01, 0.01),
                    'noise_offset': random.uniform(-0.05, 0.05),
                    'calibration_drift': 0.0
                }
            },
            'oxigeno_sensor': {
                'device_id': 'CIMARQ_O2_001',
                'location': 'Bahía Quintay - Variable',
                'parameter': 'oxigeno', 
                'state': {
                    'current': self.base_conditions['oxigeno']['base'],
                    'trend': random.uniform(-0.05, 0.05),
                    'noise_offset': random.uniform(-0.2, 0.2),
                    'calibration_drift': 0.0
                }
            }
        }
        
        return self.specialized_sensors
            
    def connect_mongodb(self) -> bool:
        """Conecta a MongoDB usando configuración del backend"""
        try:
            self.mongo_client = MongoClient(
                self.mongo_uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                socketTimeoutMS=20000,
                maxPoolSize=10,
                retryWrites=True,
                retryReads=True
            )
            
            # Verificar conexión
            self.mongo_client.admin.command('ping')
            self.db = self.mongo_client[self.db_name]
            
            # Verificar que la colección unificada exista
            collections = self.db.list_collection_names()
            if 'datos' not in collections:
                logger.warning(f"⚠️ Colección 'datos' no existe, se creará automáticamente")
                    
            logger.info(f"✅ MongoDB conectado: {self.db_name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error conectando a MongoDB: {e}")
            return False
            
    def connect_mqtt(self) -> bool:
        """Conecta a MQTT usando configuración del backend"""
        try:
            client_id = f"cimarq_simulator_{random.randint(1000, 9999)}"
            self.mqtt_client = mqtt.Client(client_id=client_id)
            
            # Configurar callbacks
            self.mqtt_client.on_connect = self._on_mqtt_connect
            self.mqtt_client.on_disconnect = self._on_mqtt_disconnect
            self.mqtt_client.on_publish = self._on_mqtt_publish
            
            # Configurar credenciales si existen
            if self.mqtt_username and self.mqtt_password:
                self.mqtt_client.username_pw_set(self.mqtt_username, self.mqtt_password)
                
            # Conectar
            self.mqtt_client.connect(self.mqtt_broker, self.mqtt_port, 60)
            self.mqtt_client.loop_start()
            
            logger.info(f"📡 MQTT conectado: {self.mqtt_broker}:{self.mqtt_port}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error conectando a MQTT: {e}")
            return False
            
    def _on_mqtt_connect(self, client, userdata, flags, rc):
        """Callback de conexión MQTT"""
        if rc == 0:
            self.mqtt_connected = True
            logger.info("✅ MQTT broker conectado exitosamente")
        else:
            self.mqtt_connected = False
            logger.error(f"❌ Error conexión MQTT, código: {rc}")
            
    def _on_mqtt_disconnect(self, client, userdata, rc):
        """Callback de desconexión MQTT"""
        self.mqtt_connected = False
        logger.warning(f"⚠️ MQTT desconectado, código: {rc}")
        
    def _on_mqtt_publish(self, client, userdata, mid):
        """Callback de publicación MQTT"""
        logger.debug(f"📤 Mensaje MQTT publicado: {mid}")
        
    def simulate_temperature(self) -> float:
        """Simula temperatura realista con tendencias suaves"""
        sensor = self.specialized_sensors['temperatura_sensor']
        state = sensor['state']
        config = self.base_conditions['temperatura']
        
        # Ciclo diario (máximo a las 15:00, mínimo a las 6:00)
        hour = get_chile_time().hour
        daily_cycle = config['daily_amplitude'] * sin(2 * pi * (hour - 6) / 24)
        
        # Ciclo estacional (verano más caliente)
        day_of_year = get_chile_time().timetuple().tm_yday
        seasonal_cycle = config['seasonal_amplitude'] * sin(2 * pi * (day_of_year - 80) / 365)
        
        # Tendencia gradual (simula cambios climáticos lentos)
        state['trend'] += random.uniform(-config['trend_speed'], config['trend_speed'])
        state['trend'] = max(-0.2, min(0.2, state['trend']))  # Limitar tendencia
        
        # Deriva de calibración (sensor aging)
        state['calibration_drift'] += random.uniform(-0.001, 0.001)
        state['calibration_drift'] = max(-0.1, min(0.1, state['calibration_drift']))
        
        # Ruido suave (no aleatorio puro)
        noise = state['noise_offset'] * random.uniform(0.8, 1.2)
        state['noise_offset'] += random.uniform(-0.05, 0.05)
        state['noise_offset'] = max(-1.0, min(1.0, state['noise_offset']))
        
        # Calcular temperatura
        temperature = (config['base'] + daily_cycle + seasonal_cycle + 
                      state['trend'] + state['calibration_drift'] + noise)
        
        # Aplicar límites realistas
        temperature = max(config['min'], min(config['max'], temperature))
        
        # Actualizar estado
        state['current'] = temperature
        
        return round(temperature, 2)
        
    def simulate_ph(self) -> float:
        """Simula pH marino con variaciones naturales"""
        sensor = self.specialized_sensors['ph_sensor']
        state = sensor['state']
        config = self.base_conditions['ph']
        
        # Ciclo diario (fotosíntesis/respiración del fitoplancton)
        hour = get_chile_time().hour
        daily_cycle = config['daily_amplitude'] * sin(2 * pi * (hour - 12) / 24)
        
        # Variación estacional menor
        day_of_year = get_chile_time().timetuple().tm_yday
        seasonal_cycle = config['seasonal_amplitude'] * cos(2 * pi * day_of_year / 365)
        
        # Tendencia gradual
        state['trend'] += random.uniform(-config['trend_speed'], config['trend_speed'])
        state['trend'] = max(-0.05, min(0.05, state['trend']))
        
        # Deriva de calibración específica del pH
        state['calibration_drift'] += random.uniform(-0.0005, 0.0005)
        state['calibration_drift'] = max(-0.02, min(0.02, state['calibration_drift']))
        
        # Ruido suave
        noise = state['noise_offset'] * random.uniform(0.9, 1.1)
        state['noise_offset'] += random.uniform(-0.01, 0.01)
        state['noise_offset'] = max(-0.1, min(0.1, state['noise_offset']))
        
        # Calcular pH
        ph = config['base'] + daily_cycle + seasonal_cycle + state['trend'] + state['calibration_drift'] + noise
        
        # Aplicar límites
        ph = max(config['min'], min(config['max'], ph))
        
        # Actualizar estado
        state['current'] = ph
        
        return round(ph, 3)
        
    def simulate_oxygen(self, current_temp: float) -> float:
        """Simula oxígeno disuelto con dependencia de temperatura"""
        sensor = self.specialized_sensors['oxigeno_sensor']
        state = sensor['state']
        config = self.base_conditions['oxigeno']
        
        # Dependencia de temperatura (mayor temp = menor O2)
        temp_effect = -0.1 * (current_temp - 16.0)  # Efecto solubilidad
        
        # Ciclo diario (fotosíntesis máxima al mediodía)
        hour = get_chile_time().hour
        daily_cycle = config['daily_amplitude'] * sin(2 * pi * (hour - 9) / 24)
        
        # Variación estacional
        day_of_year = get_chile_time().timetuple().tm_yday
        seasonal_cycle = config['seasonal_amplitude'] * sin(2 * pi * (day_of_year - 100) / 365)
        
        # Tendencia gradual
        state['trend'] += random.uniform(-config['trend_speed'], config['trend_speed'])
        state['trend'] = max(-0.1, min(0.1, state['trend']))
        
        # Deriva de calibración del sensor O2 (más sensible)
        state['calibration_drift'] += random.uniform(-0.002, 0.002)
        state['calibration_drift'] = max(-0.05, min(0.05, state['calibration_drift']))
        
        # Ruido suave
        noise = state['noise_offset'] * random.uniform(0.85, 1.15)
        state['noise_offset'] += random.uniform(-0.03, 0.03)
        state['noise_offset'] = max(-0.5, min(0.5, state['noise_offset']))
        
        # Calcular oxígeno
        oxygen = (config['base'] + temp_effect + daily_cycle + 
                 seasonal_cycle + state['trend'] + state['calibration_drift'] + noise)
        
        # Aplicar límites
        oxygen = max(config['min'], min(config['max'], oxygen))
        
        # Actualizar estado
        state['current'] = oxygen
        
        return round(oxygen, 2)
        
    def create_unified_sensor_data(self, temperatura: float, ph: float, oxigeno: float) -> Dict[str, Any]:
        """Crea datos unificados simplificados para la nueva colección 'datos'"""
        now = get_chile_time()
        
        # Estructura simplificada con valores de sensores y timestamp
        data = {
            "temperatura": temperatura,
            "ph": ph,
            "oxigeno": oxigeno,
            "fecha": int(now.timestamp() * 1000)  # Timestamp en milliseconds
        }
        
        return data
    
    def create_sensor_data(self, sensor_type: str, value: float) -> Dict[str, Any]:
        """Crea datos individuales para MQTT (mantiene compatibilidad)"""
        now = get_chile_time()
        
        # Obtener información del sensor especializado
        sensor_info = self.specialized_sensors[f"{sensor_type}_sensor"]
        
        # Formato base para MQTT
        data = {
            "device_id": sensor_info['device_id'],
            "fecha": now.isoformat(),
            "timestamp": int(now.timestamp() * 1000),
            "location": sensor_info['location'],
            "sensor_type": sensor_type
        }
        
        # Agregar campos específicos según tipo de sensor
        if sensor_type == "temperatura":
            data.update({
                "temperatura": value,
                "valor": value  # Campo alternativo para compatibilidad
            })
        elif sensor_type == "ph":
            data.update({
                "ph": value,
                "valor": value
            })
        elif sensor_type == "oxigeno":
            data.update({
                "oxigeno": value,
                "valor": value
            })
            
        return data
        
    def save_to_mongodb(self, data: Dict[str, Any]) -> bool:
        """Inserta datos en la colección unificada 'datos'"""
        try:
            if self.db is not None:
                result = self.db.datos.insert_one(data)
                logger.debug(f"💾 Guardado en datos: {result.inserted_id}")
                return True
        except Exception as e:
            logger.error(f"❌ Error guardando en MongoDB: {e}")
            
        return False
        
    def publish_to_mqtt(self, topic: str, data: Dict[str, Any]) -> bool:
        """Publica datos a MQTT"""
        try:
            if self.mqtt_client and self.mqtt_connected:
                payload = json.dumps(data, default=str)
                result = self.mqtt_client.publish(topic, payload, qos=1)
                if result.rc == mqtt.MQTT_ERR_SUCCESS:
                    logger.debug(f"📡 Publicado a {topic}")
                    return True
                else:
                    logger.warning(f"⚠️ Error publicando a {topic}: {result.rc}")
        except Exception as e:
            logger.error(f"❌ Error publicando MQTT ({topic}): {e}")
            
        return False
        
    def run_simulation_cycle(self):
        """Ejecuta un ciclo completo de simulación con estructura unificada"""
        cycle_start = get_chile_time()
        successful_operations = 0
        total_operations = 0
        
        logger.info(f"🔄 Iniciando ciclo de simulación - Sistema unificado")
        
        # Simular cada sensor especializado
        temperatura = self.simulate_temperature()
        ph = self.simulate_ph() 
        oxigeno = self.simulate_oxygen(temperatura)  # O2 depende de temperatura
        
        # Crear datos unificados para MongoDB
        unified_data = self.create_unified_sensor_data(temperatura, ph, oxigeno)
        
        # Crear datos individuales para MQTT (compatibilidad)
        temp_data = self.create_sensor_data("temperatura", temperatura)
        ph_data = self.create_sensor_data("ph", ph)
        oxigeno_data = self.create_sensor_data("oxigeno", oxigeno)
        
        # NO guardar directamente en MongoDB - usar MQTT para comunicación
        # mongo_success = self.save_to_mongodb(unified_data)
        
        # Publicar datos unificados por MQTT solo si está conectado
        unified_topic = "cimarq/sensores/unified"
        if self.mqtt_connected:
            mqtt_unified_success = self.publish_to_mqtt(unified_topic, unified_data)
        else:
            mqtt_unified_success = False
            logger.warning("⚠️ MQTT no conectado, no se puede enviar datos unificados")
        
        # Contabilizar operaciones exitosas (solo MQTT unificado)
        successful_operations += (1 if mqtt_unified_success else 0)
        total_operations += 1
        
        # Log consolidado del sistema unificado (MQTT Unificado - sin nulos)
        logger.info(f"📊 Datos Completos sin Nulos: T={temperatura}°C, pH={ph}, O2={oxigeno}mg/L | "
                   f"MQTT={'✅' if mqtt_unified_success else '❌'} | MongoDB=Via Backend")
        
        # Log detallado de la estructura enviada
        logger.info(f"� MQTT Unificado: {{temperatura: {temperatura}, ph: {ph}, oxigeno: {oxigeno}, fecha: {int(get_chile_time().timestamp() * 1000)}}}")
        
        # Estadísticas del ciclo
        cycle_duration = (get_chile_time() - cycle_start).total_seconds()
        success_rate = (successful_operations / total_operations * 100) if total_operations > 0 else 0
        
        logger.info(f"✅ Ciclo completado en {cycle_duration:.2f}s | "
                   f"Éxito: {success_rate:.1f}% ({successful_operations}/{total_operations})")
        
        self.simulation_time += 1
        self.last_execution = get_chile_time()
        
    def run_continuous(self):
        """Ejecuta el simulador en modo continuo 24/7"""
        logger.info("🚀 Iniciando simulador continuo CIMARQ")
        logger.info(f"📍 Zona: Central Chile (Valparaíso/Quintay)")
        logger.info(f"⏱️ Intervalo: {self.interval}s ({self.interval/60:.1f} min)")
        logger.info(f"🔢 Sensores especializados: 3 (Temperatura, pH, Oxígeno)")
        
        # Intentar conectar servicios
        mongodb_ok = self.connect_mongodb()
        mqtt_ok = self.connect_mqtt()
        
        if not mongodb_ok and not mqtt_ok:
            logger.error("❌ No se pudo conectar a ningún servicio. Abortando.")
            return
            
        if not mongodb_ok:
            logger.warning("⚠️ MongoDB no disponible - solo MQTT")
        if not mqtt_ok:
            logger.warning("⚠️ MQTT no disponible - solo MongoDB")
            
        logger.info("✅ Simulador iniciado correctamente - Modo 24/7 activo")
        
        next_execution = get_chile_time()
        
        try:
            while self.running:
                current_time = get_chile_time()
                
                # Verificar si es tiempo de ejecutar
                if current_time >= next_execution:
                    self.run_simulation_cycle()
                    next_execution = current_time + timedelta(seconds=self.interval)
                    
                    # Mostrar próxima ejecución
                    logger.info(f"⏰ Próximo ciclo: {next_execution.strftime('%H:%M:%S')}")
                
                # Dormir 1 segundo para no saturar CPU
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("⏹️ Simulador detenido por usuario")
        except Exception as e:
            logger.error(f"💥 Error crítico en simulación: {e}")
        finally:
            self.cleanup()
            
    def cleanup(self):
        """Limpieza de recursos al cerrar"""
        logger.info("🧹 Cerrando conexiones...")
        
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
            logger.info("📡 MQTT desconectado")
            
        if self.mongo_client:
            self.mongo_client.close()
            logger.info("💾 MongoDB desconectado")
            
        logger.info("✅ Simulador cerrado correctamente")


def main():
    """Función principal"""
    print("🐟 Simulador IoT CIMARQ - Acuicultura Zona Central Chile")
    print("=" * 60)
    
    # Crear y ejecutar simulador
    try:
        # Buscar configuración del backend
        simulator = SensorSimulator()
        simulator.run_continuous()
        
    except Exception as e:
        logger.error(f"💥 Error fatal: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()