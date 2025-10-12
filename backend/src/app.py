from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_restx import Api, Resource, fields, Namespace
from pymongo import MongoClient
from bson import ObjectId
import json
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import paho.mqtt.client as mqtt
import threading
import time

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuración de Swagger/OpenAPI
api = Api(
    app,
    version='1.0',
    title='API de Sensores IoT CIMARQ',
    description='API para monitoreo de sensores de calidad del agua: temperatura, pH y oxígeno disuelto',
    doc='/docs/',  # URL de la documentación
    prefix='/api/v1'
)

# Configuración MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://cimarq:eGEr87FyYHIadm4p@proyectotitulo.idqwtmo.mongodb.net/")
DB_NAME = os.getenv("DB_NAME", "cimarq")

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

# Definir namespaces para organizar endpoints
sensores_ns = Namespace('sensores', description='Endpoints para todos los sensores')
temperatura_ns = Namespace('temperatura', description='Endpoints para sensor de temperatura')
ph_ns = Namespace('ph', description='Endpoints para sensor de pH')
oxigeno_ns = Namespace('oxigeno', description='Endpoints para sensor de oxígeno disuelto')
mqtt_ns = Namespace('mqtt', description='Endpoints para publicación MQTT')
health_ns = Namespace('health', description='Endpoints de monitoreo y estado')

# Registrar namespaces
api.add_namespace(sensores_ns, path='/sensores')
api.add_namespace(temperatura_ns, path='/temperatura')
api.add_namespace(ph_ns, path='/ph')
api.add_namespace(oxigeno_ns, path='/oxigeno')
api.add_namespace(mqtt_ns, path='/mqtt')
api.add_namespace(health_ns, path='/health')

# Modelos para documentación
sensor_data_model = api.model('SensorData', {
    '_id': fields.String(description='ID único del registro'),
    'fecha': fields.String(description='Fecha y hora del registro'),
    'sensor_id': fields.String(description='ID del sensor (opcional)')
})

temperatura_model = api.inherit('TemperaturaData', sensor_data_model, {
    'temperatura': fields.Float(required=True, description='Temperatura en grados Celsius', example=23.5)
})

ph_model = api.inherit('PHData', sensor_data_model, {
    'ph': fields.Float(required=True, description='Valor de pH', example=7.2)
})

oxigeno_model = api.inherit('OxigenoData', sensor_data_model, {
    'oxigeno': fields.Float(required=True, description='Oxígeno disuelto en mg/L', example=8.5)
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
    'status': fields.String(description='Estado general (healthy/unhealthy)'),
    'mongodb': fields.String(description='Estado de conexión a MongoDB'),
    'mqtt': fields.String(description='Estado de conexión a MQTT'),
    'mongodb_collections': fields.Integer(description='Número de colecciones en MongoDB'),
    'timestamp': fields.String(description='Timestamp del check'),
    'environment': fields.Raw(description='Información del entorno')
})

mqtt_publish_model = api.model('MQTTPublish', {
    'topic': fields.String(required=True, description='Tópico MQTT', example='cimarq/temperatura/update'),
    'message': fields.Raw(required=True, description='Mensaje a publicar', example={'temperatura': 25.0})
})

def serializa_doc(doc):
    if doc:
        doc['_id'] = str(doc['_id'])
    return doc

# Funciones MQTT
def on_connect(client, userdata, flags, rc):
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        print("Conectado al broker MQTT")
        # Suscribirse a los tópicos usando variables de entorno
        client.subscribe(TEMPERATURA_TOPIC)
        client.subscribe(PH_TOPIC) 
        client.subscribe(OXIGENO_TOPIC)
        print(f"Suscrito a tópicos: {TEMPERATURA_TOPIC}, {PH_TOPIC}, {OXIGENO_TOPIC}")
    else:
        mqtt_connected = False
        print(f"Error de conexión MQTT: {rc}")

def on_message(client, userdata, msg):
    global last_message_time
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        last_message_time = datetime.now()
        
        print(f"Mensaje recibido en {topic}: {payload}")
        
        # Agregar timestamp si no existe
        if 'fecha' not in payload:
            payload['fecha'] = datetime.now().isoformat()
            
        # Guardar en MongoDB según el tópico
        if "temperatura" in topic:
            if 'temperatura' in payload or 'valor' in payload:
                db.temperatura.insert_one(payload)
                print(f"Temperatura guardada: {payload}")
                
        elif "ph" in topic:
            if 'ph' in payload or 'valor' in payload:
                db.ph.insert_one(payload)
                print(f"pH guardado: {payload}")
                
        elif "oxigeno" in topic:
            if 'oxigeno' in payload or 'valor' in payload:
                db.oxigeno.insert_one(payload)
                print(f"Oxígeno guardado: {payload}")
                
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
    @sensores_ns.marshal_with(response_model, code=200)
    @sensores_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def get(self):
        """Obtiene datos de todos los sensores (temperatura, pH y oxígeno)"""
        try:
            temperatura = list(db.temperatura.find().sort("fecha", -1))
            ph = list(db.ph.find().sort("fecha", -1))
            oxigeno = list(db.oxigeno.find().sort("fecha", -1))
            
            # Serializar ObjectIds
            for doc in temperatura:
                doc['_id'] = str(doc['_id'])
            for doc in ph:
                doc['_id'] = str(doc['_id'])
            for doc in oxigeno:
                doc['_id'] = str(doc['_id'])
                
            return {
                "success": True,
                "data": {
                    "temperatura": temperatura, 
                    "ph": ph, 
                    "oxigeno": oxigeno
                },
                "count": {
                    "temperatura": len(temperatura),
                    "ph": len(ph),
                    "oxigeno": len(oxigeno)
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
    @temperatura_ns.marshal_with(response_model, code=200)
    @temperatura_ns.response(500, 'Error interno del servidor', error_model)
    @temperatura_ns.param('sort', 'Orden: asc o desc', type=str, default='desc')
    @ensure_mongodb_connection
    def get(self):
        """Obtiene datos del sensor de temperatura"""
        try:
            sort_order = request.args.get('sort', 'desc', type=str)
            
            sort_direction = -1 if sort_order == 'desc' else 1
            temperatura = list(db.temperatura.find().sort("fecha", sort_direction))
            
            for doc in temperatura:
                doc['_id'] = str(doc['_id'])
                
            return {
                "success": True,
                "data": temperatura,
                "count": len(temperatura),
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
    @ph_ns.marshal_with(response_model, code=200)
    @ph_ns.response(500, 'Error interno del servidor', error_model)
    @ph_ns.param('sort', 'Orden: asc o desc', type=str, default='desc')
    @ensure_mongodb_connection
    def get(self):
        """Obtiene datos del sensor de pH"""
        try:
            sort_order = request.args.get('sort', 'desc', type=str)
            
            sort_direction = -1 if sort_order == 'desc' else 1
            ph = list(db.ph.find().sort("fecha", sort_direction))
            
            for doc in ph:
                doc['_id'] = str(doc['_id'])
                
            return {
                "success": True, 
                "data": ph,
                "count": len(ph),
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
    @oxigeno_ns.marshal_with(response_model, code=200)
    @oxigeno_ns.response(500, 'Error interno del servidor', error_model)
    @oxigeno_ns.param('sort', 'Orden: asc o desc', type=str, default='desc')
    @ensure_mongodb_connection
    def get(self):
        """Obtiene datos del sensor de oxígeno disuelto"""
        try:
            sort_order = request.args.get('sort', 'desc', type=str)
            
            sort_direction = -1 if sort_order == 'desc' else 1
            oxigeno = list(db.oxigeno.find().sort("fecha", sort_direction))
            
            for doc in oxigeno:
                doc['_id'] = str(doc['_id'])
                
            return {
                "success": True, 
                "data": oxigeno,
                "count": len(oxigeno),
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
    @sensores_ns.marshal_with(response_model, code=200)
    @sensores_ns.response(500, 'Error interno del servidor', error_model)
    @ensure_mongodb_connection
    def get(self):
        """Obtiene las últimas lecturas de todos los sensores"""
        try:
            latest_temp = db.temperatura.find_one({}, sort=[("fecha", -1)])
            latest_ph = db.ph.find_one({}, sort=[("fecha", -1)])
            latest_oxigeno = db.oxigeno.find_one({}, sort=[("fecha", -1)])
            
            result = {}
            if latest_temp:
                latest_temp['_id'] = str(latest_temp['_id'])
                result['temperatura'] = latest_temp
            if latest_ph:
                latest_ph['_id'] = str(latest_ph['_id'])
                result['ph'] = latest_ph
            if latest_oxigeno:
                latest_oxigeno['_id'] = str(latest_oxigeno['_id'])
                result['oxigeno'] = latest_oxigeno
                
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
        """Publica un mensaje a un tópico MQTT específico"""
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
                        "timestamp": datetime.now().isoformat()
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
        """Verifica el estado de salud de la API y sus dependencias"""
        health_status = {
            "status": "healthy",
            "mongodb": "disconnected",
            "mqtt": "disconnected",
            "timestamp": datetime.now().isoformat(),
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

if __name__ == '__main__':
    # Iniciar MQTT en un hilo separado
    mqtt_thread = threading.Thread(target=init_mqtt)
    mqtt_thread.daemon = True
    mqtt_thread.start()
    
    # Esperar un poco para que MQTT se conecte
    time.sleep(2)
    
    app.run(debug=True, host='0.0.0.0', port=5000)