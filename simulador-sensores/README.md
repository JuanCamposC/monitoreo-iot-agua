# 🐟 Simulador IoT CIMARQ - Acuicultura Zona Central Chile

Simulador robusto y realista de sensores IoT que **reemplaza completamente el hardware físico** manteniendo compatibilidad total con el backend existente.

## 🎯 Características Principales

### ✅ **Integración Perfecta con Backend**
- Usa **configuración idéntica** del backend (MongoDB y MQTT)
- **No crea colecciones nuevas** - usa las existentes
- **Formato de datos exacto** al hardware real
- Monta configuración del backend como volumen

### ✅ **Simulación Realista - Zona Central Chile**
- 🌡️ **Temperatura**: 12-20°C con variaciones diurnas/estacionales suaves
- ⚗️ **pH**: 7.5-8.3 con ciclos de fotosíntesis/respiración natural  
- 🫧 **Oxígeno Disuelto**: 5-9 mg/L con dependencia de temperatura
- **Tendencias progresivas** - no valores aleatorios puros

### ✅ **Operación Continua 24/7**
- Publicación **cada 5 minutos exactos** (300s)
- **Múltiples sensores** configurables (por defecto 3)
- **Auto-reconexión** robusta ante fallos
- **Logging completo** con rotación automática

### ✅ **Dockerización Completa**
- `docker-compose up -d` y listo
- **Múltiples perfiles**: producción, desarrollo, monitoreo
- **Health checks** automáticos
- **Límites de recursos** para producción

## 🚀 Inicio Rápido

### Opción 1: Producción (Recomendada)

```bash
# Desde el directorio simulador-sensores
cd simulador-sensores

# Ejecutar (usa configuración del backend automáticamente)
docker-compose up -d

# Verificar funcionamiento
docker-compose logs -f cimarq-iot-simulator
```

### Opción 2: Desarrollo Local

```bash
# Con servicios locales (MongoDB + MQTT)
docker-compose --profile dev up -d

# Acceso local:
# MongoDB: localhost:27017
# MQTT: localhost:1883
```

### Opción 3: Scripts de Conveniencia

**Windows:**
```cmd
start.bat prod    # Producción
start.bat dev     # Desarrollo
start.bat logs    # Ver logs
start.bat stop    # Detener
```

**Linux/macOS:**
```bash
./start.sh prod   # Producción
./start.sh dev    # Desarrollo  
./start.sh logs   # Ver logs
./start.sh stop   # Detener
```

## ⚙️ Configuración

### Variables de Entorno (Idénticas al Backend)

El simulador lee automáticamente la configuración desde `../backend/.env`, pero también puedes usar un `.env` local:

```env
# MongoDB (exactas del backend)
MONGO_URI=mongodb+srv://cimarq:eGEr87FyYHIadm4p@proyectotitulo.idqwtmo.mongodb.net/
DB_NAME=cimarq

# MQTT (exactas del backend)
MQTT_BROKER=test.mosquitto.org
MQTT_PORT=1883

# Tópicos (exactos del backend)
TEMPERATURA_TOPIC=cimarq/temperatura/update
PH_TOPIC=cimarq/ph/update
OXIGENO_TOPIC=cimarq/oxigeno/update

# Simulación
SIMULATION_INTERVAL=300  # 5 minutos
NUM_SENSORS=3           # Número de sensores
```

### Personalización Avanzada

```env
# Cambiar intervalo (segundos)
SIMULATION_INTERVAL=120  # 2 minutos

# Más sensores
NUM_SENSORS=5           # 5 sensores independientes

# Para testing rápido
SIMULATION_INTERVAL=30  # 30 segundos
```

## 📊 Datos Generados

### Formato Idéntico al Hardware Real

```json
{
  "device_id": "sensor_001",
  "fecha": "2025-10-11T15:30:45.123Z", 
  "timestamp": 1728658245123,
  "temperatura": 15.8,
  "valor": 15.8
}
```

### Colecciones MongoDB Utilizadas

- **`temperatura`** - Datos de temperatura del agua
- **`ph`** - Mediciones de pH marino  
- **`oxigeno`** - Oxígeno disuelto

### Rangos Realistas (Valparaíso/Quintay)

| Parámetro | Rango | Óptimo | Variación Diaria |
|-----------|-------|---------|-----------------|
| **Temperatura** | 12-20°C | 16°C | ±1.5°C |
| **pH** | 7.5-8.3 | 7.9 | ±0.15 |
| **Oxígeno** | 5-9 mg/L | 7.0 mg/L | ±1.5 mg/L |

## 🔄 Patrones de Simulación

### Variaciones Naturales Implementadas

- **🌅 Ciclo Diario**: Temperatura máxima 15:00, mínima 06:00
- **🌊 pH Diario**: Máximo mediodía (fotosíntesis), mínimo amanecer
- **🫧 O₂ vs Temperatura**: Relación inversa realista
- **📅 Estacional**: Verano más caliente, invierno más frío
- **📈 Tendencias**: Cambios graduales, no saltos abruptos

### Múltiples Sensores

Cada sensor tiene:
- **ID único**: `sensor_001`, `sensor_002`, `sensor_003`...
- **Variaciones individuales** ligeramente diferentes
- **Tendencias independientes** pero correlacionadas

## 🐳 Perfiles Docker

### Producción (Por Defecto)
```bash
docker-compose up -d
```
- Usa servicios externos (MongoDB Atlas, MQTT público)
- Mínimo uso de recursos
- Logs optimizados

### Desarrollo
```bash
docker-compose --profile dev up -d
```
- MongoDB local en puerto 27017
- MQTT local en puerto 1883
- Ideal para testing

### Monitoreo
```bash
docker-compose --profile monitor up -d
```
- Incluye monitor de logs en tiempo real
- Para debugging avanzado

## 📈 Monitoreo y Logs

### Ver Logs en Tiempo Real
```bash
# Logs del simulador
docker-compose logs -f cimarq-iot-simulator

# Logs de todos los servicios
docker-compose logs -f
```

### Verificar Estado
```bash
# Estado de contenedores
docker-compose ps

# Uso de recursos
docker stats cimarq-iot-simulator

# Health check
docker-compose exec cimarq-iot-simulator python -c "print('✅ Simulador funcionando')"
```

### Archivos de Log
- **Contenedor**: `/app/simulador_iot.log`
- **Host**: `./logs/simulador_iot.log`
- **Rotación**: Automática (10MB, 5 archivos)

## 🔧 Desarrollo y Personalización

### Estructura del Proyecto

```
simulador-sensores/
├── simulador-mqtt.py          # Código principal del simulador
├── requirements.txt           # Dependencias Python
├── Dockerfile                 # Imagen Docker optimizada
├── docker-compose.yml         # Orquestación completa
├── .env.example              # Configuración de ejemplo
├── mosquitto.conf            # Config MQTT para desarrollo
├── start.bat / start.sh      # Scripts de inicio
├── .dockerignore            # Exclusiones Docker
└── README.md                # Esta documentación
```

### Modificar Parámetros de Simulación

Edita directamente en `simulador-mqtt.py`:

```python
# Cambiar rangos de temperatura
'temperatura': {
    'base': 16.0,              # °C base
    'daily_amplitude': 1.5,    # Variación diaria
    'seasonal_amplitude': 4.0, # Variación estacional
    'min': 12.0, 'max': 20.0, # Límites absolutos
}
```

### Agregar Nuevos Tipos de Sensores

```python
# En setup_sensor_parameters()
'nuevo_sensor': {
    'base': 25.0,
    'daily_amplitude': 2.0,
    # ... más parámetros
}

# En run_simulation_cycle()
nuevo_valor = self.simulate_nuevo_sensor(sensor_id)
nuevo_data = self.create_sensor_data("nuevo_sensor", nuevo_valor, sensor_id)
self.save_to_mongodb("nuevo_collection", nuevo_data)
```

## 🛠️ Troubleshooting

### Problemas Comunes

#### ❌ "No se pudo conectar a MongoDB"
```bash
# Verificar configuración
docker-compose exec cimarq-iot-simulator env | grep MONGO

# Probar conexión manual
docker-compose exec cimarq-iot-simulator python -c "
from pymongo import MongoClient
import os
client = MongoClient(os.getenv('MONGO_URI'))
client.admin.command('ping')
print('✅ MongoDB OK')
"
```

#### ❌ "MQTT no conecta"
```bash
# Verificar broker
docker-compose logs cimarq-iot-simulator | grep MQTT

# Probar broker alternativo
docker-compose down
# Editar .env: MQTT_BROKER=broker.hivemq.com
docker-compose up -d
```

#### ❌ "Contenedor se reinicia constantemente"
```bash
# Ver logs detallados
docker-compose logs cimarq-iot-simulator

# Verificar recursos
docker stats cimarq-iot-simulator

# Modo debug
docker-compose exec cimarq-iot-simulator bash
python simulador-iot.py
```

### Comandos de Diagnóstico

```bash
# Estado completo
docker-compose ps
docker-compose top

# Verificar configuración montada
docker-compose exec cimarq-iot-simulator cat /app/.env

# Test de conectividad
docker-compose exec cimarq-iot-simulator ping -c 3 google.com

# Reinicio limpio
docker-compose down && docker-compose pull && docker-compose up -d
```

## 📋 Requisitos del Sistema

### Mínimos
- **Docker**: >= 20.10
- **Docker Compose**: >= 2.0
- **RAM**: 128MB
- **CPU**: 0.1 core
- **Disco**: 200MB

### Recomendados
- **RAM**: 256MB  
- **CPU**: 0.5 core
- **Red**: Conexión estable a Internet

## 🔒 Seguridad

### Mejores Prácticas Implementadas
- ✅ Usuario no-root en contenedor
- ✅ Variables sensibles via variables de entorno
- ✅ Red aislada con bridge personalizado
- ✅ Límites de recursos para prevenir DoS
- ✅ Health checks para detección temprana de fallos

### Para Producción
```bash
# Usar secretos Docker (recomendado)
echo "tu_mongo_uri" | docker secret create mongo_uri -

# Configurar red externa
docker network create cimarq-production
```

## 🤝 Integración con Backend

### Verificación de Compatibilidad

```bash
# 1. El simulador debe usar las mismas variables que el backend
diff ../backend/.env .env

# 2. Los tópicos MQTT deben coincidir
grep "TOPIC" ../backend/.env .env

# 3. Las colecciones MongoDB deben existir
# (El simulador las crea automáticamente si no existen)
```

### Testing de Integración

```bash
# 1. Levantar backend
cd ../backend && docker-compose up -d

# 2. Levantar simulador  
cd ../simulador-sensores && docker-compose up -d

# 3. Verificar datos en el dashboard
curl http://localhost:5000/api/v1/sensores

# 4. Verificar MQTT (opcional)
# Instalar mosquitto-clients y suscribirse:
# mosquitto_sub -h test.mosquitto.org -t "cimarq/+/update"
```

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

## 🆘 Soporte

### Documentación Adicional
- [Backend CIMARQ](../backend/README.md)
- [Frontend Dashboard](../frontend/README.md)
- [Docker Compose Reference](https://docs.docker.com/compose/)

### Contacto
Para problemas o sugerencias, crear un issue en el repositorio.

---

**🌊 Desarrollado para CIMARQ**  
*Simulando el futuro de la acuicultura sustentable en Chile* 🇨🇱