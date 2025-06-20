#include <Arduino.h>

// Config
    #define POWER_ADJUST_ON_TIME_MS 50 // The time the button is held down when changing the power.
    #define POWER_ADJUST_OFF_TIME_MS 50 // The gap between presses of the button.


// Pins
    #define PIN_LED 13            // Pin number for the built-in LED
    #define PIN_SHOCKER 8         // Pin number for the shocker
    #define PIN_INCREASE_POWER 9  // Pin number for the increase power button
    #define PIN_DECREASE_POWER 10 // Pin number for the decrease power button
    #define PIN_RANGE_LOW 11       // Pin number for the low range selector
    #define PIN_RANGE_HIGH 12      // Pin number for the high range selector


// State
    enum class ShockerState {
        IDLE,
        BUSY,
        SHOCKING,
    };
    ShockerState currentState = ShockerState::IDLE;

    int currentPowerLevel = 0; // Power level for the shocker (0-99)


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
            Serial.print(currentPowerLevel);
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

            currentPowerLevel++;
            reportPowerLevel();
        }
        void pressPowerDec(){
            digitalWrite(PIN_DECREASE_POWER, HIGH);
            delay(POWER_ADJUST_ON_TIME_MS);
            digitalWrite(PIN_DECREASE_POWER, LOW);
            delay(POWER_ADJUST_OFF_TIME_MS);

            currentPowerLevel--;
            reportPowerLevel();
        }
        void selectRangeLow(){
            digitalWrite(PIN_RANGE_HIGH, LOW);
            delay(5);
            digitalWrite(PIN_RANGE_LOW, HIGH);
        }
        void selectRangeHigh(){
            digitalWrite(PIN_RANGE_LOW, LOW);
            delay(5);
            digitalWrite(PIN_RANGE_HIGH, HIGH);
        }

    // Processing power adjustment
        void setPowerLevel(int set_to){
            // Ensure the shocker is stopped before changing power level
                pressShockStop();
                reportStateBusy();

            // Validate and set the power level
                if (set_to < 0 || set_to > 99) {
                    Serial.print("Invalid power level.\n");
                    reportStateIdle();
                    return;
                }

            // Determine range
                bool is_range_high = false;
                if(set_to > 50){
                    is_range_high = true;
                    selectRangeHigh();
                } else {
                    is_range_high = false;
                    selectRangeLow();
                }

            // Set the power level
                if(is_range_high){
                    // Return the power setting to a known state by going down from 99 to 51. This ensures we will allways be on power 51 when starting.
                        currentPowerLevel = 99;
                        while(currentPowerLevel > 51){
                            pressPowerDec();
                        }

                    // Increase untill the desired value is reached
                        while(currentPowerLevel < set_to){
                            pressPowerInc();
                        }
                }else{
                    // Return the power setting to a known state by going down from 50 to 0. This ensures we will allways be on power 1 when starting.
                        currentPowerLevel = 50;
                        while(currentPowerLevel > 0){
                            pressPowerDec();
                        }

                    // Increase untill the desired value is reached
                        while(currentPowerLevel < set_to){
                            pressPowerInc();
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
            pinMode(PIN_RANGE_LOW, OUTPUT);
            pinMode(PIN_RANGE_HIGH, OUTPUT);
            pressShockStop();
            selectRangeLow();
    }

    void loop(){
        while(Serial.available()){
            char pis = Serial.read();

            switch(pis){
                case '1':
                    pressShockStart();
                    break;

                case '0':
                    pressShockStop();
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

                default:
                    Serial.print("Stop pressing random buttons idiot\n");
                    break;
            }
        }
    }