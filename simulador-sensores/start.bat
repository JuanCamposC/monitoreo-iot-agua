@echo off
REM Script de inicio para Windows - Simulador IoT CIMARQ
REM Uso: start.bat [prod|dev|build|logs|stop|clean]

setlocal EnableDelayedExpansion

echo.
echo 🐟 Simulador IoT CIMARQ - Acuicultura Zona Central Chile
echo ========================================================

set "command=%~1"
if "%command%"=="" set "command=prod"

REM Verificar Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker no está instalado o no está en el PATH
    echo 💡 Instala Docker Desktop desde: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker Compose no está disponible
    pause
    exit /b 1
)

echo ✅ Docker está disponible

REM Verificar archivo .env
if not exist ".env" (
    echo ⚠️ Archivo .env no encontrado, copiando desde .env.example
    copy ".env.example" ".env"
    echo 📝 Por favor, edita .env con tus configuraciones
)

REM Ejecutar comando
if "%command%"=="prod" (
    echo 🚀 Iniciando en modo PRODUCCIÓN...
    docker-compose up -d
    if %errorlevel% equ 0 (
        echo ✅ Simulador iniciado correctamente
        echo 📊 Para ver logs: start.bat logs
        echo ⏹️ Para detener: start.bat stop
    )
) else if "%command%"=="dev" (
    echo 🔧 Iniciando en modo DESARROLLO ^(con servicios locales^)...
    docker-compose --profile dev up -d
    if %errorlevel% equ 0 (
        echo ✅ Simulador iniciado en modo desarrollo
        echo 📊 MongoDB local: localhost:27017
        echo 📡 MQTT local: localhost:1883
    )
) else if "%command%"=="build" (
    echo 🔨 Reconstruyendo imagen...
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
) else if "%command%"=="logs" (
    echo 📋 Mostrando logs del simulador...
    echo Presiona Ctrl+C para salir
    docker-compose logs -f cimarq-iot-simulator
) else if "%command%"=="stop" (
    echo ⏹️ Deteniendo simulador...
    docker-compose down
    echo ✅ Simulador detenido
) else if "%command%"=="clean" (
    echo 🧹 Limpiando contenedores y volúmenes...
    docker-compose down -v --rmi local
    docker system prune -f
    echo ✅ Limpieza completada
) else if "%command%"=="help" (
    echo.
    echo Uso: start.bat [COMANDO]
    echo.
    echo Comandos disponibles:
    echo   prod    - Ejecutar en producción ^(por defecto^)
    echo   dev     - Ejecutar con servicios locales
    echo   build   - Reconstruir imagen y ejecutar
    echo   logs    - Mostrar logs en tiempo real
    echo   stop    - Detener simulador
    echo   clean   - Limpiar contenedores y volúmenes
    echo   help    - Mostrar esta ayuda
    echo.
) else (
    echo ❌ Comando desconocido: %command%
    echo 💡 Usa: start.bat help
    exit /b 1
)

pause