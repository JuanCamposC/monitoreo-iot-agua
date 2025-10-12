FROM python:3.11-slim

WORKDIR /app

# Variables de entorno para reducir warnings
ENV PYTHONUNBUFFERED=1
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV PYTHONWARNINGS=ignore

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias de Python
COPY requirements_ml.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements_ml.txt

# Copiar archivos de la aplicación
COPY . .

# Crear carpeta de resultados
RUN mkdir -p /app/resultados

# Verificar instalación
RUN python verificar_sistema.py

# Comando por defecto
CMD ["python", "analisis_predictivo_sensores.py"]