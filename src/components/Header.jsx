import React from 'react';
import { Cable, Unplug, Cpu, Sparkles } from 'lucide-react';

export default function Header({
  connectionState,
  onConnect,
  onDisconnect,
  onToggleSimulation,
  isConnecting
}) {
  const { connected, simulated } = connectionState;

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Brand identity */}
        <div className="brand-section">
          <img src="/logo.svg" alt="SEEDVYRA Logo" className="brand-logo" />
          <div className="brand-titles">
            <h1 className="brand-name">
              SEEDVYRA
              <span className="brand-tag">v1.0 BIO-OPTICAL</span>
            </h1>
            <p className="brand-subtitle">Smart Seed Viability Analysis System</p>
          </div>
        </div>

        {/* Device Connectivity Controls */}
        <div className="header-actions">
          {/* Status badge */}
          <div
            className={`status-pill ${
              connected ? (simulated ? 'simulated' : 'connected') : 'disconnected'
            }`}
          >
            <span className="status-dot"></span>
            <span>
              {connected
                ? simulated
                  ? 'ESP32 (SIMULATED)'
                  : 'ESP32 CONNECTED'
                : 'ESP32 DISCONNECTED'}
            </span>
          </div>

          {/* Connect / Disconnect button */}
          {!connected ? (
            <button
              id="btn-connect-device"
              className="btn btn-primary"
              onClick={onConnect}
              disabled={isConnecting}
              title="Connect ESP32 board via Web Serial API"
            >
              <Cable size={16} />
              <span>{isConnecting ? 'CONNECTING...' : 'CONNECT DEVICE'}</span>
            </button>
          ) : (
            <button
              id="btn-disconnect-device"
              className="btn btn-outline"
              onClick={onDisconnect}
              title="Close Serial Connection"
            >
              <Unplug size={16} />
              <span>DISCONNECT</span>
            </button>
          )}

          {/* Hardware simulation toggle */}
          <button
            id="btn-toggle-simulation"
            className={`btn ${simulated ? 'btn-danger' : 'btn-secondary'} btn-sm`}
            onClick={onToggleSimulation}
            title={
              simulated
                ? 'Stop simulated hardware data'
                : 'Test UI with simulated ESP32 sensor stream'
            }
          >
            {simulated ? <Unplug size={14} /> : <Sparkles size={14} />}
            <span>{simulated ? 'STOP SIMULATION' : 'SIMULATE HW'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
