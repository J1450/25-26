// Updated 12/5

// --- Pins ----------------------------------------------------
const uint8_t PIN_STATE1 = 13; // PIN_STATE = 2'b00 -> Inventory, 2'b01 -> Asystole
const uint8_t PIN_STATE2 = 12; // PIN_STATE = 2'b10 -> VentFib,   2'b11 -> Normal Sinus
const uint8_t PIN_D11 = 11;    // Blue LED - D1
const uint8_t PIN_D10 = 10;    // Red  LED - D1
const uint8_t PIN_D4 = 4;      // Blue LED - D2
const uint8_t PIN_D3 = 3;      // Red  LED - D2
// A5 is blue LED - D4
// A4 is red  LED - D4
// A2 is blue LED - D5
// A1 is red  LED - D5

const uint8_t PIN_SEN_D9 = 9; // Sensor for E1
const uint8_t PIN_SEN_D6 = 6; // Sensor for E2
const uint8_t PIN_SEN_D2 = 2; // Sensor for E3
// A3 is sensor for E4
// A0 is sensor for E5

const uint8_t PIN_CLOCK = 5; // 120 BPM clock in Code state only

// --- Clock (120 BPM) ----------------------------------------
// 120 BPM = 2 Hz => 500 ms period. We'll output a 50% duty square wave.
const unsigned long BPM = 120;
const unsigned long PERIOD_MS = 60000UL / BPM; // 500 ms
const unsigned long TOGGLE_MS = PERIOD_MS / 2; // 250 ms

unsigned long lastToggle = 0;
bool clockLevel = false;

// --- Sensor States for Serial Communication -----------------
bool ivRemoved = false;
bool oxygenRemoved = false;
unsigned long lastSensorUpdate = 0;
const unsigned long SENSOR_UPDATE_INTERVAL = 500; // Update every 500ms

// ------------------------------------------------------------
void setup()
{
    pinMode(PIN_STATE1, INPUT); // external source drives D13 (no pull-up)
    pinMode(PIN_STATE2, INPUT); // external source drives D12 (no pull-up)
    pinMode(PIN_D11, OUTPUT);
    pinMode(PIN_D10, OUTPUT);
    pinMode(PIN_CLOCK, OUTPUT);
    pinMode(PIN_D4, OUTPUT);
    pinMode(PIN_D3, OUTPUT);
    pinMode(A5, OUTPUT);
    pinMode(A4, OUTPUT);
    pinMode(A2, OUTPUT);
    pinMode(A1, OUTPUT);

    pinMode(PIN_SEN_D9, INPUT_PULLUP); // Pressure sensor attached to D9 for E1
    pinMode(PIN_SEN_D6, INPUT_PULLUP); // Pressure sensor attached to D6 for E2
    pinMode(PIN_SEN_D2, INPUT_PULLUP); // Pressure sensor attached to D2 for E3
    pinMode(A3, INPUT_PULLUP);         // Pressure sensor attached to A3 for E4
    pinMode(A0, INPUT_PULLUP);         // Pressure sensor attached to A0 for E5

    // Safe startup states
    digitalWrite(PIN_D11, LOW);
    digitalWrite(PIN_D10, LOW);
    digitalWrite(PIN_D4, LOW);
    digitalWrite(PIN_D3, LOW);
    digitalWrite(A5, LOW);
    digitalWrite(A4, LOW);
    digitalWrite(A2, LOW);
    digitalWrite(A1, LOW);
    digitalWrite(PIN_CLOCK, LOW);

    // Start Serial communication with Flask
    Serial.begin(9600);
}

bool sen9latched = false;
bool sen6latched = false;
bool sen2latched = false;

void loop()
{
    const bool stateIsInve = ((digitalRead(PIN_STATE1) == LOW) && (digitalRead(PIN_STATE2) == LOW));   // 2'b00
    const bool stateIsAsys = ((digitalRead(PIN_STATE1) == LOW) && (digitalRead(PIN_STATE2) == HIGH));  // 2'b01
    const bool stateIsVFib = ((digitalRead(PIN_STATE1) == HIGH) && (digitalRead(PIN_STATE2) == LOW));  // 2'b10
    const bool stateIsNorS = ((digitalRead(PIN_STATE1) == HIGH) && (digitalRead(PIN_STATE2) == HIGH)); // 2'b11
    const bool sensorD1E1 = (digitalRead(PIN_SEN_D9) == LOW);
    const bool sensorD1E2 = (digitalRead(PIN_SEN_D6) == LOW);
    const bool sensorD2E1 = (digitalRead(PIN_SEN_D2) == LOW);
    const bool sensorD3E1 = (digitalRead(A3) == LOW);
    const bool sensorD4E1 = (digitalRead(A0) == LOW);

    if (stateIsAsys)
    {
        // Base outputs for "Code" state
        digitalWrite(PIN_D11, HIGH);
        digitalWrite(PIN_D4, HIGH);
        digitalWrite(A5, HIGH);
        digitalWrite(A2, HIGH);

        bool currentIvRemoved = !sensorD1E1;     // Inverted: LOW means removed
        bool currentOxygenRemoved = !sensorD1E2; // Inverted: LOW means removed

        // Update sensor states
        if (currentIvRemoved != ivRemoved || currentOxygenRemoved != oxygenRemoved)
        {
            ivRemoved = currentIvRemoved;
            oxygenRemoved = currentOxygenRemoved;

            Serial.flush();

            String sensorData = "SENSOR:IV=" + String(ivRemoved ? "1" : "0") +
                                ":OXYGEN=" + String(oxygenRemoved ? "1" : "0");
            Serial.println(sensorData);
            delay(50);
        }

        // Control red LEDs based on both sensors
        // Red light turns off only when BOTH are removed
        bool bothRemoved = ivRemoved && oxygenRemoved;

        digitalWrite(PIN_D10, bothRemoved ? LOW : HIGH);

        // Button actions (momentary)
        if (sensorD1E1)
            sen9latched = true;
        if (sensorD1E2)
            sen6latched = true;
        if (sensorD2E1)
            sen2latched = true;
        // Button actions (stored)
        digitalWrite(PIN_D10, ((sensorD1E1) || (sensorD1E2)) ? HIGH : LOW);
        digitalWrite(PIN_D3, sensorD2E1 ? HIGH : LOW);
        digitalWrite(A4, sensorD3E1 ? HIGH : LOW);
        digitalWrite(A1, sensorD4E1 ? HIGH : LOW);

        // 120 BPM clock on D5 (square wave, 50% duty)
        unsigned long now = millis();
        if (now - lastToggle >= TOGGLE_MS)
        {
            clockLevel = !clockLevel;
            digitalWrite(PIN_CLOCK, clockLevel ? HIGH : LOW);
            lastToggle = now;
        }
    }
    else if (stateIsInve)
    {
        // "Inventory" state
        clockLevel = false;
        digitalWrite(PIN_CLOCK, LOW);
        lastToggle = millis();

        // Reset sensor states when not in Asystole
        ivRemoved = false;
        oxygenRemoved = false;

        if (sensorD1E1)
            sen9latched = true;
        if (sensorD1E2)
            sen6latched = true;
        if (sensorD2E1)
            sen2latched = true;
        // Buttons modify outputs as specified
        if ((sensorD1E1) && (sensorD1E2))
        {
            digitalWrite(PIN_D10, LOW);  // send D11 low
            digitalWrite(PIN_D11, HIGH); // and D10 high
        }
        else
        {
            digitalWrite(PIN_D10, HIGH);
            digitalWrite(PIN_D11, LOW);
        }

        if (sensorD2E1)
        {
            digitalWrite(PIN_D3, LOW);  // send D8 low
            digitalWrite(PIN_D4, HIGH); // and D7 high
        }
        else
        {
            digitalWrite(PIN_D3, HIGH); // send D8 low
            digitalWrite(PIN_D4, LOW);
        }
        if (sensorD3E1)
        {
            digitalWrite(A4, LOW);  // send D8 low
            digitalWrite(A5, HIGH); // and D7 high
        }
        else
        {
            digitalWrite(A4, HIGH); // send D8 low
            digitalWrite(A5, LOW);
        }
        if (sensorD4E1)
        {
            digitalWrite(A1, LOW);  // send D8 low
            digitalWrite(A2, HIGH); // and D7 high
        }
        else
        {
            digitalWrite(A1, HIGH); // send D8 low
            digitalWrite(A2, LOW);
        }
        // No clock in Inventory
        clockLevel = false;
        digitalWrite(PIN_CLOCK, LOW);
        lastToggle = millis(); // reset phase so clock starts cleanly when returning to Code
    }
    else
    {
        bool sen9latched = false;
        bool sen6latched = false;

        // Other states (VFib, Normal Sinus)
        // Reset sensor states
        ivRemoved = false;
        oxygenRemoved = false;
    }

    // Send periodic sensor updates
    unsigned long now = millis();
    if (now - lastSensorUpdate >= SENSOR_UPDATE_INTERVAL)
    {
        if (stateIsAsys)
        {
            String sensorData = "SENSOR:IV=" + String(ivRemoved ? "1" : "0") +
                                ":OXYGEN=" + String(oxygenRemoved ? "1" : "0");
            Serial.println(sensorData);
        }
        lastSensorUpdate = now;
    }

    delay(10); // Small delay for stability
}
