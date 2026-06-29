# run_tests.ps1
# Script de automatización de pruebas para el Backend de VERUM en Windows

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Iniciando Suite de Pruebas de VERUM Backend   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Directorio base del script
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
$BackendDir = Join-Path $ScriptDir "backend"

if (-not (Test-Path $BackendDir)) {
    Write-Error "Error: El directorio 'backend' no fue encontrado en $BackendDir"
    exit 1
}

Push-Location $BackendDir

try {
    if (Test-Path "venv") {
        Write-Host "Ejecutando pruebas con el entorno virtual (venv)..." -ForegroundColor Yellow
        & ".\venv\Scripts\python.exe" -m pytest
    } else {
        Write-Warning "Entorno virtual 'venv' no encontrado. Intentando usar python global..."
        python -m pytest
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "¡Éxito! Todas las pruebas pasaron correctamente." -ForegroundColor Green
    } else {
        Write-Host "Error: Algunas pruebas fallaron. Revisa los detalles arriba." -ForegroundColor Red
    }
}
finally {
    Pop-Location
    Write-Host "=============================================" -ForegroundColor Cyan
}
