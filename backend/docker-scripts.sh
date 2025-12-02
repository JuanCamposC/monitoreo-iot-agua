#!/bin/bash

# Scripts útiles para Docker - API de Sensores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Función para mostrar ayuda
show_help() {
    echo -e "${CYAN}🐳 Scripts de Docker para API de Sensores${NC}"
    echo ""
    echo "Comandos disponibles:"
    echo -e "  ${GREEN}build${NC}           - Construir la imagen Docker"
    echo -e "  ${GREEN}dev${NC}             - Ejecutar en modo desarrollo"
    echo -e "  ${GREEN}prod${NC}            - Ejecutar en modo producción"
    echo -e "  ${YELLOW}stop${NC}            - Detener todos los contenedores"
    echo -e "  ${BLUE}logs${NC}            - Ver logs del contenedor"
    echo -e "  ${RED}clean${NC}           - Limpiar contenedores e imágenes"
    echo -e "  ${PURPLE}shell${NC}           - Acceder al shell del contenedor"
    echo -e "  ${GREEN}health${NC}          - Verificar estado de salud de la API"
    echo -e "  ${GREEN}status${NC}          - Ver estado de contenedores"
    echo -e "  ${BLUE}restart${NC}         - Reiniciar contenedores"
    echo ""
    echo -e "${GRAY}Uso: ./docker-scripts.sh <comando>${NC}"
    echo ""
}

# Construir imagen
build() {
    echo -e "${YELLOW}🔨 Construyendo imagen Docker...${NC}"
    docker build -t sensores-api .
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Imagen construida exitosamente${NC}"
    else
        echo -e "${RED}❌ Error al construir la imagen${NC}"
        exit 1
    fi
}

# Ejecutar en desarrollo
dev() {
    echo -e "${GREEN}🚀 Iniciando en modo desarrollo...${NC}"
    echo -e "${GRAY}Presiona Ctrl+C para detener${NC}"
    docker-compose up --build
}

# Ejecutar en producción
prod() {
    echo -e "${GREEN}🚀 Iniciando en modo producción...${NC}"
    docker-compose -f docker-compose.prod.yml up --build -d
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Contenedor iniciado en segundo plano${NC}"
        echo -e "${GRAY}Usa './docker-scripts.sh logs' para ver los logs${NC}"
        echo -e "${GRAY}Usa './docker-scripts.sh health' para verificar el estado${NC}"
    else
        echo -e "${RED}❌ Error al iniciar el contenedor${NC}"
        exit 1
    fi
}

# Detener contenedores
stop() {
    echo -e "${YELLOW}⏹️ Deteniendo contenedores...${NC}"
    docker-compose down
    docker-compose -f docker-compose.prod.yml down
    
    echo -e "${GREEN}✅ Contenedores detenidos${NC}"
}

# Ver logs
logs() {
    echo -e "${BLUE}📋 Mostrando logs...${NC}"
    echo -e "${GRAY}Presiona Ctrl+C para salir${NC}"
    docker-compose logs -f api
}

# Limpiar
clean() {
    echo -e "${RED}🧹 Limpiando contenedores e imágenes...${NC}"
    echo -e "${YELLOW}⚠️ Esto eliminará contenedores, imágenes y volúmenes${NC}"
    
    read -p "¿Estás seguro? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down --rmi all --volumes --remove-orphans
        docker-compose -f docker-compose.prod.yml down --rmi all --volumes --remove-orphans
        docker system prune -f
        echo -e "${GREEN}✅ Limpieza completada${NC}"
    else
        echo -e "${GRAY}Operación cancelada${NC}"
    fi
}

# Acceder al shell
shell() {
    echo -e "${PURPLE}💻 Accediendo al shell del contenedor...${NC}"
    
    # Verificar si el contenedor está corriendo
    if [ "$(docker ps -q -f name=sensores-api)" ]; then
        docker exec -it sensores-api bash
    else
        echo -e "${RED}❌ El contenedor 'sensores-api' no está ejecutándose${NC}"
        echo -e "${GRAY}Usa './docker-scripts.sh dev' o './docker-scripts.sh prod' para iniciarlo${NC}"
        exit 1
    fi
}

# Verificar salud
health() {
    echo -e "${GREEN}🏥 Verificando estado de salud...${NC}"
    
    # Verificar si el contenedor está corriendo
    if [ "$(docker ps -q -f name=sensores-api)" ]; then
        response=$(curl -s -f http://localhost:5000/health 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ API disponible${NC}"
            echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
        else
            echo -e "${RED}❌ API no disponible o no responde${NC}"
            echo -e "${GRAY}Verificando logs...${NC}"
            docker logs --tail 10 sensores-api
        fi
    else
        echo -e "${RED}❌ El contenedor 'sensores-api' no está ejecutándose${NC}"
        exit 1
    fi
}

# Ver estado de contenedores
status() {
    echo -e "${BLUE}📊 Estado de contenedores:${NC}"
    echo ""
    
    # Contenedores relacionados con sensores
    docker ps -a --filter "name=sensores" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo -e "${BLUE}📈 Uso de recursos:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" sensores-api 2>/dev/null || echo "No hay contenedores ejecutándose"
}

# Reiniciar contenedores
restart() {
    echo -e "${YELLOW}🔄 Reiniciando contenedores...${NC}"
    
    # Verificar qué archivo de compose usar
    if [ "$(docker ps -q -f name=sensores-api-prod)" ]; then
        echo -e "${GRAY}Detectado contenedor de producción${NC}"
        docker-compose -f docker-compose.prod.yml restart
    elif [ "$(docker ps -q -f name=sensores-api)" ]; then
        echo -e "${GRAY}Detectado contenedor de desarrollo${NC}"
        docker-compose restart
    else
        echo -e "${RED}❌ No hay contenedores de sensores ejecutándose${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Contenedores reiniciados${NC}"
}

# Verificar dependencias
check_dependencies() {
    local deps_ok=true
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker no está instalado${NC}"
        deps_ok=false
    fi
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose no está instalado${NC}"
        deps_ok=false
    fi
    
    # Verificar curl
    if ! command -v curl &> /dev/null; then
        echo -e "${YELLOW}⚠️ curl no está instalado (necesario para health check)${NC}"
    fi
    
    if [ "$deps_ok" = false ]; then
        echo -e "${RED}❌ Dependencias faltantes${NC}"
        exit 1
    fi
}

# Función principal
main() {
    # Verificar dependencias al inicio
    check_dependencies
    
    # Procesar argumentos
    case "$1" in
        build)
            build
            ;;
        dev)
            dev
            ;;
        prod)
            prod
            ;;
        stop)
            stop
            ;;
        logs)
            logs
            ;;
        clean)
            clean
            ;;
        shell)
            shell
            ;;
        health)
            health
            ;;
        status)
            status
            ;;
        restart)
            restart
            ;;
        *)
            show_help
            ;;
    esac
}

# Ejecutar función principal con todos los argumentos
main "$@"