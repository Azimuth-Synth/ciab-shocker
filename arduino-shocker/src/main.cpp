#include <Arduino.h>


// Pins
    #define PIN_LED 13    // Pin number for the built-in LED
    #define PIN_SHOCKER 8 // Pin number for the shocker


// State
    enum class ShockerState {
        IDLE,
        BUSY,
        SHOCKING,
    } currentState = ShockerState::IDLE;

    int currentPowerLevel = 1; // Power level for the shocker (1-99)


// Functions
    // Reporting state
        void setStateIdle(){
            currentState = ShockerState::IDLE;
            Serial.print("B\n");
        }
        void setStateBusy(){
            currentState = ShockerState::BUSY;
            Serial.print("C\n");
        }
        void setStateShocking(){
            currentState = ShockerState::SHOCKING;
            Serial.print("A\n");
        }
        void reportPowerLevel(){
            Serial.print("P");
            Serial.print(currentPowerLevel);
            Serial.print("\n");
        }

    // Pressing the buttons
        void shockStart(){
            digitalWrite(PIN_LED, HIGH);
            digitalWrite(PIN_SHOCKER, HIGH);
            setStateShocking();
        }
        void shockStop(){
            digitalWrite(PIN_LED, LOW);
            digitalWrite(PIN_SHOCKER, LOW);
            setStateIdle();
        }

    // Processing power adjustment
        void setPowerLevel(int set_to){
            // Ensure the shocker is stopped before changing power level
                shockStop();
                setStateBusy();

            // Validate and set the power level
                if (set_to < 1 || set_to > 99) {
                    Serial.print("Invalid power level.\n");
                    setStateIdle();
                    return;
                }

            // Set the power level
                currentPowerLevel = set_to;

            // Report the new power level and reset state
                reportPowerLevel();
                setStateIdle();
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
            shockStop();
    }

    void loop(){
        while(Serial.available()){
            char pis = Serial.read();

            switch(pis){
                case '1':
                    shockStart();
                    break;

                case '0':
                    shockStop();
                    break;

                case 'P':
                    {
                        // Read the power level digits until we find the '!' terminator
                        String powerStr = "";
                        unsigned long startTime = millis();
                        const unsigned long timeout = 1000; // 1 second timeout

                        while (millis() - startTime < timeout) {
                            if (Serial.available()) {
                                char nextChar = Serial.read();
                                if (nextChar == '!') {
                                    // Found terminator, parse the power level
                                    int powerLevel = powerStr.toInt();
                                    if (powerLevel >= 1 && powerLevel <= 99) {
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

                default:
                    Serial.print("stop pressing random buttons idiot\n");
                    break;
            }
        }
    }