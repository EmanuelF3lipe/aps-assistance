@echo off
title Preparar Instalador
echo.
echo  Preparando arquivos do instalador...
echo.

set "INSTALLER_DIR=C:\Projeto\Aps assistant\Instalador"
set "SOURCE_DIR=C:\Projeto\Aps assistant\pas-interface"
set "NOTION_DIR=C:\Projeto\Aps assistant\notion"
set "FONTES_DIR=%INSTALLER_DIR%\fontes"

REM Limpar pasta fontes anterior
if exist "%FONTES_DIR%" rmdir /s /q "%FONTES_DIR%"
mkdir "%FONTES_DIR%"
mkdir "%FONTES_DIR%\src"
mkdir "%FONTES_DIR%\server"
mkdir "%FONTES_DIR%\public"
mkdir "%FONTES_DIR%\data"
mkdir "%FONTES_DIR%\data\agilis"
mkdir "%FONTES_DIR%\data\corpore"
mkdir "%FONTES_DIR%\data\scgwin"
mkdir "%FONTES_DIR%\data\sgnfe"
mkdir "%FONTES_DIR%\data\_erros_nao_catalogados"
mkdir "%FONTES_DIR%\data\_images"

echo Copiando arquivos do projeto...
xcopy /E /I /Y "%SOURCE_DIR%\src" "%FONTES_DIR%\src" >nul
xcopy /E /I /Y "%SOURCE_DIR%\server" "%FONTES_DIR%\server" >nul
xcopy /E /I /Y "%SOURCE_DIR%\public" "%FONTES_DIR%\public" >nul
copy /Y "%SOURCE_DIR%\package.json" "%FONTES_DIR%\" >nul
copy /Y "%SOURCE_DIR%\vite.config.js" "%FONTES_DIR%\" >nul
copy /Y "%SOURCE_DIR%\index.html" "%FONTES_DIR%\" >nul
copy /Y "%SOURCE_DIR%\reports.json" "%FONTES_DIR%\" >nul
copy /Y "%SOURCE_DIR%\folder-colors.json" "%FONTES_DIR%\" >nul

echo Copiando dados de erros...
xcopy /E /I /Y "%NOTION_DIR%\agilis" "%FONTES_DIR%\data\agilis" >nul 2>&1
xcopy /E /I /Y "%NOTION_DIR%\corpore" "%FONTES_DIR%\data\corpore" >nul 2>&1
xcopy /E /I /Y "%NOTION_DIR%\scgwin" "%FONTES_DIR%\data\scgwin" >nul 2>&1
xcopy /E /I /Y "%NOTION_DIR%\sgnfe" "%FONTES_DIR%\data\sgnfe" >nul 2>&1
xcopy /E /I /Y "%NOTION_DIR%\_erros_nao_catalogados" "%FONTES_DIR%\data\_erros_nao_catalogados" >nul 2>&1
xcopy /E /I /Y "%NOTION_DIR%\_images" "%FONTES_DIR%\data\_images" >nul 2>&1

REM Copiar favorites.json se existir
if exist "%SOURCE_DIR%\favorites.json" copy /Y "%SOURCE_DIR%\favorites.json" "%FONTES_DIR%\" >nul

echo.
echo Arquivos preparados com sucesso!
echo.
echo Agora execute "CriarZip.bat" para gerar o instalador.
echo.
pause
