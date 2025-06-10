import styles from './ControlPanel.module.css';

import { useState } from 'react';

function ControlPanel({ mcuStatus, sendMcuCommand, changeBackground, isWebSocketConnected, myUser }) {
    const [reconnectStatus, setReconnectStatus] = useState(''); // '', 'success', 'error'


    function onMouseDown(){
        sendMcuCommand('start');
    }
    function onMouseUp(){
        sendMcuCommand('stop');
    }


    const getMcuStatusColor = () => {
        switch (mcuStatus) {
            case 'running': return '#ffff00';
            case 'idle': return '#00ff00';
            case 'disconnected': return '#ff0000';
            default: return '#9E9E9E'; // Gray
        }
    };
    const getMcuStatusText = () => {
        switch (mcuStatus) {
            case 'running': return 'Arduino: Running';
            case 'idle': return 'Arduino: Idle';
            case 'disconnected': return 'Arduino: Disconnected';
            default: return 'Arduino: Unknown';
        }
    };
    const sendMcuReconnectRequest = async () => {
        const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL || 'localhost';
        const requestUrl = `${websocketUrl}/reconnect-mcu`;

        try {
            const response = await fetch(requestUrl, { method: 'GET' });

            if (response.ok) {
                console.log('Reconnect MCU request sent to :', requestUrl);
                setReconnectStatus('success');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error sending reconnect MCU request:', error);
            setReconnectStatus('error');
        }

        // Clear status after 1 second
        setTimeout(() => {
            setReconnectStatus('');
        }, 1000);
    }


    return (
        <div className={styles.container}>
            <div className={`${styles.card} ${mcuStatus == 'running' ? styles.cardActive : ''}`}>
                <p> Press this button to shock the bitch :P </p>

                {/* Change bc button */}
                    <button onClick={changeBackground} className={styles.backgroundChangeButton}> Change background </button>

                {/* Status */}
                    <div className={styles.statusTextContainer}>
                        <div className={styles.statusIndicator} style={{ backgroundColor: getMcuStatusColor() }} />
                        <span className={styles.statusText}>{getMcuStatusText()}</span>

                        {mcuStatus == "disconnected" &&
                            <button 
                                onClick={sendMcuReconnectRequest} 
                                className={`${styles.reconnect_button} ${
                                    reconnectStatus === 'success' ? styles.reconnect_button_succ :
                                    reconnectStatus === 'error' ? styles.reconnect_button_fail : ''
                                }`}
                            > ⟲ </button>
                        }
                    </div>

                    <div className={styles.statusTextContainer}>
                        <div className={styles.statusIndicator} style={{ backgroundColor: isWebSocketConnected ? '#00ff00' : '#ff0000'}} />
                        <span className={styles.statusText}> WebSocket: {isWebSocketConnected ? 'Connected' : 'Disconnected'} </span>
                    </div>

                {/* Shock button */}
                    <button
                        onMouseDown={onMouseDown}
                        onMouseUp={onMouseUp}
                        onTouchStart={onMouseDown}
                        onTouchEnd={onMouseUp}
                        onTouchCancel={onMouseUp}
                        disabled={mcuStatus == "disconnected" || myUser.role == "bottom"}
                        className={styles.shockButton}
                    >
                        Shock!
                    </button>
            </div>
        </div>
    )
}

export default ControlPanel;