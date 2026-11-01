import React, { useState } from 'react';
import { Lightbulb, Fan, Droplets, FlaskConical, ToggleLeft, ToggleRight, Sliders, AlertCircle } from 'lucide-react';

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

  const relayDefinitions = [
    {
      id: 1,
      pin: 26,
      name: 'UV Light',
      description: 'Manual disinfection light for suspected germs or contamination.',
      icon: Lightbulb,
      onLabel: 'UV LIGHT ON',
      offLabel: 'TURN UV LIGHT ON',
      activeLabel: 'UV LIGHT ON'
    },
    {
      id: 2,
      pin: 27,
      name: 'Ventilation Fan',
      description: 'Extracts gas or fumes from the test enclosure when needed.',
      icon: Fan,
      onLabel: 'FAN ON',
      offLabel: 'TURN FAN ON',
      activeLabel: 'FAN ON'
    },
    {
      id: 3,
      pin: 25,
      name: 'Water Mist Maker',
      description: 'Moistens tough seed coats before the treatment spray.',
      icon: Droplets,
      onLabel: 'WATER MIST ON',
      offLabel: 'START WATER MIST',
      activeLabel: 'WATER MIST ON'
    },
    {
      id: 4,
      pin: 33,
      name: 'Medicine Mist Maker',
      description: 'Applies the treatment solution after the water mist step.',
      icon: FlaskConical,
      onLabel: 'MEDICINE MIST ON',
      offLabel: 'START MEDICINE MIST',
      activeLabel: 'MEDICINE MIST ON'
    }
  ];

  return (
    <div className="panel relay-panel" aria-label="Relay Control System">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <Sliders size={18} className="text-emerald-600" />
            4-Channel Optocoupled Relay Controls
          </h2>
          <p className="panel-subtitle">
            Manual controls for light, ventilation, water mist, and treatment spray
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
          GPIO 25, 26, 27 & 33
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
        {relayDefinitions.map(({ id, pin, name, description, icon: Icon, onLabel, offLabel, activeLabel }) => {
          const isOn = relayStates?.[`relay${id}`] === 1;
          return (
            <div className="relay-card" key={id}>
              <div className="relay-card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Icon size={16} color={isOn ? '#10b981' : '#64748b'} />
                    <h3 className="relay-card-name">Relay {id}: {name}</h3>
                  </div>
                  <p className="relay-card-desc">{description}</p>
                </div>
                <span className={`relay-status-indicator ${isOn ? 'on' : 'off'}`}>
                  {isOn ? activeLabel : 'OFF'}
                </span>
              </div>

              <button
                id={`btn-toggle-relay-${id}`}
                className={`btn ${isOn ? 'btn-danger' : id === 1 ? 'btn-primary' : 'btn-secondary'}`}
                disabled={!isConnected || isOperating}
                onClick={() => handleToggle(id)}
                title={!isConnected ? 'Connect ESP32 to toggle relay' : `Toggle ${name.toLowerCase()} on GPIO ${pin}`}
              >
                {isOn ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                <span>{isOn ? `TURN ${onLabel.replace(' ON', '')} OFF` : offLabel}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#64748b' }}>
        Note: Relays initialize in the safe OFF state at boot. Ensure high-voltage isolation complies with safety ratings.
      </div>
    </div>
  );
}
