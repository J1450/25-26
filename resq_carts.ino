//www.elegoo.com
//2016.12.08


#include <FastLED.h>
#include <math.h>


#define LED_PIN     10
#define NUM_LEDS    100  
#define BPM         120

#define NUM_LEDS_DRAWERS 48
#define DATA_PIN 6
#define SENSOR_THRESHOLD 70

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
int fsrReading1;      
int fsrReading2;
int fsrReading3;      
int fsrReading4;
// bool isPresent1 = false;
// bool isPresent2 = false;
// bool isPresent3 = false;
// bool isPresent4 = false;

bool isPresent1 = true;
bool isPresent2 = true;
bool isPresent3 = true;
bool isPresent4 = true;

int lastSection = 0;

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

  // isPresent1 = fsrReading1 >= SENSOR_THRESHOLD;
  // isPresent2 = fsrReading2 >= SENSOR_THRESHOLD;
  // isPresent3 = fsrReading3 >= SENSOR_THRESHOLD;
  // isPresent4 = fsrReading4 >= SENSOR_THRESHOLD;

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
    else if (data == "DRAWER1" && isPresent1) {
      activateSection(1);
      Serial.println("Drawer 1 activated");
    }
    else if (data == "DRAWER2" && isPresent2) {
      activateSection(2);
      Serial.println("Drawer 2 activated");
    }
    else if (data == "DRAWER3" && isPresent3) {
      activateSection(3);
      Serial.println("Drawer 3 activated");
    }
    else if (data == "DRAWER4" && isPresent4) {
      activateSection(4);
      Serial.println("Drawer 4 activated");
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

  // if (lastSection == 1 && !isPresent1) {
  //   turnOffLeds();
  // } else if (lastSection == 2 && !isPresent2) {
  //   turnOffLeds();
  // } else if (lastSection == 3 && !isPresent3) {
  //   turnOffLeds();
  // } else if (lastSection ==4 && !isPresent4) {
  //   turnOffLeds();
  // }
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
    if (i >= start && i < start + 8) {
      leds_drawer[i] = CRGB::Red;
    } else {
      leds_drawer[i] = CRGB::Black;
    }
  }
  FastLED.show();
}

void turnOffLeds() {
  for (int i = 0; i < NUM_LEDS_DRAWERS; i++) {
    leds_drawer[i] = CRGB::Black;
  }
  FastLED.show();
}
