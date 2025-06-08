// backend_server.js

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


// Arduino
    let serialPort = null;
    let currentMcuStatus = 'disconnected'; // 'disconnected', 'idle', 'running'
    
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

        // Try common Arduino port patterns first
        const portsToTry = [...commonPatterns];

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
                    const message = data.toString().trim();

                    if (message === 'A') {
                        currentMcuStatus = 'running';
                        wsBroadcastMcuStatus();
                        console.log('Sending RUNNING status');
                    } else if (message === 'B') {
                        currentMcuStatus = 'idle';
                        wsBroadcastMcuStatus();
                        console.log('Sending IDLE status');
                    }
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
                        }

                        // if (data.command === 'start') {
                        //     console.log(`START command from ${user.nickname} (${user.role})`);
                        //     currentMcuStatus = 'running';
                        //     wsBroadcastMcuStatus();

                        //     // Track user command by IP
                        //     userCommands.start.add(user.ip);
                        //     userCommands.stop.delete(user.ip);
                        //     wsBroadcastMcuStatus();
                        // } else if (data.command === 'stop') {
                        //     console.log(`STOP command from ${user.nickname} (${user.role})`);
                        //     currentMcuStatus = 'idle';
                        //     wsBroadcastMcuStatus();

                        //     // Track user command by IP
                        //     userCommands.stop.add(user.ip);
                        //     userCommands.start.delete(user.ip);
                        //     wsBroadcastMcuStatus();
                        // }
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