//www.elegoo.com
//2016.12.08


#include <FastLED.h>
#include <math.h>


#define LED_PIN     10
#define NUM_LEDS    100  // Total LEDs (50 for CPR + 50 for drawers)
#define NUM_DRAWERS 4
#define BPM         120


// int startPins[] = {3, 6, 11, 20, 25};
// int endPins[] = {5, 10, 15, 24, 29};


CRGB leds[NUM_LEDS];


uint32_t colors[] = {CRGB::Yellow, CRGB::Red, CRGB::Purple, CRGB::Blue, CRGB::Orange, CRGB::Purple};


// Calculate timing for 120 BPM
const unsigned long beatInterval = 250; // 60000ms / 120 beats / 2 = 250ms per beat
unsigned long lastBeatTime = 0;
bool beatState = false;
bool codeStarted = false;


// CPR LED indices (first 50 LEDs)
const int CPR_START_LED = 0;
const int CPR_END_LED = 49;
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


  // Only flash CPR LEDs if code has started
  if (codeStarted) {
    unsigned long currentTime = millis();
    if (currentTime - lastBeatTime >= beatInterval) {
      beatState = !beatState;
      updateCPRLights(beatState);
      lastBeatTime = currentTime;
    }
  }
}


void updateCPRLights(bool state) {
  // Update only the CPR LEDs (first 50)
  for (int i = CPR_START_LED; i <= CPR_END_LED; i++) {
    leds[i] = state ? CPR_COLOR : CRGB::Black;
  }
  FastLED.show();
}


void handleDrawerSignal(String data) {
  int commaIndex = data.indexOf(',');
  if (commaIndex != -1) {
    int drawerNumber = data.substring(0, commaIndex).toInt();
    String taskName = data.substring(commaIndex + 1);
    
    if (drawerNumber >= 1 && drawerNumber <= NUM_DRAWERS) {
      updateDrawerLED(drawerNumber, taskName);
    }
  }
}


void updateDrawerLED(int drawerNum, String taskName) {
  // Calculate LED positions for each drawer (last 50 LEDs)
  // Each drawer gets 12 LEDs (50 total LEDs / 4 drawers ≈ 12 LEDs per drawer)
  int ledsPerDrawer = 12;
  int startLed = 50 + (drawerNum - 1) * ledsPerDrawer;  // Start from LED 50
  
  // Set color based on task
  CRGB taskColor;
  if (taskName.indexOf("OFF") != -1) {
    taskColor = CRGB::Black;   // Turn off the drawer
  } else if (taskName.indexOf("Place IV") != -1 || taskName.indexOf("Place Oxygen") != -1) {
    taskColor = CRGB::Yellow;  // Drawer 1
  } else if (taskName.indexOf("Give Epi") != -1) {
    taskColor = CRGB::Green;   // Drawer 2
  } else if (taskName.indexOf("Give Amiodarone") != -1) {
    taskColor = CRGB::Blue;    // Drawer 3
  } else if (taskName.indexOf("Give Bicarbonate") != -1) {
    taskColor = CRGB::Red;     // Drawer 4
  } else {
    taskColor = CRGB::Black;   // Default off
  }
  
  // Update LEDs for this drawer
  for (int i = 0; i < ledsPerDrawer; i++) {
    leds[startLed + i] = taskColor;
  }
  FastLED.show();
}










