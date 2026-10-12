import React from 'react';
import {
  Thermometer,
  Droplets,
  Disc,
  Palette,
  Cpu,
  Activity
} from 'lucide-react';

export default function SensorCards({
  sensorData,
  connectionState,
  testingStatus
}) {
  const { connected, simulated } = connectionState;

  // Format helpers: return "--" when disconnected or reading null
  const formatVal = (val, unit = '', decimals = 1) => {
    if (!connected || val === null || val === undefined) return '--';
    return (
      <>
        {typeof val === 'number' ? val.toFixed(decimals) : val}
        {unit && <span className="unit">{unit}</span>}
      </>
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return '#10b981';
      case 'Analysing':
      case 'Detecting seed':
      case 'Collecting measurements':
        return '#0284c7';
      case 'Error':
        return '#ef4444';
      case 'Cancelled':
        return '#f59e0b';
      case 'Camera active':
        return '#059669';
      default:
        return '#64748b';
    }
  };

  return (
    <section className="sensor-cards-grid" aria-label="Live Sensor Telemetry">
      {/* Card 1: Environmental Temperature */}
      <div className={`sensor-card ${simulated ? 'simulated-card' : ''}`}>
        <div className="sensor-card-top">
          <span className="sensor-card-title">Ambient Temp</span>
          <div className="sensor-card-icon">
            <Thermometer size={16} />
          </div>
        </div>
        <div className="sensor-card-value">
          {formatVal(sensorData?.ambientTemp, '°C', 1)}
        </div>
        <div className="sensor-card-footer">
          <span>Source: DHT11 Sensor</span>
          <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Card 2: Environmental Humidity */}
      <div className={`sensor-card ${simulated ? 'simulated-card' : ''}`}>
        <div className="sensor-card-top">
          <span className="sensor-card-title">Ambient Humidity</span>
          <div className="sensor-card-icon">
            <Droplets size={16} />
          </div>
        </div>
        <div className="sensor-card-value">
          {formatVal(sensorData?.humidity, '%', 0)}
        </div>
        <div className="sensor-card-footer">
          <span>Source: DHT11 Sensor</span>
          <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Card 3: Sample-Area Temperature */}
      <div className={`sensor-card ${simulated ? 'simulated-card' : ''}`}>
        <div className="sensor-card-top">
          <span className="sensor-card-title">Sample Temp</span>
          <div className="sensor-card-icon">
            <Disc size={16} />
          </div>
        </div>
        <div className="sensor-card-value">
          {formatVal(sensorData?.sampleTemp, '°C', 1)}
        </div>
        <div className="sensor-card-footer">
          <span>Source: DS18B20 Probe</span>
          <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Card 4: RGB Colour Sensor */}
      <div className={`sensor-card ${simulated ? 'simulated-card' : ''}`}>
        <div className="sensor-card-top">
          <span className="sensor-card-title">RGB & Clear</span>
          <div className="sensor-card-icon">
            <Palette size={16} />
          </div>
        </div>
        <div className="sensor-card-value" style={{ fontSize: '1.25rem' }}>
          {connected && sensorData?.clear !== null && sensorData?.clear !== undefined ? (
            <span style={{ fontSize: '1rem', letterSpacing: '-0.02em' }}>
              <span style={{ color: '#ef4444' }}>R:{sensorData.red} </span>
              <span style={{ color: '#10b981' }}>G:{sensorData.green} </span>
              <span style={{ color: '#3b82f6' }}>B:{sensorData.blue} </span>
              <span style={{ color: '#64748b' }}>C:{sensorData.clear}</span>
            </span>
          ) : (
            '--'
          )}
        </div>
        <div className="sensor-card-footer">
          <span>Source: TCS34725 I2C</span>
          <span>{connected ? 'ACTIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Card 5: Device Connection */}
      <div className="sensor-card">
        <div className="sensor-card-top">
          <span className="sensor-card-title">Device Link</span>
          <div className="sensor-card-icon">
            <Cpu size={16} />
          </div>
        </div>
        <div className="sensor-card-value" style={{ fontSize: '1.35rem' }}>
          {connected ? (
            <span style={{ color: simulated ? '#d97706' : '#10b981' }}>
              {simulated ? 'SIMULATED' : 'CONNECTED'}
            </span>
          ) : (
            <span style={{ color: '#64748b' }}>DISCONNECTED</span>
          )}
        </div>
        <div className="sensor-card-footer">
          <span>Web Serial (115200 bps)</span>
          <span>{connected ? 'READY' : 'WAITING'}</span>
        </div>
      </div>

      {/* Card 6: Testing Status */}
      <div className="sensor-card">
        <div className="sensor-card-top">
          <span className="sensor-card-title">Testing Workflow</span>
          <div className="sensor-card-icon">
            <Activity size={16} />
          </div>
        </div>
        <div
          className="sensor-card-value"
          style={{ fontSize: '1.35rem', color: getStatusColor(testingStatus) }}
        >
          {testingStatus}
        </div>
        <div className="sensor-card-footer">
          <span>State Machine</span>
          <span style={{ fontWeight: 600 }}>{testingStatus.toUpperCase()}</span>
        </div>
      </div>
    </section>
  );
}
