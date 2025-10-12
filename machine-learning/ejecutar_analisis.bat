@echo off
title CIMARQ - Análisis Predictivo ML (24h)
color 0A

echo.
echo 🐟 CIMARQ - Análisis Predictivo de Sensores IoT
echo ===============================================
echo 📊 Predicción a 24 horas con Docker
echo 📁 Resultados guardados en carpeta /resultados
echo.

:: Verificar si Docker está corriendo
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker no está ejecutándose
    echo 💡 Inicia Docker Desktop y ejecuta este script nuevamente
    pause
    exit /b 1
)

echo ✅ Docker detectado
echo.

:: Verificar archivo CSV
if not exist "brisbane_water_quality.csv" (
    echo ❌ Archivo CSV no encontrado: brisbane_water_quality.csv
    echo 💡 Asegúrate de tener el dataset en esta carpeta
    pause
    exit /b 1
)

echo ✅ Dataset encontrado
echo.
echo 🚀 Iniciando análisis ML con Docker...
echo ⏱️ Esto puede tomar varios minutos...
echo.

:: Ejecutar análisis en Docker
docker-compose up --build

echo.
echo ✅ Análisis completado
echo 📁 Revisa la carpeta 'resultados' para ver:
echo    • Reporte comparativo (.txt)
echo    • Datos completos (.json)  
echo    • Gráficos (.png)
echo.
echo 🎯 Usa el reporte .txt para elegir el mejor modelo
echo.
pause