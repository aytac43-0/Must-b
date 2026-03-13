@echo off
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

echo [1/5] Cloning Must-b repository...
git clone https://github.com/aytac43-0/must-b.git must-b
if %errorlevel% neq 0 (
    echo [ERROR] Failed to clone repository. Check your internet connection.
    pause
    exit /b 1
)

cd must-b

echo [2/5] Installing backend dependencies...
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Backend npm install failed.
    pause
    exit /b 1
)

echo [3/5] Installing frontend dependencies...
cd public\Luma
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Frontend npm install failed.
    pause
    exit /b 1
)
cd ..\..

echo [4/5] Setting up environment config...
if not exist .env (
    copy .env.example .env >nul 2>&1
    echo [INFO] .env file created from .env.example — please edit it with your API keys.
) else (
    echo [INFO] .env file already exists.
)

echo [5/5] Installation complete!
echo.
echo  =============================================
echo   HOW TO RUN Must-b:
echo  =============================================
echo   Backend API  (port 4310): npm start
echo   Frontend UI  (port 4309): npm run start:frontend
echo.
echo   For development:
echo     Backend:  npm run dev
echo     Frontend: npm run dev:frontend
echo  =============================================
echo.
echo  Open http://localhost:4309 in your browser.
echo.
pause
