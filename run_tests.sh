#!/bin/bash
# run_tests.sh
# Script de automatización de pruebas para el Backend de VERUM en Linux/macOS/CI-CD

# Estilos de color para la consola
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}   Iniciando Suite de Pruebas de VERUM Backend   ${NC}"
echo -e "${CYAN}=============================================${NC}"

# Obtener directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"

if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: El directorio 'backend' no fue encontrado en $BACKEND_DIR${NC}"
    exit 1
fi

cd "$BACKEND_DIR"

if [ -d "venv" ]; then
    echo -e "${YELLOW}Ejecutando pruebas con el entorno virtual (venv)...${NC}"
    ./venv/bin/python -m pytest
else
    echo -e "${YELLOW}Entorno virtual 'venv' no encontrado. Intentando usar python global...${NC}"
    python3 -m pytest || python -m pytest
fi

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo -e "${GREEN}¡Éxito! Todas las pruebas pasaron correctamente.${NC}"
else
    echo -e "${RED}Error: Algunas pruebas fallaron. Revisa los detalles arriba.${NC}"
fi

echo -e "${CYAN}=============================================${NC}"
exit $RESULT
