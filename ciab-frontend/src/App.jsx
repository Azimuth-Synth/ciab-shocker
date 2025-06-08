import { useState, useEffect, useRef } from 'react'
import styles from "./App.module.css"

function App() {
    // State
        const [backgroundImg, setBackgroundImg] = useState(null)
        const [imageLoaded, setImageLoaded] = useState(false)
        const [isLoading, setIsLoading] = useState(true)
        const [isActive, setIsActive] = useState(false);

    // Websocket state
        const [arduinoStatus, setArduinoStatus] = useState('disconnected'); // 'disconnected', 'idle', 'running'
        const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
        const wsRef = useRef(null);


    // Background
        // Fuction to get a random image
            const getRandomBackground = async () => {
                try {
                    console.log("Getting image");
                    // Import all PNG and JPG files from background_art directory
                    const images = import.meta.glob('./assets/background_art/*.{png,jpg,jpeg}');
                    const imageKeys = Object.keys(images);

                    if (imageKeys.length === 0) return null;

                    // Select random image
                    const randomIndex = Math.floor(Math.random() * imageKeys.length);
                    const randomImagePath = imageKeys[randomIndex];

                    // Dynamically import the selected image
                    const imageModule = await images[randomImagePath]();
                    return imageModule.default;
                } catch (error) {
                    console.error('Error loading background image:', error);
                    return null;
                }
            }

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

    // Websocket and indicator
        // WebSocket Setup on load
            useEffect(() => {
                // Get WebSocket URL from environment variable, fallback to localhost for local development
                const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3000';
                
                console.log('Connecting to WebSocket:', websocketUrl);
                
                // Connect to WebSocket server
                const ws = new WebSocket(websocketUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log('Connected to WebSocket server');
                    setIsWebSocketConnected(true);
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'status') {
                            setArduinoStatus(data.status);
                            console.log('Arduino status:', data.status);
                        }
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                ws.onclose = () => {
                    console.log('Disconnected from WebSocket server');
                    setIsWebSocketConnected(false);
                    setArduinoStatus('disconnected');
                };

                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    setIsWebSocketConnected(false);
                };

                // Cleanup on component unmount
                return () => {
                    ws.close();
                };
            }, []);

        // Arduino Control Functions
            const sendCommand = (command) => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'command',
                        command: command
                    }));
                    console.log(`Sent ${command} command to Arduino`);
                } else {
                    console.log('WebSocket not connected');
                }
            };

        // Indicator Functions
            const getStatusColor = () => {
                switch (arduinoStatus) {
                    case 'running': return '#ffff00';
                    case 'idle': return '#00ff00';
                    case 'disconnected': return '#ff0000';
                    default: return '#9E9E9E'; // Gray
                }
            };

            const getStatusText = () => {
                switch (arduinoStatus) {
                    case 'running': return 'Arduino Running';
                    case 'idle': return 'Arduino Idle';
                    case 'disconnected': return 'Arduino Disconnected';
                    default: return 'Unknown Status';
                }
            };

            const isArduinoReady = () => {
                return isWebSocketConnected && arduinoStatus !== 'disconnected';
            };

            const isArduinoRunning = () => {
                return isWebSocketConnected && arduinoStatus === 'running';
            }

    // Button handlers
        function onMouseDown(){
            setIsActive(true);
            sendCommand('start');
        }
        function onMouseUp(){
            setIsActive(false);
            sendCommand('stop');
        }

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
                <h1>Cytober is a bitch</h1>

                <div className={`${styles.card} ${isArduinoRunning() ? styles.cardActive : ''}`}>
                    <p> Press this button to shock the bitch :P </p>


                    {/* Shock button */}
                        <button
                            onMouseDown={onMouseDown}
                            onMouseUp={onMouseUp}
                            disabled={!isArduinoReady()}
                            className={`${styles.shock_button} ${!isArduinoReady() ? styles.buttonDisabled : ''}`}
                        >
                            Shock!
                        </button>


                    {/* Status */}
                        <div className={styles.statusTextContainer}>
                            <div className={styles.statusIndicator} style={{ backgroundColor: getStatusColor() }} />
                            <span className={styles.statusText}>{getStatusText()}</span>
                        </div>

                        <div className={styles.statusTextContainer}>
                            <div className={styles.statusIndicator} style={{ backgroundColor: isWebSocketConnected ? '#00ff00' : '#ff0000'}} />
                            <span className={styles.statusText}> WebSocket: {isWebSocketConnected ? 'Connected' : 'Disconnected'} </span>
                        </div>


                    {/* Change bc button */}
                        <button onClick={changeBackground}> Change background </button>
                </div>
            </div>
        </>
    )
}

export default App