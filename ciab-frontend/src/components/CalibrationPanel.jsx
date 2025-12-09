import styles from './CalibrationPanel.module.css';

import { useState } from 'react';

function CalibrationPanel({ mcuStatus, sendMcuCommand, isWebSocketConnected, myUser }) {
    const [calibrationStatus, setCalibrationStatus] = useState(''); // '', 'sent', 'error'

    // Send calibrate command
    const sendCalibrate = () => {
        if (isWebSocketConnected && mcuStatus !== 'disconnected') {
            sendMcuCommand('calibrate');
            console.log('Calibrate command sent');
            setCalibrationStatus('sent');
            
            // Clear status after 2 seconds
            setTimeout(() => {
                setCalibrationStatus('');
            }, 2000);
        } else {
            console.log('WebSocket not connected - cannot calibrate');
            setCalibrationStatus('error');
            
            setTimeout(() => {
                setCalibrationStatus('');
            }, 2000);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                {/* Title */}
                <h2 className={styles.title}>Power Calibration</h2>

                {/* Description */}
                <p className={styles.description}>
                    Calibrate the power output to ensure accurate shock delivery.
                    This will run a calibration sequence on the device.
                </p>

                {/* Calibrate button */}
                <button
                    onClick={sendCalibrate}
                    disabled={mcuStatus === "disconnected" || mcuStatus === "busy" || !isWebSocketConnected || myUser?.role === "bottom"}
                    className={`${styles.calibrateButton} ${
                        calibrationStatus === 'sent' ? styles.calibrateButtonSuccess :
                        calibrationStatus === 'error' ? styles.calibrateButtonError : ''
                    }`}
                >
                    {calibrationStatus === 'sent' ? '✓ Calibration Sent' :
                     calibrationStatus === 'error' ? '✗ Connection Error' :
                     'Start Calibration'}
                </button>

                {/* Status info */}
                <div className={styles.statusInfo}>
                    <p className={styles.statusLabel}>Device Status:</p>
                    <p className={styles.statusValue}>
                        {mcuStatus === 'idle' ? 'Ready' :
                         mcuStatus === 'running' ? 'Running' :
                         mcuStatus === 'busy' ? 'Busy' :
                         'Disconnected'}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default CalibrationPanel;
