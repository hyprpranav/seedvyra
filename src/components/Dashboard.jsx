import React, { useState, useEffect, useRef } from 'react';
import SensorCards from './SensorCards';
import CameraPanel from './CameraPanel';
import RGBPanel from './RGBPanel';
import TemperaturePanel from './TemperaturePanel';
import RelayPanel from './RelayPanel';
import ResultPanel from './ResultPanel';
import { serialService } from '../services/serial';
import { cameraService } from '../services/camera';
import { seedAnalysisService } from '../services/seedAnalysis';
import { calculationService } from '../services/calculations';

export default function Dashboard({
  connectionState,
  sensorData,
  relayStates,
  onToggleRelay,
  hardwareError
}) {
  const [testingStatus, setTestingStatus] = useState('Idle');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [validationIssues, setValidationIssues] = useState([]);
  const [testHistory, setTestHistory] = useState([]);

  const isCancelledRef = useRef(false);

  // Sync camera active state to testingStatus if idle
  const handleCameraStateChange = (active) => {
    setIsCameraActive(active);
    if (testingStatus === 'Idle' && active) {
      setTestingStatus('Camera active');
    } else if (testingStatus === 'Camera active' && !active) {
      setTestingStatus('Idle');
    }
  };

  /**
   * Main CALCULATE Workflow:
   * Step 1: Ensure camera is ready
   * Step 2: Verify device connection & telemetry
   * Step 3: Capture image frame
   * Step 4: Run CV analysis & verify seed detection
   * Step 5: Read and validate latest sensor values
   * Step 6: Process test run and display results
   */
  const handleCalculate = async () => {
    isCancelledRef.current = false;
    setValidationIssues([]);
    setTestResult(null);

    // Step 1: Confirm camera is active
    let cameraStream = cameraService.stream;
    if (!cameraStream) {
      try {
        setTestingStatus('Camera active');
        await cameraService.startCamera();
        setIsCameraActive(true);
        // Brief pause to allow camera auto-exposure to stabilize
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        setTestingStatus('Error');
        setValidationIssues([`Camera unavailable: ${err.message}`]);
        return;
      }
    }

    if (isCancelledRef.current) return;

    // Step 2: Validate Prerequisites
    const currentValidation = calculationService.validateTestData({
      sensorData,
      imageAnalysis: null, // will evaluate frame next
      isDeviceConnected: connectionState.connected
    });

    // Check hardware connection
    if (!connectionState.connected) {
      setValidationIssues(currentValidation.issues);
      setTestingStatus('Error');
      return;
    }

    // Step 3: Capture frame and analyze
    setTestingStatus('Detecting seed');
    let capturedCanvas;
    try {
      capturedCanvas = cameraService.captureFrame();
    } catch (err) {
      setTestingStatus('Error');
      setValidationIssues([`Frame capture failed: ${err.message}`]);
      return;
    }

    if (isCancelledRef.current) return;

    // Analyze captured canvas
    const analysisOutput = seedAnalysisService.analyzeImage(capturedCanvas);
    setLatestAnalysis(analysisOutput);

    // Step 4: Verify seed presence
    if (!analysisOutput.detected) {
      setTestingStatus('Completed');
      setTestResult({
        success: false,
        status: 'NO_SEED',
        summary: 'No seed detected. Place a seed inside the camera testing area.',
        observations: [],
        viabilityPrediction: {
          isAvailable: false,
          classification: 'INCONCLUSIVE',
          message: 'No seed detected in testing area.',
          disclaimer: 'Seed positioning required before calculation can proceed.'
        }
      });
      setValidationIssues([
        'No seed detected. Place a seed inside the camera testing area.'
      ]);
      return;
    }

    if (isCancelledRef.current) return;

    // Step 5: Collecting Measurements & Analysing
    setTestingStatus('Collecting measurements');
    await new Promise((r) => setTimeout(r, 500));

    if (isCancelledRef.current) return;

    setTestingStatus('Analysing');
    await new Promise((r) => setTimeout(r, 400));

    if (isCancelledRef.current) return;

    // Step 6: Process run
    const result = calculationService.processTestRun({
      sensorData,
      imageAnalysis: analysisOutput,
      hasValidatedModel: seedAnalysisService.isSeedModelConfigured()
    });

    setTestResult(result);
    setTestingStatus('Completed');
  };

  /**
   * CANCEL TEST Handler
   * Stops active workflow without leaving camera or serial reader in an inconsistent state.
   */
  const handleCancelTest = () => {
    isCancelledRef.current = true;
    setTestingStatus('Cancelled');
    setValidationIssues(['Active test was cancelled by user.']);
  };

  /**
   * COMPLETE TEST Handler
   * Finalizes the test, commits to session batch statistics, and resets for the next seed.
   */
  const handleCompleteTest = () => {
    if (testResult) {
      setTestHistory((prev) => [...prev, testResult]);
    }
    setTestResult(null);
    setTestingStatus(isCameraActive ? 'Camera active' : 'Idle');
    setValidationIssues([]);
  };

  /**
   * RETRY Handler
   */
  const handleRetryTest = () => {
    setTestResult(null);
    setValidationIssues([]);
    setTestingStatus(isCameraActive ? 'Camera active' : 'Idle');
  };

  const batchMetrics = calculationService.calculateBatchMetrics(testHistory);

  return (
    <main className="main-content">
      {/* 6 Sensor Cards Header Row */}
      <SensorCards
        sensorData={sensorData}
        connectionState={connectionState}
        testingStatus={testingStatus}
      />

      {/* Main Two-Column Scientific Dashboard */}
      <div className="dashboard-grid">
        {/* Left Column: Visual Capture & Analytical Result */}
        <div className="dashboard-left-col">
          <CameraPanel
            onCameraStateChange={handleCameraStateChange}
            latestAnalysis={latestAnalysis}
            testingStatus={testingStatus}
          />

          <ResultPanel
            testResult={testResult}
            testingStatus={testingStatus}
            onCalculate={handleCalculate}
            onCancelTest={handleCancelTest}
            onCompleteTest={handleCompleteTest}
            onRetryTest={handleRetryTest}
            validationIssues={validationIssues}
            batchMetrics={batchMetrics}
            isOperating={
              testingStatus === 'Analysing' ||
              testingStatus === 'Detecting seed' ||
              testingStatus === 'Collecting measurements'
            }
          />
        </div>

        {/* Right Column: Spectrometry, Thermal, Actuators */}
        <div className="dashboard-right-col">
          <RGBPanel
            sensorData={sensorData}
            isConnected={connectionState.connected}
          />

          <TemperaturePanel
            sensorData={sensorData}
            isConnected={connectionState.connected}
          />

          <RelayPanel
            relayStates={relayStates}
            onToggleRelay={onToggleRelay}
            isConnected={connectionState.connected}
            isOperating={
              testingStatus === 'Analysing' ||
              testingStatus === 'Detecting seed'
            }
          />
        </div>
      </div>
    </main>
  );
}
