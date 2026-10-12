import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import { serialService } from './services/serial';
import { AlertCircle } from 'lucide-react';
import './styles/main.css';

export default function App() {
  const [connectionState, setConnectionState] = useState({
    connected: false,
    simulated: false
  });
  const [sensorData, setSensorData] = useState(null);
  const [relayStates, setRelayStates] = useState({ relay1: 0, relay2: 0 });
  const [hardwareError, setHardwareError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Initialize Web Serial event listeners
  useEffect(() => {
    serialService.onSensorData((data) => {
      setSensorData(data);
    });

    serialService.onRelayStatus((status) => {
      if (status.relay === 1) {
        setRelayStates((prev) => ({ ...prev, relay1: status.state }));
      } else if (status.relay === 2) {
        setRelayStates((prev) => ({ ...prev, relay2: status.state }));
      }
    });

    serialService.onConnectionChange((state) => {
      setConnectionState(state);
      if (!state.connected) {
        setSensorData(null);
      }
    });

    serialService.onError((errMessage) => {
      setHardwareError(errMessage);
    });

    return () => {
      serialService.disconnect();
    };
  }, []);

  // Connect ESP32 Device
  const handleConnect = async () => {
    setIsConnecting(true);
    setHardwareError(null);
    try {
      await serialService.connect(115200);
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        setHardwareError(err.message);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect Device
  const handleDisconnect = async () => {
    await serialService.disconnect();
    setSensorData(null);
    setRelayStates({ relay1: 0, relay2: 0 });
  };

  // Toggle Hardware Simulation
  const handleToggleSimulation = () => {
    if (connectionState.simulated) {
      serialService.stopSimulation();
      setSensorData(null);
    } else {
      serialService.startSimulation();
    }
  };

  // Toggle Relay command
  const handleToggleRelay = useCallback(
    async (relayNum) => {
      const currentState =
        relayNum === 1 ? relayStates.relay1 : relayStates.relay2;
      const targetState = currentState === 1 ? 0 : 1;
      await serialService.setRelay(relayNum, targetState);
    },
    [relayStates]
  );

  return (
    <div className="app-container">
      <Header
        connectionState={connectionState}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onToggleSimulation={handleToggleSimulation}
        isConnecting={isConnecting}
      />

      {/* Global Hardware Notification / Alert */}
      {hardwareError && (
        <div style={{ maxWidth: '1440px', margin: '1rem auto 0', padding: '0 1.25rem', width: '100%' }}>
          <div className="alert-banner error" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{hardwareError}</span>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setHardwareError(null)}
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

      <Dashboard
        connectionState={connectionState}
        sensorData={sensorData}
        relayStates={relayStates}
        onToggleRelay={handleToggleRelay}
        hardwareError={hardwareError}
      />

      <footer className="site-footer">
        <p>
          <strong>SEEDVYRA</strong> — Smart Seed Viability Analysis System | ESP32 DevKit (GPIO 4, 16, 21, 22, 26, 27) | Web Serial API @ 115200 baud
        </p>
        <p style={{ marginTop: '0.25rem', color: '#94a3b8' }}>
          Physical observations & optical telemetry reflect empirical measurements. Predictive germination classifications require crop-specific model calibration.
        </p>
      </footer>
    </div>
  );
}
