@echo off
REM Configuration - Change these directory names as needed
set FRONTEND_DIR=ciab-frontend
set BACKEND_DIR=ciab-backend

echo Installing dependencies...
echo.

REM Store current directory
set ORIGINAL_DIR=%CD%

REM Install frontend dependencies
echo Installing frontend dependencies in %FRONTEND_DIR%...
if exist "%FRONTEND_DIR%" (
    cd "%FRONTEND_DIR%"
    npm install
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install frontend dependencies
        cd "%ORIGINAL_DIR%"
        pause
        exit /b 1
    )
    cd "%ORIGINAL_DIR%"
    echo Frontend dependencies installed successfully!
    echo.
) else (
    echo Warning: %FRONTEND_DIR% directory not found!
    echo.
)

REM Install backend dependencies
echo Installing backend dependencies in %BACKEND_DIR%...
if exist "%BACKEND_DIR%" (
    cd "%BACKEND_DIR%"
    npm install
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install backend dependencies
        cd "%ORIGINAL_DIR%"
        pause
        exit /b 1
    )
    cd "%ORIGINAL_DIR%"
    echo Backend dependencies installed successfully!
    echo.
) else (
    echo Warning: %BACKEND_DIR% directory not found!
    echo.
)

echo All dependencies installed successfully!
pause