# 🐳 API de Sensores IoT - Docker

API para monitoreo de sensores de calidad del agua (temperatura, pH y oxígeno disuelto) con MongoDB y MQTT en la nube.

## 🚀 Comandos Básicos

### Iniciar la API
```bash
# Desarrollo (con logs visibles)
docker-compose up --build

# Producción (en segundo plano)
docker-compose -f docker-compose.prod.yml up --build -d
```

### Detener la API
```bash
# Detener contenedores
docker-compose down

# Detener y limpiar todo
docker-compose down --rmi all --volumes
```

## 📋 Configuración

1. **Configurar variables de entorno:**
   ```bash
   copy .env.example .env
   # Editar .env con credenciales reales
   ```

2. **Verificar estado:**
   ```bash
   # Ver logs
   docker-compose logs -f
   
   # Health check
   curl http://localhost:5000/api/v1/health
   ```

## 🌐 Endpoints de la API

### **� Documentación Interactiva**
- **Swagger UI**: `http://localhost:5000/docs/`

### **🏠 Endpoints Principales**
- **API Base**: `http://localhost:5000/`
- **Health Check**: `http://localhost:5000/api/v1/health`

### **📊 Datos de Sensores**
- **Todos los sensores**: `http://localhost:5000/api/v1/sensores`
- **Últimas lecturas**: `http://localhost:5000/api/v1/sensores/latest`
- **🌡️ Temperatura**: `http://localhost:5000/api/v1/temperatura`
- **⚗️ pH**: `http://localhost:5000/api/v1/ph`
- **💧 Oxígeno**: `http://localhost:5000/api/v1/oxigeno`

### **� MQTT**
- **Publicar mensaje**: `POST http://localhost:5000/api/v1/mqtt/publish`

### **🔧 Parámetros Disponibles**
```bash
# Limitar resultados
curl "http://localhost:5000/api/v1/temperatura?limit=10"

# Ordenar (asc/desc)
curl "http://localhost:5000/api/v1/ph?limit=5&sort=asc"

# Combinar parámetros
curl "http://localhost:5000/api/v1/sensores?limit=20"
```

## � Ejemplos de Uso

### Obtener datos de temperatura
```bash
curl http://localhost:5000/api/v1/temperatura?limit=5
```

### Verificar estado de la API
```bash
curl http://localhost:5000/api/v1/health
```

### Publicar datos vía MQTT
```bash
curl -X POST http://localhost:5000/api/v1/mqtt/publish \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "cimarq/temperatura/update",
    "message": {"temperatura": 25.5}
  }'
```

## 🔧 Comandos de Mantenimiento

```bash
# Ver logs en tiempo real
docker-compose logs -f api

# Acceder al contenedor
docker exec -it sensores-api bash

# Ver estadísticas de recursos
docker stats sensores-api

# Reiniciar contenedor
docker-compose restart api
```

## � Notas

- **Puerto**: La API corre en el puerto 5000
- **Servicios externos**: MongoDB Atlas y Mosquitto MQTT (configurados en `.env`)
- **Documentación**: Disponible en `/docs/` con interfaz interactiva
- **Versionado**: API v1 con prefijo `/api/v1/`