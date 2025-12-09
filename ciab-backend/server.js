// backend_server.js

const express = require('express');
const { SerialPort } = require('serialport');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const path = require('path');


// Configuration
    const PORT = 3000;
    const commonPatterns = ['/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyUSB0', '/dev/ttyUSB1'];

    // Function to read device port from config.txt
    function getConfiguredDevice() {
        try {
            const configPath = path.join(__dirname, '..', 'config.txt');
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const lines = configContent.split('\n');
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('device')) {
                    const parts = trimmedLine.split('=');
                    if (parts.length === 2) {
                        const device = parts[1].trim();
                        console.log(`Found configured device in config.txt: ${device}`);
                        return device;
                    }
                }
            }
        } catch (error) {
            console.log(`Could not read config.txt: ${error.message}`);
        }
        return null;
    }


// Middleware setup
    const app = express();
    app.use(cors());
    app.use(express.json());


// Arduino
    let serialPort = null;
    let currentMcuStatus = 'disconnected'; // 'disconnected', 'idle', 'busy', 'running'
    let currentMcuPowerLevel = 0; // range from 0 to 99

    // Track user commands by IP
    const userCommands = {
        start: new Set(), // User IPs who have set start
        stop: new Set()   // User IPs who have set stop
    };

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
    async function tryConnectToMcu() {
        // First scan and list only USB/ACM ports
        const availableUsbAcmPorts = await scanAndListPorts();

        if (availableUsbAcmPorts.length === 0) {
            console.log('No USB/ACM serial ports available. Please connect your Arduino.');
            return;
        }

        // Try configured device first, then common Arduino port patterns
        const portsToTry = [];
        const configuredDevice = getConfiguredDevice();
        if (configuredDevice) {
            portsToTry.push(configuredDevice);
        }
        portsToTry.push(...commonPatterns);

        // Add any other available USB/ACM ports that aren't already in the list
        availableUsbAcmPorts.forEach(port => {
            if (!portsToTry.includes(port.path)) {
                portsToTry.push(port.path);
            }
        });

        console.log(`\nTrying to connect to Arduino on USB ports only...`);

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
                    currentMcuStatus = 'idle';
                    wsBroadcastMcuStatus();
                });

                serialPort.on('data', (data) => {
                    // Handle multiple messages in one chunk (split by newline)
                    const messages = data.toString().split('\n');
                    messages.forEach((rawMsg) => {
                        const message = rawMsg.trim();
                        if (!message) return;

                        if (message === 'A') {
                            currentMcuStatus = 'running';
                            wsBroadcastMcuStatus();
                            console.log('MCU is RUNNING');
                        } else if (message === 'B') {
                            currentMcuStatus = 'idle';
                            wsBroadcastMcuStatus();
                            console.log('MCU is IDLE');
                        } else if (message === 'C') {
                            currentMcuStatus = 'busy';
                            wsBroadcastMcuStatus();
                            console.log('MCU is BUSY');
                        } else if (message.startsWith('P') && message.endsWith('!')) {
                            const powerLevelStr = message.slice(1, -1); // Remove 'P' and '!'
                            const powerLevel = parseInt(powerLevelStr, 10);
                            if (!isNaN(powerLevel) && powerLevel >= 0 && powerLevel <= 99) {
                                currentMcuPowerLevel = powerLevel;
                                // console.log(`MCU power level set to ${currentMcuPowerLevel}`);
                                wsBroadcastMcuStatus();
                            } else {
                                console.error(`Invalid power level received: ${message}`);
                            }
                        }
                    });
                });

                serialPort.on('error', (err) => {
                    console.error(`❌ Serial port error: ${err.message}`);
                    currentMcuStatus = 'disconnected';
                    wsBroadcastMcuStatus();
                });

                serialPort.on('close', () => {
                    console.log('Serial port closed');
                    currentMcuStatus = 'disconnected';
                    wsBroadcastMcuStatus();
                });

                // Wait a moment for the connection to establish
                await new Promise(resolve => setTimeout(resolve, 1000));

                if (serialPort.isOpen) {
                    console.log(`✅ Successfully connected to ${portPath}`);
                    return; // Successfully connected, exit function
                }
            } catch (error) {
                console.log(`❌ Failed to connect to ${portPath}: ${error.message}`);
                continue; // Try next port
            }
        }
    }

// Create and init a http server
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

// HTTP endpoints
    app.get('/', (req, res) => {
        res.json({ message: 'Server is running' });
    });

    app.get('/reconnect-mcu', async (req, res) => {
        await tryConnectToMcu();
        res.json({ message: 'Attempting to reconect to microcontroler' });
    });

    app.get('/claim-master', async (req, res) => {
        // This endpoint is for claiming the master role
        const clientIP = getClientIP(req);
        const user = getOrCreateUser(clientIP);

        if (user.role === 'master') {
            console.log(`User ${user.nickname} tried to claim master role but is already a master`);
            return res.status(400).json({ message: 'You are already a master' });
        }

        // Check if there is no master present
        const masterExists = Array.from(users.values()).some(u => u.role === 'master');
        if (!masterExists) {
            user.role = 'master';
            console.log(`User ${user.nickname} claimed the master role`);
            printUsers();
            return res.json({ message: 'You are now the master' });
        } else {
            console.log(`User ${user.nickname} tried to claim master role but a master already exists`);
            return res.status(400).json({ message: 'A master already exists' });
        }
    });

    app.post('/set-user-role', (req, res) => {
        const { ip, role } = req.body;

        if (!ip || !role) {
            return res.status(400).json({ message: 'IP and role are required' });
        }

        // Validate role
        const validRoles = ['master', 'guest', 'bottom'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be: master, guest, or bottom' });
        }

        const success = setUserRole(ip, role);
        if (success) {
            return res.json({ message: `User role updated to ${role}` });
        } else {
            return res.status(404).json({ message: 'User not found' });
        }
    });

    app.post('/set-user-nickname', (req, res) => {
        const { ip, nickname } = req.body;

        if (!ip || !nickname) {
            return res.status(400).json({ message: 'IP and nickname are required' });
        }

        // Basic nickname validation
        if (nickname.length < 1 || nickname.length > 50) {
            return res.status(400).json({ message: 'Nickname must be between 1 and 50 characters' });
        }

        const success = setUserNickname(ip, nickname);
        if (success) {
            return res.json({ message: `User nickname updated to ${nickname}` });
        } else {
            return res.status(404).json({ message: 'User not found' });
        }
    });

    app.get('/random-shock/status', (req, res) => {
        res.json({
            active: randomShockingActive,
            settings: randomShockSettings,
            mcu_connected: serialPort && serialPort.isOpen,
            next_shock_scheduled: randomShockTimeout !== null
        });
    });

    app.post('/random-shock/settings', (req, res) => {
        const clientIP = getClientIP(req);
        const user = getOrCreateUser(clientIP);

        // Check permissions (only master can change settings)
        if (user.role !== 'master') {
            return res.status(403).json({ message: 'Permission denied: only masters can change random shock settings' });
        }

        const { enabled, gapRange, durationRange, powerRange } = req.body;

        // Handle enabled/disabled toggle
        if (enabled !== undefined) {
            const wasEnabled = randomShockSettings.enabled;
            
            if (enabled && !wasEnabled) {
                // Starting random shocking
                const success = startRandomShocking();
                if (!success) {
                    return res.status(400).json({ message: 'Cannot enable random shocking: MCU not connected' });
                }
                console.log(`Random shocking ENABLED by ${user.nickname}`);
            } else if (!enabled && wasEnabled) {
                // Stopping random shocking
                stopRandomShocking();
                console.log(`Random shocking DISABLED by ${user.nickname}`);
            }
        }

        // Validate and update other settings
        if (gapRange && gapRange.min && gapRange.max) {
            if (gapRange.min >= 1000 && gapRange.max >= gapRange.min && gapRange.max <= 300000) {
                randomShockSettings.gapRange = gapRange;
            } else {
                return res.status(400).json({ message: 'Invalid gap range. Min must be >= 1000ms, max <= 300000ms' });
            }
        }

        if (durationRange && durationRange.min && durationRange.max) {
            if (durationRange.min >= 100 && durationRange.max >= durationRange.min && durationRange.max <= 30000) {
                randomShockSettings.durationRange = durationRange;
            } else {
                return res.status(400).json({ message: 'Invalid duration range. Min must be >= 100ms, max <= 30000ms' });
            }
        }

        if (powerRange && powerRange.min !== undefined && powerRange.max !== undefined) {
            if (powerRange.min >= 0 && powerRange.max <= 99 && powerRange.max >= powerRange.min) {
                randomShockSettings.powerRange = powerRange;
            } else {
                return res.status(400).json({ message: 'Invalid power range. Must be 0-99' });
            }
        }

        console.log(`Random shock settings updated by ${user.nickname}:`, randomShockSettings);
        res.json({ 
            message: 'Settings updated successfully',
            settings: randomShockSettings,
            active: randomShockingActive,
            next_shock_scheduled: randomShockTimeout !== null
        });
    });

// # Enable random shocking
// curl -X POST http://localhost:3000/random-shock/settings \
//   -H "Content-Type: application/json" \
//   -d '{"enabled": true}'

// # Disable random shocking
// curl -X POST http://localhost:3000/random-shock/settings \
//   -H "Content-Type: application/json" \
//   -d '{"enabled": false}'

// # Update settings and enable at the same time
// curl -X POST http://localhost:3000/random-shock/settings \
//   -H "Content-Type: application/json" \
//   -d '{"enabled": true, "gapRange":{"min":3000,"max":10000}, "powerRange":{"min":20,"max":60}}'

// # Check status (includes next_shock_scheduled for debugging)
// curl http://localhost:3000/random-shock/status

// Random shoking system
    let randomShockingActive = false;
    let randomShockTimeout = null;

    // Random shocking settings (configurable ranges)
    const randomShockSettings = {
        enabled: false,                           // Add enabled/disabled flag
        gapRange: { min: 5000, max: 15000 },      // Gap between shocks (5-15 seconds)
        durationRange: { min: 1000, max: 5000 }, // Shock duration (1-5 seconds)
        powerRange: { min: 10, max: 80 }         // Power level (10-80)
    };

    // Function to get random value within range
    function getRandomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Function to execute a random shock
    async function executeRandomShock() {
        // Check if random shocking is still active and enabled
        if (!randomShockingActive || !randomShockSettings.enabled || !serialPort || !serialPort.isOpen) {
            console.log('Random shock cancelled - system inactive or MCU disconnected');
            return;
        }

        const power = getRandomInRange(randomShockSettings.powerRange.min, randomShockSettings.powerRange.max);
        const duration = getRandomInRange(randomShockSettings.durationRange.min, randomShockSettings.durationRange.max);
        const timestamp = new Date().toLocaleString();

        console.log(`- Random shock scheduled: ${timestamp} - Power: ${power} - Duration: ${duration}ms`);

        try {
            // Set power level
            const powerCommand = `P${power}!`;
            serialPort.write(powerCommand);
            
            // Wait a moment for power to be set
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Start shock
            serialPort.write('1');
            console.log(`- Random shock started: Power ${power} for ${duration}ms`);
            
            // Stop shock after duration
            setTimeout(() => {
                if (serialPort && serialPort.isOpen) {
                    serialPort.write('0');
                    console.log(`-  Random shock ended after ${duration}ms`);
                }
            }, duration);
            
            // Schedule next shock only if still active and enabled
            if (randomShockingActive && randomShockSettings.enabled) {
                scheduleNextRandomShock();
            }
            
        } catch (error) {
            console.error('Error executing random shock:', error);
            // Still schedule next shock even if this one failed, but only if still active
            if (randomShockingActive && randomShockSettings.enabled) {
                scheduleNextRandomShock();
            }
        }
    }

    // Function to schedule the next random shock
    function scheduleNextRandomShock() {
        // Clear any existing timeout first
        if (randomShockTimeout) {
            clearTimeout(randomShockTimeout);
            randomShockTimeout = null;
        }

        if (!randomShockingActive || !randomShockSettings.enabled) {
            console.log('-  Next shock not scheduled - random shocking disabled');
            return;
        }

        const gap = getRandomInRange(randomShockSettings.gapRange.min, randomShockSettings.gapRange.max);
        const nextShockTime = new Date(Date.now() + gap).toLocaleString();
        
        console.log(`- Next random shock scheduled in ${gap/1000}s at ${nextShockTime}`);
        
        randomShockTimeout = setTimeout(() => {
            executeRandomShock();
        }, gap);
    }

    // Function to start random shocking
    function startRandomShocking() {
        if (!serialPort || !serialPort.isOpen) {
            console.error('Cannot start random shocking: MCU not connected');
            return false;
        }

        // Clear any existing timeouts to prevent duplicate scheduling
        if (randomShockTimeout) {
            clearTimeout(randomShockTimeout);
            randomShockTimeout = null;
        }

        randomShockingActive = true;
        randomShockSettings.enabled = true;
        console.log('- Random shocking mode STARTED');
        scheduleNextRandomShock();
        return true;
    }

    // Function to stop random shocking
    function stopRandomShocking() {
        randomShockingActive = false;
        randomShockSettings.enabled = false;
        
        // Clear any pending timeouts
        if (randomShockTimeout) {
            clearTimeout(randomShockTimeout);
            randomShockTimeout = null;
            console.log('- Cancelled pending random shock');
        }
        
        // Emergency stop - send stop command to MCU
        if (serialPort && serialPort.isOpen) {
            serialPort.write('0');
        }
        
        console.log('- Random shocking mode STOPPED');
        return true;
    }


// User tracking
    // User registry - IP address as key
    const users = new Map();
    let userCounter = 1;

    // Helper function to get client IP
    function getClientIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0] || 
            req.headers['x-real-ip'] || 
            req.connection.remoteAddress || 
            req.socket.remoteAddress;
    }

    // Helper function to normalize IPv6 addresses  
    function normalizeIP(ip) {
        if (ip.startsWith('::ffff:')) {
            // IPv4-mapped IPv6 address
            return ip.substring(7);
        }
        return ip;
    }

    // Get or create user entry
    function getOrCreateUser(ip) {
        const normalizedIP = normalizeIP(ip);

        if (!users.has(normalizedIP)) {
            const masterIsPresent = Array.from(users.values()).some(user => user.role === 'master');
            users.set(normalizedIP, {
                nickname: `gooner_${userCounter++}`,
                role: masterIsPresent ? 'bottom' : 'guest',
                ip: normalizedIP,
                connected: false,
                connections: new Set()
            });
            console.log(`New user: ${users.get(normalizedIP).nickname} - Role: ${users.get(normalizedIP).role}`);
        }

        return users.get(normalizedIP);
    }

    // Change user properties
        // Function to change user roles (call manually or via admin interface)
        function setUserRole(ip, role) {
            const normalizedIP = normalizeIP(ip);
            const user = users.get(normalizedIP);
            if (user) {
            user.role = role;
            console.log(`Changed role for ${user.nickname} to ${role}`);
            printUsers();
            return true;
            }
            console.log(`Cannot set role, user with IP ${ip} not found`);
            return false;
        }

        // Function to set user nickname
        function setUserNickname(ip, newNickname) {
            const normalizedIP = normalizeIP(ip);
            const user = users.get(normalizedIP);
            if (user) {
            const oldNickname = user.nickname;
            user.nickname = newNickname;
            console.log(`Changed user nickname from ${oldNickname} to ${newNickname}`);
            printUsers();
            return true;
            }
            console.log(`Cannot set nick, user with IP ${ip} not found`);
            return false;
        }

    // Sending users data to clients
        // Print all users
        function printUsers() {
            console.log('\n=== Users ===');
            users.forEach((user) => {
                const status = user.connected ? 'connected' : 'disconnected';
                console.log(`${user.nickname} - ${user.role} - ${status} - ${user.connections.size} connection(s)`);
            });
            console.log('=============\n');

            wsBroadcastUsers();
        }

        // Function that transforms users Map to an array of user data to send to clients
        function getUsersDataArray() {
            const usersArray = [];
            users.forEach((user, ip) => {
                usersArray.push({
                    ip: ip, // Using IP as unique ID
                    username: user.nickname,
                    role: user.role,
                    status: user.connected ? 'online' : 'offline',
                });
            });
            return usersArray;
        }

        // Function to broadcast users data to all connected clients
        function wsBroadcastUsers() {
            wss.clients.forEach((client) => {
                if (client.readyState === client.OPEN && client.user) {
                    const usersMessage = JSON.stringify({
                        type: 'users',
                        users: getUsersDataArray(),
                        my_user_info: {
                            ip: client.user.ip,
                            nickname: client.user.nickname,
                            role: client.user.role,
                        }
                    });
                    client.send(usersMessage);
                }
            });
        }


// WebSocket connection handling
    wss.on('connection', (ws, req) => {
        // Get client IP and user info
            const clientIP = getClientIP(req);
            const user = getOrCreateUser(clientIP);

            // Add this connection to the user's connection set
            user.connections.add(ws);
            user.connected = true;

            console.log(`Client connected: ${user.nickname}`);
            printUsers();
            ws.user = user; // Store user reference on the WebSocket for easy access
            wsBroadcastUsers();


        // Ping pong
            const pingInterval = setInterval(() => {
                if (ws.readyState === ws.OPEN) {
                    ws.ping();
                } else {
                    clearInterval(pingInterval);
                }
            }, 5000);

            ws.on('pong', () => {
            });


        // Transmit current status to the clients
            ws.send(JSON.stringify({
                type: 'status',
                mcu_status: currentMcuStatus,
                user_commands: {
                    start: Array.from(userCommands.start),
                    stop: Array.from(userCommands.stop)
                }
            }));


        // Handle incoming messages from the clients
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'command') {
                        // Check if user has permission (only master and guest can send commands)
                        if (user.role === 'bottom') {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: 'bottom: Cannot send commands'
                            }));
                            return;
                        }

                        if (data.command === 'start' && serialPort && serialPort.isOpen) {
                            serialPort.write('1');
                            console.log(`START command from ${user.nickname} (${user.role})`);

                            // Track user command by IP
                            userCommands.start.add(user.ip);
                            userCommands.stop.delete(user.ip);
                            wsBroadcastMcuStatus();

                        } else if (data.command === 'stop' && serialPort && serialPort.isOpen) {
                            serialPort.write('0');
                            console.log(`STOP command from ${user.nickname} (${user.role})`);

                            // Track user command by IP
                            userCommands.stop.add(user.ip);
                            userCommands.start.delete(user.ip);
                            wsBroadcastMcuStatus();
                        } else if (data.command === 'set_power' && data.hasOwnProperty('set_power_to')) {
                            const powerLevel = parseInt(data.set_power_to, 10);
                            if (isNaN(powerLevel) || powerLevel < 0 || powerLevel > 99) {
                                console.error(`Invalid power level: ${data.set_power_to}`);
                                return;
                            }

                            if (serialPort && serialPort.isOpen) {
                                const mcuCommandString = `P${powerLevel}!`;
                                serialPort.write(mcuCommandString);
                                console.log(`Power level set to ${currentMcuPowerLevel} by ${user.nickname} (${user.role})`);
                                wsBroadcastMcuStatus();
                            } else {
                                console.error('Cannot set power: serialPort is not open or not connected.');
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: 'MCU is not connected.'
                                }));
                            }
                        } else if (data.command === 'calibrate' && serialPort && serialPort.isOpen) {
                            serialPort.write('C');
                            console.log(`CALIBRATE command from ${user.nickname} (${user.role})`);
                        }

                    } else if (data.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });


        // Handle client disconnection and error
            ws.on('close', () => {
                user.connections.delete(ws);
                console.log(`Client disconnected: ${user.nickname}`);

                // Mark user as disconnected if no more connections
                if (user.connections.size === 0) {
                    user.connected = false;

                    // Remove user from command tracking when they disconnect
                    userCommands.start.delete(user.ip);
                    userCommands.stop.delete(user.ip);
                    wsBroadcastMcuStatus();
                }

                // Transmitt updated users data
                printUsers();

                clearInterval(pingInterval);
            });

            ws.on('error', (error) => {
                console.error('WebSocket connection error:', error);
                user.connections.delete(ws);
                clearInterval(pingInterval);
            });
    });

    function wsBroadcastMcuStatus() {
        const statusMessage = JSON.stringify({
            type: 'status',
            mcu_status: currentMcuStatus,
            mcu_power_level: currentMcuPowerLevel,
            user_commands: {
                start: Array.from(userCommands.start),
                stop: Array.from(userCommands.stop)
            }
        });

        wss.clients.forEach((client) => {
            if (client.readyState === client.OPEN) {
                client.send(statusMessage);
            }
        });
    }

    // Every 4 seconds broadcast the users status
    setInterval(() => {
        wsBroadcastUsers();
    }, 4000);


// Start serverwsBroadcastStatus
    server.listen(PORT, async () => {
        console.log(`\nServer running at http://localhost:${PORT}`);

        // Try to connect to Arduino when server starts
        await tryConnectToMcu();
    });