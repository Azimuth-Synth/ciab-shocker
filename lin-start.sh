#!/bin/bash

# Configuration - Change this filename as needed
START_FILE="init_script.js"


# Check if start file exists
if [ -f "$START_FILE" ]; then
    node "$START_FILE"
    EXIT_CODE=$?
    if [ $EXIT_CODE -ne 0 ]; then
        echo
        echo "Error: Application exited with error code $EXIT_CODE"
    else
        echo
        echo "Application finished successfully."
    fi
else
    echo "Error: $START_FILE not found in current directory!"
    echo "Make sure you're running this script from the correct location."
fi