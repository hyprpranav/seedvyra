import React, { useState } from 'react';
import { Lightbulb, ToggleLeft, ToggleRight, Sliders, AlertCircle, CheckCircle } from 'lucide-react';

export default function RelayPanel({
  relayStates,
  onToggleRelay,
  isConnected,
  isOperating
}) {
  const [relayError, setRelayError] = useState(null);

  const handleToggle = async (relayNum) => {
    if (!isConnected) {
      setRelayError('Relay commands require an active ESP32 serial connection.');
      return;
    }
    setRelayError(null);
    try {
      await onToggleRelay(relayNum);
    } catch (err) {
      setRelayError(`Relay ${relayNum} command failed: ${err.message}`);
    }
  };

  const r1On = relayStates?.relay1 === 1;
  const r2On = relayStates?.relay2 === 1;

  return (
    <div className="panel relay-panel" aria-label="Relay Control System">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <Sliders size={18} className="text-emerald-600" />
            2-Channel Optocoupled Relay Controls
          </h2>
          <p className="panel-subtitle">
            GPIO-switched actuators for optical illumination and auxiliary testing
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
          GPIO 26 & 27
        </div>
      </div>

      {relayError && (
        <div className="alert-banner error" role="alert" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{relayError}</span>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setRelayError(null)}
          >
            DISMISS
          </button>
        </div>
      )}

      <div className="relays-grid">
        {/* Relay 1: Lighting Control */}
        <div className="relay-card">
          <div className="relay-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Lightbulb size={16} color={r1On ? '#10b981' : '#64748b'} />
                <h3 className="relay-card-name">Relay 1: Lighting Control</h3>
              </div>
              <p className="relay-card-desc">
                External white target illumination for uniform seed image capture
              </p>
            </div>
            <span className={`relay-status-indicator ${r1On ? 'on' : 'off'}`}>
              {r1On ? 'ILLUMINATION ON' : 'LIGHT OFF'}
            </span>
          </div>

          <button
            id="btn-toggle-relay-1"
            className={`btn ${r1On ? 'btn-danger' : 'btn-primary'}`}
            disabled={!isConnected || isOperating}
            onClick={() => handleToggle(1)}
            title={
              !isConnected
                ? 'Connect ESP32 to toggle relay'
                : 'Toggle external illumination'
            }
          >
            {r1On ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            <span>{r1On ? 'TURN LIGHT OFF' : 'TURN LIGHT ON'}</span>
          </button>
        </div>

        {/* Relay 2: Auxiliary ON/OFF Control */}
        <div className="relay-card">
          <div className="relay-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sliders size={16} color={r2On ? '#0284c7' : '#64748b'} />
                <h3 className="relay-card-name">Relay 2: Auxiliary Channel</h3>
              </div>
              <p className="relay-card-desc">
                General-purpose switching output for future expansion (Default: OFF)
              </p>
            </div>
            <span className={`relay-status-indicator ${r2On ? 'on' : 'off'}`}>
              {r2On ? 'ACTIVE (ON)' : 'STANDBY (OFF)'}
            </span>
          </div>

          <button
            id="btn-toggle-relay-2"
            className={`btn ${r2On ? 'btn-danger' : 'btn-secondary'}`}
            disabled={!isConnected || isOperating}
            onClick={() => handleToggle(2)}
            title={
              !isConnected
                ? 'Connect ESP32 to toggle relay'
                : 'Toggle auxiliary output'
            }
          >
            {r2On ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            <span>{r2On ? 'DEACTIVATE RELAY 2' : 'ACTIVATE RELAY 2'}</span>
          </button>
        </div>
      </div>

      <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#64748b' }}>
        Note: Relays initialize in the safe OFF state at boot. Ensure high-voltage isolation complies with safety ratings.
      </div>
    </div>
  );
}
