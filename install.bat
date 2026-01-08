@echo off
echo.
echo ============================================
echo  SecuredAPI - Installation Script
echo ============================================
echo.

echo [1/5] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js found: 
node --version
echo.

echo [2/5] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo Dependencies installed successfully!
echo.

echo [3/5] Checking MongoDB...
echo Please make sure MongoDB is running on localhost:27017
echo If not, install from https://www.mongodb.com/try/download/community
echo.
pause

echo [4/5] Checking Redis (Optional)...
echo Redis is optional but recommended for production
echo If not installed, get it from https://redis.io/download
echo.

echo [5/5] Configuration...
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo.
    echo IMPORTANT: Please edit .env file and update the following:
    echo   - JWT_SECRET (change to a secure random string)
    echo   - STRIPE_SECRET_KEY (add your Stripe key)
    echo   - STRIPE_WEBHOOK_SECRET (add your webhook secret)
    echo.
)
echo.

echo ============================================
echo  Installation Complete!
echo ============================================
echo.
echo Next steps:
echo   1. Edit .env file with your configuration
echo   2. Make sure MongoDB is running
echo   3. Run: npm run dev
echo   4. Visit: http://localhost:3000/demo
echo.
echo Documentation:
echo   - Setup Guide: SETUP_GUIDE.md
echo   - API Docs: API_DOCS.md
echo   - Deployment: DEPLOYMENT.md
echo   - Overview: PROJECT_OVERVIEW.md
echo.
pause
