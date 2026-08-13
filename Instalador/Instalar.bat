@echo off
title APS Assistance - Instalador
color 0B
echo.
echo  ==========================================
echo   APS Assistance - Instalador
echo  ==========================================
echo.

set "INSTALL_DIR=%USERPROFILE%\Desktop\APS Assistance"
set "SOURCE_DIR=%~dp0fontes"

echo [1/7] Criando pasta de instalacao...
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
    echo Pasta criada: %INSTALL_DIR%
) else (
    echo Pasta ja existe: %INSTALL_DIR%
)

echo.
echo [2/7] Verificando Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo.
    echo  AVISO: Node.js nao encontrado!
    echo  Baixe em: https://nodejs.org
    echo  Escolha a versao LTS e instale.
    echo.
    pause
    exit /b 1
)
echo Node.js encontrado!

echo.
echo [3/7] Copiando arquivos do projeto...
xcopy /E /I /Y "%SOURCE_DIR%\src" "%INSTALL_DIR%\src" >nul
xcopy /E /I /Y "%SOURCE_DIR%\server" "%INSTALL_DIR%\server" >nul
xcopy /E /I /Y "%SOURCE_DIR%\public" "%INSTALL_DIR%\public" >nul
copy /Y "%SOURCE_DIR%\package.json" "%INSTALL_DIR%\" >nul
copy /Y "%SOURCE_DIR%\vite.config.js" "%INSTALL_DIR%\" >nul
copy /Y "%SOURCE_DIR%\index.html" "%INSTALL_DIR%\" >nul
copy /Y "%SOURCE_DIR%\reports.json" "%INSTALL_DIR%\" >nul
copy /Y "%SOURCE_DIR%\folder-colors.json" "%INSTALL_DIR%\" >nul
echo Arquivos copiados!

echo.
echo [4/7] Copiando dados de erros...
set "DATA_DIR=%INSTALL_DIR%\data"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
xcopy /E /I /Y "%SOURCE_DIR%\data\agilis" "%DATA_DIR%\agilis" >nul 2>&1
xcopy /E /I /Y "%SOURCE_DIR%\data\corpore" "%DATA_DIR%\corpore" >nul 2>&1
xcopy /E /I /Y "%SOURCE_DIR%\data\scgwin" "%DATA_DIR%\scgwin" >nul 2>&1
xcopy /E /I /Y "%SOURCE_DIR%\data\sgnfe" "%DATA_DIR%\sgnfe" >nul 2>&1
xcopy /E /I /Y "%SOURCE_DIR%\data\_erros_nao_catalogados" "%DATA_DIR%\_erros_nao_catalogados" >nul 2>&1
xcopy /E /I /Y "%SOURCE_DIR%\data\_images" "%DATA_DIR%\_images" >nul 2>&1
echo Dados copiados!

echo.
echo [5/7] Atualizando caminhos nos arquivos...
cd /d "%INSTALL_DIR%"

REM Atualizar server/index.js - caminho NOTION_PATH para apontar para pasta data
powershell -Command "$content = Get-Content 'server\index.js' -Raw; $content = $content -replace \"path\.join\(__dirname, '\.\.', '\.\.', 'notion'\)\", \"path.join(__dirname, '..', 'data')\"; Set-Content 'server\index.js' -Value $content -Encoding UTF8"

REM Criar arquivo favorites.json se não existir
if not exist "favorites.json" echo [] > favorites.json

echo Caminhos atualizados!

echo.
echo [6/7] Instalando dependencias...
call npm install --silent
if errorlevel 1 (
    echo ERRO ao instalar dependencias!
    pause
    exit /b 1
)
echo Dependencias instaladas!

echo.
echo [7/7] Criando atalho na area de trabalho...
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\APS Assistance.lnk"
set "BAT_PATH=%INSTALL_DIR%\Iniciar.bat"

> "%TEMP%\create_shortcut.vbs" (
    echo Set ws = CreateObject^("WScript.Shell"^)
    echo Set shortcut = ws.CreateShortcut^("%SHORTCUT_PATH%"^)
    echo shortcut.TargetPath = "%BAT_PATH%"
    echo shortcut.WorkingDirectory = "%INSTALL_DIR%"
    echo shortcut.IconLocation = "%INSTALL_DIR%\public\favicon.png,0"
    echo shortcut.Save
)
cscript //nologo "%TEMP%\create_shortcut.vbs" >nul 2>&1
del "%TEMP%\create_shortcut.vbs" >nul 2>&1
echo Atalho criado na area de trabalho!

echo.
echo  ==========================================
echo   Instalacao concluida com sucesso!
echo  ==========================================
echo.
echo  Para usar, clique no atalho "APS Assistance"
echo  na area de trabalho.
echo.
echo  Localizacao: %INSTALL_DIR%
echo.
pause
