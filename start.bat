@echo off
echo.
echo ============================================
echo  Starting SecuredAPI Development Server
echo ============================================
echo.

REM Check if node_modules exists
if not exist node_modules (
    echo ERROR: Dependencies not installed!
    echo Please run: npm install
    echo Or use: install.bat
    pause
    exit /b 1
)

REM Check if .env exists
if not exist .env (
    echo WARNING: .env file not found!
    echo Creating from .env.example...
    copy .env.example .env
    echo.
    echo Please edit .env file before continuing.
    pause
)

echo Starting development server...
echo.
echo Server will start on: http://localhost:3000
echo Widget Demo: http://localhost:3000/demo
echo Dashboard: http://localhost:3000/dashboard.html
echo API Health: http://localhost:3000/health
echo.
echo Press Ctrl+C to stop the server
echo.

npm run dev
