//www.elegoo.com
//2016.12.08

#include <FastLED.h>
#include <math.h>

#define LED_PIN     10
#define LED_PIN2    11
#define NUM_LEDS    60
#define NUM_DRAWERS 6

int startPins[] = {3, 6, 11, 20, 25};
int endPins[] = {5, 10, 15, 24, 29};

CRGB leds[NUM_LEDS*2];

uint32_t colors[] = {CRGB::Yellow, CRGB::Red, CRGB::Purple, CRGB::Blue, CRGB::Orange, CRGB::Purple};

void setup() {
  Serial.begin(9600);
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, 0, NUM_LEDS);
  FastLED.setBrightness(50);
  FastLED.addLeds<WS2812B, 11, GRB>(leds, NUM_LEDS, 2*NUM_LEDS);
}

void loop() 
{  
  receivePySignal();
  CPRlight();  
}

void CPRlight(){
  long time_now = millis();
  while(millis() < time_now + 400){
    leds[119] = CRGB::Yellow;
    leds[118] = CRGB::Yellow;
    leds[117] = CRGB::Yellow;
    leds[116] = CRGB::Yellow;
    leds[115] = CRGB::Yellow;
    // for (int dot = 60; dot < 120; dot ++){      
    //   leds[dot] = CRGB::Yellow;h
    //   FastLED.show();
    // }
  }
  for (int dot = 60; dot < 120; dot ++){
    leds[dot] = CRGB::Black;
    FastLED.show();
  }
}

void receivePySignal() {
  if (Serial.available()){
    String a = Serial.readString();
    a.trim();
    long b = a.substring(0,1).toInt();
    long c = a.substring(a.length() - 1).toInt();
    float d = c;
    Serial.println(c);

    if ((0 < b) && (b < NUM_DRAWERS)){
      // float distance = endPins[b-1] - startPins[b-1] + 1;
      // float start_pos = round(startPins[b-1] + (d-1)/3 * distance);
      // float end_pos = round(startPins[b-1] + (d/3)*distance);
      // Serial.print("Start Position: ");
      // Serial.println(start_pos);
      // Serial.print("End Position: ");
      // Serial.println(end_pos);
      float start_pos = 0;
      float end_pos = 0;
      if (b == 1) {
        start_pos = 0;
        end_pos = 20;
      }
      else if (b == 2) {
        start_pos = 20;
        end_pos = 40;
      }
      else if (b == 3) {
        start_pos = 40;
        end_pos = 60;
      }
      else if (b == 4) {
        start_pos = 60;
        end_pos = 80;
      }
      for (int dot = start_pos; dot < end_pos; dot ++){
        if (leds[dot] != CRGB::Black){
          leds[dot] = CRGB::Black;
        }
        else {
          leds[dot] = colors[c];
        }
        FastLED.show();
      }
    }
  }

  // for (int i = 0; i < 48; i++) {
  //     leds[i] = CRGB::Red;
  // }

  FastLED.show();
}