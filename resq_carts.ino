//www.elegoo.com
//2016.12.08

#include <FastLED.h>
#include <math.h>

#define LED_PIN     10
#define NUM_LEDS    50  // Total LEDs (60 * 2 for both strips)
#define NUM_DRAWERS 6
#define BPM         120

int startPins[] = {3, 6, 11, 20, 25};
int endPins[] = {5, 10, 15, 24, 29};

CRGB leds[NUM_LEDS];

uint32_t colors[] = {CRGB::Yellow, CRGB::Red, CRGB::Purple, CRGB::Blue, CRGB::Orange, CRGB::Purple};

// Calculate timing for 120 BPM
const unsigned long beatInterval = 250; // 60000ms / 120 beats = 250ms per beat
unsigned long lastBeatTime = 0;
bool beatState = false;
bool codeStarted = false;

// CPR LED indices
const int CPR_START_LED = 1;
const int CPR_END_LED = 50;
const CRGB CPR_COLOR = CRGB::Yellow;

void setup() {
  Serial.begin(9600);
  // Initialize the entire LED strip
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(50);
  
  // Initialize all LEDs to off
  FastLED.clear();
  FastLED.show();
}

void loop() {
  // Check for start signal
  if (Serial.available() > 0) {
    String data = Serial.readStringUntil('\n');
    if (data.indexOf("START") != -1) {
      codeStarted = true;
    }
    else {
      // Handle regular drawer signals
      handleDrawerSignal(data);
    }
  }

  // Only flash LEDs if code has started
  if (codeStarted) {
    unsigned long currentTime = millis();
    if (currentTime - lastBeatTime >= beatInterval) {
      beatState = !beatState;
      updateAllLEDs(beatState);
      lastBeatTime = currentTime;
    }
  }
}

void updateAllLEDs(bool state) {
  // Update all LEDs
  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = state ? CRGB::Yellow : CRGB::Black;
  }
  FastLED.show();
}

void handleDrawerSignal(String data) {
  int commaIndex = data.indexOf(',');
  if (commaIndex != -1) {
    int drawerNumber = data.substring(0, commaIndex).toInt();
    int personNumber = data.substring(commaIndex + 1).toInt();
    
    if (drawerNumber >= 0 && drawerNumber < NUM_DRAWERS) {
      updateDrawerLED(drawerNumber);
    }
  }
}

void updateDrawerLED(int drawerNum) {
  int startLed = startPins[drawerNum];
  for (int i = 0; i < 3; i++) {
    leds[startLed + i] = colors[drawerNum];
  }
  FastLED.show();
}

void updateCPRLights(bool state) {
  // Update CPR indicator LEDs
  for (int i = CPR_START_LED; i <= CPR_END_LED; i++) {
    leds[i] = state ? CPR_COLOR : CRGB::Black;
  }
  FastLED.show();
}


