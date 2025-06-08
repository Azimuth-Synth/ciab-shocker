@echo off
REM Configuration - Change this filename as needed
set START_FILE=init_script.js

REM Check if start file exists
if exist "%START_FILE%" (
    echo Running %START_FILE%...
    node "%START_FILE%"
    if %ERRORLEVEL% neq 0 (
        echo.
        echo Error: Application exited with error code %ERRORLEVEL%
    ) else (
        echo.
        echo Application finished successfully.
    )
) else (
    echo Error: %START_FILE% not found in current directory!
    echo Make sure you're running this script from the correct location.
)