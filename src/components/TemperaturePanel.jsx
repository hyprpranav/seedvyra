import React from 'react';
import { Thermometer, Droplets, Waves, CheckCircle2 } from 'lucide-react';

export default function TemperaturePanel({ sensorData, isConnected }) {
  const hasAmbient =
    isConnected &&
    sensorData &&
    sensorData.ambientTemp !== null &&
    sensorData.ambientTemp !== undefined;

  const hasSample =
    isConnected &&
    sensorData &&
    sensorData.sampleTemp !== null &&
    sensorData.sampleTemp !== undefined;

  const hasHumidity =
    isConnected &&
    sensorData &&
    sensorData.humidity !== null &&
    sensorData.humidity !== undefined;

  const ambient = hasAmbient ? sensorData.ambientTemp : null;
  const sample = hasSample ? sensorData.sampleTemp : null;
  const humidity = hasHumidity ? sensorData.humidity : null;

  // Thermal delta (Sample - Ambient)
  let delta = null;
  if (ambient !== null && sample !== null) {
    delta = parseFloat((sample - ambient).toFixed(2));
  }

  return (
    <div className="panel temp-panel" aria-label="Temperature & Environmental Differential">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <Thermometer size={18} className="text-emerald-600" />
            Thermal & Humidity Telemetry
          </h2>
          <p className="panel-subtitle">
            DHT11 Environmental Sensor + DS18B20 Precision Contact Probe
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
          Dual Sensor Array
        </div>
      </div>

      <div className="temp-comparison-grid">
        {/* Ambient Card */}
        <div className="temp-stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-title">DHT11 Ambient</span>
            <Thermometer size={14} color="#64748b" />
          </div>
          <div className="stat-val">
            {ambient !== null ? `${ambient.toFixed(1)} °C` : '--'}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
            Chamber atmosphere
          </span>
        </div>

        {/* Sample Probe Card */}
        <div className="temp-stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-title">DS18B20 Sample Plate</span>
            <Thermometer size={14} color="#059669" />
          </div>
          <div className="stat-val" style={{ color: '#059669' }}>
            {sample !== null ? `${sample.toFixed(1)} °C` : '--'}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
            Substrate surface
          </span>
        </div>
      </div>

      {/* Thermal Differential Delta */}
      <div className="temp-delta-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Waves size={16} color="#059669" />
          <span>Thermal Differential (ΔT = Sample − Ambient)</span>
        </div>
        <div className="temp-delta-val">
          {delta !== null ? (
            <span>
              {delta > 0 ? `+${delta}` : delta} °C
            </span>
          ) : (
            '--'
          )}
        </div>
      </div>

      {/* Humidity status row */}
      <div
        style={{
          marginTop: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-subtle)',
          padding: '0.65rem 0.85rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Droplets size={16} color="#0284c7" />
          <span style={{ fontWeight: 600 }}>Chamber Relative Humidity</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          {humidity !== null ? `${humidity}% RH` : '--'}
        </span>
      </div>
    </div>
  );
}
