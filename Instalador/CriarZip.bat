@echo off
title Criar Zip do Instalador
echo.
echo  Criando arquivo compactado...
echo.

set "INSTALLER_DIR=C:\Projeto\Aps assistant\Instalador"
set "OUTPUT_FILE=%USERPROFILE%\Desktop\APS Assistance - Instalador.zip"

REM Verificar se a pasta fontes existe
if not exist "%INSTALLER_DIR%\fontes" (
    echo ERRO: Pasta "fontes" nao encontrada!
    echo Execute "Preparar.bat" primeiro.
    echo.
    pause
    exit /b 1
)

REM Remover zip anterior
if exist "%OUTPUT_FILE%" del /f /q "%OUTPUT_FILE%"

REM Criar novo zip
powershell -Command "Compress-Archive -Path '%INSTALLER_DIR%\Instalar.bat', '%INSTALLER_DIR%\Preparar.bat', '%INSTALLER_DIR%\CriarZip.bat', '%INSTALLER_DIR%\LEIA-ME.txt', '%INSTALLER_DIR%\fontes' -DestinationPath '%OUTPUT_FILE%' -Force"

echo.
echo  ==========================================
echo   Zip criado com sucesso!
echo  ==========================================
echo.
echo  Localizacao: %OUTPUT_FILE%
echo.
pause
