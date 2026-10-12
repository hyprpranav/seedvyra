import React from 'react';
import {
  Play,
  XCircle,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Info,
  ShieldCheck,
  ClipboardList
} from 'lucide-react';

export default function ResultPanel({
  testResult,
  testingStatus,
  onCalculate,
  onCancelTest,
  onCompleteTest,
  onRetryTest,
  validationIssues,
  batchMetrics,
  isOperating
}) {
  const isCompleted = testingStatus === 'Completed' && testResult;
  const isAnalyzing =
    testingStatus === 'Analysing' ||
    testingStatus === 'Detecting seed' ||
    testingStatus === 'Collecting measurements';

  const viability = testResult?.viabilityPrediction;

  return (
    <div className="panel results-panel" aria-label="Viability Analysis & Test Workflow">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <ClipboardList size={18} className="text-emerald-600" />
            Seed Viability & Analytical Synthesis
          </h2>
          <p className="panel-subtitle">
            Controlled laboratory test sequence and empirical measurement results
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
          Session Batch: {batchMetrics?.totalTested || 0} Tested
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="workflow-actions-bar">
        <button
          id="btn-calculate-workflow"
          className="btn btn-calculate btn-lg"
          onClick={onCalculate}
          disabled={isAnalyzing}
          title="Initiate optical capture, sensor acquisition, and viability analysis"
        >
          <Play size={18} fill="currentColor" />
          <span>{isAnalyzing ? 'RUNNING TEST...' : 'CALCULATE'}</span>
        </button>

        {isAnalyzing && (
          <button
            id="btn-cancel-test"
            className="btn btn-danger"
            onClick={onCancelTest}
            title="Halt current test workflow safely"
          >
            <XCircle size={16} />
            <span>CANCEL TEST</span>
          </button>
        )}

        {isCompleted && (
          <>
            <button
              id="btn-retry-test"
              className="btn btn-outline"
              onClick={onRetryTest}
              title="Reset analysis stage for next sample"
            >
              <RotateCcw size={16} />
              <span>RETRY</span>
            </button>

            <button
              id="btn-complete-test"
              className="btn btn-secondary"
              onClick={onCompleteTest}
              title="Record results to session history and finalize"
            >
              <CheckCircle2 size={16} color="#059669" />
              <span>COMPLETE TEST</span>
            </button>
          </>
        )}
      </div>

      {/* Validation Warnings / Prerequisite Alerts */}
      {validationIssues && validationIssues.length > 0 && (
        <div className="alert-banner warning" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <AlertTriangle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Test Prerequisite Notice:</div>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                {validationIssues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Results Display when Completed */}
      {isCompleted ? (
        <div className="result-card">
          {/* Viability Status Banner */}
          <div
            className={`viability-banner ${
              viability?.classification === 'VIABLE'
                ? 'viable'
                : viability?.classification === 'NON-VIABLE'
                ? 'non-viable'
                : 'inconclusive'
            }`}
          >
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                Viability Classification
              </div>
              <div className="viability-badge">
                {viability?.isAvailable
                  ? viability.classification
                  : 'VIABILITY PREDICTION UNAVAILABLE'}
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', textAlign: 'right', maxWidth: '300px' }}>
              <strong>{viability?.message}</strong>
            </div>
          </div>

          {/* Morphological Observations Grid */}
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
            Empirical Physical Measurements
          </h3>
          <div className="observations-list">
            {testResult.observations?.map((obs, idx) => (
              <div key={idx} className="observation-item">
                <div className="observation-label">{obs.label}</div>
                <div className="observation-val">{obs.value}</div>
              </div>
            ))}

            {testResult.opticalSummary && (
              <div className="observation-item">
                <div className="observation-label">TCS34725 Optical Reflectance</div>
                <div className="observation-val">{testResult.opticalSummary}</div>
              </div>
            )}

            {testResult.thermalDelta !== null && (
              <div className="observation-item">
                <div className="observation-label">Thermal Gradient (ΔT)</div>
                <div className="observation-val">
                  {testResult.thermalDelta > 0 ? `+${testResult.thermalDelta}` : testResult.thermalDelta} °C
                </div>
              </div>
            )}
          </div>

          {/* Environmental Telemetry Snapshot */}
          <div
            style={{
              padding: '0.75rem',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.78rem',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginTop: '0.75rem'
            }}
          >
            <span>
              <strong>Ambient:</strong> {testResult.sensorSnapshot?.ambientTemp ?? '--'} °C
            </span>
            <span>
              <strong>Humidity:</strong> {testResult.sensorSnapshot?.humidity ?? '--'} %
            </span>
            <span>
              <strong>Sample Probe:</strong> {testResult.sensorSnapshot?.sampleTemp ?? '--'} °C
            </span>
            <span>
              <strong>TCS Clear:</strong> {testResult.sensorSnapshot?.clear ?? '--'}
            </span>
            <span>
              <strong>Timestamp:</strong> {new Date(testResult.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* Scientific Transparency Disclaimer */}
          <div className="disclaimer-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <Info size={14} />
              <span>Scientific Disclaimer & Model Integrity</span>
            </div>
            <p style={{ marginTop: '0.25rem' }}>
              {viability?.disclaimer ||
                'Visible seed condition and environmental telemetry reflect empirical observations. Viability prediction requires a scientifically calibrated crop-specific model. Do not equate preliminary observations with confirmed germination.'}
            </p>
          </div>
        </div>
      ) : (
        /* Empty / Idle State */
        <div
          style={{
            padding: '2.5rem 1rem',
            textAlign: 'center',
            color: '#94a3b8',
            background: 'var(--bg-subtle)',
            borderRadius: '10px',
            border: '1px dashed #cbd5e1'
          }}
        >
          <ShieldCheck size={36} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#475569' }}>
            Ready for Seed Testing
          </h4>
          <p style={{ fontSize: '0.8rem', maxWidth: '420px', margin: '0.35rem auto 0' }}>
            Position a seed inside the camera inspection reticle, ensure the ESP32 is
            connected, then click <strong>CALCULATE</strong> above.
          </p>
        </div>
      )}

      {/* Batch Testing Session Statistics */}
      {batchMetrics && batchMetrics.totalTested > 0 && (
        <div className="batch-summary-box">
          <div>
            <strong>Session Batch Record:</strong> {batchMetrics.totalTested} seed(s) inspected
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: '#059669' }}>Viable: {batchMetrics.viableCount}</span>
            <span style={{ color: '#dc2626' }}>Non-Viable: {batchMetrics.nonViableCount}</span>
            <span style={{ color: '#475569' }}>Inconclusive: {batchMetrics.inconclusiveCount}</span>
          </div>
          {batchMetrics.estimatedViabilityPercentage !== null && (
            <div style={{ fontWeight: 700, color: '#059669' }}>
              Est. Batch Viability: {batchMetrics.estimatedViabilityPercentage}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
