#!/bin/bash

# Script para abrir la documentación de Swagger en el navegador

echo "🚀 Abriendo documentación de Swagger..."
echo "📖 URL: http://localhost:5000/docs/"
echo ""
echo "Endpoints disponibles:"
echo "📊 Todos los sensores: http://localhost:5000/api/v1/sensores"
echo "🌡️  Temperatura: http://localhost:5000/api/v1/temperatura"
echo "⚗️  pH: http://localhost:5000/api/v1/ph"
echo "💧 Oxígeno: http://localhost:5000/api/v1/oxigeno"
echo "📡 MQTT Publish: http://localhost:5000/api/v1/mqtt/publish"
echo "🏥 Health Check: http://localhost:5000/api/v1/health"
echo ""

# Detectar el sistema operativo y abrir el navegador
if command -v xdg-open > /dev/null; then
    # Linux
    xdg-open http://localhost:5000/docs/
elif command -v open > /dev/null; then
    # macOS
    open http://localhost:5000/docs/
elif command -v start > /dev/null; then
    # Windows (Git Bash)
    start http://localhost:5000/docs/
else
    echo "⚠️  No se pudo detectar el comando para abrir el navegador"
    echo "🌐 Abre manualmente: http://localhost:5000/docs/"
fi

echo ""
echo "✨ ¡Disfruta la documentación interactiva de Swagger!"