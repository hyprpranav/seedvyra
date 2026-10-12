/**
 * ============================================================================
 * SEEDVYRA - Smart Seed Viability Analysis System
 * Firmware: ESP32 Hardware Prototype Controller
 * ============================================================================
 * 
 * Hardware Modules:
 * 1. ESP32 DevKit V1 (30-pin / 38-pin compatible)
 * 2. DHT11 - Ambient Environmental Temperature & Humidity Sensor
 * 3. DS18B20 - Precision Sample-Plate Temperature Sensor
 * 4. TCS34725 - I2C RGB + Clear Light Sensor (Color Temperature & Lux)
 * 5. 0.96" I2C OLED Display (SSD1306 128x64 or 128x32 compatible)
 * 6. 2-Channel Relay Module (Optocoupled, Active-LOW standard)
 * 
 * Serial Protocol: 115200 Baud, newline-terminated JSON messages
 * Output Telemetry:
 *   {"type":"sensor","ambientTemp":29.5,"humidity":65,"sampleTemp":28.8,"red":145,"green":112,"blue":78,"clear":310}
 * Input Relay Command:
 *   {"type":"relay","relay":1,"state":1}
 * Command Acknowledgement:
 *   {"type":"relay_status","relay":1,"state":1,"success":true}
 * 
 * Required Arduino Libraries (Install via Arduino IDE Library Manager):
 * - "DHT sensor library" by Adafruit (v1.4.x) + "Adafruit Unified Sensor"
 * - "OneWire" by Jim Studt, Paul Stoffregen (v2.3.x)
 * - "DallasTemperature" by Miles Burton (v3.9.x)
 * - "Adafruit TCS34725" by Adafruit (v1.4.x)
 * - "Adafruit SSD1306" by Adafruit (v2.5.x)
 * - "Adafruit GFX Library" by Adafruit (v1.11.x)
 * ============================================================================
 */

#include <Wire.h>
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_TCS34725.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ============================================================================
// 1. PIN CONFIGURATION & HARDWARE DEFINITIONS
// ============================================================================

// DHT11 Environmental Sensor
#define PIN_DHT11           4       // GPIO 4 (DATA)
#define DHTTYPE             DHT11

// DS18B20 Sample-Area Digital Temperature Sensor
#define PIN_DS18B20         16      // GPIO 16 (DATA, requires 4.7k pull-up to 3.3V)

// I2C Bus Pins (Shared between TCS34725 & OLED Display)
#define PIN_I2C_SDA         21      // GPIO 21 (SDA)
#define PIN_I2C_SCL         22      // GPIO 22 (SCL)

// Relay Controls (2-Channel Module)
// NOTE: Standard relay breakout boards use ACTIVE-LOW logic:
//   LOW (0V) -> Relay Coil ENERGIZED (ON / COM connected to NO)
//   HIGH (3.3V) -> Relay Coil DE-ENERGIZED (OFF / COM connected to NC)
#define PIN_RELAY_1         26      // GPIO 26: Relay 1 (Target Lighting Control)
#define PIN_RELAY_2         27      // GPIO 27: Relay 2 (Auxiliary Control)
#define RELAY_ACTIVE_LEVEL  LOW     // Set to LOW for Active-LOW relays, HIGH for Active-HIGH
#define RELAY_INACTIVE_LEVEL HIGH

// OLED Display Parameters
#define SCREEN_WIDTH        128
#define SCREEN_HEIGHT       64
#define OLED_RESET          -1      // Reset pin # (or -1 if sharing ESP32 reset)
#define SCREEN_I2C_ADDRESS  0x3C    // Common address: 0x3C or 0x3D

// Serial Communication Settings
#define SERIAL_BAUD_RATE    115200
#define TELEMETRY_INTERVAL  1000    // Telemetry transmission interval in ms (1 Hz)

// ============================================================================
// 2. DEVICE INSTANCES & GLOBAL STATE
// ============================================================================

DHT dht(PIN_DHT11, DHTTYPE);
OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

// TCS34725: Integration time 50ms, Gain 4x (suitable for laboratory macro box)
Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);

// OLED display
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Hardware status flags
bool oledAvailable = false;
bool tcsAvailable = false;
bool dhtAvailable = false;
bool ds18b20Available = false;

// Relay states (0 = OFF, 1 = ON)
int relay1State = 0;
int relay2State = 0;

// Timing counters
unsigned long lastTelemetryMillis = 0;
String serialInputBuffer = "";

// ============================================================================
// 3. SETUP & INITIALIZATION
// ============================================================================

void setup() {
  // Initialize Serial Monitor
  Serial.begin(SERIAL_BAUD_RATE);
  delay(200);

  // Initialize Relays in SAFE OFF STATE immediately
  pinMode(PIN_RELAY_1, OUTPUT);
  pinMode(PIN_RELAY_2, OUTPUT);
  digitalWrite(PIN_RELAY_1, RELAY_INACTIVE_LEVEL);
  digitalWrite(PIN_RELAY_2, RELAY_INACTIVE_LEVEL);
  relay1State = 0;
  relay2State = 0;

  // Initialize I2C Bus explicitly on defined pins
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  // Initialize OLED Display (safe fallback if disconnected)
  if (display.begin(SSD1306_SWITCHCAPVCC, SCREEN_I2C_ADDRESS)) {
    oledAvailable = true;
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 4);
    display.println("   SEEDVYRA SYSTEM");
    display.println("=====================");
    display.println(" Initializing HW...");
    display.display();
  } else {
    oledAvailable = false;
    Serial.println("{\"type\":\"error\",\"message\":\"OLED Display not detected at 0x3C\"}");
  }

  // Initialize DHT11
  dht.begin();
  dhtAvailable = true;

  // Initialize DS18B20
  ds18b20.begin();
  int dsCount = ds18b20.getDeviceCount();
  if (dsCount > 0) {
    ds18b20Available = true;
  } else {
    Serial.println("{\"type\":\"error\",\"message\":\"DS18B20 temperature sensor not detected\"}");
  }

  // Initialize TCS34725 RGB Sensor
  if (tcs.begin()) {
    tcsAvailable = true;
  } else {
    tcsAvailable = false;
    Serial.println("{\"type\":\"error\",\"message\":\"TCS34725 RGB sensor not detected\"}");
  }

  // Initial OLED Status Screen
  updateOLEDStatus(0.0, 0.0, 0.0);

  // Announce startup
  Serial.println("{\"type\":\"system\",\"status\":\"READY\",\"baud\":115200}");
}

// ============================================================================
// 4. MAIN LOOP
// ============================================================================

void loop() {
  // 1. Process incoming Serial JSON commands
  checkIncomingSerial();

  // 2. Periodically read sensors and emit telemetry JSON
  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryMillis >= TELEMETRY_INTERVAL) {
    lastTelemetryMillis = currentMillis;
    readAndTransmitTelemetry();
  }
}

// ============================================================================
// 5. SENSOR ACQUISITION & TELEMETRY TRANSMISSION
// ============================================================================

void readAndTransmitTelemetry() {
  // Read DHT11
  float ambientTemp = dht.readTemperature();
  float humidity = dht.readHumidity();

  // Validate DHT11 readings
  bool dhtValid = !isnan(ambientTemp) && !isnan(humidity);

  // Read DS18B20
  float sampleTemp = -127.0;
  if (ds18b20Available) {
    ds18b20.requestTemperatures();
    sampleTemp = ds18b20.getTempCByIndex(0);
  }
  bool dsValid = (sampleTemp > -55.0 && sampleTemp < 125.0);

  // Read TCS34725 RGB
  uint16_t r = 0, g = 0, b = 0, c = 0;
  if (tcsAvailable) {
    tcs.getRawData(&r, &g, &b, &c);
  }

  // Build JSON telemetry string
  // Format: {"type":"sensor","ambientTemp":29.5,"humidity":65,"sampleTemp":28.8,"red":145,"green":112,"blue":78,"clear":310}
  String jsonOutput = "{\"type\":\"sensor\",";

  // Ambient Temperature
  if (dhtValid) {
    jsonOutput += "\"ambientTemp\":" + String(ambientTemp, 1) + ",";
    jsonOutput += "\"humidity\":" + String(humidity, 0) + ",";
  } else {
    jsonOutput += "\"ambientTemp\":null,\"humidity\":null,";
  }

  // Sample Temperature
  if (dsValid) {
    jsonOutput += "\"sampleTemp\":" + String(sampleTemp, 1) + ",";
  } else {
    jsonOutput += "\"sampleTemp\":null,";
  }

  // RGB and Clear Photodiode values
  if (tcsAvailable) {
    jsonOutput += "\"red\":" + String(r) + ",";
    jsonOutput += "\"green\":" + String(g) + ",";
    jsonOutput += "\"blue\":" + String(b) + ",";
    jsonOutput += "\"clear\":" + String(c);
  } else {
    jsonOutput += "\"red\":null,\"green\":null,\"blue\":null,\"clear\":null";
  }

  jsonOutput += "}";

  // Transmit over Serial
  Serial.println(jsonOutput);

  // Update OLED display with latest readings
  updateOLEDStatus(dhtValid ? ambientTemp : 0.0, dsValid ? sampleTemp : 0.0, humidity);
}

// ============================================================================
// 6. SERIAL COMMAND PARSING (SAFE RELAY CONTROL)
// ============================================================================

void checkIncomingSerial() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialInputBuffer.length() > 0) {
        parseAndExecuteCommand(serialInputBuffer);
        serialInputBuffer = "";
      }
    } else {
      if (serialInputBuffer.length() < 256) {
        serialInputBuffer += c;
      }
    }
  }
}

/**
 * Robust JSON command parser for relay commands:
 * Example: {"type":"relay","relay":1,"state":1}
 */
void parseAndExecuteCommand(String jsonStr) {
  jsonStr.trim();
  if (!jsonStr.startsWith("{") || !jsonStr.endsWith("}")) {
    return; // Ignore malformed lines
  }

  // Check message type
  if (jsonStr.indexOf("\"type\":\"relay\"") == -1 && jsonStr.indexOf("\"type\": \"relay\"") == -1) {
    return;
  }

  // Extract relay number (1 or 2)
  int relayIndex = -1;
  int relayPos = jsonStr.indexOf("\"relay\"");
  if (relayPos != -1) {
    int colonPos = jsonStr.indexOf(':', relayPos);
    if (colonPos != -1) {
      String sub = jsonStr.substring(colonPos + 1);
      sub.trim();
      relayIndex = sub.toInt();
    }
  }

  // Extract desired state (0 or 1)
  int targetState = -1;
  int statePos = jsonStr.indexOf("\"state\"");
  if (statePos != -1) {
    int colonPos = jsonStr.indexOf(':', statePos);
    if (colonPos != -1) {
      String sub = jsonStr.substring(colonPos + 1);
      sub.trim();
      targetState = sub.toInt();
    }
  }

  // Validate inputs strictly
  if ((relayIndex == 1 || relayIndex == 2) && (targetState == 0 || targetState == 1)) {
    bool success = setRelayState(relayIndex, targetState);
    // Send acknowledgement
    Serial.println("{\"type\":\"relay_status\",\"relay\":" + String(relayIndex) +
                   ",\"state\":" + String(targetState) +
                   ",\"success\":" + (success ? "true" : "false") + "}");
  } else {
    Serial.println("{\"type\":\"error\",\"message\":\"Invalid relay parameters in JSON command\"}");
  }
}

/**
 * Execute validated relay state change
 */
bool setRelayState(int relayNum, int state) {
  int pin = (relayNum == 1) ? PIN_RELAY_1 : PIN_RELAY_2;
  int level = (state == 1) ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL;

  digitalWrite(pin, level);

  if (relayNum == 1) relay1State = state;
  if (relayNum == 2) relay2State = state;

  return true;
}

// ============================================================================
// 7. OLED STATUS DISPLAY
// ============================================================================

void updateOLEDStatus(float ambTemp, float smpTemp, float hum) {
  if (!oledAvailable) return;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Header Title
  display.setCursor(0, 0);
  display.println("SEEDVYRA BIO-ANALYZER");
  display.drawLine(0, 9, 127, 9, SSD1306_WHITE);

  // Status & Temperatures
  display.setCursor(0, 13);
  display.print("Status: READY (ESP32)");

  display.setCursor(0, 24);
  display.print("Amb: ");
  if (ambTemp > 0) {
    display.print(ambTemp, 1);
    display.print("C  ");
    display.print((int)hum);
    display.print("%");
  } else {
    display.print("-- C");
  }

  display.setCursor(0, 35);
  display.print("Sample: ");
  if (smpTemp > -50 && smpTemp < 100) {
    display.print(smpTemp, 1);
    display.print(" C");
  } else {
    display.print("-- C");
  }

  display.setCursor(0, 46);
  display.print("RGB: ");
  display.print(tcsAvailable ? "ACTIVE" : "OFFLINE");

  // Relays State
  display.setCursor(0, 56);
  display.print("R1(Light):");
  display.print(relay1State ? "ON " : "OFF ");
  display.print("R2:");
  display.print(relay2State ? "ON" : "OFF");

  display.display();
}
