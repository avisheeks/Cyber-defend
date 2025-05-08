@echo off
echo ========================================
echo EdgeSentinel Alert Tester
echo ========================================
echo.

echo Checking if Python is installed...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed! Please install Python 3.6 or higher.
    pause
    exit /b
)

echo Checking if required packages are installed...
pip show requests >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing requests package...
    pip install requests
)

echo.
echo Starting test alerts script...
echo.
python send_test_alerts.py

echo.
echo Test complete! Check your dashboard to see if alerts appear.
echo If you don't see alerts, try refreshing the page or check the console for errors.
echo.
pause 