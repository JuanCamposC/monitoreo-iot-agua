# Dockerfile para Simulador IoT CIMARQ
# Imagen optimizada para producción 24/7

FROM python:3.11-slim

# Metadatos
LABEL maintainer="CIMARQ Team"
LABEL description="Simulador IoT para sensores de acuicultura marina - Zona Central Chile"
LABEL version="1.0"

# Variables de entorno
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV TZ=America/Santiago

# Instalar dependencias del sistema y configurar timezone
RUN apt-get update && apt-get install -y \
    gcc \
    tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

# Crear directorio de trabajo
WORKDIR /app

# Copiar y instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY simulador-mqtt.py ./simulador-iot.py

# Crear directorio para logs
RUN mkdir -p /app/logs

# Crear usuario no-root para seguridad
RUN adduser --disabled-password --gecos '' --shell /bin/bash appuser \
    && chown -R appuser:appuser /app
USER appuser

# Exponer puerto para health check (opcional)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import sys; import os; sys.exit(0 if os.path.exists('/app/simulador_iot.log') else 1)"

# Comando por defecto
CMD ["python", "simulador-iot.py"]