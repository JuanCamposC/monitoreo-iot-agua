from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from flask_restx import Api, Resource, fields, Namespace
from pymongo import MongoClient
from bson import ObjectId
from bson.timestamp import Timestamp
import json
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import pytz
import paho.mqtt.client as mqtt
import threading
import time
from sistema_preventivo import SistemaPreventivoML
from servicios.notificaciones_email import servicio_email

load_dotenv()

# Configuración de zona horaria Chile (GMT-3)
CHILE_TZ = pytz.timezone('America/Santiago')

app = Flask(__name__)
CORS(app)

# Configuración de Swagger/OpenAPI
api = Api(
    app,
    version='2.0',
    title='API de Sensores IoT CIMARQ - Sistema Unificado',
    description="""
    API REST para monitoreo de sensores de calidad del agua en acuicultura.
    
    ## Características Principales:
    - **Estructura Unificada**: Todos los sensores se almacenan en documentos completos sin valores nulos
    - **Timezone Chile**: Todos los timestamps usan GMT-3 (America/Santiago)  
    - **Comunicación MQTT**: Integración con broker test.mosquitto.org
    - **Sensores**: Temperatura (°C), pH (acidez/alcalinidad), Oxígeno Disuelto (mg/L)
    
    ## Colección de Datos:
    - **Base de datos**: cimarqdb
    - **Colección**: datos (estructura unificada)
    - **Formato**: {temperatura: float, ph: float, oxigeno: float, fecha: timestamp}
    
    ## Tópicos MQTT:
    - **cimarq/sensores/unified**: Mensajes completos con todos los sensores
    - **cimarq/temperatura/update**: Solo temperatura (legacy)  
    - **cimarq/ph/update**: Solo pH (legacy)
    - **cimarq/oxigeno/update**: Solo oxígeno (legacy)
    """,
    doc='/docs/',  # URL de la documentación
    prefix='/api/v1'
)

# Configuración MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://cimarq:eGEr87FyYHIadm4p@proyectotitulo.idqwtmo.mongodb.net/")
DB_NAME = os.getenv("DB_NAME", "cimarqdb")

# Configurar cliente MongoDB con opciones específicas para Docker
try:
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000,  # 5 segundos timeout
        connectTimeoutMS=10000,         # 10 segundos para conectar
        socketTimeoutMS=20000,          # 20 segundos para operaciones
        maxPoolSize=10,                 # Máximo 10 conexiones
        retryWrites=True,               # Reintentar escrituras
        retryReads=True                 # Reintentar lecturas
    )
    
    # Verificar conexión
    client.admin.command('ping')
    db = client[DB_NAME]
    print(f"✅ Conectado a MongoDB: {DB_NAME}")
    
    # Inicializar sistema preventivo ML
    try:
        sistema_ml = SistemaPreventivoML(MONGO_URI, DB_NAME)
        print("✅ Sistema preventivo ML inicializado")
    except Exception as e:
        print(f"⚠️ Error inicializando sistema ML: {e}")
        sistema_ml = None
    
except Exception as e:
    print(f"❌ Error conectando a MongoDB: {e}")
    print(f"URI utilizada: {MONGO_URI[:50]}...")
    client = None
    db = None

# Función para reconectar a MongoDB
def reconnect_mongodb():
    global client, db
    try:
        if client:
            client.close()
        
        client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=20000,
            maxPoolSize=10,
            retryWrites=True,
            retryReads=True
        )
        
        client.admin.command('ping')
        db = client[DB_NAME]
        print(f"✅ Reconectado a MongoDB: {DB_NAME}")
        return True
        
    except Exception as e:
        print(f"❌ Error en reconexión a MongoDB: {e}")
        client = None
        db = None
        return False

# Configuración MQTT
MQTT_BROKER = os.getenv("MQTT_BROKER", "test.mosquitto.org")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")

# Tópicos MQTT
TEMPERATURA_TOPIC = os.getenv("TEMPERATURA_TOPIC", "cimarq/temperatura/update")
PH_TOPIC = os.getenv("PH_TOPIC", "cimarq/ph/update")
OXIGENO_TOPIC = os.getenv("OXIGENO_TOPIC", "cimarq/oxigeno/update")
UNIFIED_TOPIC = os.getenv("UNIFIED_TOPIC", "cimarq/sensores/unified")

# Variables globales para MQTT
mqtt_client = None
mqtt_connected = False
last_message_time = None

# Decorador para manejar reconexión automática a MongoDB
def ensure_mongodb_connection(f):
    def wrapper(*args, **kwargs):
        global client, db
        
        # Si no hay cliente o no está conectado, intentar reconectar
        if client is None or db is None:
            print("🔄 Intentando reconectar a MongoDB...")
            if not reconnect_mongodb():
                return jsonify({"success": False, "error": "No se pudo conectar a MongoDB"}), 500
        
        # Verificar si la conexión sigue activa
        try:
            client.admin.command('ping')
        except Exception as e:
            print(f"🔄 Conexión perdida, reconectando... Error: {e}")
            if not reconnect_mongodb():
                return jsonify({"success": False, "error": "No se pudo reconectar a MongoDB"}), 500
        
        return f(*args, **kwargs)
    
    wrapper.__name__ = f.__name__
    return wrapper

# Configurar headers anti-caché globalmente
@app.after_request
def after_request(response):
    # Agregar headers anti-caché para endpoints de datos en tiempo real
    if '/sensores' in request.path or '/latest' in request.path or '/ml/' in request.path:
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# Definir namespaces para organizar endpoints
sensores_ns = Namespace('sensores', description='📊 Datos unificados de todos los sensores (temperatura, pH, oxígeno)')
temperatura_ns = Namespace('temperatura', description='🌡️ Datos de temperatura del agua (°C)')
ph_ns = Namespace('ph', description='🧪 Datos de pH - acidez/alcalinidad del agua (6.5-8.5)')
oxigeno_ns = Namespace('oxigeno', description='💨 Datos de oxígeno disuelto (mg/L) - calidad del agua')
mqtt_ns = Namespace('mqtt', description='📡 Publicación de mensajes MQTT - comunicación IoT')
health_ns = Namespace('health', description='❤️ Estado de salud del sistema (MongoDB, MQTT, timezone)')
alertas_ns = Namespace('alertas', description='🚨 Sistema de alertas preventivas con ML')
ml_ns = Namespace('ml', description='🤖 Análisis predictivo con Machine Learning')
notificaciones_ns = Namespace('notificaciones', description='📧 Sistema de notificaciones por email y otros canales')

# Registrar namespaces
api.add_namespace(sensores_ns, path='/sensores')
api.add_namespace(temperatura_ns, path='/temperatura')
api.add_namespace(ph_ns, path='/ph')
api.add_namespace(oxigeno_ns, path='/oxigeno')
api.add_namespace(mqtt_ns, path='/mqtt')
api.add_namespace(health_ns, path='/health')
api.add_namespace(alertas_ns, path='/alertas')
api.add_namespace(ml_ns, path='/ml')
api.add_namespace(notificaciones_ns, path='/notificaciones')

# Modelos para documentación
unified_sensor_model = api.model('UnifiedSensorData', {
    '_id': fields.String(description='ID único del registro'),
    'temperatura': fields.Float(required=True, description='Temperatura en grados Celsius', example=14.2),
    'ph': fields.Float(required=True, description='Valor de pH del agua', example=8.1),
    'oxigeno': fields.Float(required=True, description='Oxígeno disuelto en mg/L', example=7.8),
    'fecha': fields.String(description='Fecha y hora con timezone Chile (GMT-3)', example='2025-10-13T20:26:07.248000-03:00')
})

# Modelos legacy para compatibilidad
sensor_data_model = api.model('SensorData', {
    '_id': fields.String(description='ID único del registro'),
    'fecha': fields.String(description='Fecha y hora del registro'),
    'sensor_id': fields.String(description='ID del sensor (opcional)')
})

temperatura_model = api.model('TemperaturaData', {
    '_id': fields.String(description='ID único del registro'),
    'temperatura': fields.Float(required=True, description='Temperatura en grados Celsius', example=14.2),
    'fecha': fields.String(description='Fecha y hora con timezone Chile (GMT-3)', example='2025-10-13T20:26:07.248000-03:00')
})

ph_model = api.model('PHData', {
    '_id': fields.String(description='ID único del registro'),
    'ph': fields.Float(required=True, description='Valor de pH del agua', example=8.1),
    'fecha': fields.String(description='Fecha y hora con timezone Chile (GMT-3)', example='2025-10-13T20:26:07.248000-03:00')
})

oxigeno_model = api.model('OxigenoData', {
    '_id': fields.String(description='ID único del registro'),
    'oxigeno': fields.Float(required=True, description='Oxígeno disuelto en mg/L', example=7.8),
    'fecha': fields.String(description='Fecha y hora con timezone Chile (GMT-3)', example='2025-10-13T20:26:07.248000-03:00')
})

# Modelos de respuesta específicos para cada sensor
temperatura_response_model = api.model('TemperaturaResponse', {
    'success': fields.Boolean(description='Indica si la operación fue exitosa'),
    'data': fields.List(fields.Nested(temperatura_model), description='Array de lecturas de temperatura'),
    'count': fields.Integer(description='Número de registros de temperatura'),
    'mqtt_status': fields.Raw(description='Estado de conexión MQTT')
})

ph_response_model = api.model('PHResponse', {
    'success': fields.Boolean(description='Indica si la operación fue exitosa'),
    'data': fields.List(fields.Nested(ph_model), description='Array de lecturas de pH'),
    'count': fields.Integer(description='Número de registros de pH'),
    'mqtt_status': fields.Raw(description='Estado de conexión MQTT')
})

oxigeno_response_model = api.model('OxigenoResponse', {
    'success': fields.Boolean(description='Indica si la operación fue exitosa'),
    'data': fields.List(fields.Nested(oxigeno_model), description='Array de lecturas de oxígeno'),
    'count': fields.Integer(description='Número de registros de oxígeno'),
    'mqtt_status': fields.Raw(description='Estado de conexión MQTT')
})

unified_response_model = api.model('UnifiedResponse', {
    'success': fields.Boolean(description='Indica si la operación fue exitosa'),
    'data': fields.Raw(description='Datos organizados por sensor: {temperatura: [{_id, temperatura, fecha}], ph: [{_id, ph, fecha}], oxigeno: [{_id, oxigeno, fecha}]}'),
    'count': fields.Raw(description='Conteo de registros: {temperatura: int, ph: int, oxigeno: int, total: int}'),
    'mqtt_status': fields.Raw(description='Estado de conexión MQTT: {connected: bool, last_message: datetime|null}')
})

response_model = api.model('Response', {
    'success': fields.Boolean(description='Indica si la operación fue exitosa'),
    'data': fields.Raw(description='Datos de respuesta'),
    'count': fields.Raw(description='Cantidad de registros (puede ser entero o diccionario)'),
    'mqtt_status': fields.Raw(description='Estado de MQTT')
})

error_model = api.model('Error', {
    'success': fields.Boolean(description='Siempre false para errores'),
    'error': fields.String(description='Mensaje de error')
})

health_model = api.model('Health', {
    'status': fields.String(description='Estado general (healthy/unhealthy)', example='healthy'),
    'mongodb': fields.String(description='Estado de conexión a MongoDB', example='connected'),
    'mqtt': fields.String(description='Estado de conexión a MQTT', example='connected'),
    'mongodb_collections': fields.Integer(description='Número de colecciones en MongoDB', example=2),
    'timestamp': fields.String(description='Timestamp con timezone Chile GMT-3', example='2025-10-13T20:26:07.248000-03:00'),
    'environment': fields.Raw(description='Información del entorno: {mongo_uri_configured, db_name, flask_env}')
})

mqtt_publish_model = api.model('MqttPublish', {
    'topic': fields.String(required=True, description='Tópico MQTT', example='cimarq/sensores/unified'),
    'message': fields.Raw(required=True, description='Mensaje a publicar', example={'temperatura': 14.2, 'ph': 8.1, 'oxigeno': 7.8, 'fecha': 1728847567248})
})

# Modelos para alertas y ML
alerta_model = api.model('Alerta', {
    '_id': fields.String(description='ID único de la alerta'),
    'sensor': fields.String(required=True, description='Sensor que generó la alerta', example='temperatura'),
    'nivel': fields.String(required=True, description='Nivel de alerta', example='ALTO', enum=['NORMAL', 'MEDIO', 'ALTO', 'CRITICO']),
    'mensaje': fields.String(required=True, description='Mensaje descriptivo de la alerta'),
    'sugerencias': fields.List(fields.String, description='Lista de sugerencias para resolver el problema'),
    'valor_actual': fields.Float(description='Valor actual del sensor'),
    'fecha_creacion': fields.String(description='Fecha de creación con timezone Chile'),
    'resuelto': fields.Boolean(description='Indica si la alerta ha sido resuelta'),
    'prioridad': fields.Integer(description='Prioridad numérica (1-4)'),
    'acciones_recomendadas': fields.List(fields.String, description='Acciones específicas recomendadas')
})

prediccion_model = api.model('Prediccion', {
    'sensor': fields.String(required=True, description='Sensor analizado'),
    'predicciones': fields.List(fields.Float, description='Array de valores predichos'),
    'timestamps': fields.List(fields.String, description='Timestamps futuros correspondientes'),
    'valor_actual': fields.Float(description='Valor actual del sensor'),
    'analisis': fields.Raw(description='Análisis detallado de las predicciones'),
    'fecha_prediccion': fields.String(description='Fecha de generación de la predicción')
})

alertas_response_model = api.model('AlertasResponse', {
    'success': fields.Boolean(description='Indica si la operación fue exitosa'),
    'alertas': fields.List(fields.Nested(alerta_model), description='Lista de alertas'),
    'total': fields.Integer(description='Total de alertas'),
    'activas': fields.Integer(description='Alertas activas (no resueltas)'),
    'por_nivel': fields.Raw(description='Conteo por nivel de alerta')
})

ml_response_model = api.model('MLResponse', {
    'success': fields.Boolean(description='Indica si la operación fue exitosa'),
    'predicciones': fields.Raw(description='Predicciones por sensor'),
    'alertas_generadas': fields.List(fields.Raw, description='Nuevas alertas generadas'),
    'metricas_modelos': fields.Raw(description='Métricas de los modelos ML'),
    'fecha_procesamiento': fields.String(description='Timestamp del procesamiento')
})

mqtt_publish_model = api.model('MQTTPublish', {
    'topic': fields.String(required=True, description='Tópico MQTT', example='cimarq/temperatura/update'),
    'message': fields.Raw(required=True, description='Mensaje a publicar', example={'temperatura': 25.0})
})

def get_chile_time():
    """Obtiene la hora actual en zona horaria de Chile (America/Santiago)"""
    return datetime.now(CHILE_TZ)

def serializa_doc(doc):
    if doc:
        doc['_id'] = str(doc['_id'])
        # Convertir timestamps a ISO string para el frontend
        if 'fecha' in doc:
            if isinstance(doc['fecha'], (int, float)):
                # Si es un timestamp numérico, convertir a ISO string con zona horaria de Chile
                chile_time = datetime.fromtimestamp(doc['fecha'] / 1000, tz=CHILE_TZ)
                doc['fecha'] = chile_time.isoformat()
            elif isinstance(doc['fecha'], Timestamp):
                # Si es un objeto Timestamp de MongoDB, convertir a ISO string con zona horaria de Chile
                chile_time = datetime.fromtimestamp(doc['fecha'].time, tz=CHILE_TZ)
                doc['fecha'] = chile_time.isoformat()
            elif isinstance(doc['fecha'], datetime):
                # Si es un objeto datetime, asegurar zona horaria Chile
                if doc['fecha'].tzinfo is None:
                    # Si no tiene timezone, asumimos que es Chile
                    chile_time = CHILE_TZ.localize(doc['fecha'])
                else:
                    # Si ya tiene timezone, convertir a Chile
                    chile_time = doc['fecha'].astimezone(CHILE_TZ)
                doc['fecha'] = chile_time.isoformat()
            elif hasattr(doc['fecha'], 'timestamp'):
                # Si es otro tipo de objeto con timestamp, usar el método timestamp con zona horaria de Chile
                chile_time = datetime.fromtimestamp(doc['fecha'].timestamp(), tz=CHILE_TZ)
                doc['fecha'] = chile_time.isoformat()
    return doc

# Funciones MQTT
def on_connect(client, userdata, flags, rc):
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        print("Conectado al broker MQTT")
        # Suscribirse al tópico unificado para datos completos sin nulos
        client.subscribe(UNIFIED_TOPIC)
        # También mantener tópicos individuales por compatibilidad
        client.subscribe(TEMPERATURA_TOPIC)
        client.subscribe(PH_TOPIC) 
        client.subscribe(OXIGENO_TOPIC)
        print(f"Suscrito a tópicos: {UNIFIED_TOPIC}, {TEMPERATURA_TOPIC}, {PH_TOPIC}, {OXIGENO_TOPIC}")
    else:
        mqtt_connected = False
        print(f"Error de conexión MQTT: {rc}")

# Cache temporal para acumular datos de sensores
sensor_cache = {
    'temperatura': None,
    'ph': None,
    'oxigeno': None,
    'timestamp': None
}

def save_complete_sensor_data():
    """Guarda datos completos solo cuando todos los sensores tienen valores"""
    global sensor_cache
    
    # Verificar que todos los valores estén disponibles
    if all(value is not None for value in sensor_cache.values()):
        try:
            # Crear documento completo sin nulos
            complete_data = {
                'temperatura': sensor_cache['temperatura'],
                'ph': sensor_cache['ph'],
                'oxigeno': sensor_cache['oxigeno'],
                'fecha': sensor_cache['timestamp']
            }
            
            # Guardar en base de datos
            result = db.datos.insert_one(complete_data)
            print(f"✅ Datos completos guardados: T={complete_data['temperatura']}°C, "
                  f"pH={complete_data['ph']}, O2={complete_data['oxigeno']}mg/L - ID: {result.inserted_id}")
            
            # Limpiar cache para próximo ciclo
            sensor_cache = {
                'temperatura': None,
                'ph': None,
                'oxigeno': None,
                'timestamp': None
            }
            
            return True
            
        except Exception as e:
            print(f"❌ Error guardando datos completos: {e}")
            return False
    
    return False

def on_message(client, userdata, msg):
    global last_message_time, sensor_cache
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        last_message_time = get_chile_time()
        
        print(f"Mensaje recibido en {topic}: {payload}")
        
        # Manejar mensaje unificado (datos completos sin nulos)
        if "unified" in topic:
            # Datos completos recibidos - guardar directamente
            if all(key in payload for key in ['temperatura', 'ph', 'oxigeno', 'fecha']):
                try:
                    # Serializar documento antes de guardar
                    complete_data = {
                        'temperatura': payload['temperatura'],
                        'ph': payload['ph'],
                        'oxigeno': payload['oxigeno'],
                        'fecha': payload['fecha']
                    }
                    
                    result = db.datos.insert_one(complete_data)
                    print(f"✅ Datos unificados guardados: T={complete_data['temperatura']}°C, "
                          f"pH={complete_data['ph']}, O2={complete_data['oxigeno']}mg/L - ID: {result.inserted_id}")
                    
                    # Ejecutar monitoreo en tiempo real tras guardar nuevos datos
                    if sistema_ml and sistema_ml.monitoreo_activo:
                        try:
                            resultado_monitoreo = sistema_ml.monitorear_sensores_tiempo_real()
                            alertas_generadas = len(resultado_monitoreo.get('alertas_generadas', []))
                            if alertas_generadas > 0:
                                print(f"🚨 Monitoreo automático: {alertas_generadas} alertas generadas")
                            else:
                                print("✅ Monitoreo automático: Todos los valores en rango normal")
                        except Exception as e:
                            print(f"⚠️ Error en monitoreo automático: {e}")
                    
                except Exception as e:
                    print(f"❌ Error guardando datos unificados: {e}")
            else:
                print(f"⚠️ Mensaje unificado incompleto, faltan campos: {payload}")
                
        else:
            # Manejar mensajes individuales (sistema legacy)
            timestamp = payload.get('timestamp', int(get_chile_time().timestamp() * 1000))
            
            # Actualizar cache con nuevo valor de sensor
            if "temperatura" in topic:
                value = payload.get('temperatura') or payload.get('valor')
                if value is not None:
                    sensor_cache['temperatura'] = value
                    sensor_cache['timestamp'] = timestamp
                    print(f"🌡️ Temperatura actualizada: {value}°C")
                    
            elif "ph" in topic:
                value = payload.get('ph') or payload.get('valor')
                if value is not None:
                    sensor_cache['ph'] = value
                    sensor_cache['timestamp'] = timestamp
                    print(f"🧪 pH actualizado: {value}")
                    
            elif "oxigeno" in topic:
                value = payload.get('oxigeno') or payload.get('valor')
                if value is not None:
                    sensor_cache['oxigeno'] = value
                    sensor_cache['timestamp'] = timestamp
                    print(f"💧 Oxígeno actualizado: {value} mg/L")
            
            # Intentar guardar si tenemos datos completos del cache
            cache_status = f"Cache: T={sensor_cache['temperatura']}, pH={sensor_cache['ph']}, O2={sensor_cache['oxigeno']}"
            print(f"📋 {cache_status}")
            
            # Guardar solo cuando todos los sensores estén disponibles
            if save_complete_sensor_data():
                print("🎯 Documento completo creado - sin valores nulos")
                
                # Ejecutar monitoreo en tiempo real tras guardar nuevos datos del cache
                if sistema_ml and sistema_ml.monitoreo_activo:
                    try:
                        resultado_monitoreo = sistema_ml.monitorear_sensores_tiempo_real()
                        alertas_generadas = len(resultado_monitoreo.get('alertas_generadas', []))
                        if alertas_generadas > 0:
                            print(f"🚨 Monitoreo automático cache: {alertas_generadas} alertas generadas")
                        else:
                            print("✅ Monitoreo automático cache: Todos los valores en rango normal")
                    except Exception as e:
                        print(f"⚠️ Error en monitoreo automático cache: {e}")
                
    except Exception as e:
        print(f"Error procesando mensaje MQTT: {e}")

def init_mqtt():
    global mqtt_client
    try:
        mqtt_client = mqtt.Client()
        mqtt_client.on_connect = on_connect
        mqtt_client.on_message = on_message
        
        # Configurar autenticación si está disponible
        if MQTT_USERNAME and MQTT_PASSWORD:
            mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        
        # Conectar al broker usando variables de entorno
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
        print(f"Cliente MQTT iniciado - Broker: {MQTT_BROKER}:{MQTT_PORT}")
    except Exception as e:
        print(f"Error iniciando MQTT: {e}")

# Endpoints documentados con Swagger

# Endpoint raíz (fuera de namespaces)
@app.route('/')
def home():
    """Endpoint raíz de la API"""
    return jsonify({
        "message": "API CIMARQ Funcionando",
        "version": "1.0",
        "documentation": "/docs/",
        "mqtt_connected": mqtt_connected,
        "last_message": last_message_time.isoformat() if last_message_time else None
    })

# Endpoint de health check simple (para Docker healthcheck)
@app.route('/health')
def simple_health():
    """Health check simple sin autenticación"""
    return jsonify({
        "status": "healthy",
        "mongodb": "connected" if client else "disconnected",
        "mqtt": "connected" if mqtt_connected else "disconnected"
    })

@sensores_ns.route('')
class SensoresResource(Resource):
    @sensores_ns.doc('get_all_sensors')
    @sensores_ns.marshal_with(unified_response_model, code=200)
    @sensores_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def get(self):
        """
        Obtiene datos organizados por tipo de sensor
        
        Retorna datos de temperatura, pH y oxígeno disuelto agrupados por tipo de sensor.
        Cada grupo contiene solo los campos específicos del sensor correspondiente.
        Los timestamps están en zona horaria de Chile (GMT-3).
        
        Estructura de respuesta:
        - data.temperatura: []{_id, temperatura, fecha} - Solo datos de temperatura
        - data.ph: []{_id, ph, fecha} - Solo datos de pH  
        - data.oxigeno: []{_id, oxigeno, fecha} - Solo datos de oxígeno
        - count: {temperatura: int, ph: int, oxigeno: int, total: int}
        - mqtt_status: {connected: bool, last_message: datetime|null}
        """
        try:
            # Obtener datos específicos para cada sensor con proyección
            temperatura_cursor = db.datos.find(
                {"temperatura": {"$ne": None}},
                {"_id": 1, "temperatura": 1, "fecha": 1}
            ).sort("fecha", -1)
            
            ph_cursor = db.datos.find(
                {"ph": {"$ne": None}},
                {"_id": 1, "ph": 1, "fecha": 1}
            ).sort("fecha", -1)
            
            oxigeno_cursor = db.datos.find(
                {"oxigeno": {"$ne": None}},
                {"_id": 1, "oxigeno": 1, "fecha": 1}
            ).sort("fecha", -1)
            
            # Procesar y serializar cada grupo
            temperatura_data = []
            for doc in temperatura_cursor:
                serializa_doc(doc)
                temperatura_data.append(doc)
                
            ph_data = []
            for doc in ph_cursor:
                serializa_doc(doc)
                ph_data.append(doc)
                
            oxigeno_data = []
            for doc in oxigeno_cursor:
                serializa_doc(doc)
                oxigeno_data.append(doc)
                
            # Obtener total de registros únicos
            total_count = db.datos.count_documents({})
                
            return {
                "success": True,
                "data": {
                    "temperatura": temperatura_data, 
                    "ph": ph_data, 
                    "oxigeno": oxigeno_data
                },
                "count": {
                    "temperatura": len(temperatura_data),
                    "ph": len(ph_data),
                    "oxigeno": len(oxigeno_data),
                    "total": total_count
                },
                "mqtt_status": {
                    "connected": mqtt_connected,
                    "last_message": last_message_time.isoformat() if last_message_time else None
                }
            }
        except Exception as e:
            sensores_ns.abort(500, success=False, error=str(e))

@temperatura_ns.route('')
class TemperaturaResource(Resource):
    @temperatura_ns.doc('get_temperatura')
    @temperatura_ns.marshal_with(temperatura_response_model, code=200)
    @temperatura_ns.response(500, 'Error interno del servidor', error_model)
    @temperatura_ns.param('sort', 'Orden: asc o desc', type=str, default='desc')
    @ensure_mongodb_connection
    def get(self):
        """
        Obtiene solo los datos de temperatura
        
        Retorna únicamente los valores de temperatura y fecha desde la colección unificada.
        Filtra y devuelve solo los campos: _id, temperatura, fecha.
        Los datos están ordenados por fecha (desc por defecto).
        """
        try:
            sort_order = request.args.get('sort', 'desc', type=str)
            
            sort_direction = -1 if sort_order == 'desc' else 1
            # Obtener datos y proyectar solo temperatura y fecha
            cursor = db.datos.find(
                {"temperatura": {"$ne": None}},
                {"_id": 1, "temperatura": 1, "fecha": 1}  # Solo estos campos
            ).sort("fecha", sort_direction)
            
            temperatura_data = []
            for doc in cursor:
                serializa_doc(doc)
                temperatura_data.append(doc)
                
            return {
                "success": True,
                "data": temperatura_data,
                "count": len(temperatura_data),
                "mqtt_status": {
                    "connected": mqtt_connected,
                    "last_message": last_message_time.isoformat() if last_message_time else None
                }
            }
        except Exception as e:
            temperatura_ns.abort(500, success=False, error=str(e))

@ph_ns.route('')
class PHResource(Resource):
    @ph_ns.doc('get_ph')
    @ph_ns.marshal_with(ph_response_model, code=200)
    @ph_ns.response(500, 'Error interno del servidor', error_model)
    @ph_ns.param('sort', 'Orden: asc o desc', type=str, default='desc')
    @ensure_mongodb_connection
    def get(self):
        """
        Obtiene solo los datos de pH
        
        Retorna únicamente los valores de pH y fecha desde la colección unificada.
        Filtra y devuelve solo los campos: _id, ph, fecha.
        Los valores de pH indican la acidez/alcalinidad del agua (rango típico: 6.5-8.5).
        """
        try:
            sort_order = request.args.get('sort', 'desc', type=str)
            
            sort_direction = -1 if sort_order == 'desc' else 1
            # Obtener datos y proyectar solo pH y fecha
            cursor = db.datos.find(
                {"ph": {"$ne": None}},
                {"_id": 1, "ph": 1, "fecha": 1}  # Solo estos campos
            ).sort("fecha", sort_direction)
            
            ph_data = []
            for doc in cursor:
                serializa_doc(doc)
                ph_data.append(doc)
                
            return {
                "success": True, 
                "data": ph_data,
                "count": len(ph_data),
                "mqtt_status": {
                    "connected": mqtt_connected,
                    "last_message": last_message_time.isoformat() if last_message_time else None
                }
            }
        except Exception as e:
            ph_ns.abort(500, success=False, error=str(e))

@oxigeno_ns.route('')
class OxigenoResource(Resource):
    @oxigeno_ns.doc('get_oxigeno')
    @oxigeno_ns.marshal_with(oxigeno_response_model, code=200)
    @oxigeno_ns.response(500, 'Error interno del servidor', error_model)
    @oxigeno_ns.param('sort', 'Orden: asc o desc', type=str, default='desc')
    @ensure_mongodb_connection
    def get(self):
        """
        Obtiene solo los datos de oxígeno disuelto
        
        Retorna únicamente los valores de oxígeno y fecha desde la colección unificada.
        Filtra y devuelve solo los campos: _id, oxigeno, fecha.
        El oxígeno disuelto se mide en mg/L (valores típicos: 5-12 mg/L para acuicultura).
        """
        try:
            sort_order = request.args.get('sort', 'desc', type=str)
            
            sort_direction = -1 if sort_order == 'desc' else 1
            # Obtener datos y proyectar solo oxígeno y fecha
            cursor = db.datos.find(
                {"oxigeno": {"$ne": None}},
                {"_id": 1, "oxigeno": 1, "fecha": 1}  # Solo estos campos
            ).sort("fecha", sort_direction)
            
            oxigeno_data = []
            for doc in cursor:
                serializa_doc(doc)
                oxigeno_data.append(doc)
                
            return {
                "success": True, 
                "data": oxigeno_data,
                "count": len(oxigeno_data),
                "mqtt_status": {
                    "connected": mqtt_connected,
                    "last_message": last_message_time.isoformat() if last_message_time else None
                }
            }
        except Exception as e:
            oxigeno_ns.abort(500, success=False, error=str(e))

@sensores_ns.route('/latest')
class LatestSensoresResource(Resource):
    @sensores_ns.doc('get_latest_readings')
    @sensores_ns.marshal_with(unified_response_model, code=200)
    @sensores_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def get(self):
        """
        Obtiene las últimas lecturas de todos los sensores
        
        Retorna el documento más reciente de cada tipo de sensor desde la colección unificada.
        Cada documento contiene temperatura, pH, oxígeno y fecha con timezone Chile.
        """
        try:
            # Obtener las últimas lecturas de cada tipo de sensor de la colección unificada
            latest_temp = db.datos.find_one(
                {"temperatura": {"$ne": None}}, 
                sort=[("fecha", -1)]
            )
            latest_ph = db.datos.find_one(
                {"ph": {"$ne": None}}, 
                sort=[("fecha", -1)]
            )
            latest_oxigeno = db.datos.find_one(
                {"oxigeno": {"$ne": None}}, 
                sort=[("fecha", -1)]
            )
            
            result = {}
            if latest_temp:
                result['temperatura'] = serializa_doc(latest_temp)
            if latest_ph:
                result['ph'] = serializa_doc(latest_ph)
            if latest_oxigeno:
                result['oxigeno'] = serializa_doc(latest_oxigeno)
                
            return {
                "success": True, 
                "data": result,
                "count": len(result),
                "mqtt_status": {
                    "connected": mqtt_connected,
                    "last_message": last_message_time.isoformat() if last_message_time else None
                }
            }
        except Exception as e:
            sensores_ns.abort(500, success=False, error=str(e))

@mqtt_ns.route('/publish')
class MQTTPublishResource(Resource):
    @mqtt_ns.doc('publish_mqtt')
    @mqtt_ns.expect(mqtt_publish_model)
    @mqtt_ns.marshal_with(response_model, code=200)
    @mqtt_ns.response(400, 'Datos de entrada inválidos', error_model)
    @mqtt_ns.response(500, 'Error interno del servidor', error_model)
    def post(self):
        """
        Publica un mensaje a un tópico MQTT específico
        
        Permite publicar datos de sensores al broker MQTT (test.mosquitto.org).
        
        Tópicos principales:
        - cimarq/sensores/unified: Mensajes con estructura completa {temperatura, ph, oxigeno, fecha}
        - cimarq/temperatura/update: Solo datos de temperatura
        - cimarq/ph/update: Solo datos de pH
        - cimarq/oxigeno/update: Solo datos de oxígeno
        
        El timestamp debe incluir zona horaria Chile GMT-3.
        """
        try:
            data = request.get_json()
            
            if not data:
                mqtt_ns.abort(400, success=False, error="No se proporcionaron datos")
            
            topic = data.get('topic')
            message = data.get('message')
            
            if not topic or not message:
                mqtt_ns.abort(400, success=False, error="Faltan campos requeridos: topic y message")
            
            if mqtt_client and mqtt_connected:
                mqtt_client.publish(topic, json.dumps(message))
                return {
                    "success": True, 
                    "message": f"Mensaje publicado en tópico: {topic}",
                    "data": {
                        "topic": topic,
                        "message": message,
                        "timestamp": get_chile_time().isoformat()
                    }
                }
            else:
                mqtt_ns.abort(500, success=False, error="MQTT no conectado")
                
        except Exception as e:
            mqtt_ns.abort(500, success=False, error=str(e))

@health_ns.route('')
class HealthResource(Resource):
    @health_ns.doc('health_check')
    @health_ns.marshal_with(health_model, code=200)
    @health_ns.response(500, 'Sistema no saludable', health_model)
    def get(self):
        """
        Verifica el estado de salud de la API y sus dependencias
        
        Retorna información completa sobre:
        - Estado de conexión MongoDB (base de datos cimarqdb)
        - Estado de conexión MQTT (broker test.mosquitto.org)
        - Número de colecciones en la base de datos
        - Timestamp con zona horaria Chile GMT-3
        - Información del entorno (configuración, variables)
        """
        health_status = {
            "status": "healthy",
            "mongodb": "disconnected",
            "mqtt": "disconnected",
            "timestamp": get_chile_time().isoformat(),
            "environment": {
                "mongo_uri_configured": bool(os.getenv("MONGO_URI")),
                "db_name": DB_NAME,
                "flask_env": os.getenv("FLASK_ENV", "development")
            }
        }
        
        # Verificar conexión a MongoDB
        try:
            if client:
                client.admin.command('ping')
                health_status["mongodb"] = "connected"
                
                # Verificar acceso a la base de datos
                collections_count = len(db.list_collection_names())
                health_status["mongodb_collections"] = collections_count
            else:
                health_status["mongodb"] = "client_not_initialized"
        except Exception as e:
            health_status["mongodb"] = f"error: {str(e)}"
        
        # Verificar estado de MQTT
        try:
            if mqtt_client and mqtt_client.is_connected():
                health_status["mqtt"] = "connected"
            else:
                health_status["mqtt"] = "disconnected"
        except Exception as e:
            health_status["mqtt"] = f"error: {str(e)}"
        
        # Determinar estado general
        is_healthy = (health_status["mongodb"] == "connected")
        health_status["status"] = "healthy" if is_healthy else "unhealthy"
        
        if not is_healthy:
            health_ns.abort(500, **health_status)
        
        return health_status

# =============================================================================
# ENDPOINTS DE ALERTAS Y MACHINE LEARNING
# =============================================================================

@alertas_ns.route('')
class AlertasResource(Resource):
    @alertas_ns.doc('get_alertas')
    @alertas_ns.marshal_with(alertas_response_model, code=200)
    @alertas_ns.response(500, 'Error interno del servidor', error_model)
    @alertas_ns.param('activas', 'Solo alertas activas (true/false)', type=str, default='true')
    @alertas_ns.param('limite', 'Límite de alertas a retornar', type=int, default=50)
    @ensure_mongodb_connection
    def get(self):
        """
        Obtiene lista de alertas del sistema
        
        Retorna alertas generadas por el sistema de ML preventivo.
        Permite filtrar por alertas activas y limitar cantidad de resultados.
        Ordenadas por fecha de creación (más recientes primero).
        """
        try:
            activas_param = request.args.get('activas', 'true').lower()
            limite = request.args.get('limite', 50, type=int)
            
            # Construir query
            query = {}
            if activas_param == 'true':
                query['resuelto'] = False
            
            # Obtener alertas
            cursor = db.alertas.find(query).sort("fecha_creacion_timestamp", -1).limit(limite)
            alertas = list(cursor)
            
            # Serializar ObjectIds
            for alerta in alertas:
                if '_id' in alerta:
                    alerta['_id'] = str(alerta['_id'])
            
            # Estadísticas
            total = db.alertas.count_documents({})
            activas = db.alertas.count_documents({"resuelto": False})
            
            # Conteo por nivel
            pipeline = [
                {"$group": {"_id": "$nivel", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ]
            por_nivel = {doc['_id']: doc['count'] for doc in db.alertas.aggregate(pipeline)}
            
            return {
                "success": True,
                "alertas": alertas,
                "total": total,
                "activas": activas,
                "por_nivel": por_nivel
            }
            
        except Exception as e:
            alertas_ns.abort(500, success=False, error=str(e))

@alertas_ns.route('/<string:alerta_id>/resolver')
class ResolverAlertaResource(Resource):
    @alertas_ns.doc('resolver_alerta')
    @alertas_ns.marshal_with(response_model, code=200)
    @alertas_ns.response(404, 'Alerta no encontrada', error_model)
    @alertas_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def put(self, alerta_id):
        """
        Marca una alerta como resuelta
        
        Actualiza el estado de una alerta específica a resuelto=true
        y agrega timestamp de resolución con timezone Chile.
        """
        try:
            from bson import ObjectId
            
            # Actualizar alerta
            resultado = db.alertas.update_one(
                {"_id": ObjectId(alerta_id)},
                {
                    "$set": {
                        "resuelto": True,
                        "fecha_resolucion": get_chile_time().isoformat(),
                        "fecha_resolucion_timestamp": int(get_chile_time().timestamp() * 1000)
                    }
                }
            )
            
            if resultado.matched_count == 0:
                alertas_ns.abort(404, success=False, error="Alerta no encontrada")
            
            return {
                "success": True,
                "message": f"Alerta {alerta_id} marcada como resuelta",
                "timestamp": get_chile_time().isoformat()
            }
            
        except Exception as e:
            alertas_ns.abort(500, success=False, error=str(e))

@ml_ns.route('/predicciones')
class PrediccionesResource(Resource):
    @ml_ns.doc('get_predicciones')
    @ml_ns.marshal_with(ml_response_model, code=200)
    @ml_ns.response(500, 'Error interno del servidor', error_model)
    @ml_ns.param('sensor', 'Sensor específico (opcional)', type=str, enum=['temperatura', 'ph', 'oxigeno'])
    @ml_ns.param('horas', 'Horas a predecir', type=int, default=24)
    @ensure_mongodb_connection
    def get(self):
        """
        Genera predicciones con modelos de Machine Learning
        
        Utiliza modelos Perceptron entrenados para predecir valores futuros.
        Puede generar predicciones para un sensor específico o todos.
        Incluye análisis de riesgo y detección de anomalías.
        """
        try:
            if not sistema_ml:
                ml_ns.abort(500, success=False, error="Sistema ML no inicializado")
            
            sensor_param = request.args.get('sensor')
            horas = request.args.get('horas', 24, type=int)
            
            # Validar parámetros
            if horas < 1 or horas > 168:  # Máximo 1 semana
                ml_ns.abort(400, success=False, error="Horas debe estar entre 1 y 168")
            
            sensores = [sensor_param] if sensor_param else ['temperatura', 'ph', 'oxigeno']
            
            predicciones = {}
            alertas_generadas = []
            
            for sensor in sensores:
                try:
                    # Cargar o entrenar modelo
                    if not sistema_ml.cargar_modelo(sensor):
                        sistema_ml.entrenar_modelo(sensor)
                    
                    # Generar predicción
                    prediccion = sistema_ml.predecir_sensor(sensor, horas)
                    predicciones[sensor] = prediccion
                    
                    # Generar alerta si es necesaria
                    alerta = sistema_ml.generar_alerta(sensor, prediccion)
                    if alerta:
                        alerta_id = sistema_ml.guardar_alerta(alerta)
                        if alerta_id:
                            alertas_generadas.append({
                                'sensor': sensor,
                                'nivel': alerta['nivel'],
                                'alerta_id': alerta_id,
                                'mensaje': alerta['mensaje']
                            })
                            
                except Exception as e:
                    predicciones[sensor] = {"error": str(e)}
            
            return {
                "success": True,
                "predicciones": predicciones,
                "alertas_generadas": alertas_generadas,
                "fecha_procesamiento": get_chile_time().isoformat(),
                "parametros": {
                    "horas_prediccion": horas,
                    "sensores_procesados": sensores
                }
            }
            
        except Exception as e:
            ml_ns.abort(500, success=False, error=str(e))

@ml_ns.route('/entrenar')
class EntrenarModelosResource(Resource):
    @ml_ns.doc('entrenar_modelos')
    @ml_ns.marshal_with(ml_response_model, code=200)
    @ml_ns.response(500, 'Error interno del servidor', error_model)
    @ml_ns.param('sensor', 'Sensor específico (opcional)', type=str, enum=['temperatura', 'ph', 'oxigeno'])
    @ml_ns.param('dias', 'Días de datos históricos', type=int, default=30)
    @ensure_mongodb_connection
    def post(self):
        """
        Entrena o re-entrena modelos de Machine Learning
        
        Entrena modelos Perceptron con datos históricos recientes.
        Puede entrenar un sensor específico o todos los sensores.
        Retorna métricas de rendimiento y precisión de los modelos.
        """
        try:
            if not sistema_ml:
                ml_ns.abort(500, success=False, error="Sistema ML no inicializado")
            
            sensor_param = request.args.get('sensor')
            dias = request.args.get('dias', 30, type=int)
            
            # Validar parámetros
            if dias < 7 or dias > 90:
                ml_ns.abort(400, success=False, error="Días debe estar entre 7 y 90")
            
            sensores = [sensor_param] if sensor_param else ['temperatura', 'ph', 'oxigeno']
            
            metricas_modelos = {}
            
            for sensor in sensores:
                try:
                    metricas = sistema_ml.entrenar_modelo(sensor, dias)
                    metricas_modelos[sensor] = metricas
                except Exception as e:
                    metricas_modelos[sensor] = {"error": str(e)}
            
            return {
                "success": True,
                "metricas_modelos": metricas_modelos,
                "fecha_procesamiento": get_chile_time().isoformat(),
                "parametros": {
                    "dias_entrenamiento": dias,
                    "sensores_entrenados": sensores
                }
            }
            
        except Exception as e:
            ml_ns.abort(500, success=False, error=str(e))

@ml_ns.route('/monitoreo-tiempo-real')
class MonitoreoTiempoRealResource(Resource):
    @ml_ns.doc('monitoreo_tiempo_real')
    @ml_ns.marshal_with(ml_response_model, code=200)
    @ml_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def post(self):
        """
        Monitoreo en tiempo real de sensores
        
        Verifica los valores actuales de todos los sensores y genera alertas
        automáticamente si algún parámetro está fuera del rango establecido.
        
        Esta función:
        - Obtiene los últimos valores de temperatura, pH y oxígeno
        - Verifica si están dentro de los rangos críticos y óptimos
        - Genera alertas automáticamente para valores fuera de rango
        - No requiere entrenamiento de modelos ML
        """
        try:
            if not sistema_ml:
                ml_ns.abort(500, success=False, error="Sistema ML no inicializado")
            
            resultado = sistema_ml.monitorear_sensores_tiempo_real()
            
            return {
                "success": True,
                "timestamp": resultado.get('timestamp'),
                "sensores_monitoreados": resultado.get('sensores_monitoreados', []),
                "alertas_generadas": resultado.get('alertas_generadas', []),
                "valores_normales": resultado.get('valores_normales', []),
                "errores": resultado.get('errores', []),
                "resumen": {
                    "sensores_verificados": len(resultado.get('sensores_monitoreados', [])),
                    "alertas_creadas": len(resultado.get('alertas_generadas', [])),
                    "valores_normales": len(resultado.get('valores_normales', [])),
                    "errores_encontrados": len(resultado.get('errores', []))
                }
            }
            
        except Exception as e:
            ml_ns.abort(500, success=False, error=str(e))

@ml_ns.route('/sistema-completo')
class SistemaCompletoResource(Resource):
    @ml_ns.doc('sistema_completo')
    @ml_ns.marshal_with(ml_response_model, code=200)
    @ml_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def post(self):
        """
        Ejecuta el sistema preventivo completo
        
        Entrena modelos, genera predicciones y crea alertas automáticas.
        Proceso completo de análisis preventivo para todos los sensores.
        Ideal para ejecución programada o manual completa del sistema.
        """
        try:
            if not sistema_ml:
                ml_ns.abort(500, success=False, error="Sistema ML no inicializado")
            
            resultado = sistema_ml.procesar_sistema_completo()
            
            return {
                "success": True,
                "predicciones": resultado.get('predicciones', {}),
                "alertas_generadas": resultado.get('alertas_generadas', []),
                "metricas_modelos": resultado.get('modelos_entrenados', {}),
                "fecha_procesamiento": resultado.get('fecha_procesamiento'),
                "errores": resultado.get('errores', []),
                "resumen": {
                    "modelos_procesados": len(resultado.get('modelos_entrenados', {})),
                    "predicciones_generadas": len(resultado.get('predicciones', {})),
                    "alertas_creadas": len(resultado.get('alertas_generadas', [])),
                    "errores_encontrados": len(resultado.get('errores', []))
                }
            }
            
        except Exception as e:
            ml_ns.abort(500, success=False, error=str(e))

# ================================
# ENDPOINTS DE ALERTAS
# ================================

# Modelo para alertas
alerta_model = api.model('Alerta', {
    '_id': fields.String(description='ID único de la alerta'),
    'sensor': fields.String(required=True, description='Tipo de sensor', example='temperatura'),
    'nivel': fields.String(required=True, description='Nivel de la alerta', example='CRITICO'),
    'mensaje': fields.String(required=True, description='Descripción de la alerta'),
    'valor_actual': fields.Float(required=True, description='Valor que generó la alerta'),
    'fecha_creacion': fields.String(description='Fecha y hora de creación'),
    'resuelto': fields.Boolean(description='Si la alerta ha sido revisada', default=False),
    'prioridad': fields.Integer(description='Prioridad de la alerta (1-5)', example=3),
    'sugerencias': fields.List(fields.String, description='Sugerencias para resolver la alerta')
})

alertas_response_model = api.model('AlertasResponse', {
    'success': fields.Boolean(description='Si la operación fue exitosa'),
    'alertas': fields.List(fields.Nested(alerta_model), description='Lista de alertas'),
    'total': fields.Integer(description='Total de alertas'),
    'sin_revisar': fields.Integer(description='Alertas sin revisar')
})

@alertas_ns.route('')
class AlertasListResource(Resource):
    @alertas_ns.doc('listar_alertas')
    @alertas_ns.marshal_with(alertas_response_model, code=200)
    @alertas_ns.response(500, 'Error interno del servidor', error_model)
    @alertas_ns.param('limite', 'Número máximo de alertas a retornar', type=int, default=50)
    @alertas_ns.param('filtro', 'Filtrar por estado: todas, sin_revisar, revisadas', default='todas')
    @ensure_mongodb_connection
    def get(self):
        """
        Obtener lista de alertas históricas
        
        Retorna las alertas generadas por el sistema preventivo ML.
        Permite filtrar por estado y limitar el número de resultados.
        """
        try:
            limite = request.args.get('limite', 50, type=int)
            filtro = request.args.get('filtro', 'todas')
            
            # Construir filtro de consulta
            query = {}
            if filtro == 'sin_revisar':
                query['resuelto'] = False
            elif filtro == 'revisadas':
                query['resuelto'] = True
            
            # Obtener alertas de la base de datos
            alertas_collection = db.alertas
            alertas_cursor = alertas_collection.find(query).sort('fecha_creacion', -1).limit(limite)
            alertas = []
            
            for alerta in alertas_cursor:
                alerta_dict = {
                    '_id': str(alerta['_id']),
                    'sensor': alerta.get('sensor', ''),
                    'nivel': alerta.get('nivel', ''),
                    'mensaje': alerta.get('mensaje', ''),
                    'valor_actual': alerta.get('valor_actual', 0),
                    'fecha_creacion': alerta.get('fecha_creacion', ''),
                    'resuelto': alerta.get('resuelto', False),
                    'prioridad': alerta.get('prioridad', 1),
                    'sugerencias': alerta.get('sugerencias', [])
                }
                alertas.append(alerta_dict)
            
            # Contar totales
            total_alertas = alertas_collection.count_documents({})
            sin_revisar = alertas_collection.count_documents({'resuelto': False})
            
            return {
                'success': True,
                'alertas': alertas,
                'total': total_alertas,
                'sin_revisar': sin_revisar
            }
            
        except Exception as e:
            alertas_ns.abort(500, success=False, error=str(e))

@alertas_ns.route('/<string:alerta_id>/revisar')
class AlertaRevisarResource(Resource):
    @alertas_ns.doc('marcar_alerta_revisada')
    @alertas_ns.response(200, 'Alerta marcada como revisada')
    @alertas_ns.response(404, 'Alerta no encontrada')
    @alertas_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def put(self, alerta_id):
        """
        Marcar una alerta como revisada
        
        Actualiza el estado de una alerta específica marcándola como revisada.
        """
        try:
            # Verificar que el ID sea válido
            if not ObjectId.is_valid(alerta_id):
                alertas_ns.abort(400, success=False, error='ID de alerta inválido')
            
            # Actualizar la alerta
            resultado = db.alertas.update_one(
                {'_id': ObjectId(alerta_id)},
                {
                    '$set': {
                        'resuelto': True,
                        'fecha_revision': datetime.now(CHILE_TZ).isoformat()
                    }
                }
            )
            
            if resultado.matched_count == 0:
                alertas_ns.abort(404, success=False, error='Alerta no encontrada')
            
            return {
                'success': True,
                'mensaje': 'Alerta marcada como revisada exitosamente'
            }
            
        except Exception as e:
            alertas_ns.abort(500, success=False, error=str(e))

@alertas_ns.route('/revisar-todas')
class AlertasRevisarTodasResource(Resource):
    @alertas_ns.doc('marcar_todas_revisadas')
    @alertas_ns.response(200, 'Todas las alertas marcadas como revisadas')
    @alertas_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def put(self):
        """
        Marcar todas las alertas como revisadas
        
        Actualiza el estado de todas las alertas pendientes marcándolas como revisadas.
        """
        try:
            # Actualizar todas las alertas sin revisar
            resultado = db.alertas.update_many(
                {'resuelto': False},
                {
                    '$set': {
                        'resuelto': True,
                        'fecha_revision': datetime.now(CHILE_TZ).isoformat()
                    }
                }
            )
            
            return {
                'success': True,
                'mensaje': f'{resultado.modified_count} alertas marcadas como revisadas',
                'alertas_actualizadas': resultado.modified_count
            }
            
        except Exception as e:
            alertas_ns.abort(500, success=False, error=str(e))

# ================================
# ENDPOINTS DE NOTIFICACIONES
# ================================

# Modelos para notificaciones
notificacion_request_model = api.model('NotificacionRequest', {
    'tipo': fields.String(required=True, description='Tipo de notificación', example='critica'),
    'alerta_id': fields.String(description='ID de la alerta'),
    'canales': fields.List(fields.String, description='Canales de notificación', example=['email']),
    'destinatarios': fields.List(fields.String, description='Lista de destinatarios'),
    'mensaje_personalizado': fields.String(description='Mensaje personalizado opcional')
})

notificacion_response_model = api.model('NotificacionResponse', {
    'success': fields.Boolean(description='Si la notificación fue exitosa'),
    'mensaje': fields.String(description='Mensaje de resultado'),
    'canales_enviados': fields.List(fields.String, description='Canales donde se envió'),
    'destinatarios_exitosos': fields.List(fields.String, description='Destinatarios que recibieron la notificación'),
    'errores': fields.List(fields.String, description='Lista de errores si los hay')
})

@notificaciones_ns.route('/enviar')
class NotificacionEnviarResource(Resource):
    @notificaciones_ns.doc('enviar_notificacion')
    @notificaciones_ns.expect(notificacion_request_model)
    @notificaciones_ns.marshal_with(notificacion_response_model, code=200)
    @notificaciones_ns.response(400, 'Datos de entrada inválidos', error_model)
    @notificaciones_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def post(self):
        """
        Enviar notificación por los canales especificados
        
        Permite enviar notificaciones por email u otros canales cuando se detectan
        alertas críticas o por solicitud manual del usuario.
        """
        try:
            data = request.get_json()
            
            if not data:
                notificaciones_ns.abort(400, success=False, error='No se proporcionaron datos')
            
            tipo = data.get('tipo', 'manual')
            alerta_id = data.get('alerta_id')
            canales = data.get('canales', ['email'])
            destinatarios_custom = data.get('destinatarios', [])
            mensaje_custom = data.get('mensaje_personalizado')
            
            resultado = {
                'success': True,
                'mensaje': 'Notificación procesada exitosamente',
                'canales_enviados': [],
                'destinatarios_exitosos': [],
                'errores': []
            }
            
            # Obtener datos de la alerta si se proporciona ID
            alerta_data = None
            if alerta_id:
                try:
                    if ObjectId.is_valid(alerta_id):
                        alerta_doc = db.alertas.find_one({'_id': ObjectId(alerta_id)})
                        if alerta_doc:
                            alerta_data = {
                                '_id': str(alerta_doc['_id']),
                                'sensor': alerta_doc.get('sensor', ''),
                                'nivel': alerta_doc.get('nivel', 'MEDIO'),
                                'mensaje': alerta_doc.get('mensaje', ''),
                                'valor_actual': alerta_doc.get('valor_actual', 0),
                                'fecha_creacion': alerta_doc.get('fecha_creacion', ''),
                                'prioridad': alerta_doc.get('prioridad', 1),
                                'sugerencias': alerta_doc.get('sugerencias', [])
                            }
                except Exception as e:
                    resultado['errores'].append(f'Error obteniendo alerta: {str(e)}')
            
            # Si no hay alerta específica, crear datos genéricos
            if not alerta_data:
                alerta_data = {
                    'sensor': 'sistema',
                    'nivel': 'CRITICO' if tipo == 'critica' else 'MEDIO',
                    'mensaje': mensaje_custom or f'Notificación {tipo} del sistema CIMARQ',
                    'valor_actual': 0,
                    'fecha_creacion': datetime.now(CHILE_TZ).strftime('%d/%m/%Y %H:%M:%S'),
                    'prioridad': 5 if tipo == 'critica' else 3,
                    'sugerencias': ['Revisar el dashboard para más información']
                }
            
            # Procesar canales de notificación
            if 'email' in canales:
                try:
                    destinatarios = destinatarios_custom if destinatarios_custom else None
                    exito_email = servicio_email.enviar_alerta_email(alerta_data, destinatarios)
                    
                    if exito_email:
                        resultado['canales_enviados'].append('email')
                        resultado['destinatarios_exitosos'].extend(
                            destinatarios or servicio_email.destinatarios_default
                        )
                    else:
                        resultado['errores'].append('Error al enviar email')
                        
                except Exception as e:
                    resultado['errores'].append(f'Error en canal email: {str(e)}')
            
            # Determinar éxito general
            if resultado['errores'] and not resultado['canales_enviados']:
                resultado['success'] = False
                resultado['mensaje'] = 'Error al enviar notificaciones'
            elif resultado['errores']:
                resultado['mensaje'] = 'Notificación enviada con algunos errores'
            
            return resultado
            
        except Exception as e:
            notificaciones_ns.abort(500, success=False, error=str(e))

@notificaciones_ns.route('/configuracion')
class NotificacionConfiguracionResource(Resource):
    @notificaciones_ns.doc('obtener_configuracion_notificaciones')
    @notificaciones_ns.response(200, 'Configuración de notificaciones')
    @notificaciones_ns.response(500, 'Error interno del servidor', error_model)
    def get(self):
        """
        Obtener configuración actual de notificaciones
        
        Devuelve el estado de la configuración de email y otros canales.
        """
        try:
            config_email = servicio_email.verificar_configuracion()
            
            return {
                'success': True,
                'configuracion': {
                    'email': {
                        'habilitado': config_email,
                        'servidor_smtp': servicio_email.smtp_server,
                        'puerto': servicio_email.smtp_port,
                        'remitente': servicio_email.email_remitente,
                        'destinatarios_default': servicio_email.destinatarios_default,
                        'niveles_notificacion': servicio_email.niveles_notificacion
                    }
                },
                'canales_disponibles': ['email'],
                'timestamp': datetime.now(CHILE_TZ).isoformat()
            }
            
        except Exception as e:
            notificaciones_ns.abort(500, success=False, error=str(e))

@notificaciones_ns.route('/probar')
class NotificacionProbarResource(Resource):
    @notificaciones_ns.doc('probar_notificaciones')
    @notificaciones_ns.response(200, 'Resultado de la prueba')
    @notificaciones_ns.response(500, 'Error interno del servidor', error_model)
    def post(self):
        """
        Probar configuración de notificaciones
        
        Envía un email de prueba para verificar que la configuración es correcta.
        """
        try:
            resultado_prueba = servicio_email.probar_configuracion()
            
            return {
                'success': resultado_prueba['success'],
                'resultado_email': resultado_prueba,
                'timestamp': datetime.now(CHILE_TZ).isoformat()
            }
            
        except Exception as e:
            notificaciones_ns.abort(500, success=False, error=str(e))

# Inicializar MQTT al cargar el módulo
import threading
import time

def init_mqtt_delayed():
    """Inicializa MQTT con un pequeño delay para asegurar que Flask esté listo"""
    time.sleep(2)
    init_mqtt()

# Ejecutar MQTT en hilo separado
mqtt_thread = threading.Thread(target=init_mqtt_delayed)
mqtt_thread.daemon = True  
mqtt_thread.start()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)