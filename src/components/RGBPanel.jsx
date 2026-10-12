import React from 'react';
import { Palette, SunMedium, Sparkles } from 'lucide-react';

export default function RGBPanel({ sensorData, isConnected }) {
  const hasData =
    isConnected &&
    sensorData &&
    sensorData.clear !== null &&
    sensorData.clear !== undefined &&
    sensorData.clear > 0;

  const red = hasData ? sensorData.red : 0;
  const green = hasData ? sensorData.green : 0;
  const blue = hasData ? sensorData.blue : 0;
  const clear = hasData ? sensorData.clear : 0;

  // Normalized RGB percentages for bar displays
  const rgbSum = red + green + blue || 1;
  const rPct = hasData ? Math.round((red / rgbSum) * 100) : 0;
  const gPct = hasData ? Math.round((green / rgbSum) * 100) : 0;
  const bPct = hasData ? Math.round((blue / rgbSum) * 100) : 0;

  // Convert raw TCS34725 to approximate 8-bit RGB color for swatch display
  // Using simple chromaticity scaling capped at 255
  const normFactor = clear > 0 ? (255 / (clear * 0.75 || 1)) : 1;
  const swatchR = Math.min(255, Math.round(red * normFactor));
  const swatchG = Math.min(255, Math.round(green * normFactor));
  const swatchB = Math.min(255, Math.round(blue * normFactor));
  const swatchColor = hasData
    ? `rgb(${swatchR}, ${swatchG}, ${swatchB})`
    : 'rgba(203, 213, 225, 0.4)';

  return (
    <div className="panel rgb-panel" aria-label="TCS34725 Optical Color Spectrometry">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <Palette size={18} className="text-emerald-600" />
            TCS34725 Optical Color Sensor
          </h2>
          <p className="panel-subtitle">
            Multichannel spectral measurement of seed coat reflectance
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
          I2C: 0x29
        </div>
      </div>

      {/* Swatch & Distribution Bars */}
      <div className="rgb-preview-wrapper">
        <div
          className="rgb-color-swatch"
          style={{ backgroundColor: swatchColor }}
          title={hasData ? `Estimated Reflectance Swatch: ${swatchColor}` : 'Sensor Offline'}
        >
          <span className="rgb-color-swatch-label">
            {hasData ? 'COAT SWATCH' : 'OFFLINE'}
          </span>
        </div>

        <div className="rgb-bars-container">
          {/* Red channel */}
          <div className="rgb-bar-row">
            <span className="rgb-bar-label" style={{ color: '#ef4444' }}>R</span>
            <div className="rgb-bar-track">
              <div
                className="rgb-bar-fill red"
                style={{ width: `${rPct}%` }}
              ></div>
            </div>
            <span style={{ width: '42px', textAlign: 'right' }}>
              {hasData ? `${rPct}%` : '--'}
            </span>
          </div>

          {/* Green channel */}
          <div className="rgb-bar-row">
            <span className="rgb-bar-label" style={{ color: '#10b981' }}>G</span>
            <div className="rgb-bar-track">
              <div
                className="rgb-bar-fill green"
                style={{ width: `${gPct}%` }}
              ></div>
            </div>
            <span style={{ width: '42px', textAlign: 'right' }}>
              {hasData ? `${gPct}%` : '--'}
            </span>
          </div>

          {/* Blue channel */}
          <div className="rgb-bar-row">
            <span className="rgb-bar-label" style={{ color: '#3b82f6' }}>B</span>
            <div className="rgb-bar-track">
              <div
                className="rgb-bar-fill blue"
                style={{ width: `${bPct}%` }}
              ></div>
            </div>
            <span style={{ width: '42px', textAlign: 'right' }}>
              {hasData ? `${bPct}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Raw counts grid */}
      <div className="rgb-metrics-grid">
        <div className="rgb-metric-box">
          <div className="metric-label" style={{ color: '#dc2626' }}>Red Count</div>
          <div className="metric-val">{hasData ? red : '--'}</div>
        </div>

        <div className="rgb-metric-box">
          <div className="metric-label" style={{ color: '#059669' }}>Green Count</div>
          <div className="metric-val">{hasData ? green : '--'}</div>
        </div>

        <div className="rgb-metric-box">
          <div className="metric-label" style={{ color: '#2563eb' }}>Blue Count</div>
          <div className="metric-val">{hasData ? blue : '--'}</div>
        </div>

        <div className="rgb-metric-box">
          <div className="metric-label" style={{ color: '#475569' }}>Clear Photodiode</div>
          <div className="metric-val">{hasData ? clear : '--'}</div>
        </div>
      </div>

      <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: '#64748b' }}>
        <SunMedium size={14} />
        <span>
          Clear photodiode registers overall luminous intensity. Keep illumination constant during testing.
        </span>
      </div>
    </div>
  );
}
