@echo off
echo ===================================================
echo Windows 10 Real-Time Network Monitoring
echo ===================================================
echo.

REM Check if Python is installed
python --version > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher and try again
    pause
    exit /b 1
)

REM Check if required packages are installed
echo Checking required Python packages...
pip show requests > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installing requests package...
    pip install requests
)

REM Check if the backend is running
echo Checking if backend server is running...
curl -s http://localhost:8000 > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo WARNING: Backend server does not appear to be running
    echo Start the backend server first with: cd backend ^& uvicorn app:app --reload
    echo.
    set /p START_ANYWAY="Do you want to start the monitoring agent anyway? (y/n): "
    if /i "%START_ANYWAY%" NEQ "y" (
        echo Exiting...
        pause
        exit /b 1
    )
)

echo.
echo Starting Windows monitoring agent for REAL-TIME data collection...
echo [INFO] This agent will collect ACTUAL network metrics from your PC
echo [INFO] No simulated data will be displayed on the dashboard
echo Press Ctrl+C to stop monitoring
echo.

REM Start the monitoring script
python windows10_monitor.py

echo.
if %ERRORLEVEL% NEQ 0 (
    echo Error occurred while running the monitoring agent
) else (
    echo Monitoring stopped
)

pause 