@echo off
title APS Assistance
color 0A
echo.
echo  ========================================
echo   APS Assistance - Catalogo de Erros
echo  ========================================
echo.

set "PROJECT_DIR=%~dp0..\pas-interface"

echo [1/4] Verificando Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado! Instale em https://nodejs.org
    pause
    exit /b 1
)

echo [2/4] Verificando dependencias...
cd /d "%PROJECT_DIR%"
if not exist "node_modules" (
    echo    Instalando pacotes...
    call npm install
)

if not exist "bot-config.json" (
    echo.
    echo  --- Configuracao do Bot Telegram ---
    echo  Crie um bot via @BotFather no Telegram
    echo  e cole o token abaixo:
    echo.
    set /p BOT_TOKEN="Token do bot: "
    echo {"token": "!BOT_TOKEN!"} > bot-config.json
    echo    Bot configurado!
    echo.
)

echo [3/4] Encerrando servidor antigo...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [4/4] Compilando e iniciando...
call npm run build
if errorlevel 1 (
    echo ERRO na compilacao!
    pause
    exit /b 1
)

node server\index.js
