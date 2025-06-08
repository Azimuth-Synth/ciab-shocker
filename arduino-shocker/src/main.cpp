#include <Arduino.h>


// Pins
    #define PIN_LED 13    // Pin number for the built-in LED
    #define PIN_SHOCKER 8 // Pin number for the shocker


// Functions
    void shockStart(){
        digitalWrite(PIN_LED, HIGH);
        digitalWrite(PIN_SHOCKER, HIGH);
        Serial.print("A");
    }
    void shockStop(){
        digitalWrite(PIN_LED, LOW);
        digitalWrite(PIN_SHOCKER, LOW);
        Serial.print("B");
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

                default:
                    Serial.print("stop pressing random buttons idiot\n");
                    break;
            }
        }
    }