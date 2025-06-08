const express = require('express');
const { SerialPort } = require('serialport');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');


// Configuration
    const PORT = 3000;
    const commonPatterns = ['/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyUSB0', '/dev/ttyUSB1'];


// Middleware setup
    const app = express();
    app.use(cors());
    app.use(express.json());


// Try to find Arduino on available ports
    let serialPort = null;
    let currentStatus = 'disconnected'; // 'disconnected', 'idle', 'running'

    async function scanAndListPorts() {
        console.log('=== Scanning for available USB/ACM serial ports ===');
        try {
            const allPorts = await SerialPort.list();

            if (allPorts.length === 0) {
                console.log('No serial ports found!');
                return [];
            }

            // Filter for USB and ACM ports (cross-platform: Linux, macOS, Windows)
            const usbAcmPorts = allPorts.filter(port => 
                port.path && (
                    // Linux/macOS patterns
                    port.path.includes('ACM') || 
                    port.path.includes('USB') ||
                    port.path.includes('ttyUSB') ||
                    port.path.includes('ttyACM') ||
                    // Windows patterns (COM ports)
                    /^COM\d+$/i.test(port.path)
                )
            );

            if (usbAcmPorts.length === 0) {
                console.log('Total ports found:', allPorts.length);
                return [];
            }

            console.log('Available USB/ACM ports:');
            usbAcmPorts.forEach((port, index) => {
                console.log(`  ${index + 1}. ${port.path}`);
                if (port.manufacturer) console.log(`     Manufacturer: ${port.manufacturer}`);
                if (port.serialNumber) console.log(`     Serial Number: ${port.serialNumber}`);
                if (port.vendorId)     console.log(`     Vendor ID: ${port.vendorId}`);
                if (port.productId)    console.log(`     Product ID: ${port.productId}`);
                console.log('');
            });

            return usbAcmPorts; // Return only USB/ACM ports
        } catch (error) {
            console.error('Error scanning ports:', error);
            return [];
        }
    }

// Function to connect to Arduino
    async function connectToArduino() {
        // First scan and list only USB/ACM ports
        const availableUsbAcmPorts = await scanAndListPorts();

        if (availableUsbAcmPorts.length === 0) {
            console.log('No USB/ACM serial ports available. Please connect your Arduino.');
            return;
        }

        // Try common Arduino port patterns first
        const portsToTry = [...commonPatterns];

        // Add any other available USB/ACM ports that aren't already in the list
        availableUsbAcmPorts.forEach(port => {
            if (!portsToTry.includes(port.path)) {
                portsToTry.push(port.path);
            }
        });

        console.log(`\nTrying to connect to Arduino on USB/ACM ports only...`);

        for (const portPath of portsToTry) {
            // Skip if this port doesn't actually exist in available USB/ACM ports
            const portExists = availableUsbAcmPorts.some(p => p.path === portPath);
            if (!portExists)
                continue;

            try {
                console.log(`Attempting connection to ${portPath}...`);

                serialPort = new SerialPort({
                    path: portPath,
                    baudRate: 115200,
                });

                // Set up event handlers
                serialPort.on('open', () => {
                    console.log(`✅ Connected to Arduino on ${portPath}`);
                    currentStatus = 'idle';
                    broadcastStatus();
                });

                serialPort.on('data', (data) => {
                    const message = data.toString().trim();

                    if (message === 'A') {
                        currentStatus = 'running';
                        broadcastStatus();
                        console.log('Sending RUNNING status');
                    } else if (message === 'B') {
                        currentStatus = 'idle';
                        broadcastStatus();
                        console.log('Sending IDLE status');
                    }
                });

                serialPort.on('error', (err) => {
                    console.error(`❌ Serial port error: ${err.message}`);
                    currentStatus = 'disconnected';
                    broadcastStatus();
                });

                serialPort.on('close', () => {
                    console.log('Serial port closed');
                    currentStatus = 'disconnected';
                    broadcastStatus();
                });

                // Wait a moment for the connection to establish
                await new Promise(resolve => setTimeout(resolve, 1000));

                if (serialPort.isOpen) {
                    console.log(`💚 Successfully connected to ${portPath}`);
                    return; // Successfully connected, exit function
                }
            } catch (error) {
                console.log(`❌ Failed to connect to ${portPath}: ${error.message}`);
                continue; // Try next port
            }
        }

        // // Only show error if no connection was established
        // if (!serialPort || !serialPort.isOpen) {
        //     console.log('\n❌ Could not connect to Arduino on any available USB/ACM port');
        //     console.log('Please check:');
        //     console.log('1. Arduino is connected via USB');
        //     console.log('2. Arduino drivers are installed');
        //     console.log('3. You have permission to access serial ports');
        //     console.log('   Try: sudo usermod -a -G dialout $USER (then logout/login)');
        //     console.log('4. No other program is using the Arduino (Arduino IDE, etc.)');
        //     console.log('5. Arduino code is running and Serial.begin(115200) is set');
        //     currentStatus = 'disconnected';
        // }
    }

// Create and init a http server
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

// HTTP endpoints
    app.get('/', (req, res) => {
        res.json({ message: 'Server is running' });
    });

// WebSocket connection handling
    wss.on('connection', (ws) => {
        console.log('Client connected');

        // Send current status to new client
        ws.send(JSON.stringify({
            type: 'status',
            status: currentStatus
        }));

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'command') {
                    if (data.command === 'start' && serialPort && serialPort.isOpen) {
                        serialPort.write('1');
                        console.log('Sent START command to Arduino');
                    } else if (data.command === 'stop' && serialPort && serialPort.isOpen) {
                        serialPort.write('0');
                        console.log('Sent STOP command to Arduino');
                    }
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });

    function broadcastStatus() {
        const statusMessage = JSON.stringify({
            type: 'status',
            status: currentStatus
        });

        wss.clients.forEach((client) => {
            if (client.readyState === client.OPEN) {
                client.send(statusMessage);
            }
        });
    }

// Periodicaly reconnect to arduino
    setInterval(async () => {
        if (currentStatus === 'disconnected') {
            console.log('Attempting to reconnect to Arduino...');
            await connectToArduino();
        }
    }, 30000);

// Start server
    server.listen(PORT, async () => {
        console.log(`\nServer running at http://localhost:${PORT}`);

        // Try to connect to Arduino when server starts
        await connectToArduino();
    });