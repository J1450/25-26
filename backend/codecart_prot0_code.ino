//Set up

// --- Pins ----------------------------------------------------
const uint8_t PIN_STATE1  = 13;  // PIN_STATE = 2'b00 -> Nothing, 2'b01 -> Inventory, 2'b10 -> Code
const uint8_t PIN_STATE2  = 12;  //
const uint8_t PIN_D11     = 11;  // output
const uint8_t PIN_D10     = 10;  // output (goes HIGH when D9 pressed)
const uint8_t PIN_BTN_D9  = 9;   // button to drive D10 (active LOW)
const uint8_t PIN_D8      = 8;   // output
const uint8_t PIN_BTN_D6  = 6;   // button to drive D7 (active LOW)
const uint8_t PIN_D7      = 7;   // output
const uint8_t PIN_CLOCK   = 5;   // 120 BPM clock in Code state only

// --- Clock (120 BPM) ----------------------------------------
// 120 BPM = 2 Hz => 500 ms period. We'll output a 50% duty square wave.
const unsigned long BPM        = 120;
const unsigned long PERIOD_MS  = 60000UL / BPM;      // 500 ms
const unsigned long TOGGLE_MS  = PERIOD_MS / 2;      // 250 ms

unsigned long lastToggle = 0;
bool clockLevel = false;

// ------------------------------------------------------------
void setup() {
  pinMode(PIN_STATE1, INPUT);         // external source drives D13 (no pull-up)
  pinMode(PIN_STATE2, INPUT);
  pinMode(PIN_D11,    OUTPUT);
  pinMode(PIN_D10,    OUTPUT);
  pinMode(PIN_D8,     OUTPUT);
  pinMode(PIN_D7,     OUTPUT);
  pinMode(PIN_CLOCK,  OUTPUT);

  pinMode(PIN_BTN_D9, INPUT_PULLUP); // buttons to GND
  pinMode(PIN_BTN_D6, INPUT_PULLUP);

  // Safe startup states
  digitalWrite(PIN_D11, LOW);
  digitalWrite(PIN_D10, LOW);
  digitalWrite(PIN_D8,  LOW);
  digitalWrite(PIN_D7,  LOW);
  digitalWrite(PIN_CLOCK, LOW);
}

bool btn9latched = false;
bool btn6latched = false;

void loop() {
  const bool stateIsOff =  ((digitalRead(PIN_STATE1) == LOW  ) && (digitalRead(PIN_STATE2) == LOW )); //2'b00
  const bool stateIsInv =  ((digitalRead(PIN_STATE1) == LOW  ) && (digitalRead(PIN_STATE2) == HIGH)); //2'b01
  const bool stateIsCode = ((digitalRead(PIN_STATE1) == HIGH ) && (digitalRead(PIN_STATE2) == LOW )); //2'b10
  const bool btn9Pressed = (digitalRead(PIN_BTN_D9) == LOW);
  const bool btn6Pressed = (digitalRead(PIN_BTN_D6) == LOW);
  if (stateIsOff) {
    btn9latched = false;
    btn6latched = false;
  }

  if (stateIsCode) {
    // Base outputs for "Code" state
    digitalWrite(PIN_D11, HIGH);
    digitalWrite(PIN_D8,  HIGH);
    
    // Button actions (momentary)
    if (btn9Pressed) btn9latched = true;
    if (btn6Pressed) btn6latched = true;
    // Button actions (stored)
    digitalWrite(PIN_D10, btn9latched ? HIGH : LOW);
    digitalWrite(PIN_D7,  btn6latched ? HIGH : LOW);

    // 120 BPM clock on D5 (square wave, 50% duty)
    unsigned long now = millis();
    if (now - lastToggle >= TOGGLE_MS) {
      clockLevel = !clockLevel;
      digitalWrite(PIN_CLOCK, clockLevel ? HIGH : LOW);
      lastToggle = now;
    }
  } else if (stateIsInv) {
    // "Inventory" state

    if (btn9Pressed) btn9latched = true;
    if (btn6Pressed) btn6latched = true;
    // Buttons modify outputs as specified
    if (btn9latched) {
      digitalWrite(PIN_D10, LOW);   // send D11 low
      digitalWrite(PIN_D11, HIGH);  // and D10 high
    } else {
      digitalWrite(PIN_D10, HIGH);
      digitalWrite(PIN_D11, LOW);
    }

    if (btn6latched) {
      digitalWrite(PIN_D7, LOW);    // send D8 low
      digitalWrite(PIN_D8, HIGH);   // and D7 high
    } else {
      digitalWrite(PIN_D7, HIGH);    // send D8 low
      digitalWrite(PIN_D8, LOW);
    }
    // No clock in Inventory
    clockLevel = false;
    digitalWrite(PIN_CLOCK, LOW);
    lastToggle = millis(); // reset phase so clock starts cleanly when returning to Code
  } else if (stateIsOff) {
      digitalWrite(PIN_D11,    LOW);
      digitalWrite(PIN_D10,    LOW);
      digitalWrite(PIN_D8,     LOW);
      digitalWrite(PIN_D7,     LOW);
      clockLevel = false;
      digitalWrite(PIN_CLOCK,  LOW);
      lastToggle = millis();
      bool btn9latched = false;
      bool btn6latched = false;
  } else {
    bool btn9latched = false;
    bool btn6latched = false;
  }
}

