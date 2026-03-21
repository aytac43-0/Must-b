@echo off
:: Usage: curl -fsSL https://must-b.com/install.cmd -o install.cmd && install.cmd
title Must-b Installer — Auto Step Edition
echo.
echo  =============================================
echo   Must-b v2.0 — Auto Step Edition Installer
echo  =============================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

:: Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed. Please install Git from https://git-scm.com
    pause
    exit /b 1
)

echo [1/4] Cloning Must-b repository...
git clone https://github.com/aytac43-0/must-b.git must-b
if %errorlevel% neq 0 (
    echo [ERROR] Failed to clone repository. Check your internet connection.
    pause
    exit /b 1
)

cd must-b

echo [2/4] Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo [3/4] Setting up environment config...
if not exist .env (
    copy .env.example .env >nul 2>&1
    echo [INFO] .env file created from .env.example — please edit it with your API keys.
) else (
    echo [INFO] .env file already exists.
)

echo [4/4] Registering global "must-b" command...
npm link
if %errorlevel% neq 0 (
    echo [WARN] npm link failed — try running as Administrator, or run "npm link" manually.
)

echo.
echo  =============================================
echo   Installation complete!
echo  =============================================
echo.
echo   Build the frontend once (required before first run):
echo     npm run build:frontend
echo.
echo   Then start Must-b:
echo     must-b          (global command)
echo     npm start       (from project folder)
echo.
echo   Open http://localhost:4309 in your browser.
echo  =============================================
echo.
pause
