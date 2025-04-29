#include <FastLED.h>
#include <math.h>

#define LED_PIN     10
#define NUM_LEDS    100  
#define BPM         120

#define NUM_LEDS_DRAWERS 100
#define DATA_PIN 6
#define SENSOR_THRESHOLD 30

CRGB leds[NUM_LEDS];
CRGB leds_drawer[NUM_LEDS_DRAWERS];
uint32_t colors[] = {CRGB::Yellow, CRGB::Red, CRGB::Purple, CRGB::Blue, CRGB::Orange, CRGB::Purple};

// Calculate timing for 120 BPM
const unsigned long beatInterval = 300; // 60000ms / 100 beats / 2 = 300ms per beat
unsigned long lastBeatTime = 0;
bool beatState = false;
bool cprActive = false;

// CPR LED indices (whole strip)
const int CPR_START_LED = 0;
const int CPR_END_LED = 99;
const CRGB CPR_COLOR = CRGB::Yellow;

// Setup for drawers/pressure sensors
int fsrAnalogPin1 = 0;
int fsrAnalogPin2 = 1;
int fsrAnalogPin3 = 2;
int fsrAnalogPin4 = 3;
int fsrAnalogPin5 = 4;
int fsrReading1;      
int fsrReading2;
int fsrReading3;      
int fsrReading4;
int fsrReading5;

int count = 0;
bool isPresent1 = false;
bool isPresent2 = false;
bool isPresent3 = false;
bool isPresent4 = false;
bool isPresent5 = false;

int lastSection = 0;

int hist[] = {0, 0, 0, 0, 0};

void setup() {
  Serial.begin(9600);
  // Initialize the entire LED strip
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.addLeds<WS2812B, DATA_PIN>(leds_drawer, NUM_LEDS_DRAWERS);
  FastLED.setBrightness(50);
 
  // Initialize all LEDs to off
  FastLED.clear();
  FastLED.show();
  
  // Ensure CPR is not active on startup
  cprActive = false;
}


void loop() {
  // Drawer functionality
  fsrReading1 = analogRead(fsrAnalogPin1);
  fsrReading2 = analogRead(fsrAnalogPin2);
  fsrReading3 = analogRead(fsrAnalogPin3);
  fsrReading4 = analogRead(fsrAnalogPin4);
  fsrReading5 = analogRead(fsrAnalogPin5);

  isPresent1 = fsrReading1 >= SENSOR_THRESHOLD;
  isPresent2 = fsrReading2 >= SENSOR_THRESHOLD;
  isPresent3 = fsrReading3 >= SENSOR_THRESHOLD;
  isPresent4 = fsrReading4 >= SENSOR_THRESHOLD;
  isPresent5 = fsrReading5 >= SENSOR_THRESHOLD;

  // Check for serial commands
  if (Serial.available() > 0) {
    String data = Serial.readStringUntil('\n');
    data.trim();  // Remove any whitespace
    
    if (data == "START") {
      cprActive = true;
      Serial.println("CPR_STARTED");  // Send confirmation
    }
    else if (data == "STOP") {
      cprActive = false;
      // Turn off CPR LEDs immediately
      for (int i = CPR_START_LED; i <= CPR_END_LED; i++) {
        leds[i] = CRGB::Black;
      }
      FastLED.show();
      // Send confirmation back
      Serial.println("CPR_STOPPED");
    }
    
    if (data.indexOf("DRAWER1") >= 0 && isPresent1) {
      hist[0] = 1;
      activateSection(1);
    }
    if (data.indexOf("DRAWER2") >= 0 && isPresent2) { 
      hist[1] = 1;
      activateSection(2);
      count = count + 1;
    }
    if (data.indexOf("DRAWER3") >= 0 && isPresent3) {
      hist[2] = 1;
      activateSection(3);
    }
    if (data.indexOf("DRAWER4") >= 0 && isPresent4) {
      hist[3] = 1;
      activateSection(4);
    }
  }

  // Only flash CPR LEDs if CPR is active
  if (cprActive) {
    unsigned long currentTime = millis();
    if (currentTime - lastBeatTime >= beatInterval) {
      beatState = !beatState;
      updateCPRLights(beatState);
      lastBeatTime = currentTime;
    }
  }

  if (hist[0] && !isPresent1) {
    turnOffLeds(1);
    hist[0] = 0;
  } if (hist[1] && !isPresent2) {
    turnOffLeds(2);
    hist[1] = 0;
  } if (hist[2] && !isPresent3) {
    turnOffLeds(3);
    hist[2] = 0;
  } if (hist[3] && !isPresent4) {
    turnOffLeds(4);
    hist[3] = 0;
  } 
}

void updateCPRLights(bool state) {
  if (!cprActive) {
    // Ensure lights are off if CPR is not active
    for (int i = CPR_START_LED; i <= CPR_END_LED; i++) {
      leds[i] = CRGB::Black;
    }
  } else {
    // Update the CPR LED strip
    for (int i = CPR_START_LED; i <= CPR_END_LED; i++) {
      leds[i] = state ? CPR_COLOR : CRGB::Black;
    }
  }
  FastLED.show();
}

void activateSection(int section) {
  lastSection = section;
  int start = (section - 1) * 8 + 7;

  for (int i = 0; i < NUM_LEDS_DRAWERS; i++) { 
    if (i >= 22 && i < 30) {
      if (section == 1) leds_drawer[i] = CRGB::Red;
    } 
    else if (i >= 31 && i < 39) {
      if (section == 2) leds_drawer[i] = CRGB::Green;
    } 
    else if (i >= 40 && i < 51) {
      if (section == 3) leds_drawer[i] = CRGB::Blue;
    } 
    else if (i >= 51 && i < 62) {
      if (section == 4) leds_drawer[i] = CRGB::Yellow;
    } 
    else {
      leds_drawer[i] = leds_drawer[i];
    }
  }
  FastLED.show();
}

void turnOffLeds(int section) {
  int start = (section - 1) * 8 + 7;

  for (int i = 0; i < NUM_LEDS_DRAWERS; i++) { 
    if (i >= 22 && i < 30) { 
      if (section == 1) leds_drawer[i] = CRGB::Black;
    } 
    else if (i >= 31 && i < 39) {
      if (section == 2) leds_drawer[i] = CRGB::Black;
    } 
    else if (i >= 40 && i < 51) {
      if (section == 3) leds_drawer[i] = CRGB::Black;
    } 
    else if (i >= 51 && i < 62) {
      if (section == 4) leds_drawer[i] = CRGB::Black;
    } 
  }

  FastLED.show();
}
