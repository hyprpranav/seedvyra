/**
 * SEEDVYRA - Web Serial API Service
 * Handles bidirectional serial communication with the ESP32 hardware prototype.
 */

class SerialService {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readableStreamClosed = null;
    this.writableStreamClosed = null;
    this.isConnected = false;
    this.isReading = false;
    this.baudRate = 115200;
    this.lineBuffer = '';
    
    // Callbacks
    this.onSensorDataCallback = null;
    this.onRelayStatusCallback = null;
    this.onConnectionChangeCallback = null;
    this.onErrorCallback = null;
    this.onRawLineCallback = null;

    // Simulation handle
    this.simulationInterval = null;
    this.isSimulated = false;
  }

  /**
   * Check if the browser supports Web Serial API
   */
  isSupported() {
    return 'serial' in navigator;
  }

  /**
   * Set callback for sensor telemetry updates
   */
  onSensorData(callback) {
    this.onSensorDataCallback = callback;
  }

  /**
   * Set callback for relay command acknowledgements
   */
  onRelayStatus(callback) {
    this.onRelayStatusCallback = callback;
  }

  /**
   * Set callback for connection state changes
   */
  onConnectionChange(callback) {
    this.onConnectionChangeCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback) {
    this.onErrorCallback = callback;
  }

  /**
   * Set callback for raw log lines (optional debugging)
   */
  onRawLine(callback) {
    this.onRawLineCallback = callback;
  }

  /**
   * Prompt user to select port and open connection
   */
  async connect(baudRate = 115200) {
    if (!this.isSupported()) {
      throw new Error(
        'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera on Desktop.'
      );
    }

    if (this.isSimulated) {
      this.stopSimulation();
    }

    try {
      this.baudRate = baudRate;
      // Request a port from user
      this.port = await navigator.serial.requestPort();
      
      // Open port with configured baud rate
      await this.port.open({ baudRate: this.baudRate });
      this.isConnected = true;
      this.isSimulated = false;

      // Setup writer
      const encoder = new TextEncoderStream();
      this.writableStreamClosed = encoder.readable.pipeTo(this.port.writable);
      this.writer = encoder.writable.getWriter();

      if (this.onConnectionChangeCallback) {
        this.onConnectionChangeCallback({ connected: true, simulated: false });
      }

      // Start continuous read loop
      this.startReading();

      return true;
    } catch (err) {
      this.isConnected = false;
      if (this.onConnectionChangeCallback) {
        this.onConnectionChangeCallback({ connected: false, simulated: false });
      }
      if (err.name !== 'NotFoundError') {
        // User didn't just cancel the prompt
        if (this.onErrorCallback) {
          this.onErrorCallback(`Serial Connection Error: ${err.message}`);
        }
      }
      throw err;
    }
  }

  /**
   * Read incoming stream continuously
   */
  async startReading() {
    if (!this.port || !this.port.readable) return;

    this.isReading = true;
    const textDecoder = new TextDecoderStream();
    this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          // Stream closed by device or disconnect
          break;
        }
        if (value) {
          this.processIncomingChunk(value);
        }
      }
    } catch (err) {
      if (this.isReading && this.onErrorCallback) {
        this.onErrorCallback(`Serial Read Error: ${err.message}`);
      }
    } finally {
      this.isReading = false;
    }
  }

  /**
   * Buffer and process incoming serial text line-by-line
   */
  processIncomingChunk(chunk) {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split(/\r?\n/);
    
    // Keep incomplete trailing line in buffer
    this.lineBuffer = lines.pop();

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      if (this.onRawLineCallback) {
        this.onRawLineCallback(trimmed);
      }

      // Attempt JSON parse
      try {
        const data = JSON.parse(trimmed);
        this.handleMessage(data);
      } catch {
        // Line might be non-JSON debug text or fragmented
        // Safely ignore or pass as debug info
      }
    }
  }

  /**
   * Dispatch parsed JSON packet based on type
   */
  handleMessage(data) {
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'sensor':
        if (this.onSensorDataCallback) {
          this.onSensorDataCallback({
            ambientTemp: typeof data.ambientTemp === 'number' ? data.ambientTemp : null,
            humidity: typeof data.humidity === 'number' ? data.humidity : null,
            sampleTemp: typeof data.sampleTemp === 'number' ? data.sampleTemp : null,
            red: typeof data.red === 'number' ? data.red : null,
            green: typeof data.green === 'number' ? data.green : null,
            blue: typeof data.blue === 'number' ? data.blue : null,
            clear: typeof data.clear === 'number' ? data.clear : null,
            timestamp: Date.now(),
            isSimulated: this.isSimulated
          });
        }
        break;

      case 'relay_status':
        if (this.onRelayStatusCallback) {
          this.onRelayStatusCallback(data);
        }
        break;

      case 'error':
        if (this.onErrorCallback) {
          this.onErrorCallback(`Hardware Alert: ${data.message || 'Unknown sensor error'}`);
        }
        break;

      default:
        // Handle generic or unrecognized telemetry
        break;
    }
  }

  /**
   * Send a JSON command to the ESP32
   */
  async sendCommand(commandObj) {
    if (this.isSimulated) {
      // Simulate relay acknowledgement
      if (commandObj.type === 'relay') {
        setTimeout(() => {
          if (this.onRelayStatusCallback) {
            this.onRelayStatusCallback({
              type: 'relay_status',
              relay: commandObj.relay,
              state: commandObj.state,
              success: true
            });
          }
        }, 120);
      }
      return true;
    }

    if (!this.isConnected || !this.writer) {
      const err = new Error('Device not connected via serial.');
      if (this.onErrorCallback) {
        this.onErrorCallback('Cannot send command: ESP32 is not connected.');
      }
      throw err;
    }

    try {
      const payload = JSON.stringify(commandObj) + '\n';
      await this.writer.write(payload);
      return true;
    } catch (err) {
      if (this.onErrorCallback) {
        this.onErrorCallback(`Failed to send command to ESP32: ${err.message}`);
      }
      throw err;
    }
  }

  /**
   * Switch relay state
   * @param {number} relay 1 or 2
   * @param {number} state 0 (OFF) or 1 (ON)
   */
  async setRelay(relay, state) {
    return this.sendCommand({
      type: 'relay',
      relay: Number(relay),
      state: state ? 1 : 0
    });
  }

  /**
   * Disconnect cleanly from the serial port
   */
  async disconnect() {
    if (this.isSimulated) {
      this.stopSimulation();
      return;
    }

    this.isReading = false;

    try {
      if (this.reader) {
        await this.reader.cancel().catch(() => {});
        this.reader.releaseLock();
        this.reader = null;
      }

      if (this.readableStreamClosed) {
        await this.readableStreamClosed.catch(() => {});
        this.readableStreamClosed = null;
      }

      if (this.writer) {
        await this.writer.close().catch(() => {});
        this.writer.releaseLock();
        this.writer = null;
      }

      if (this.writableStreamClosed) {
        await this.writableStreamClosed.catch(() => {});
        this.writableStreamClosed = null;
      }

      if (this.port) {
        await this.port.close().catch(() => {});
        this.port = null;
      }
    } catch (err) {
      console.warn('Serial cleanup notice:', err);
    } finally {
      this.isConnected = false;
      this.isSimulated = false;
      this.lineBuffer = '';
      if (this.onConnectionChangeCallback) {
        this.onConnectionChangeCallback({ connected: false, simulated: false });
      }
    }
  }

  /**
   * Start optional hardware simulation mode for offline UI testing
   */
  startSimulation() {
    this.stopSimulation();
    this.isSimulated = true;
    this.isConnected = true;

    if (this.onConnectionChangeCallback) {
      this.onConnectionChangeCallback({ connected: true, simulated: true });
    }

    let baseTemp = 28.5;
    let baseSample = 27.8;
    let baseHum = 62;

    this.simulationInterval = setInterval(() => {
      baseTemp += (Math.random() - 0.5) * 0.2;
      baseSample += (Math.random() - 0.5) * 0.15;
      baseHum += (Math.random() - 0.5) * 0.4;

      const simData = {
        type: 'sensor',
        ambientTemp: parseFloat(baseTemp.toFixed(1)),
        humidity: Math.round(baseHum),
        sampleTemp: parseFloat(baseSample.toFixed(1)),
        red: Math.floor(130 + Math.random() * 25),
        green: Math.floor(100 + Math.random() * 20),
        blue: Math.floor(70 + Math.random() * 15),
        clear: Math.floor(290 + Math.random() * 30),
        timestamp: Date.now(),
        isSimulated: true
      };

      if (this.onSensorDataCallback) {
        this.onSensorDataCallback(simData);
      }
    }, 1200);
  }

  /**
   * Stop hardware simulation
   */
  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    this.isSimulated = false;
    this.isConnected = false;
    if (this.onConnectionChangeCallback) {
      this.onConnectionChangeCallback({ connected: false, simulated: false });
    }
  }
}

export const serialService = new SerialService();
