# 🐟 CIMARQ - Script PowerShell para Análisis ML

Write-Host "🐟 CIMARQ - Análisis Predictivo de Sensores IoT" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host "📊 Predicción a 24 horas con Docker" -ForegroundColor Cyan
Write-Host "📁 Resultados guardados en carpeta /resultados" -ForegroundColor Cyan
Write-Host ""

# Verificar Docker
try {
    docker info | Out-Null
    Write-Host "✅ Docker detectado" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker no está ejecutándose" -ForegroundColor Red
    Write-Host "💡 Inicia Docker Desktop y ejecuta este script nuevamente" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir..."
    exit 1
}

# Verificar CSV
if (-not (Test-Path "brisbane_water_quality.csv")) {
    Write-Host "❌ Archivo CSV no encontrado: brisbane_water_quality.csv" -ForegroundColor Red
    Write-Host "💡 Asegúrate de tener el dataset en esta carpeta" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir..."
    exit 1
}

Write-Host "✅ Dataset encontrado" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Iniciando análisis ML con Docker..." -ForegroundColor Cyan
Write-Host "⏱️ Esto puede tomar varios minutos..." -ForegroundColor Yellow
Write-Host ""

# Ejecutar análisis
docker-compose up --build

Write-Host ""
Write-Host "✅ Análisis completado" -ForegroundColor Green
Write-Host "📁 Revisa la carpeta 'resultados' para ver:" -ForegroundColor Cyan
Write-Host "   • Reporte comparativo (.txt)" -ForegroundColor White
Write-Host "   • Datos completos (.json)" -ForegroundColor White
Write-Host "   • Gráficos (.png)" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Usa el reporte .txt para elegir el mejor modelo" -ForegroundColor Green
Write-Host ""
Read-Host "Presiona Enter para salir..."