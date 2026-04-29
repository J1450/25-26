// Updated Arduino Code integrated with flask
// Flask mapping: 0=Asystole, 1=VFib, 2=Normal Sinus

// --- Pins ----------------------------------------------------
// Drawer 1 (D1)
// A0  is Blue LED - D1
// A1  is Red  LED - D1
// A2  is Inventory Sensor 1 - D1 - IV
// A3  is Inventory Sensor 2 - D1 - Airway/Oxygen

// Drawer 2 (D2)
// A4  is Blue LED - D2
// A5  is Red  LED - D2
// A6  is Inventory Sensor 1 - D2 - EPI1
// A7  is Inventory Sensor 2 - D2 - EPI2

// Drawer 3 (D3)
// A8  is Blue LED - D3
// A9  is Red  LED - D3
// A10 is Inventory Sensor 1 - D3 - Ami1
// A11 is Inventory Sensor 2 - D3 - Ami2

// Drawer 4 (D4)
// A12 is Blue LED - D4
// A13 is Red  LED - D4
// A14 is Inventory Sensor 1 - D4 - Bicarbonate1
// A15 is Inventory Sensor 2 - D4 - Bicarbonate2

#include <FastLED.h>
#define LED_PIN 6
#define NUM_LEDS 300
#define BRIGHTNESS 20
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB
CRGB leds[NUM_LEDS];

// Clock PIN
const uint8_t PIN_CLOCK = 4;

// --- Clock (120 BPM) ----------------------------------------
const unsigned long BPM = 120;
const unsigned long PERIOD_MS = 60000UL / BPM; // 500 ms
const unsigned long TOGGLE_MS = PERIOD_MS / 2; // 250 ms

unsigned long lastToggle = 0;
bool clockLevel = false;

// --- State from Flask ----------
// 0 = Asystole, 1 = VFib, 2 = Normal Sinus, 3 = Inventory
int currentState = 3;
int lastState = -1;

// --- Latches --------------
bool latched_iv = false;
bool latched_air = false;
bool latched_epi1 = false;
bool latched_epi2 = false;
bool latched_ami1 = false;
bool latched_ami2 = false;
bool latched_bic1 = false;
bool latched_bic2 = false;

// ------------------------------------------------------------
void setup()
{
    Serial.begin(9600);
    FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
    FastLED.setBrightness(BRIGHTNESS);

    // Clock Control
    pinMode(PIN_CLOCK, OUTPUT);

    // Drawer 1
    pinMode(A0, OUTPUT);
    pinMode(A1, OUTPUT);
    pinMode(A2, INPUT_PULLUP);
    pinMode(A3, INPUT_PULLUP);

    // Drawer 2
    pinMode(A4, OUTPUT);
    pinMode(A5, OUTPUT);
    pinMode(A6, INPUT_PULLUP);
    pinMode(A7, INPUT_PULLUP);

    // Drawer 3
    pinMode(A8, OUTPUT);
    pinMode(A9, OUTPUT);
    pinMode(A10, INPUT_PULLUP);
    pinMode(A11, INPUT_PULLUP);

    // Drawer 4
    pinMode(A12, OUTPUT);
    pinMode(A13, OUTPUT);
    pinMode(A14, INPUT_PULLUP);
    pinMode(A15, INPUT_PULLUP);

    // Safe startup states for LEDs
    digitalWrite(A0, LOW);
    digitalWrite(A1, LOW);
    digitalWrite(A4, LOW);
    digitalWrite(A5, LOW);
    digitalWrite(A8, LOW);
    digitalWrite(A9, LOW);
    digitalWrite(A12, LOW);
    digitalWrite(A13, LOW);

    // Set Clock as low
    digitalWrite(PIN_CLOCK, LOW);
}

// ------------------------------------------------------------
void loop()
{
    // --- Check for incoming serial commands from Flask ---
    if (Serial.available() > 0)
    {
        String command = Serial.readStringUntil('\n');
        command.trim();

        if (command.startsWith("STATE:"))
        {
            int newState = command.substring(6).toInt();

            if (newState >= 0 && newState <= 3)
            {
                currentState = newState;
                lastState = -1; // Force state change handling
            }
        }
    }

    // --- Handle state change (reset clock on change) ---
    if (currentState != lastState)
    {
        lastState = currentState;
        // Reset clock timing on state change
        clockLevel = false;
        digitalWrite(PIN_CLOCK, LOW);
        lastToggle = millis();
    }

    // --- Read sensors (LOW = item present, HIGH = removed) ---
    const bool sensor_iv = (digitalRead(A2) == LOW);
    const bool sensor_air = (digitalRead(A3) == LOW);
    const bool sensor_epi1 = (digitalRead(A6) == LOW);
    const bool sensor_epi2 = (digitalRead(A7) == LOW);
    const bool sensor_ami1 = (digitalRead(A10) == LOW);
    const bool sensor_ami2 = (digitalRead(A11) == LOW);
    const bool sensor_bic1 = (digitalRead(A14) == LOW);
    const bool sensor_bic2 = (digitalRead(A15) == LOW);

    // --- Latching ---
    if (sensor_iv)
        latched_iv = true;
    if (sensor_air)
        latched_air = true;
    if (sensor_epi1)
        latched_epi1 = true;
    if (sensor_epi2)
        latched_epi2 = true;
    if (sensor_ami1)
        latched_ami1 = true;
    if (sensor_ami2)
        latched_ami2 = true;
    if (sensor_bic1)
        latched_bic1 = true;
    if (sensor_bic2)
        latched_bic2 = true;

    // --- STATE LOGIC ---
    if (currentState == 3)
    { // INVENTORY (default)

        // Drawer 1 - Blue if both present, else Red
        if ((sensor_iv) && (sensor_air))
        {
            digitalWrite(A0, HIGH);
            digitalWrite(A1, LOW);
        }
        else
        {
            digitalWrite(A0, LOW);
            digitalWrite(A1, HIGH);
        }

        // Drawer 2 - Blue if both present, else Red
        if ((sensor_epi1) || (sensor_epi2))
        {
            digitalWrite(A4, HIGH);
            digitalWrite(A5, LOW);
        }
        else
        {
            digitalWrite(A4, LOW);
            digitalWrite(A5, HIGH);
        }

        // Drawer 3 - Blue if both present, else Red
        if ((sensor_ami1) || (sensor_ami2))
        {
            digitalWrite(A8, HIGH);
            digitalWrite(A9, LOW);
        }
        else
        {
            digitalWrite(A8, LOW);
            digitalWrite(A9, HIGH);
        }

        // Drawer 4 - Blue if both present, else Red
        if ((sensor_bic1) || (sensor_bic2))
        {
            digitalWrite(A12, HIGH);
            digitalWrite(A13, LOW);
        }
        else
        {
            digitalWrite(A12, LOW);
            digitalWrite(A13, HIGH);
        }

        // No clock in Inventory
        clockLevel = false;
        digitalWrite(PIN_CLOCK, LOW);
        lastToggle = millis();
    }
    else if (currentState == 0)
    { // ASYSTOLE

        // Blue LEDs - Drawers 1 and 2 ON only
        digitalWrite(A0, HIGH); // Drawer 1 Blue ON
        digitalWrite(A4, HIGH); // Drawer 2 Blue ON
        digitalWrite(A8, LOW);  // Drawer 3 Blue OFF
        digitalWrite(A12, LOW); // Drawer 4 Blue OFF

        // Red LEDs logic
        digitalWrite(A1, ((sensor_iv) || (sensor_air)) ? HIGH : LOW);
        digitalWrite(A5, ((sensor_epi1) && (sensor_epi2)) ? HIGH : LOW);
        digitalWrite(A9, LOW);
        digitalWrite(A13, LOW);

        // 120 BPM clock
        unsigned long now = millis();
        if (now - lastToggle >= TOGGLE_MS)
        {
            clockLevel = !clockLevel;
            digitalWrite(PIN_CLOCK, clockLevel ? HIGH : LOW);
            lastToggle = now;
        }
        strobeRedCPR();
    }
    else if (currentState == 1)
    { // VFIB

        // Blue LEDs - Drawers 1, 2, and 3 ON
        digitalWrite(A0, LOW);  // Drawer 1 Blue OFF
        digitalWrite(A4, HIGH); // Drawer 2 Blue ON
        digitalWrite(A8, HIGH); // Drawer 3 Blue ON
        digitalWrite(A12, LOW); // Drawer 4 Blue OFF

        // Red LEDs logic
        digitalWrite(A1, sensor_iv ? HIGH : LOW);
        digitalWrite(A5, ((sensor_epi1) && (sensor_epi2)) ? HIGH : LOW);
        digitalWrite(A9, ((sensor_ami1) && (sensor_ami2)) ? HIGH : LOW);
        digitalWrite(A13, LOW);

        // 120 BPM clock
        unsigned long now = millis();
        if (now - lastToggle >= TOGGLE_MS)
        {
            clockLevel = !clockLevel;
            digitalWrite(PIN_CLOCK, clockLevel ? HIGH : LOW);
            lastToggle = now;
        }
        strobeRedCPR();
    }
    else if (currentState == 2)
    { // NORMAL SINUS

        // Blue LEDs - Drawer 4 only
        digitalWrite(A0, LOW);   // Drawer 1 Blue OFF
        digitalWrite(A4, LOW);   // Drawer 2 Blue OFF
        digitalWrite(A8, LOW);   // Drawer 3 Blue OFF
        digitalWrite(A12, HIGH); // Drawer 4 Blue ON

        // Red LEDs logic
        digitalWrite(A1, LOW);
        digitalWrite(A5, LOW);
        digitalWrite(A9, LOW);
        digitalWrite(A13, ((sensor_bic1)) ? HIGH : LOW);

        // No clock
        clockLevel = false;
        digitalWrite(PIN_CLOCK, LOW);
        lastToggle = millis();
    }

    // --- Send sensor data to Flask ---
    static unsigned long lastSend = 0;
    if (millis() - lastSend > 300)
    {
        Serial.print("SENSOR:");
        Serial.print("IV=");
        Serial.print(sensor_iv ? "1" : "0");
        Serial.print(":OXYGEN=");
        Serial.print(sensor_air ? "1" : "0");
        Serial.print(":EPI=");
        Serial.print((sensor_epi1 && sensor_epi2) ? "1" : "0");
        Serial.print(":AMIO=");
        Serial.print((sensor_ami1 && sensor_ami2) ? "1" : "0");
        Serial.print(":BICARB=");
        Serial.print(sensor_bic1 ? "1" : "0");
        Serial.println();

        lastSend = millis();
    }
}
void strobeRedCPR()
{
    unsigned long now = millis();
    float phase = fmod((float)now, 500.0f) / 500.0f;
    uint8_t v = (phase < 0.4f) ? (uint8_t)(255 * sin(M_PI * phase / 0.4f)) : 0;
    fill_solid(leds, NUM_LEDS, CRGB(v, v, v));
    FastLED.show();
}