#!/bin/bash

# Configuration - Change these directory names as needed
FRONTEND_DIR="ciab-frontend"
BACKEND_DIR="ciab-backend"

echo "Installing dependencies..."
echo

# Store current directory
ORIGINAL_DIR=$(pwd)

# Install frontend dependencies
echo "Installing frontend dependencies in $FRONTEND_DIR..."
if [ -d "$FRONTEND_DIR" ]; then
    cd "$FRONTEND_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install frontend dependencies"
        cd "$ORIGINAL_DIR"
        read -p "Press Enter to continue..."
        exit 1
    fi
    cd "$ORIGINAL_DIR"
    echo "Frontend dependencies installed successfully!"
    echo
else
    echo "Warning: $FRONTEND_DIR directory not found!"
    echo
fi

# Install backend dependencies
echo "Installing backend dependencies in $BACKEND_DIR..."
if [ -d "$BACKEND_DIR" ]; then
    cd "$BACKEND_DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install backend dependencies"
        cd "$ORIGINAL_DIR"
        read -p "Press Enter to continue..."
        exit 1
    fi
    cd "$ORIGINAL_DIR"
    echo "Backend dependencies installed successfully!"
    echo
else
    echo "Warning: $BACKEND_DIR directory not found!"
    echo
fi

echo "All dependencies installed successfully!"
read -p "Press Enter to continue..."