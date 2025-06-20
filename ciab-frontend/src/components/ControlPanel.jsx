import styles from './ControlPanel.module.css';

import { useState } from 'react';

function ControlPanel({ mcuStatus, mcuPowerLevel, sendMcuCommand, changeBackground, isWebSocketConnected, myUser }) {
    const [reconnectStatus, setReconnectStatus] = useState(''); // '', 'success', 'error'
    const [adjustingSliderPower, setAdjustingSliderPower] = useState(mcuPowerLevel);


    // Shock button
        function onMouseDown(){
            sendMcuCommand('start');
        }
        function onMouseUp(){
            sendMcuCommand('stop');
        }


    // Power display slider


    // Power adjust slider
        const handleUserSliderChange = (e) => {
            setAdjustingSliderPower(parseInt(e.target.value));
        };

        const handleUserSliderRelease = () => {
            sendMcuCommand('set_power', adjustingSliderPower);
        };


    // Get styles based on MCU status
        const getMcuStatusColor = () => {
            switch (mcuStatus) {
                case 'running': return '#ffff00';
                case 'busy': return '#0000ff';
                case 'idle': return '#00ff00';
                case 'disconnected': return '#ff0000';
                default: return '#9E9E9E'; // Gray
            }
        };
        const getMcuStatusText = () => {
            switch (mcuStatus) {
                case 'running': return 'Arduino: Running';
                case 'busy': return 'Arduino: Busy';
                case 'idle': return 'Arduino: Idle';
                case 'disconnected': return 'Arduino: Disconnected';
                default: return 'Arduino: Unknown';
            }
        };

    // Send reconnect request to MCU
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
                        disabled={mcuStatus == "disconnected" || mcuStatus == "busy" || myUser.role == "bottom"}
                        className={styles.shockButton}
                    >
                        Shock!
                    </button>


                {/* Power display */}
                   <p> Current power: {mcuPowerLevel} </p>
                    <input
                        type="range"
                        min="0"
                        max="99"
                        value={mcuPowerLevel}
                        readOnly
                        className={styles.powerDisplaySlider}
                    />


                {/* Power selector */}
                   <p> Adjust power to: {adjustingSliderPower} </p>
                   <input
                        type="range"
                        min="0"
                        max="99"
                        value={adjustingSliderPower}
                        onChange={handleUserSliderChange}
                        onMouseUp={handleUserSliderRelease}
                        onTouchEnd={handleUserSliderRelease}
                        className={styles.powerAdjustSlider}
                    />

            </div>
        </div>
    )
}

export default ControlPanel;