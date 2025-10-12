#!/bin/bash

echo "🐟 CIMARQ - Análisis Predictivo de Sensores IoT"
echo "==============================================="
echo "📊 Predicción a 24 horas con Docker"
echo "📁 Resultados guardados en carpeta /resultados"
echo

# Verificar Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker no está ejecutándose"
    echo "💡 Inicia Docker y ejecuta este script nuevamente"
    exit 1
fi

echo "✅ Docker detectado"

# Verificar CSV
if [ ! -f "brisbane_water_quality.csv" ]; then
    echo "❌ Archivo CSV no encontrado: brisbane_water_quality.csv"
    echo "💡 Asegúrate de tener el dataset en esta carpeta"
    exit 1
fi

echo "✅ Dataset encontrado"
echo
echo "🚀 Iniciando análisis ML con Docker..."
echo "⏱️ Esto puede tomar varios minutos..."
echo

# Ejecutar análisis
docker-compose up --build

echo
echo "✅ Análisis completado"
echo "📁 Revisa la carpeta 'resultados' para ver:"
echo "   • Reporte comparativo (.txt)"
echo "   • Datos completos (.json)"
echo "   • Gráficos (.png)"
echo
echo "🎯 Usa el reporte .txt para elegir el mejor modelo"