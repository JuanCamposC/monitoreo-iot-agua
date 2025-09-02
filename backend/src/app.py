from flask import Flask, jsonify, request
from flask_cors import CORS
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

# Configuración MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://cimarq:eGEr87FyYHIadm4p@proyectotitulo.idqwtmo.mongodb.net/")
client = MongoClient(MONGO_URI)
db = client.cimarq

# Variables globales para MQTT
mqtt_client = None
mqtt_connected = False
last_message_time = None

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
        # Suscribirse a los tópicos
        client.subscribe("tu_proyecto/temperatura/update")
        client.subscribe("tu_proyecto/ph/update") 
        client.subscribe("tu_proyecto/oxigeno/update")
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
        
        # Conectar al broker (usando HiveMQ como en tu frontend)
        mqtt_client.connect("broker.hivemq.com", 1883, 60)
        mqtt_client.loop_start()
        print("Cliente MQTT iniciado")
    except Exception as e:
        print(f"Error iniciando MQTT: {e}")

# Endpoints existentes simplificados
@app.route('/')
def home():
    return jsonify({
        "message": "API CIMARQ Funcionando",
        "mqtt_connected": mqtt_connected,
        "last_message": last_message_time.isoformat() if last_message_time else None
    })

@app.route('/sensores', methods=['GET'])
def get_sensores():
    try:
        # Obtener últimos 50 registros de cada sensor ordenados por fecha
        temperatura = list(db.temperatura.find().sort("fecha", -1).limit(50))
        ph = list(db.ph.find().sort("fecha", -1).limit(50))
        oxigeno = list(db.oxigeno.find().sort("fecha", -1).limit(50))
        
        # Serializar ObjectIds
        for doc in temperatura:
            doc['_id'] = str(doc['_id'])
        for doc in ph:
            doc['_id'] = str(doc['_id'])
        for doc in oxigeno:
            doc['_id'] = str(doc['_id'])
            
        return jsonify({
            "success": True, 
            "data": {
                "temperatura": temperatura, 
                "ph": ph, 
                "oxigeno": oxigeno
            },
            "mqtt_status": {
                "connected": mqtt_connected,
                "last_message": last_message_time.isoformat() if last_message_time else None
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Endpoints individuales para cada sensor
@app.route('/temperatura', methods=['GET'])
def get_temperatura():
    try:
        limit = request.args.get('limit', 50, type=int)
        temperatura = list(db.temperatura.find().sort("fecha", -1).limit(limit))
        
        for doc in temperatura:
            doc['_id'] = str(doc['_id'])
            
        return jsonify({
            "success": True, 
            "data": temperatura,
            "count": len(temperatura),
            "mqtt_status": {
                "connected": mqtt_connected,
                "last_message": last_message_time.isoformat() if last_message_time else None
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/ph', methods=['GET'])
def get_ph():
    try:
        limit = request.args.get('limit', 50, type=int)
        ph = list(db.ph.find().sort("fecha", -1).limit(limit))
        
        for doc in ph:
            doc['_id'] = str(doc['_id'])
            
        return jsonify({
            "success": True, 
            "data": ph,
            "count": len(ph),
            "mqtt_status": {
                "connected": mqtt_connected,
                "last_message": last_message_time.isoformat() if last_message_time else None
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/oxigeno', methods=['GET'])
def get_oxigeno():
    try:
        limit = request.args.get('limit', 50, type=int)
        oxigeno = list(db.oxigeno.find().sort("fecha", -1).limit(limit))
        
        for doc in oxigeno:
            doc['_id'] = str(doc['_id'])
            
        return jsonify({
            "success": True, 
            "data": oxigeno,
            "count": len(oxigeno),
            "mqtt_status": {
                "connected": mqtt_connected,
                "last_message": last_message_time.isoformat() if last_message_time else None
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/sensores/latest', methods=['GET'])
def get_latest_readings():
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
            
        return jsonify({
            "success": True, 
            "data": result,
            "mqtt_status": {
                "connected": mqtt_connected,
                "last_message": last_message_time.isoformat() if last_message_time else None
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/mqtt/publish', methods=['POST'])
def publish_mqtt():
    try:
        data = request.get_json()
        topic = data.get('topic')
        message = data.get('message')
        
        if mqtt_client and mqtt_connected:
            mqtt_client.publish(topic, json.dumps(message))
            return jsonify({"success": True, "message": "Mensaje publicado"})
        else:
            return jsonify({"success": False, "error": "MQTT no conectado"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Iniciar MQTT en un hilo separado
    mqtt_thread = threading.Thread(target=init_mqtt)
    mqtt_thread.daemon = True
    mqtt_thread.start()
    
    # Esperar un poco para que MQTT se conecte
    time.sleep(2)
    
    app.run(debug=True, host='0.0.0.0', port=5000)