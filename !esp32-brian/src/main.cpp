#include <Arduino.h>

// Config
    #define POWER_ADJUST_ON_TIME_MS 70  // The time the button is held down when changing the power.
    #define POWER_ADJUST_OFF_TIME_MS 10 // The gap between presses of the button.
    #define CALIBRATION_HOLD_TIME_S 18  // The time to hold down the decrease button during first-time calibration.
    #define POWER_COMMAND_TIMEOUT_MS 10000 // Maximum time to wait for complete power command


// Pins
    #define PIN_SHOCKER 27        // Pin number for the shocker
    #define PIN_INCREASE_POWER 25 // Pin number for the increase power button
    #define PIN_DECREASE_POWER 26 // Pin number for the decrease power button
    #define PIN_LED 2             // Pin number for the status LED (GPIO 2 is the onboard LED on ESP32)


// State
    enum class ShockerState {
        IDLE,
        BUSY,
        SHOCKING,
    };
    ShockerState currentState = ShockerState::IDLE;

    int powerLevel = 0; // Power level for the shocker


// Functions
    // Reporting state
        void reportStateIdle(){
            currentState = ShockerState::IDLE;
            Serial.print("B\n");
        }
        void reportStateBusy(){
            currentState = ShockerState::BUSY;
            Serial.print("C\n");
        }
        void reportStateShocking(){
            currentState = ShockerState::SHOCKING;
            Serial.print("A\n");
        }
        void reportPowerLevel(){
            Serial.print("P");
            Serial.print(powerLevel);
            Serial.print("!\n");
        }

    // Pressing the buttons
        void pressShockStart(){
            digitalWrite(PIN_LED, HIGH);
            digitalWrite(PIN_SHOCKER, HIGH);
            reportStateShocking();
        }
        void pressShockStop(){
            digitalWrite(PIN_LED, LOW);
            digitalWrite(PIN_SHOCKER, LOW);
            reportStateIdle();
        }
        void pressPowerInc(){
            digitalWrite(PIN_INCREASE_POWER, HIGH);
            delay(POWER_ADJUST_ON_TIME_MS);
            digitalWrite(PIN_INCREASE_POWER, LOW);
            delay(POWER_ADJUST_OFF_TIME_MS);

            powerLevel++;
            reportPowerLevel();
        }
        void pressPowerDec(){
            digitalWrite(PIN_DECREASE_POWER, HIGH);
            delay(POWER_ADJUST_ON_TIME_MS);
            digitalWrite(PIN_DECREASE_POWER, LOW);
            delay(POWER_ADJUST_OFF_TIME_MS);

            powerLevel--;
            reportPowerLevel();
        }

    // Processing power adjustment
        // This fucntion decides weather to call the first time or calibrated version of the function
        void setPowerLevelFirstTime(int set_to);
        void setPowerLevelCalibrated(int set_to);
        void setPowerLevel(int set_to){
            static bool is_calibrated = false;

            if(is_calibrated == false){
                setPowerLevelFirstTime(set_to);
                is_calibrated = true;
            }else{
                setPowerLevelCalibrated(set_to);
            }
        }

        // This calibrates the power variable to the real one
        void setPowerLevelFirstTime(int set_to){
            // Ensure the shocker is stopped before changing power level
                pressShockStop();
                reportStateBusy();

            // Validate and set the power level
                if (set_to < 0 || set_to > 99) {
                    Serial.print("Invalid power level.\n");
                    reportStateIdle();
                    return;
                }

            // Go to 0 power first
                digitalWrite(PIN_DECREASE_POWER, LOW);
                delay(500); // Small delay to ensure the pin state is settled
                digitalWrite(PIN_DECREASE_POWER, HIGH);
                delay(CALIBRATION_HOLD_TIME_S * 1000); // Hold down the decrease button for X seconds to ensure we are at 0
                digitalWrite(PIN_DECREASE_POWER, LOW);
                powerLevel = 0;

                setPowerLevelCalibrated(set_to);

            // Report the new power level and reset state
                reportPowerLevel();
                reportStateIdle();
        }

        // This function assumes the power level is already calibrated
        void setPowerLevelCalibrated(int set_to){
            // Ensure the shocker is stopped before changing power level
                pressShockStop();
                reportStateBusy();

            // Validate and the power level
                if (set_to < 0 || set_to > 99) {
                    Serial.print("Invalid power level.\n");
                    reportStateIdle();
                    return;
                }

            // Adjust the power level to the desired setting
                if(powerLevel < set_to){
                    while(powerLevel < set_to){
                        pressPowerInc();
                    }
                }else{
                    while(powerLevel > set_to){
                        pressPowerDec();
                    }
                }

            // Report the new power level and reset state
                reportPowerLevel();
                reportStateIdle();
        }


// Main loop
    void setup(){
        // Serial
            Serial.begin(115200);
            while (!Serial)
                delay(10); // Wait for serial port to connect. Needed for native USB port only
            Serial.print("\n\nSerial started!\n");

        // Set pin modes
            pinMode(PIN_LED, OUTPUT);
            pinMode(PIN_SHOCKER, OUTPUT);
            pinMode(PIN_INCREASE_POWER, OUTPUT);
            pinMode(PIN_DECREASE_POWER, OUTPUT);
            pressShockStop();
    }

    void loop(){
        while(Serial.available()){
            char pis = Serial.read();

            switch(pis){
                case '1':
                    pressShockStart();
                    pressShockStart();
                    break;

                case '0':
                    pressShockStop();
                    pressShockStop();
                    break;

                case 'P':
                    {
                        // Read the power level digits until we find the '!' terminator
                        String powerStr = "";
                        unsigned long startTime = millis();
                        const unsigned long timeout = POWER_COMMAND_TIMEOUT_MS; // 10 second timeout

                        while (millis() - startTime < timeout) {
                            if (Serial.available()) {
                                char nextChar = Serial.read();
                                if (nextChar == '!') {
                                    // Found terminator, parse the power level
                                    int powerLevel = powerStr.toInt();
                                    if (powerLevel >= 0 && powerLevel <= 99) {
                                        setPowerLevel(powerLevel);
                                    } else {
                                        Serial.print("Invalid power level range.\n");
                                    }
                                    break;
                                } else if (isDigit(nextChar)) {
                                    powerStr += nextChar;
                                } else {
                                    // Invalid character in power level
                                    Serial.print("Invalid power level format.\n");
                                    break;
                                }
                            }
                        }

                        // Check for timeout
                        if (millis() - startTime >= timeout) {
                            Serial.print("Power level command timeout.\n");
                        }
                    }
                    break;

                case 'C':
                    // Calibrate power level to 0
                    setPowerLevelFirstTime(powerLevel);
                    break;

                default:
                    Serial.print("Stop pressing random buttons idiot\n");
                    break;
            }
        }
    }