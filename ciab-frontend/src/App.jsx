// ReactApp.jsx

import { useState, useEffect, useRef } from 'react'
import styles from "./App.module.css"

import ControlPanel from './components/ControlPanel'
import UsersPanel from './components/UsersPanel'
import Modal from './components/Modal'

function App() {
    // State
        const [backgroundImg, setBackgroundImg] = useState(null)
        const [imageLoaded, setImageLoaded] = useState(false)
        const [users, setUsers] = useState([]); // Users data from backend
        const [myUser, setMyUser] = useState(null); // Current user data
        const [isModalOpen, setIsModalOpen] = useState(null); // Modal state for user controls

    // Websocket state
        const [mcuStatus, setMcuStatus] = useState('disconnected'); // 'disconnected', 'idle', 'running'
        const [userCommands, setUserCommands] = useState({ start: [], stop: [] }); // Track user commands
        const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
        const wsRef = useRef(null);


    // Background
        // Fuction to get a random image
            const prevImageRef = useRef(null);

            const getRandomBackground = async () => {
                try {
                    // Import all PNG and JPG files from background_art directory
                    const images = import.meta.glob('./assets/background_art/*.{png,jpg,jpeg}');
                    const imageKeys = Object.keys(images);

                    if (imageKeys.length === 0) return null;

                    // Filter out the current image if possible
                    let availableImages = imageKeys;
                    if (prevImageRef.current && imageKeys.length > 1) {
                        availableImages = imageKeys.filter(key => key !== prevImageRef.current);
                    }

                    // Select random image
                    const randomIndex = Math.floor(Math.random() * availableImages.length);
                    const randomImagePath = availableImages[randomIndex];

                    // Dynamically import the selected image
                    const imageModule = await images[randomImagePath]();

                    // Store the current image path for next time
                    prevImageRef.current = randomImagePath;

                    return imageModule.default;
                } catch (error) {
                    console.error('Error loading background image:', error);
                    return null;
                }
            };

        // Function to change background randomly
            const changeBackground = async () => {
                setImageLoaded(false) // Reset image loaded state
                const newBackground = await getRandomBackground()
                setBackgroundImg(newBackground)
                console.log("Background changed to:", newBackground)
            }

        // Load random background on component mount
            useEffect(() => {
                changeBackground()
            }, [])

        // Handle image load
            const handleImageLoad = () => {
                setImageLoaded(true)
            }

    // Websocket and indicators
        // WebSocket Setup on load
            useEffect(() => {
                // Get WebSocket URL from environment variable, fallback to localhost for local development
                const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3000';

                // Convert HTTPS to WSS and ensure we're connecting to the WebSocket endpoint
                let websocketerUrl;
                if (websocketUrl.startsWith('https://')) {
                    websocketerUrl = websocketUrl.replace('https://', 'wss://');
                } else if (websocketUrl.startsWith('http://')) {
                    websocketerUrl = websocketUrl.replace('http://', 'ws://');
                } else {
                    websocketerUrl = websocketUrl;
                }

                console.log('Connecting to WebSocket:', websocketerUrl);

                // Connect to WebSocket server
                const ws = new WebSocket(websocketerUrl);
                wsRef.current = ws;

                // Set up client-side ping interval
                let pingInterval;

                ws.onopen = () => {
                    console.log('Connected to WebSocket server');
                    setIsWebSocketConnected(true);

                    // Start pinging server every 25 seconds
                    pingInterval = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'ping' }));
                        }
                    }, 25000);
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'status') {
                            setMcuStatus(data.mcu_status);
                            if (data.user_commands) {
                                setUserCommands(data.user_commands);
                            }
                        } else if (data.type === 'users') {
                            setUsers(data.users);
                            setMyUser(data.my_user_info);
                        } else if (data.type === 'pong') {
                            // Handle pong response
                        }
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                ws.onclose = () => {
                    console.log('Disconnected from WebSocket server');
                    setIsWebSocketConnected(false);
                    setMcuStatus('disconnected');
                    setUserCommands({ start: [], stop: [] });
                    if (pingInterval) {
                        clearInterval(pingInterval);
                    }
                };

                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    setIsWebSocketConnected(false);
                    if (pingInterval) {
                        clearInterval(pingInterval);
                    }
                };

                // Cleanup on component unmount
                return () => {
                    if (pingInterval) {
                        clearInterval(pingInterval);
                    }
                    ws.close();
                };
            }, []);

        // Arduino Control Functions
            const sendMcuCommand = (command) => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    console.log(`Sent ${command} command to Arduino`);
                    wsRef.current.send(JSON.stringify({
                        type: 'command',
                        command: command
                    }));
                } else {
                    console.log('WebSocket not connected');
                }
            };


    return (
        <>
            {/* Background image */}
                <img
                    className={`${styles.background} ${imageLoaded ? styles.backgroundLoaded : ''}`}
                    src={backgroundImg} 
                    onLoad={handleImageLoad}
                />

            {/* Main content */}
                <div className={styles.container}>
                    <Modal isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} users={users} myUser={myUser}/>

                    <div className={styles.title}>
                        <h1>Cytober is a bitch</h1>
                    </div>

                    <div className={styles.controlPanel}>
                        <ControlPanel mcuStatus={mcuStatus} sendMcuCommand={sendMcuCommand} changeBackground={changeBackground} isWebSocketConnected={isWebSocketConnected} myUser={myUser}/>
                    </div>

                    <div className={styles.usersPanel}>
                        <UsersPanel users={users} myUser={myUser} setIsModalOpen={setIsModalOpen} userCommands={userCommands}/>
                    </div>
                </div>
        </>
    )
}

export default App