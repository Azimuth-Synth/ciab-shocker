import styles from './AutoPanel.module.css';

import { useState, useEffect, useRef } from 'react';

function AutoPanel({ mcuStatus, mcuPowerLevel, sendMcuCommand, changeBackground, isWebSocketConnected, myUser }) {
    // References
        const [autoShockingActivated, setAutoShockingActivated] = useState(false);
        const intervalRef = useRef(null);
        const timeoutRef = useRef(null);
        const countdownIntervalRef = useRef(null);
        const mcuStatusRef = useRef(mcuStatus);

    // Parameters
        const [powerMin, setPowerMin] = useState(1);
        const [powerMax, setPowerMax] = useState(10);
        const [intervalMinSec, setIntervalMinSec] = useState(5);
        const [intervalMaxSec, setIntervalMaxSec] = useState(120);
        const [durationMinSec, setDurationMinSec] = useState(1);
        const [durationMaxSec, setDurationMaxSec] = useState(5);

    // Next shock indicator states
        const [nextShockCountdown, setNextShockCountdown] = useState(0);
        const [nextShockPower, setNextShockPower] = useState(0);
        const [nextShockDuration, setNextShockDuration] = useState(0);

    // Store the actual values that will be used for the next shock
        const nextShockParamsRef = useRef({ power: 0, duration: 0 });

    // Update the ref whenever mcuStatus changes
        useEffect(() => {
            mcuStatusRef.current = mcuStatus;
        }, [mcuStatus]);

    // Start countdown timer
        const startCountdown = (seconds, power, duration) => {
            // Clear any existing countdown first
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
            }

            // Set initial values
            setNextShockCountdown(seconds);
            setNextShockPower(power);
            setNextShockDuration(duration);

            // Start new countdown
            countdownIntervalRef.current = setInterval(() => {
                setNextShockCountdown(prev => {
                    const newValue = prev - 1;
                    if (newValue <= 0) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                        return 0;
                    }
                    return newValue;
                });
            }, 1000);
        };

    // Auto shocking loop function
        const executeAutoShock = () => {
            // Use the pre-calculated values from the ref
            const randomPower = nextShockParamsRef.current.power;
            const randomDuration = nextShockParamsRef.current.duration;

            console.log(`Auto shock executing: Power ${randomPower}, Duration ${randomDuration}s`);

            // Send the shock command sequence
            if (sendMcuCommand) {
                // Step 1: Send the power command
                console.log(`Setting power to ${randomPower}`);
                sendMcuCommand('set_power', randomPower);

                // Step 2: Wait 100ms buffer time
                setTimeout(() => {
                    // Step 3: Wait until the MCU confirms ready (idle status)
                    const checkMcuStatus = () => {
                        // Get the current MCU status from ref (always up-to-date)
                        const currentStatus = mcuStatusRef.current;
                        if (currentStatus === 'idle') {
                            console.log('MCU is idle, sending start command');
                            // Step 4: Send start command
                            sendMcuCommand('start');

                            // Step 5: Schedule stop command after duration
                            console.log(`Scheduling stop command in ${randomDuration} seconds`);
                            setTimeout(() => {
                                console.log('Sending stop command');
                                sendMcuCommand('stop');

                                // Schedule next shock AFTER this one is completely finished
                                if (autoShockingActivated) {
                                    const randomInterval = Math.floor(Math.random() * (intervalMaxSec - intervalMinSec + 1)) + intervalMinSec;
                                    const nextRandomPower = Math.floor(Math.random() * (powerMax - powerMin + 1)) + powerMin;
                                    const nextRandomDuration = Math.floor(Math.random() * (durationMaxSec - durationMinSec + 1)) + durationMinSec;

                                    console.log(`Next shock scheduled in ${randomInterval} seconds`);

                                    // Store the next shock parameters in ref so they match what will actually be executed
                                    nextShockParamsRef.current = { power: nextRandomPower, duration: nextRandomDuration };

                                    // Start countdown for next shock
                                    startCountdown(randomInterval, nextRandomPower, nextRandomDuration);

                                    timeoutRef.current = setTimeout(executeAutoShock, randomInterval * 1000);
                                }
                            }, randomDuration * 1000);
                        } else {
                            // Check again after 100ms
                            setTimeout(checkMcuStatus, 100);
                        }
                    };

                    checkMcuStatus();
                }, 100);
            }
        };

    // Effect to handle auto shocking activation/deactivation
        useEffect(() => {
            if (autoShockingActivated) {
                console.log('Starting auto shocking thread');
                // Start the first execution after initial interval
                const initialInterval = Math.floor(Math.random() * (intervalMaxSec - intervalMinSec + 1)) + intervalMinSec;
                const initialPower = Math.floor(Math.random() * (powerMax - powerMin + 1)) + powerMin;
                const initialDuration = Math.floor(Math.random() * (durationMaxSec - durationMinSec + 1)) + durationMinSec;

                // Store the initial shock parameters
                nextShockParamsRef.current = { power: initialPower, duration: initialDuration };

                // Start countdown for first shock
                startCountdown(initialInterval, initialPower, initialDuration);

                timeoutRef.current = setTimeout(executeAutoShock, initialInterval * 1000);
            } else {
                console.log('Stopping auto shocking thread');
                // Clear any pending timeouts and countdowns
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
                if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                }
                // Reset countdown display and stored parameters
                setNextShockCountdown(0);
                setNextShockPower(0);
                setNextShockDuration(0);
                nextShockParamsRef.current = { power: 0, duration: 0 };
            }

            // Cleanup function
            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
                if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                }
            };
        }, [autoShockingActivated, powerMin, powerMax, intervalMinSec, intervalMaxSec, durationMinSec, durationMaxSec]);

        const toggleAutoShocking = () => {
            sendMcuCommand('stop');
            setAutoShockingActivated(!autoShockingActivated);
        }

    return (
        <div className={styles.container}>
            <div className={`${styles.card} ${mcuStatus == 'running' ? styles.cardActive : ''}`}>
                <h2>Auto Shocking</h2>

                {/* Auto Shocking Indicator */}
                    <div className={styles.autoShockingIndicator}>
                        <div className={styles.statusIndicator} style={{ backgroundColor: autoShockingActivated ? '#00ff00' : '#ff0000'}} />
                        <span className={styles.statusText}> Auto Shocking: {autoShockingActivated ? 'ON' : 'OFF'} </span>
                    </div>

                {/* Next Shock Indicator */}
                    {autoShockingActivated && timeoutRef.current && (
                        <div className={styles.nextShockIndicator}>
                            <p>Countdown: {Math.floor(nextShockCountdown / 60).toString().padStart(2, '0')}:{(nextShockCountdown % 60).toString().padStart(2, '0')}</p>
                            <p>Power: {nextShockPower.toString().padStart(2, '0')}</p>
                            <p>Duration: {nextShockDuration.toString()} seconds</p>
                        </div>
                    )}

                {/* Power Range */}
                    <label className={styles.powerRangeSelectorLabel}>Power Range: {powerMin} - {powerMax}</label>
                    <div className={styles.powerRangeSelectorSlider}>
                        {/* Track container */}
                        <div className={styles.rangeTrack}>

                            {/* Interactable Elements */}
                                <div className={styles.interactableRange}>

                                    {/* Fill between thumbs */}
                                    <div 
                                        className={styles.rangeFill}
                                        style={{
                                            left: `${(powerMin - 1) / 99 * 100}%`,
                                            right: `${(100 - powerMax) / 99 * 100}%`
                                        }}
                                    />

                                    {/* Min thumb */}
                                    <div
                                        className={styles.rangeThumb}
                                        style={{ left: `${(powerMin - 1) / 99 * 100}%` }}
                                        onMouseDown={(e) => {
                                            const startX = e.clientX;
                                            const startValue = powerMin;
                                            const rect = e.currentTarget.parentElement.getBoundingClientRect();

                                            const handleMouseMove = (e) => {
                                                const deltaX = e.clientX - startX;
                                                const deltaPercent = (deltaX / rect.width) * 99;
                                                const newValue = Math.round(Math.max(1, Math.min(powerMax, startValue + deltaPercent)));
                                                setPowerMin(newValue);
                                            };

                                            const handleMouseUp = () => {
                                                document.removeEventListener('mousemove', handleMouseMove);
                                                document.removeEventListener('mouseup', handleMouseUp);
                                            };

                                            document.addEventListener('mousemove', handleMouseMove);
                                            document.addEventListener('mouseup', handleMouseUp);
                                            e.preventDefault();
                                        }}
                                    />

                                    {/* Max thumb */}
                                    <div
                                        className={styles.rangeThumb}
                                        style={{ left: `${(powerMax - 1) / 99 * 100}%` }}
                                        onMouseDown={(e) => {
                                            const startX = e.clientX;
                                            const startValue = powerMax;
                                            const rect = e.currentTarget.parentElement.getBoundingClientRect();

                                            const handleMouseMove = (e) => {
                                                const deltaX = e.clientX - startX;
                                                const deltaPercent = (deltaX / rect.width) * 99;
                                                const newValue = Math.round(Math.max(powerMin, Math.min(100, startValue + deltaPercent)));
                                                setPowerMax(newValue);
                                            };

                                            const handleMouseUp = () => {
                                                document.removeEventListener('mousemove', handleMouseMove);
                                                document.removeEventListener('mouseup', handleMouseUp);
                                            };

                                            document.addEventListener('mousemove', handleMouseMove);
                                            document.addEventListener('mouseup', handleMouseUp);
                                            e.preventDefault();
                                        }}
                                    />
                                </div>
                        </div>
                    </div>

                {/* Interval Range */}
                    <div className={styles.timeSelector}>
                        <label>Interval time:</label>

                        <div>
                            <span> Minimum: </span>
                            <input
                                type="number"
                                min="0"
                                max="300"
                                value={Math.floor(intervalMinSec / 60)}
                                onChange={(e) => {
                                    const newMinSec = Number(e.target.value) * 60 + (intervalMinSec % 60);
                                    if (newMinSec < intervalMaxSec) {
                                        setIntervalMinSec(newMinSec);
                                    }
                                }}
                            />
                            <span>min </span>
                            <input
                                type="number"
                                min="0"
                                max="59"
                                value={intervalMinSec % 60}
                                onChange={(e) => {
                                    const newMinSec = Math.floor(intervalMinSec / 60) * 60 + Number(e.target.value);
                                    if (newMinSec < intervalMaxSec) {
                                        setIntervalMinSec(newMinSec);
                                    }
                                }}
                            />
                            <span>sec</span>
                        </div>

                        <div>
                            <span> Maximum: </span>
                            <input
                                type="number"
                                min="0"
                                max="300"
                                value={Math.floor(intervalMaxSec / 60)}
                                onChange={(e) => {
                                    const newMaxSec = Number(e.target.value) * 60 + (intervalMaxSec % 60);
                                    if (newMaxSec > intervalMinSec) {
                                        setIntervalMaxSec(newMaxSec);
                                    }
                                }}
                            />
                            <span>min </span>
                            <input
                                type="number"
                                min="0"
                                max="59"
                                value={intervalMaxSec % 60}
                                onChange={(e) => {
                                    const newMaxSec = Math.floor(intervalMaxSec / 60) * 60 + Number(e.target.value);
                                    if (newMaxSec > intervalMinSec) {
                                        setIntervalMaxSec(newMaxSec);
                                    }
                                }}
                            />
                            <span>sec</span>
                        </div>
                    </div>

                {/* Duration Range */}
                    <div className={styles.timeSelector}>
                        <label>Shock duration:</label>

                        <div>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={durationMinSec}
                                onChange={(e) => setDurationMinSec(Number(e.target.value))}
                            />
                            <span>min </span>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={durationMaxSec}
                                onChange={(e) => setDurationMaxSec(Number(e.target.value))}
                            />
                            <span>max</span>
                        </div>
                    </div>

                {/* Start/Stop Button */}
                    <button onClick={() => toggleAutoShocking()} className={styles.startStopButton}>
                        Start/Stop
                    </button>
            </div>
        </div>
    )
}

export default AutoPanel;