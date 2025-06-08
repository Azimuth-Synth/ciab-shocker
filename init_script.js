const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration - update these paths to match your project structure
const FRONTEND_DIR = './ciab-frontend';
const BACKEND_DIR = './ciab-backend';

console.log('Starting servers with Cloudflare tunnels...');

let reactProcess, nodeProcess, frontendTunnel, backendTunnel;
let backendTunnelUrl = '';
let frontendTunnelUrl = '';

// Function to extract tunnel URL from cloudflared output
function extractTunnelUrl(data) {
    const output = data.toString();
    const match = output.match(/https:\/\/[a-zA-Z0-9\-\.]+\.trycloudflare\.com/);
    return match ? match[0] : null;
}

// Function to update the frontend environment
function updateFrontendEnv(websocketUrl) {
    const envPath = path.resolve(FRONTEND_DIR, '.env');
    const envContent = `VITE_WEBSOCKET_URL=${websocketUrl.replace('https://', 'wss://')}\n`;
    
    try {
        fs.writeFileSync(envPath, envContent);
        console.log(`  - Updated frontend .env with: ${websocketUrl.replace('https://', 'wss://')}`);
    } catch (error) {
        console.error('  - Failed to update .env file:', error);
    }
}

// Function to start React dev server
function startReactServer() {
    console.log('- Starting React server...');
    reactProcess = spawn('npm', ['run', 'dev'], {
        cwd: path.resolve(FRONTEND_DIR),
        stdio: 'ignore',
    });

    reactProcess.on('spawn', () => {
        console.log('\nServers started successfully!');
        console.log('Stop by pressing Ctrl+C');
        console.log('Send this url to users to access the device:');
        console.log(`  - Frontend: ${frontendTunnelUrl}`);
        console.log("\n\n");
    });

    reactProcess.on('close', (code) => {
        console.log(`  - React server exited with code ${code}`);
        cleanup();
    });

    reactProcess.on('error', (err) => {
        console.error('  - Failed to start React server:', err);
        cleanup();
    });
}

// Function to start Node.js backend server
function startNodeServer() {
    console.log('- Starting Node.js backend server...');
    nodeProcess = spawn('node', ['server.js'], {
        cwd: path.resolve(BACKEND_DIR),
        stdio: 'inherit',
    });

    nodeProcess.on('close', (code) => {
        console.log(`  - Node.js server exited with code ${code}`);
        cleanup();
    });

    nodeProcess.on('error', (err) => {
        console.error('  - Failed to start Node.js server:', err);
        cleanup();
    });
}

// Function to start frontend tunnel
function startFrontendTunnel() {
    console.log('- Creating frontend tunnel...');
    frontendTunnel = spawn('cloudflared', ['tunnel', '--url', 'localhost:4000'], {
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    frontendTunnel.stdout.on('data', (data) => {
        const url = extractTunnelUrl(data);
        if (url) {
            console.log(`  - Frontend available at: ${url}`);
            frontendTunnelUrl = url;
        }
    });

    frontendTunnel.stderr.on('data', (data) => {
        const url = extractTunnelUrl(data);
        if (url) {
            console.log(`  - Frontend available at: ${url}`);
            frontendTunnelUrl = url;
        }
    });

    frontendTunnel.on('close', (code) => {
        console.log(`  - Frontend tunnel exited with code ${code}`);
        cleanup();
    });

    frontendTunnel.on('error', (err) => {
        console.error('  - Failed to start frontend tunnel:', err);
        cleanup();
    });
}

// Function to start backend tunnel
function startBackendTunnel() {
    console.log('\n- Creating backend tunnel...');
    backendTunnel = spawn('cloudflared', ['tunnel', '--url', 'localhost:3000'], {
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    backendTunnel.stdout.on('data', (data) => {
        const url = extractTunnelUrl(data);
        if (url && !backendTunnelUrl) {
            backendTunnelUrl = url;
            console.log(`  - Backend WebSocket available at: ${url}`);
            updateFrontendEnv(url);
            
            // Start React server after we have the backend URL
            setTimeout(startReactServer, 2000);
        }
    });

    backendTunnel.stderr.on('data', (data) => {
        const url = extractTunnelUrl(data);
        if (url && !backendTunnelUrl) {
            backendTunnelUrl = url;
            console.log(`  - Backend WebSocket available at: ${url}`);
            updateFrontendEnv(url);
            
            // Start React server after we have the backend URL
            setTimeout(startReactServer, 2000);
        }
    });

    backendTunnel.on('close', (code) => {
        console.log(`  - Backend tunnel exited with code ${code}`);
        cleanup();
    });

    backendTunnel.on('error', (err) => {
        console.error('  -Failed to start backend tunnel:', err);
        cleanup();
    });
}

// Cleanup function
function cleanup() {
    if (reactProcess) reactProcess.kill('SIGTERM');
    if (nodeProcess) nodeProcess.kill('SIGTERM');
    if (frontendTunnel) frontendTunnel.kill('SIGTERM');
    if (backendTunnel) backendTunnel.kill('SIGTERM');

    process.exit(0);
}

// Start sequence
startNodeServer();

setTimeout(() => {
    startBackendTunnel();
}, 3000);

setTimeout(() => {
    startFrontendTunnel();
}, 5000);

// Handle Ctrl+C gracefully
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);