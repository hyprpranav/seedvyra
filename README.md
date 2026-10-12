# SEEDVYRA — Smart Seed Viability Analysis System

![SEEDVYRA Logo](/public/logo.svg)

**SEEDVYRA** is a lightweight, responsive, laboratory-grade bio-optical seed analysis dashboard that interfaces directly with an ESP32 hardware prototype via the browser's **Web Serial API**, **MediaDevices API**, and **HTML5 Canvas Computer Vision**.

The system performs:
- **Optical seed morphology & dimension measurement** (width, height, area, aspect ratio, circularity index)
- **TCS34725 I2C spectral RGB & Clear photodiode reflectance measurement**
- **Dual thermal differential monitoring**: Environmental ambient temperature & humidity (DHT11) vs. sample-area contact temperature (DS18B20)
- **2-Channel optocoupled relay actuation**: Relay 1 (Target White Lighting) & Relay 2 (Auxiliary Output)
- **Empirical test workflow synthesis**: Clear separation between seed detection, physical observation, sensor readings, and predictive germination models.

---

## 1. System Architecture

```
┌──────────────────────────────────────────────┐
│             SEEDVYRA Web Client             │
│   (React + Vite + Web Serial + MediaDevices) │
└───────▲──────────────────────────────▲───────┘
        │                               │
 Web Serial API (115200 baud)    Browser Camera Stream
  [JSON Packets & Commands]       (Built-in / USB Webcam)
        │                               │
┌───────▼───────────────────────────────▼───────┐
│              ESP32 DevKit V1                  │
├──────────────────────┬────────────────────────┤
│ GPIO 4:  DHT11       │ GPIO 21: SDA (I2C)     │
│ GPIO 16: DS18B20     │ GPIO 22: SCL (I2C)     │
│ GPIO 26: Relay 1     │ I2C 0x29: TCS34725 RGB │
│ GPIO 27: Relay 2     │ I2C 0x3C: OLED Display │
└──────────────────────┴────────────────────────┘
```

---

## 2. Hardware Components & Bill of Materials

| Component | Purpose | Interface | Recommended Voltage |
|-----------|---------|-----------|---------------------|
| **ESP32 DevKit V1** | Main microcontroller & serial telemetry engine | USB Serial | 5V (USB) / 3.3V Logic |
| **DHT11** | Chamber ambient temperature (°C) & humidity (% RH) | GPIO 4 (1-Wire) | 3.3V / 5V |
| **DS18B20 Probe** | Sample-stage contact surface temperature (°C) | GPIO 16 (Dallas 1-Wire) | 3.3V (requires 4.7kΩ pull-up) |
| **TCS34725** | High-precision RGB color and clear lux photodiode | I2C (SDA: 21, SCL: 22) | 3.3V |
| **0.96" I2C OLED** | Real-time device-side status monitor (SSD1306) | I2C (SDA: 21, SCL: 22) | 3.3V / 5V |
| **2-Channel Relay** | Switched actuators (Relay 1: Lighting, Relay 2: Aux) | GPIO 26 & 27 | 5V Coil VCC / Active LOW |
| **Laptop / Webcam** | Seed macro image capture & visual reticle inspection | MediaDevices API | Native USB |

---

## 3. ESP32 Pinout Configuration

| Component Pin | ESP32 GPIO | Description & Electrical Notes |
|---------------|------------|--------------------------------|
| **DHT11 DATA** | **GPIO 4** | Ambient temperature and humidity sensor data line. |
| **DS18B20 DATA** | **GPIO 16** | Sample probe data line. **Requires a 4.7kΩ resistor between DATA and 3.3V**. |
| **TCS34725 SDA** | **GPIO 21** | Shared I2C data bus (Address: `0x29`). |
| **TCS34725 SCL** | **GPIO 22** | Shared I2C clock bus. |
| **OLED SDA** | **GPIO 21** | Shared I2C data bus (Address: `0x3C` or `0x3D`). |
| **OLED SCL** | **GPIO 22** | Shared I2C clock bus. |
| **Relay 1 IN1** | **GPIO 26** | Target illumination light control. Active-LOW logic. |
| **Relay 2 IN2** | **GPIO 27** | Auxiliary switching output. Active-LOW logic (Default: OFF). |
| **GND** | **GND** | Common ground connected across ESP32, sensors, and relay module. |

> **Relay Safety Notice:** Standard relay breakout boards use optocoupled **active-LOW** trigger inputs (`LOW` activates the relay coil; `HIGH` de-activates it). The firmware initializes both GPIO 26 and 27 to `HIGH` upon startup to guarantee both relays remain safely **OFF** at boot.

---

## 4. ESP32 Serial Protocol Specification

- **Baud Rate**: `115200`
- **Framing**: UTF-8 JSON lines terminated by `\n`

### A. Periodic Sensor Telemetry (1 Hz from ESP32)
```json
{"type":"sensor","ambientTemp":29.5,"humidity":65,"sampleTemp":28.8,"red":145,"green":112,"blue":78,"clear":310}
```
*Note: If any individual sensor fails to respond, its value is transmitted as `null` without crashing the firmware.*

### B. Relay Command (Browser to ESP32)
```json
{"type":"relay","relay":1,"state":1}
```
- `relay`: `1` (Lighting Control) or `2` (Auxiliary Channel)
- `state`: `1` (ON) or `0` (OFF)

### C. Relay Acknowledgement (ESP32 to Browser)
```json
{"type":"relay_status","relay":1,"state":1,"success":true}
```

---

## 5. ESP32 Firmware Installation

The complete sketch is located at [`ESP32/seed_viability_tester.ino`](ESP32/seed_viability_tester.ino).

### Required Arduino Libraries
Install the following via the **Arduino IDE Library Manager** (`Ctrl+Shift+I`):
1. **DHT sensor library** by Adafruit (v1.4.x)
2. **Adafruit Unified Sensor** by Adafruit (v1.1.x)
3. **OneWire** by Jim Studt, Paul Stoffregen (v2.3.x)
4. **DallasTemperature** by Miles Burton (v3.9.x)
5. **Adafruit TCS34725** by Adafruit (v1.4.x)
6. **Adafruit SSD1306** by Adafruit (v2.5.x)
7. **Adafruit GFX Library** by Adafruit (v1.11.x)

### Upload Instructions
1. Open [`ESP32/seed_viability_tester.ino`](ESP32/seed_viability_tester.ino) in Arduino IDE.
2. Select your board: `Tools` > `Board` > `ESP32 Arduino` > `ESP32 Dev Module`.
3. Select your serial port: `Tools` > `Port` > `COMx` (Windows) or `/dev/ttyUSBx` (Linux/macOS).
4. Click **Upload** (`Ctrl+U`).

---

## 6. Web Application Setup & Local Development

### Prerequisites
- Node.js `v18.0.0` or higher
- A browser supporting the **Web Serial API** (Google Chrome, Microsoft Edge, Opera on Desktop)
- Secure origin context (`http://localhost` or `https://` on Vercel)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/hyprpranav/seedvyra.git
cd seedvyra

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:3000/` in Google Chrome or Microsoft Edge.

---

## 7. Dual Vision: Optical Black Seed CV & Thermal Infrared Imaging

### A. Specialized Black Seed Detection in Cardboard Testing Box
- **Substrate Surface**: The system calibrates for a standard cardboard testing box aperture (kraft / tan / brown surface).
- **Black Seed Identification**: Specifically isolates dark/black seed clusters ($R < 75, G < 75, B < 75$) contrasting against the cardboard backdrop.
- **Morphology Metrics**: Computes physical seed bounding box ($W \times H$ px), area, circularity/roundness factor, aspect ratio, and uniformity.

### B. Online-Based ML Model (Person & Scene Detection)
- Powered by client-side **TensorFlow.js & COCO-SSD** loaded on-demand.
- Detects and highlights humans with a dedicated **`PERSON IDENTIFIED (Online ML Model)`** banner and purple tracking bounding box, differentiating background persons from the test subject.

### C. Radiometric Thermal Infrared Camera (IR FLIR Simulation)
- Maps optical radiance and calibrated probe telemetry ($T_{sample}$ from DS18B20 & $T_{ambient}$ from DHT11) into a real-time false-color thermal heatmap.
- **Palettes Supported**:
  - `Ironbow (FLIR)`: Deep purple $\rightarrow$ red $\rightarrow$ amber $\rightarrow$ white-hot
  - `Inferno`: Radiometric dark purple to fiery gold
  - `Rainbow`: Standard multi-hue thermal gradient
  - `White-Hot`: Monochrome thermal radiance
- **Radiometric HUD**: Real-time center spot temperature readout ($T_{spot}$ in °C), calibrated temperature scale bar (Min $\rightarrow$ Max °C), and organic seed coat emissivity factor ($\varepsilon = 0.95$).

### D. Scientific Integrity & Non-Fabrication
SEEDVYRA rigorously distinguishes between:
1. **Seed detection**: Optical confirmation that a black seed is placed in the cardboard box reticle.
2. **Visible seed condition**: Quantitative morphological metrics (width, height, area, circularity, surface uniformity).
3. **Sensor measurements**: Environmental temperature, humidity, sample temperature, and raw RGB/Clear counts.
4. **Predicted viability**: Requires a calibrated, scientifically validated crop-specific machine learning model.
5. **Confirmed germination**: Traditional physiological laboratory germination tests.

> **Important:** The system **never fabricates** a viability prediction from unvalidated formulas. When no validated crop model is loaded, the dashboard explicitly reports:
> `"Viability prediction unavailable — model validation required."`

### Pluggable Seed Model Integration
To plug in a custom trained TensorFlow.js or ONNX model:
1. Place `model.json` and weight binaries in `public/models/`.
2. Enable model inference in [`src/services/seedAnalysis.js`](src/services/seedAnalysis.js) by calling `loadCustomSeedModel('/models/model.json')`.

---

## 8. Deployment on Vercel

The project is built with standard Vite and is deployable to Vercel without server configuration:

```bash
# Build the production bundle
npm run build
```

### Vercel Deployment Options:
1. **GitHub Integration (Recommended)**:
   - Push this repository to GitHub: `https://github.com/hyprpranav/seedvyra.git`
   - Import the repository in [Vercel](https://vercel.com).
   - Vercel automatically detects the Vite framework and runs `npm run build` with output directory `dist`.
2. **Vercel CLI**:
   ```bash
   npx vercel --prod
   ```

*Note on Web Serial over Vercel:* The Web Serial API is a client-side browser API. It communicates directly from your browser to the local ESP32 via USB. It works seamlessly on Vercel because Vercel serves the web application over HTTPS (satisfying the secure context requirement).

---

## 9. Troubleshooting & FAQ

| Problem | Cause | Solution |
|---------|-------|----------|
| **"Web Serial API is not supported"** | Using Safari, Firefox, or mobile browser | Open the dashboard in Google Chrome or Microsoft Edge on Desktop. |
| **"Cannot open serial port"** | Another program (e.g. Arduino Serial Monitor) has locked the COM port | Close Arduino IDE Serial Monitor or any other terminal before clicking "CONNECT DEVICE". |
| **Sensor card displays "--"** | ESP32 disconnected or sensor disconnected | Ensure the ESP32 is plugged in and connected via the dashboard. Check physical wiring if an individual sensor shows null. |
| **Camera access denied** | Browser permission blocked or not on secure context | Allow camera permissions in the browser address bar icon. Ensure using `localhost` or `https://`. |
| **No seed detected** | Seed outside target reticle or low contrast | Center the seed within the green bracketed reticle on the camera stage. Ensure adequate illumination using Relay 1. |
| **DS18B20 returns null / -127°C** | Missing 4.7kΩ pull-up resistor | Connect a 4.7kΩ resistor between the DS18B20 DATA pin and 3.3V. |

---

## 10. License
Academic and Research Open Source License. Developed for intelligent agricultural sensing and automated seed viability research.
