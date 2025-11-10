from flask import Flask, jsonify, request, make_response, g
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
import csv
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from servicios.notificaciones_email import servicio_email
import hashlib
import secrets
import jwt
from functools import wraps

load_dotenv()

# Configuración de zona horaria Chile (GMT-3)
CHILE_TZ = pytz.timezone('America/Santiago')

app = Flask(__name__)
CORS(app, 
     origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True)

# Configuración JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Configuración de Swagger/OpenAPI
api = Api(
    app,
    version='2.1',
    title='CIMARQ - API Sistema de Monitoreo Acuícola',
    doc='/docs/',  # Documentación disponible en /docs/
    description="""
    Sistema completo para monitoreo en tiempo real de parámetros de calidad del agua en acuicultura.
    
    **Sensores monitoreados**: Temperatura, pH y Oxígeno Disuelto  
    **Zona horaria**: Chile GMT-3 (America/Santiago)  
    **Base de datos**: MongoDB con estructura unificada  
    **Comunicación IoT**: MQTT para datos en tiempo real
    **Machine Learning**: API externa en Railway (https://ml-acuicultura.railway.app)
    
    ## Endpoints principales:
    - **/sensores**: Datos unificados de todos los sensores (recomendado)
    - **/alertas**: Sistema de alertas y notificaciones
    - **/auth**: Autenticación JWT y gestión de usuarios
    - **/health**: Diagnóstico del sistema
    """,
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
    print(f"Conectado a MongoDB: {DB_NAME}")
    
    # Asignar base de datos al servicio de email
    servicio_email.set_database(db)
    print("Servicio de email configurado con base de datos")
    
except Exception as e:
    print(f"Error conectando a MongoDB: {e}")
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
        print(f"Reconectado a MongoDB: {DB_NAME}")
        return True
        
    except Exception as e:
        print(f"Error en reconexión a MongoDB: {e}")
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
            print("Intentando reconectar a MongoDB...")
            if not reconnect_mongodb():
                return jsonify({"success": False, "error": "No se pudo conectar a MongoDB"}), 500
        
        # Verificar si la conexión sigue activa
        try:
            client.admin.command('ping')
        except Exception as e:
            print(f"Conexión perdida, reconectando... Error: {e}")
            if not reconnect_mongodb():
                return jsonify({"success": False, "error": "No se pudo reconectar a MongoDB"}), 500
        
        return f(*args, **kwargs)
    
    wrapper.__name__ = f.__name__
    return wrapper

# ============================================================================
# FUNCIONES DE AUTENTICACIÓN Y SEGURIDADES
# ============================================================================

def hash_password(password: str) -> str:
    """Crear hash seguro de la contraseña"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verificar contraseña contra hash"""
    return hashlib.sha256(password.encode()).hexdigest() == hashed

def generate_jwt_token(user_data: dict) -> str:
    """Generar token JWT para el usuario"""
    payload = {
        'user_id': str(user_data['_id']),
        'email': user_data['email'],
        'nombre': user_data['nombre'],
        'rol': user_data['rol'],
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> dict:
    """Verificar y decodificar token JWT"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def require_auth(f):
    """Decorador para rutas que requieren autenticación"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return {'success': False, 'message': 'Token de autenticación requerido'}, 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload:
            return {'success': False, 'message': 'Token inválido o expirado'}, 401
        
        # Agregar información del usuario a g
        g.current_user = payload
        return f(*args, **kwargs)
    
    return decorated_function

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
auth_ns = Namespace('auth', description='Autenticación JWT y gestión de usuarios')
sensores_ns = Namespace('sensores', description='Datos unificados de sensores - API principal recomendada')
temperatura_ns = Namespace('temperatura', description='Datos específicos de temperatura (°C)')
ph_ns = Namespace('ph', description='Datos específicos de pH - acidez/alcalinidad (6.5-8.5)')
oxigeno_ns = Namespace('oxigeno', description='Datos específicos de oxígeno disuelto (mg/L)')
mqtt_ns = Namespace('mqtt', description='Publicación manual MQTT para testing')
health_ns = Namespace('health', description='Diagnóstico y estado del sistema')
alertas_ns = Namespace('alertas', description='Sistema de alertas inteligentes con ML')
notificaciones_ns = Namespace('notificaciones', description='Notificaciones automáticas por email')

# Registrar namespaces
api.add_namespace(auth_ns, path='/auth')
api.add_namespace(sensores_ns, path='/sensores')
api.add_namespace(temperatura_ns, path='/temperatura')
api.add_namespace(ph_ns, path='/ph')
api.add_namespace(oxigeno_ns, path='/oxigeno')
api.add_namespace(mqtt_ns, path='/mqtt')
api.add_namespace(health_ns, path='/health')
api.add_namespace(alertas_ns, path='/alertas')
api.add_namespace(notificaciones_ns, path='/notificaciones')

# ============================================================================
# MODELOS DE AUTENTICACIÓN
# ============================================================================

# Modelos de entrada para autenticación
login_model = api.model('LoginCredentials', {
    'email': fields.String(required=True, description='Email registrado en el sistema', example='admin@cimarq.com'),
    'password': fields.String(required=True, description='Contraseña de acceso', example='admin123')
})

# Modelos de respuesta
user_model = api.model('UserData', {
    'id': fields.String(description='ID único del usuario'),
    'email': fields.String(description='Correo electrónico del usuario'),
    'nombre': fields.String(description='Nombre completo del usuario'),
    'rol': fields.String(description='Rol del usuario', enum=['admin', 'usuario']),
    'fecha_creacion': fields.String(description='Fecha de creación de la cuenta')
})

auth_response_model = api.model('AuthResponse', {
    'success': fields.Boolean(description='Indica si la operación fue exitosa'),
    'message': fields.String(description='Mensaje descriptivo del resultado'),
    'token': fields.String(description='Token JWT para autenticación'),
    'user': fields.Nested(user_model, description='Datos del usuario autenticado')
})

# Modelo de error
error_model = api.model('ErrorResponse', {
    'success': fields.Boolean(description='Siempre false para errores'),
    'message': fields.String(description='Descripción del error')
})



# ============================================================================
# MODELOS DE SENSORES
# ============================================================================

# Modelos para documentación
unified_sensor_model = api.model('SensorReading', {
    '_id': fields.String(description='Identificador único del registro'),
    'temperatura': fields.Float(required=True, description='Temperatura del agua en °C (rango normal: 8-20°C)', example=14.2),
    'ph': fields.Float(required=True, description='Nivel de pH - acidez/alcalinidad (rango seguro: 6.5-8.5)', example=7.1),
    'oxigeno': fields.Float(required=True, description='Oxígeno disuelto en mg/L (mínimo recomendado: 6 mg/L)', example=7.8),
    'fecha': fields.String(description='Timestamp con zona horaria Chile (GMT-3)', example='2025-11-09T15:30:00-03:00')
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

# Modelo para ingreso manual de datos de sensores
manual_input_model = api.model('ManualSensorInput', {
    'temperatura': fields.Float(
        required=True, 
        description='Temperatura del agua en °C (rango acuicultura: 8-20°C)',
        example=15.2,
        min=-50.0,
        max=100.0
    ),
    'ph': fields.Float(
        required=True,
        description='Nivel de pH del agua (rango seguro: 6.5-8.5)',
        example=7.1,
        min=0.0,
        max=14.0
    ),
    'oxigeno': fields.Float(
        required=True,
        description='Oxígeno disuelto en mg/L (mínimo crítico: 6 mg/L)',
        example=8.2,
        min=0.0,
        max=30.0
    ),
    'fecha': fields.String(
        required=False,
        description='Timestamp ISO 8601 del momento de la medición. Si no se especifica, se usa la fecha/hora actual del servidor (GMT-3)',
        example='2024-11-06T10:30:00Z'
    ),
    'fuente': fields.String(
        required=False,
        description='Identificador de la fuente del dato. Usado para trazabilidad y filtrado. Por defecto: "manual"',
        example='manual',
        default='manual'
    ),
    'usuario': fields.String(
        required=False,
        description='Usuario que registra la medición. Usado para auditoría y trazabilidad. Por defecto: "admin"',
        example='admin',
        default='admin'
    )
})

# Modelo de respuesta específico para ingreso manual
manual_response_model = api.model('ManualResponse', {
    'success': fields.Boolean(description='Indica si la operación fue exitosa', example=True),
    'data': fields.Nested(api.model('ManualData', {
        '_id': fields.String(description='ID único del registro en MongoDB', example='673b8e4f9c8d4e001f123456'),
        'temperatura': fields.Float(description='Temperatura registrada en °C', example=22.5),
        'ph': fields.Float(description='pH registrado', example=7.2),
        'oxigeno': fields.Float(description='Oxígeno registrado en mg/L', example=8.5),
        'fecha': fields.String(description='Timestamp final con zona horaria Chile', example='2024-11-06T13:30:00-03:00'),
        'fuente': fields.String(description='Fuente confirmada del dato', example='manual'),
        'usuario': fields.String(description='Usuario confirmado', example='admin')
    })),
    'count': fields.Integer(description='Número de registros creados (siempre 1)', example=1),
    'alertas_generadas': fields.Integer(description='Cantidad de alertas generadas automáticamente', example=0),
    'mqtt_status': fields.Nested(api.model('MQTTStatus', {
        'connected': fields.Boolean(description='Estado de conexión MQTT', example=True),
        'last_message': fields.String(description='Último mensaje MQTT recibido', example='2024-11-06T13:29:45-03:00')
    }))
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
            print(f"Datos completos guardados: T={complete_data['temperatura']}°C, "
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
            print(f"Error guardando datos completos: {e}")
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
                    print(f"Datos unificados guardados: T={complete_data['temperatura']}°C, "
                          f"pH={complete_data['ph']}, O2={complete_data['oxigeno']}mg/L - ID: {result.inserted_id}")
                    
                except Exception as e:
                    print(f"Error guardando datos unificados: {e}")
            else:
                print(f"Mensaje unificado incompleto, faltan campos: {payload}")
                
        else:
            # Manejar mensajes individuales (sistema legacy)
            timestamp = payload.get('timestamp', int(get_chile_time().timestamp() * 1000))
            
            # Actualizar cache con nuevo valor de sensor
            if "temperatura" in topic:
                value = payload.get('temperatura') or payload.get('valor')
                if value is not None:
                    sensor_cache['temperatura'] = value
                    sensor_cache['timestamp'] = timestamp
                    print(f"Temperatura actualizada: {value}°C")
                    
            elif "ph" in topic:
                value = payload.get('ph') or payload.get('valor')
                if value is not None:
                    sensor_cache['ph'] = value
                    sensor_cache['timestamp'] = timestamp
                    print(f"pH actualizado: {value}")
                    
            elif "oxigeno" in topic:
                value = payload.get('oxigeno') or payload.get('valor')
                if value is not None:
                    sensor_cache['oxigeno'] = value
                    sensor_cache['timestamp'] = timestamp
                    print(f"Oxígeno actualizado: {value} mg/L")
            
            # Intentar guardar si tenemos datos completos del cache
            cache_status = f"Cache: T={sensor_cache['temperatura']}, pH={sensor_cache['ph']}, O2={sensor_cache['oxigeno']}"
            print(f"{cache_status}")
            
            # Guardar solo cuando todos los sensores estén disponibles
            if save_complete_sensor_data():
                print("Documento completo creado - sin valores nulos")
                
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
    @sensores_ns.doc('get_unified_sensors')
    @sensores_ns.marshal_with(unified_response_model, code=200)
    @sensores_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def get(self):
        """
        Obtiene todos los datos de sensores organizados por tipo
        
        **API principal recomendada** para obtener datos de monitoreo de calidad del agua.
        
        **Datos incluidos:**
        - Temperatura del agua (°C)
        - Nivel de pH (acidez/alcalinidad)  
        - Oxígeno disuelto (mg/L)
        
        **Respuesta agrupada por sensor** con timestamps en zona horaria Chile (GMT-3).
        Los datos se ordenan por fecha descendente (más recientes primero).
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

@sensores_ns.route('/manual')
class SensoresManualResource(Resource):
    @sensores_ns.doc(
        'manual_sensor_input',
        summary='Ingreso manual de datos de sensores'
    )
    @sensores_ns.expect(manual_input_model, validate=True)
    @sensores_ns.marshal_with(manual_response_model, code=201)
    @sensores_ns.response(201, 'Datos creados exitosamente - Registro completado', manual_response_model)
    @sensores_ns.response(400, 'Datos de entrada inválidos - Verificar rangos de sensores', error_model)
    @sensores_ns.response(500, 'Error interno del servidor - Conexión BD o sistema ML', error_model)
    @ensure_mongodb_connection
    def post(self):
        """
        Registro manual de mediciones de sensores
        
        Permite ingresar datos de temperatura, pH y oxígeno disuelto manualmente.
        Útil para calibración, mantenimiento o ingreso de mediciones históricas.
        
        **Proceso automático:**
        - Validación de rangos de seguridad
        - Timestamp automático (Chile GMT-3)
        - Activación de sistema de alertas ML
        - Notificaciones si hay valores críticos
        
        **Rangos recomendados para acuicultura:**
        - Temperatura: 8-20°C
        - pH: 6.5-8.5  
        - Oxígeno: >6 mg/L
                "fuente": "manual",
                "usuario": "admin"
            },
            "count": 1,
            "alertas_generadas": 0,
            "mqtt_status": {
                "connected": true,
                "last_message": "2024-11-06T13:29:45-03:00"
            }
        }
        ```
        """
        try:
            data = request.json
            
            # Validaciones de rango
            temperatura = data.get('temperatura')
            ph = data.get('ph') 
            oxigeno = data.get('oxigeno')
            
            if not (-50 <= temperatura <= 100):
                sensores_ns.abort(400, success=False, error='Temperatura debe estar entre -50°C y 100°C')
            
            if not (0 <= ph <= 14):
                sensores_ns.abort(400, success=False, error='pH debe estar entre 0 y 14')
                
            if not (0 <= oxigeno <= 30):
                sensores_ns.abort(400, success=False, error='Oxígeno debe estar entre 0 y 30 mg/L')
            
            # Preparar datos para inserción
            manual_data = {
                'temperatura': temperatura,
                'ph': ph,
                'oxigeno': oxigeno,
                'fecha': data.get('fecha', get_chile_time().isoformat()),
                'fuente': data.get('fuente', 'manual'),
                'usuario': data.get('usuario', 'admin')
            }
            
            # Insertar en base de datos
            result = db.datos.insert_one(manual_data)
            
            return {
                "success": True,
                "data": {
                    "_id": str(result.inserted_id),
                    "temperatura": temperatura,
                    "ph": ph,
                    "oxigeno": oxigeno,
                    "fecha": manual_data['fecha'],
                    "fuente": manual_data['fuente'],
                    "usuario": manual_data['usuario']
                },
                "count": 1,
                "mqtt_status": {
                    "connected": mqtt_connected,
                    "last_message": last_message_time.isoformat() if last_message_time else None
                }
            }, 201
            
        except Exception as e:
            sensores_ns.abort(500, success=False, error=str(e))

@temperatura_ns.route('')
class TemperaturaResource(Resource):
    @temperatura_ns.doc('get_temperatura_only')
    @temperatura_ns.marshal_with(temperatura_response_model, code=200)
    @temperatura_ns.response(500, 'Error interno del servidor', error_model)
    @temperatura_ns.param('sort', 'Orden: asc o desc', type=str, default='desc')
    @ensure_mongodb_connection
    def get(self):
        """
        Datos específicos de temperatura únicamente
        
        Obtiene solo las mediciones de temperatura del agua filtradas desde la base de datos.
        Para obtener todos los sensores juntos se recomienda usar /sensores.
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
    @ph_ns.doc('get_ph_only')
    @ph_ns.marshal_with(ph_response_model, code=200)
    @ph_ns.response(500, 'Error interno del servidor', error_model)
    @ph_ns.param('sort', 'Orden: asc o desc', type=str, default='desc')
    @ensure_mongodb_connection
    def get(self):
        """
        Datos específicos de pH únicamente
        
        Obtiene solo las mediciones de pH (acidez/alcalinidad) filtradas desde la base de datos.
        Rango seguro para acuicultura: 6.5-8.5. Para datos completos usar /sensores.
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
    @oxigeno_ns.doc('get_oxigeno_only')
    @oxigeno_ns.marshal_with(oxigeno_response_model, code=200)
    @oxigeno_ns.response(500, 'Error interno del servidor', error_model)
    @oxigeno_ns.param('sort', 'Orden: asc o desc', type=str, default='desc')
    @ensure_mongodb_connection
    def get(self):
        """
        Datos específicos de oxígeno disuelto únicamente
        
        Obtiene solo las mediciones de oxígeno disuelto (mg/L) filtradas desde la base de datos.
        Nivel crítico para acuicultura: >6 mg/L. Para datos completos usar /sensores.
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
    @mqtt_ns.doc('mqtt_test_publish')
    @mqtt_ns.expect(mqtt_publish_model)
    @mqtt_ns.marshal_with(response_model, code=200)
    @mqtt_ns.response(400, 'Tópico o mensaje inválido', error_model)
    @mqtt_ns.response(500, 'Error de conexión MQTT', error_model)
    def post(self):
        """
        Herramienta de testing para publicación MQTT manual
        
        **Uso recomendado**: Testing, debugging y demostraciones del sistema MQTT.
        Los sensores IoT reales publican automáticamente.
        
        **Tópicos disponibles:**
        - cimarq/sensores/unified: Datos completos (recomendado)
        - cimarq/temperatura/update: Solo temperatura
        - cimarq/ph/update: Solo pH  
        - cimarq/oxigeno/update: Solo oxígeno
        
        Los datos publicados se almacenan en la base de datos y activan alertas.
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
    @health_ns.doc('system_health')
    @health_ns.marshal_with(health_model, code=200)
    @health_ns.response(500, 'Sistema con fallos', health_model)
    def get(self):
        """
        Diagnóstico completo del estado del sistema
        
        Verifica el estado de conexión y funcionamiento de todos los componentes:
        - Base de datos MongoDB
        - Comunicación MQTT  
        - Configuración del sistema
        - Timestamp Chile GMT-3
        
        Útil para monitoreo automático y diagnóstico de problemas.
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

# Modelos para exportación de datos por email
exportacion_email_model = api.model('ExportacionEmail', {
    'destinatario': fields.String(required=True, description='Email del destinatario', example='usuario@ejemplo.com'),
    'asunto': fields.String(required=True, description='Asunto del email', example='Exportación de Datos - Sistema de Monitoreo'),
    'mensaje': fields.String(required=True, description='Mensaje del email', example='Adjunto encontrará los datos exportados del sistema.'),
    'datos_adjuntos': fields.List(fields.Raw, required=True, description='Array de datos a adjuntar'),
    'formato': fields.String(required=True, description='Formato del archivo adjunto', enum=['csv', 'excel'], example='csv'),
    'filtros_aplicados': fields.Raw(description='Información sobre filtros aplicados (opcional)')
})

exportacion_response_model = api.model('ExportacionResponse', {
    'success': fields.Boolean(description='Indica si el envío fue exitoso', example=True),
    'mensaje': fields.String(description='Mensaje de resultado', example='Email enviado exitosamente'),
    'destinatario': fields.String(description='Email de destino confirmado'),
    'registros_enviados': fields.Integer(description='Número de registros adjuntados'),
    'formato_archivo': fields.String(description='Formato del archivo generado'),
    'timestamp': fields.String(description='Timestamp del envío')
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
            
            # Verificar configuración de emails habilitados en base de datos
            config_doc = db.configuracion.find_one({'tipo': 'emails'})
            emails_habilitados = config_doc.get('habilitado', True) if config_doc else True
            
            return {
                'success': True,
                'configuracion': {
                    'email': {
                        'habilitado': config_email and emails_habilitados,
                        'configurado': config_email,
                        'activo': emails_habilitados,
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

@notificaciones_ns.route('/configuracion/emails')
class EmailConfiguracionResource(Resource):
    @notificaciones_ns.doc('actualizar_configuracion_emails')
    @notificaciones_ns.expect(api.model('ConfiguracionEmails', {
        'habilitado': fields.Boolean(required=True, description='¿Enviar notificaciones por email?'),
        'timestamp': fields.String(description='Timestamp de la configuración')
    }))
    @notificaciones_ns.response(200, 'Configuración actualizada exitosamente')
    @notificaciones_ns.response(400, 'Datos inválidos', error_model)
    @notificaciones_ns.response(500, 'Error interno del servidor', error_model)
    def post(self):
        """
        Actualizar configuración de notificaciones por email
        
        Permite activar o desactivar el envío de notificaciones por email.
        """
        try:
            data = request.get_json()
            habilitado = data.get('habilitado', True)
            timestamp = data.get('timestamp', datetime.now(CHILE_TZ).isoformat())
            
            # Actualizar configuración en base de datos
            db.configuracion.update_one(
                {'tipo': 'emails'},
                {
                    '$set': {
                        'tipo': 'emails',
                        'habilitado': habilitado,
                        'timestamp': timestamp,
                        'fecha_actualizacion': datetime.now(CHILE_TZ)
                    }
                },
                upsert=True
            )
            
            # Verificar configuración de email
            config_email = servicio_email.verificar_configuracion()
            
            return {
                'success': True,
                'mensaje': f'Notificaciones por email {"activadas" if habilitado else "desactivadas"}',
                'configuracion': {
                    'habilitado': habilitado,
                    'configurado': config_email,
                    'efectivo': config_email and habilitado
                },
                'timestamp': datetime.now(CHILE_TZ).isoformat()
            }
            
        except Exception as e:
            notificaciones_ns.abort(500, success=False, error=str(e))

@notificaciones_ns.route('/correo-critico')
class NotificacionCorreoCriticoResource(Resource):
    @notificaciones_ns.doc('enviar_correo_critico')
    @notificaciones_ns.response(200, 'Correo crítico enviado exitosamente')
    @notificaciones_ns.response(400, 'Datos de entrada inválidos', error_model)
    @notificaciones_ns.response(500, 'Error interno del servidor', error_model)
    def post(self):
        """
        Enviar correo crítico para alerta automática
        
        Envía un correo electrónico detallado cuando se detecta una alerta crítica 
        en el sistema de monitoreo automático.
        """
        try:
            data = request.get_json()
            
            if not data:
                notificaciones_ns.abort(400, success=False, error='No se proporcionaron datos')
            
            # Preparar datos para el servicio de email
            alerta_data = {
                'sensor': data.get('sensor'),
                'nivel': 'CRITICO',
                'valor_actual': data.get('valor'),
                'mensaje': data.get('mensaje'),
                'fecha_hora': data.get('timestamp'),
                'rangos': data.get('rangos'),
                'acciones_recomendadas': data.get('acciones_recomendadas', []),
                'detalles_tecnicos': data.get('detalles_tecnicos', {}),
                'impacto_ambiental': data.get('impacto_ambiental'),
                'nivel_riesgo': data.get('nivel_riesgo'),
                'fuente': 'monitoreo_automatico'
            }
            
            # Enviar email crítico
            resultado = servicio_email.enviar_alerta_email(alerta_data)
            
            if resultado:
                return {
                    'success': True,
                    'mensaje': 'Correo crítico enviado exitosamente',
                    'timestamp': datetime.now(CHILE_TZ).isoformat(),
                    'detalles': {
                        'sensor': data.get('sensor'),
                        'valor': data.get('valor'),
                        'nivel_riesgo': data.get('nivel_riesgo')
                    }
                }
            else:
                return {
                    'success': False,
                    'mensaje': 'Error al enviar correo crítico',
                    'timestamp': datetime.now(CHILE_TZ).isoformat()
                }
                
        except Exception as e:
            print(f"Error al enviar correo crítico: {str(e)}")
            notificaciones_ns.abort(500, success=False, error=f'Error interno: {str(e)}')

@notificaciones_ns.route('/exportar')
class ExportacionEmailResource(Resource):
    @notificaciones_ns.doc(
        'exportar_datos_email',
        summary='Exportar datos por email',
        description='Envía datos exportados del sistema por email con archivo adjunto en formato CSV o Excel.'
    )
    @notificaciones_ns.expect(exportacion_email_model, validate=True)
    @notificaciones_ns.marshal_with(exportacion_response_model, code=200)
    @notificaciones_ns.response(200, 'Datos exportados y enviados exitosamente', exportacion_response_model)
    @notificaciones_ns.response(400, 'Datos de entrada inválidos o email malformado', error_model)
    @notificaciones_ns.response(413, 'Demasiados datos para enviar por email', error_model)
    @notificaciones_ns.response(500, 'Error interno del servidor o configuración SMTP', error_model)
    @ensure_mongodb_connection
    def post(self):
        """
        Exportar datos por email con archivo adjunto
        
        Genera un archivo CSV o Excel con los datos proporcionados y lo envía
        por email al destinatario especificado. Máximo 1000 registros por envío.
        """
        try:
            data = request.json
            
            # Validaciones básicas
            destinatario = data.get('destinatario')
            datos_adjuntos = data.get('datos_adjuntos', [])
            formato = data.get('formato', 'csv')
            
            # Validar email
            import re
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, destinatario):
                notificaciones_ns.abort(400, success=False, error='Formato de email inválido')
            
            # Validar cantidad de datos
            if len(datos_adjuntos) == 0:
                notificaciones_ns.abort(400, success=False, error='No se proporcionaron datos para exportar')
            
            if len(datos_adjuntos) > 1000:
                notificaciones_ns.abort(413, success=False, 
                    error=f'Demasiados registros ({len(datos_adjuntos)}). Máximo permitido: 1000')
            
            # Generar contenido del archivo según formato
            if formato == 'csv':
                contenido_archivo, nombre_archivo = generar_csv(datos_adjuntos)
            elif formato == 'excel':
                contenido_archivo, nombre_archivo = generar_excel_simple(datos_adjuntos)
            else:
                notificaciones_ns.abort(400, success=False, error='Formato no soportado. Use "csv" o "excel"')
            
            # Preparar datos para el servicio de email
            asunto = data.get('asunto', 'Exportación de Datos - Sistema de Monitoreo')
            mensaje = data.get('mensaje', 'Adjunto encontrará los datos exportados del sistema de monitoreo.')
            
            # Añadir información adicional al mensaje
            mensaje += f"\nTotal de registros: {len(datos_adjuntos)}"
            mensaje += f"\nFecha de generación: {get_chile_time().strftime('%d/%m/%Y %H:%M:%S')}"
            
            # Envío real con servicio_email
            try:
                # Preparar datos para el servicio de email
                email_data = {
                    'destinatario': destinatario,
                    'asunto': asunto,
                    'mensaje': mensaje,
                    'archivo_adjunto': {
                        'contenido': contenido_archivo,
                        'nombre': nombre_archivo,
                        'tipo_mime': 'text/csv' if formato == 'csv' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    }
                }
                
                # Enviar email
                resultado_email = servicio_email.enviar_email_con_adjunto(email_data)
                
                if resultado_email.get('success', False):
                    return {
                        'success': True,
                        'mensaje': f'Email enviado exitosamente a {destinatario}',
                        'destinatario': destinatario,
                        'registros_enviados': len(datos_adjuntos),
                        'formato_archivo': formato,
                        'timestamp': get_chile_time().isoformat()
                    }, 200
                else:
                    raise Exception(resultado_email.get('error', 'Error desconocido al enviar email'))
                    
            except Exception as email_error:
                print(f"Error enviando email: {email_error}")
                # Fallback: retornar éxito pero indicar problema con email
                return {
                    'success': False,
                    'error': f'Error al enviar email: {str(email_error)}',
                    'destinatario': destinatario,
                    'registros_procesados': len(datos_adjuntos),
                    'formato_archivo': formato
                }, 500
                
        except Exception as e:
            print(f"Error en exportación por email: {e}")
            notificaciones_ns.abort(500, success=False, error=str(e))

def generar_csv(datos):
    """Genera contenido CSV compatible usando el módulo csv de Python"""
    if not datos:
        return "", "datos_vacios.csv"
    
    # Crear buffer de memoria para el CSV
    output = io.StringIO()
    
    # Obtener encabezados del primer registro
    encabezados = list(datos[0].keys())
    
    # Configurar writer CSV con formato estándar
    writer = csv.DictWriter(
        output, 
        fieldnames=encabezados,
        dialect='excel',
        quoting=csv.QUOTE_MINIMAL,
        lineterminator='\n'
    )
    
    # Escribir encabezados
    writer.writeheader()
    
    # Escribir datos
    for registro in datos:
        # Procesar cada registro para asegurar compatibilidad
        registro_procesado = {}
        for key, value in registro.items():
            if isinstance(value, datetime):
                # Formatear fechas de manera consistente
                registro_procesado[key] = value.strftime('%Y-%m-%d %H:%M:%S')
            elif isinstance(value, (int, float)):
                # Mantener números como están
                registro_procesado[key] = value
            elif value is None:
                # Convertir None a string vacío
                registro_procesado[key] = ""
            else:
                # Convertir todo lo demás a string
                registro_procesado[key] = str(value)
        
        writer.writerow(registro_procesado)
    
    # Obtener contenido con BOM para compatibilidad con Excel
    contenido = '\ufeff' + output.getvalue()
    output.close()
    
    nombre_archivo = f"datos_sensores_{get_chile_time().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return contenido, nombre_archivo

def generar_excel_simple(datos):
    """Genera un archivo Excel real usando openpyxl"""
    if not datos:
        return b"", "datos_vacios.xlsx"
    
    try:
        # Crear workbook y worksheet
        wb = Workbook()
        ws = wb.active
        ws.title = "Datos Sensores"
        
        # Obtener encabezados del primer registro
        encabezados = list(datos[0].keys())
        
        # Estilo para encabezados
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center")
        
        # Escribir encabezados con estilo
        for col, encabezado in enumerate(encabezados, 1):
            cell = ws.cell(row=1, column=col, value=encabezado)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
        
        # Escribir datos
        for row_idx, registro in enumerate(datos, 2):  # Empezar en fila 2
            for col_idx, key in enumerate(encabezados, 1):
                value = registro.get(key, "")
                
                # Procesar diferentes tipos de datos
                if isinstance(value, datetime):
                    # Excel maneja fechas nativamente
                    ws.cell(row=row_idx, column=col_idx, value=value)
                elif isinstance(value, (int, float)):
                    # Números se mantienen como números
                    ws.cell(row=row_idx, column=col_idx, value=value)
                elif value is None:
                    ws.cell(row=row_idx, column=col_idx, value="")
                else:
                    ws.cell(row=row_idx, column=col_idx, value=str(value))
        
        # Ajustar ancho de columnas automáticamente
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)  # Máximo 50 caracteres
            ws.column_dimensions[column_letter].width = adjusted_width
        
        # Guardar en buffer de memoria
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        contenido = output.getvalue()
        output.close()
        
        nombre_archivo = f"datos_sensores_{get_chile_time().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return contenido, nombre_archivo
        
    except ImportError:
        # Fallback a CSV si openpyxl no está disponible
        print("openpyxl no disponible, generando CSV en su lugar")
        contenido_csv, nombre_csv = generar_csv(datos)
        nombre_excel = nombre_csv.replace('.csv', '.xlsx')
        return contenido_csv.encode('utf-8-sig'), nombre_excel
    except Exception as e:
        print(f"Error generando Excel: {e}")
        # Fallback a CSV en caso de error
        contenido_csv, nombre_csv = generar_csv(datos)
        nombre_excel = nombre_csv.replace('.csv', '.xlsx')
        return contenido_csv.encode('utf-8-sig'), nombre_excel

# Modelo para descarga directa de archivos
descarga_model = api.model('DescargaArchivo', {
    'datos': fields.List(fields.Raw, required=True, description='Array de datos a exportar'),
    'formato': fields.String(required=True, description='Formato del archivo', enum=['csv', 'excel'], example='csv')
})

# Endpoints para descarga directa de archivos
@notificaciones_ns.route('/descargar/csv')
class DescargarCSVResource(Resource):
    @notificaciones_ns.doc(
        'descargar_csv',
        summary='Descargar CSV',
        description='Descarga datos en formato CSV compatible con Excel y otras aplicaciones.'
    )
    @notificaciones_ns.expect(descarga_model)
    def post(self):
        """Descarga datos en formato CSV"""
        try:
            data = request.get_json()
            datos = data.get('datos', [])
            
            if len(datos) == 0:
                return {'success': False, 'error': 'No se proporcionaron datos para exportar'}, 400
            
            if len(datos) > 5000:  # Límite mayor para descarga directa
                return {'success': False, 'error': f'Demasiados registros ({len(datos)}). Máximo permitido: 5000'}, 413
            
            # Generar CSV
            contenido_csv, nombre_archivo = generar_csv(datos)
            
            # Crear respuesta con el archivo
            response = make_response(contenido_csv)
            response.headers['Content-Type'] = 'text/csv; charset=utf-8-sig'
            response.headers['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
            response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'
            
            return response
            
        except Exception as e:
            print(f"Error en descarga CSV: {e}")
            return {'success': False, 'error': str(e)}, 500

@notificaciones_ns.route('/descargar/excel')
class DescargarExcelResource(Resource):
    @notificaciones_ns.doc(
        'descargar_excel',
        summary='Descargar Excel',
        description='Descarga datos en formato Excel nativo (.xlsx) con formato profesional.'
    )
    @notificaciones_ns.expect(descarga_model)
    def post(self):
        """Descarga datos en formato Excel"""
        try:
            data = request.get_json()
            datos = data.get('datos', [])
            
            if len(datos) == 0:
                return {'success': False, 'error': 'No se proporcionaron datos para exportar'}, 400
            
            if len(datos) > 5000:  # Límite mayor para descarga directa
                return {'success': False, 'error': f'Demasiados registros ({len(datos)}). Máximo permitido: 5000'}, 413
            
            # Generar Excel
            contenido_excel, nombre_archivo = generar_excel_simple(datos)
            
            # Crear respuesta con el archivo
            response = make_response(contenido_excel)
            response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            response.headers['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
            response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'
            
            return response
            
        except Exception as e:
            print(f"Error en descarga Excel: {e}")
            return {'success': False, 'error': str(e)}, 500

# ============================================================================
# ENDPOINTS DE AUTENTICACIÓN
# ============================================================================

@auth_ns.route('/login')
class LoginResource(Resource):
    @auth_ns.doc('login_user')
    @auth_ns.expect(login_model, validate=True)
    @auth_ns.response(200, 'Login exitoso', auth_response_model)
    @auth_ns.response(401, 'Credenciales inválidas', error_model)
    @auth_ns.response(500, 'Error interno del servidor', error_model)
    def post(self):
        """
        Iniciar sesión en el sistema
        
        Autentica a un usuario con email y contraseña.
        Retorna un token JWT válido por 24 horas.
        """
        try:
            data = request.get_json()
            email = data.get('email', '').lower().strip()
            password = data.get('password', '')
            
            # Validar entrada
            if not email or not password:
                return {
                    'success': False,
                    'message': 'Email y contraseña son requeridos'
                }, 400
            
            # Buscar usuario en la base de datos
            user = db.usuarios.find_one({'email': email})
            
            if not user:
                return {
                    'success': False,
                    'message': 'Credenciales inválidas'
                }, 401
            
            # Verificar contraseña
            if not verify_password(password, user['password_hash']):
                return {
                    'success': False,
                    'message': 'Credenciales inválidas'
                }, 401
            
            # Generar token JWT
            token = generate_jwt_token(user)
            
            # Preparar datos del usuario (sin contraseña)
            user_data = {
                'id': str(user['_id']),
                'email': user['email'],
                'nombre': user['nombre'],
                'rol': user['rol'],
                'fecha_creacion': user.get('fecha_creacion', '').isoformat() if user.get('fecha_creacion') else None
            }
            
            return {
                'success': True,
                'message': 'Login exitoso',
                'token': token,
                'user': user_data
            }
            
        except Exception as e:
            print(f"Error en login: {e}")
            return {
                'success': False,
                'message': 'Error interno del servidor'
            }, 500

@auth_ns.route('/verify')
class VerifyTokenResource(Resource):
    @auth_ns.doc('verify_token')
    @auth_ns.response(200, 'Token válido', user_model)
    @auth_ns.response(401, 'Token inválido', error_model)
    @require_auth
    def get(self):
        """
        Verificar validez del token JWT
        
        Verifica si el token proporcionado sigue siendo válido.
        Retorna la información del usuario autenticado.
        """
        try:
            user_data = {
                'id': request.current_user['user_id'],
                'email': request.current_user['email'],
                'nombre': request.current_user['nombre'],
                'rol': request.current_user['rol']
            }
            
            return {
                'success': True,
                'user': user_data
            }
            
        except Exception as e:
            print(f"Error verificando token: {e}")
            return {
                'success': False,
                'message': 'Error interno del servidor'
            }, 500

@auth_ns.route('/status')
class AuthStatusResource(Resource):
    @auth_ns.doc('auth_status')
    @auth_ns.response(200, 'Estado de autenticación del sistema')
    def get(self):
        """
        Obtener estado del sistema de autenticación
        
        Verifica si hay usuarios registrados en el sistema.
        Útil para determinar si se necesita configuración inicial.
        """
        try:
            user_count = db.usuarios.count_documents({})
            
            return {
                'success': True,
                'users_registered': user_count > 0,
                'total_users': user_count,
                'needs_setup': user_count == 0,
                'message': 'Sistema listo para usar' if user_count > 0 else 'Sistema requiere configuración inicial'
            }
            
        except Exception as e:
            print(f"Error obteniendo estado de auth: {e}")
            return {
                'success': False,
                'message': 'Error interno del servidor'
            }, 500

@auth_ns.route('/update-profile')
class UpdateProfile(Resource):
    @auth_ns.doc('update_profile')
    @auth_ns.expect(auth_ns.model('UpdateProfile', {
        'nombre': fields.String(required=True, description='Nuevo nombre del usuario'),
        'email': fields.String(required=True, description='Nuevo email del usuario'),
        'currentPassword': fields.String(description='Contraseña actual (requerida para cambiar contraseña)'),
        'newPassword': fields.String(description='Nueva contraseña (opcional)')
    }))
    @require_auth
    def put(self):
        """
        Actualizar perfil de usuario
        Permite actualizar nombre, email y contraseña del usuario autenticado
        """
        try:
            data = request.get_json()
            
            # Obtener usuario actual del token
            current_user = g.current_user
            
            # Validaciones básicas
            if not data.get('nombre') or not data.get('nombre').strip():
                return {'success': False, 'message': 'El nombre es requerido'}, 400
                
            if not data.get('email') or not data.get('email').strip():
                return {'success': False, 'message': 'El email es requerido'}, 400
            
            # Preparar datos de actualización
            update_data = {
                'nombre': data['nombre'].strip(),
                'email': data['email'].strip()
            }
            
            # Si se quiere cambiar la contraseña
            if data.get('newPassword'):
                if not data.get('currentPassword'):
                    return {'success': False, 'message': 'Contraseña actual requerida'}, 400
                
                # Verificar contraseña actual
                current_user_db = db.usuarios.find_one({'email': current_user['email']})
                if not current_user_db:
                    return {'success': False, 'message': 'Usuario no encontrado'}, 404
                
                # Verificar contraseña actual
                current_password_hash = hashlib.sha256(data['currentPassword'].encode()).hexdigest()
                if current_password_hash != current_user_db['password_hash']:
                    return {'success': False, 'message': 'Contraseña actual incorrecta'}, 400
                
                # Validar nueva contraseña
                if len(data['newPassword']) < 6:
                    return {'success': False, 'message': 'La nueva contraseña debe tener al menos 6 caracteres'}, 400
                
                # Hash de la nueva contraseña
                update_data['password_hash'] = hashlib.sha256(data['newPassword'].encode()).hexdigest()
            
            # Verificar si el email ya existe (si se está cambiando)
            if data['email'] != current_user['email']:
                existing_user = db.usuarios.find_one({'email': data['email']})
                if existing_user and str(existing_user['_id']) != str(current_user['_id']):
                    return {'success': False, 'message': 'El email ya está en uso'}, 400
            
            # Actualizar usuario en la base de datos
            result = db.usuarios.update_one(
                {'email': current_user['email']},
                {'$set': update_data}
            )
            
            if result.modified_count == 0:
                return {'success': False, 'message': 'No se realizaron cambios'}, 400
            
            # Obtener usuario actualizado
            updated_user = db.usuarios.find_one({'email': data['email']})
            if not updated_user:
                return {'success': False, 'message': 'Error al obtener usuario actualizado'}, 500
            
            # Generar nuevo token con datos actualizados
            user_data = {
                '_id': str(updated_user['_id']),
                'email': updated_user['email'],
                'nombre': updated_user['nombre'],
                'rol': updated_user['rol']
            }
            
            new_token = generate_jwt_token(user_data)
            
            return {
                'success': True,
                'message': 'Perfil actualizado correctamente',
                'user': {
                    'id': user_data['_id'],
                    'email': user_data['email'],
                    'nombre': user_data['nombre'],
                    'rol': user_data['rol']
                },
                'token': new_token
            }
            
        except Exception as e:
            print(f"Error actualizando perfil: {e}")
            return {
                'success': False,
                'message': 'Error interno del servidor'
            }, 500



# ============================================================================
# ENDPOINT DE ESTADO GENERAL (sin autenticación requerida)
# ============================================================================

@app.route('/api/v1/estado')
def estado_sistema():
    """Endpoint simple para verificar conectividad del backend"""
    return jsonify({
        'success': True,
        'message': 'Backend funcionando correctamente',
        'timestamp': datetime.now(CHILE_TZ).isoformat(),
        'version': '2.0'
    })

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