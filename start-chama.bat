@echo off
echo ========================================
echo Chama Management System Startup
echo ========================================
echo.

echo Step 1: Checking Docker...
docker --version
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)
echo Docker is installed!
echo.

echo Step 2: Starting PostgreSQL and Redis...
docker compose up -d postgres redis
if %errorlevel% neq 0 (
    echo ERROR: Failed to start Docker containers
    echo Please make sure Docker Desktop is running
    pause
    exit /b 1
)
echo Database services started!
echo.

echo Step 3: Waiting for database to be ready...
timeout /t 10 /nobreak
echo.

echo Step 4: Running database migrations...
call npm run db:migrate
if %errorlevel% neq 0 (
    echo WARNING: Migration failed, but continuing...
)
echo.

echo Step 5: Starting backend server...
echo Backend will start at http://localhost:3000
echo Frontend is at http://localhost:5173
echo.
echo Press Ctrl+C to stop the backend server
echo.
call npm run dev

pause
