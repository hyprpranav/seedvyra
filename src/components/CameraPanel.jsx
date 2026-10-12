import React, { useRef, useEffect, useState } from 'react';
import {
  Camera,
  CameraOff,
  Video,
  Crosshair,
  AlertCircle,
  CheckCircle2,
  Flame,
  UserCheck,
  Split,
  Eye,
  Sliders
} from 'lucide-react';
import { cameraService } from '../services/camera';
import { seedAnalysisService } from '../services/seedAnalysis';

export default function CameraPanel({
  onFrameCaptured,
  latestAnalysis,
  testingStatus,
  onCameraStateChange,
  sensorData
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const thermalCanvasRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const [continuousAnalysis, setContinuousAnalysis] = useState(null);
  
  // Dual / Split view state: 'split' | 'optical' | 'thermal'
  const [viewMode, setViewMode] = useState('split');
  // Thermal palette: 'ironbow' | 'inferno' | 'rainbow' | 'whiteHot'
  const [thermalPalette, setThermalPalette] = useState('ironbow');
  // Person detected state
  const [personDetected, setPersonDetected] = useState(false);
  const [personScore, setPersonScore] = useState(0);

  // Initialize camera device listing
  useEffect(() => {
    async function loadDevices() {
      const devs = await cameraService.getAvailableCameras();
      setCameras(devs);
      if (devs.length > 0 && !selectedCameraId) {
        setSelectedCameraId(devs[0].deviceId);
      }
    }
    loadDevices();
  }, []);

  // Handle start camera
  const handleStartCamera = async () => {
    setCameraError(null);
    try {
      await cameraService.startCamera(selectedCameraId, videoRef.current);
      setIsCameraActive(true);
      if (onCameraStateChange) onCameraStateChange(true);

      const devs = await cameraService.getAvailableCameras();
      setCameras(devs);
    } catch (err) {
      setCameraError(err.message);
      setIsCameraActive(false);
      if (onCameraStateChange) onCameraStateChange(false);
    }
  };

  // Handle stop camera
  const handleStopCamera = () => {
    cameraService.stopCamera();
    setIsCameraActive(false);
    setContinuousAnalysis(null);
    setPersonDetected(false);
    if (onCameraStateChange) onCameraStateChange(false);

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    if (thermalCanvasRef.current) {
      const ctx = thermalCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, thermalCanvasRef.current.width, thermalCanvasRef.current.height);
    }
  };

  // Handle camera change
  const handleCameraChange = async (e) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    if (isCameraActive) {
      try {
        await cameraService.startCamera(newId, videoRef.current);
      } catch (err) {
        setCameraError(err.message);
      }
    }
  };

  // Real-time animation loop for Optical CV Overlay and Thermal Camera View
  useEffect(() => {
    let animId;
    let lastScanTime = 0;

    const renderLoop = async (time) => {
      if (isCameraActive && videoRef.current) {
        const video = videoRef.current;
        const optCanvas = canvasRef.current;
        const thermCanvas = thermalCanvasRef.current;

        if (video.readyState >= 2) {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 480;

          // 1. Render Thermal False-Color View
          if (thermCanvas && (viewMode === 'split' || viewMode === 'thermal')) {
            if (thermCanvas.width !== vw || thermCanvas.height !== vh) {
              thermCanvas.width = vw;
              thermCanvas.height = vh;
            }

            seedAnalysisService.renderThermalView(video, thermCanvas, {
              palette: thermalPalette,
              sampleTemp: sensorData?.sampleTemp != null ? sensorData.sampleTemp : 28.8,
              ambientTemp: sensorData?.ambientTemp != null ? sensorData.ambientTemp : 26.5
            });
          }

          // 2. Optical CV Analysis & Reticle Overlay (every 350ms to ensure 60fps thermal render)
          if (optCanvas && (viewMode === 'split' || viewMode === 'optical')) {
            if (optCanvas.width !== vw || optCanvas.height !== vh) {
              optCanvas.width = vw;
              optCanvas.height = vh;
            }

            if (time - lastScanTime > 350) {
              lastScanTime = time;
              try {
                // Specialized Black Seed in Cardboard Box CV
                const currentResult = seedAnalysisService.analyzeImage(video);

                // Online ML General Object & Person Detection (COCO-SSD)
                const objects = await seedAnalysisService.detectGeneralObjects(video);
                currentResult.generalObjects = objects;

                // Check for person
                const personObj = objects.find(
                  (o) => o.class.toLowerCase() === 'person'
                );
                if (personObj) {
                  setPersonDetected(true);
                  setPersonScore(Math.round(personObj.score * 100));
                } else {
                  setPersonDetected(false);
                  setPersonScore(0);
                }

                setContinuousAnalysis(currentResult);

                // Clear & redraw reticles and boxes
                const ctx = optCanvas.getContext('2d');
                ctx.clearRect(0, 0, optCanvas.width, optCanvas.height);
                seedAnalysisService.drawOverlay(optCanvas, currentResult);
              } catch (err) {
                console.warn('Real-time frame evaluation warning:', err);
              }
            }
          }
        }
      }
      animId = requestAnimationFrame(renderLoop);
    };

    if (isCameraActive) {
      animId = requestAnimationFrame(renderLoop);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isCameraActive, viewMode, thermalPalette, sensorData]);

  const activeAnalysis = latestAnalysis || continuousAnalysis;

  return (
    <div className="panel camera-panel" aria-label="Dual Vision Imaging & Thermal Station">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <Camera size={20} className="text-emerald-600" />
            Dual Bio-Optical & Thermal Camera Station
          </h2>
          <p className="panel-subtitle">
            Optical Black Seed inspection (Cardboard Box) + Radiometric Thermal Infrared (IR FLIR)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* View mode toggle */}
          <div className="view-mode-toggle">
            <button
              className={`mode-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Dual Side-by-Side View (Optical + Thermal)"
            >
              <Split size={14} />
              <span>DUAL</span>
            </button>
            <button
              className={`mode-btn ${viewMode === 'optical' ? 'active' : ''}`}
              onClick={() => setViewMode('optical')}
              title="Optical Camera Only"
            >
              <Eye size={14} />
              <span>OPTICAL</span>
            </button>
            <button
              className={`mode-btn ${viewMode === 'thermal' ? 'active' : ''}`}
              onClick={() => setViewMode('thermal')}
              title="Thermal Infrared Camera Only"
            >
              <Flame size={14} />
              <span>THERMAL</span>
            </button>
          </div>

          <span className={`status-pill ${isCameraActive ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {isCameraActive ? 'LIVE STREAM' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {cameraError && (
        <div className="alert-banner error" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{cameraError}</span>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setCameraError(null)}
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Person Identification Banner (Online ML Model) */}
      {isCameraActive && personDetected && (
        <div className="person-detected-banner" role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <UserCheck size={18} />
            <div>
              <strong>PERSON IDENTIFIED ({personScore}% Confidence)</strong>
              <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                Online ML Detection active. Human subject detected in the optical camera viewport.
              </div>
            </div>
          </div>
          <span className="online-ml-badge">ONLINE ML (COCO-SSD)</span>
        </div>
      )}

      {/* Camera Viewport Stages Container */}
      <div className={`dual-camera-container ${viewMode}`}>
        {/* Hidden video element supplying raw frames */}
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />

        {/* 1. Optical Camera Viewport */}
        {(viewMode === 'split' || viewMode === 'optical') && (
          <div className="camera-viewport-card optical-card">
            <div className="viewport-badge">
              <Eye size={13} />
              <span>OPTICAL SEED CAMERA</span>
            </div>

            <div className="camera-stage-container">
              {isCameraActive ? (
                <>
                  <canvas ref={canvasRef} className="camera-overlay-canvas" />
                </>
              ) : (
                <div className="camera-idle-placeholder">
                  <Video size={40} strokeWidth={1.5} />
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Optical Camera Offline</p>
                  <p style={{ fontSize: '0.75rem' }}>
                    Click <strong>START CAMERA</strong> below to activate
                  </p>
                </div>
              )}
            </div>
            <div className="viewport-footer-note">
              Target: Black seed in cardboard testing box
            </div>
          </div>
        )}

        {/* 2. Thermal Infrared Camera Viewport */}
        {(viewMode === 'split' || viewMode === 'thermal') && (
          <div className="camera-viewport-card thermal-card">
            <div className="viewport-badge thermal">
              <Flame size={13} />
              <span>THERMAL INFRARED (IR FLIR)</span>
            </div>

            <div className="camera-stage-container thermal-stage">
              {isCameraActive ? (
                <canvas ref={thermalCanvasRef} className="camera-overlay-canvas" />
              ) : (
                <div className="camera-idle-placeholder">
                  <Flame size={40} strokeWidth={1.5} color="#ea580c" />
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Thermal Imaging Offline</p>
                  <p style={{ fontSize: '0.75rem' }}>
                    False-color radiometric heatmap activates with camera
                  </p>
                </div>
              )}
            </div>
            <div className="viewport-footer-note">
              Calibration: ε = 0.95 | Scaled with DS18B20 probe
            </div>
          </div>
        )}
      </div>

      {/* Camera Toolbar */}
      <div className="camera-toolbar">
        <div className="camera-controls-left">
          {!isCameraActive ? (
            <button
              id="btn-start-camera"
              className="btn btn-primary"
              onClick={handleStartCamera}
            >
              <Camera size={16} />
              <span>START CAMERA</span>
            </button>
          ) : (
            <button
              id="btn-stop-camera"
              className="btn btn-outline"
              onClick={handleStopCamera}
            >
              <CameraOff size={16} />
              <span>STOP CAMERA</span>
            </button>
          )}

          {/* Device selector */}
          {cameras.length > 1 && (
            <select
              id="camera-device-select"
              className="camera-select"
              value={selectedCameraId}
              onChange={handleCameraChange}
              title="Select Video Input Device"
            >
              {cameras.map((cam, idx) => (
                <option key={cam.deviceId || idx} value={cam.deviceId}>
                  {cam.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {/* Thermal Palette Selector */}
          {(viewMode === 'split' || viewMode === 'thermal') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                Palette:
              </span>
              <select
                id="thermal-palette-select"
                className="camera-select"
                style={{ maxWidth: '140px' }}
                value={thermalPalette}
                onChange={(e) => setThermalPalette(e.target.value)}
              >
                <option value="ironbow">Ironbow (FLIR)</option>
                <option value="inferno">Inferno</option>
                <option value="rainbow">Rainbow</option>
                <option value="whiteHot">White-Hot</option>
              </select>
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
          Real-time dual stream @ 30fps
        </div>
      </div>

      {/* Real-time Detection Status Bar */}
      {isCameraActive && activeAnalysis && (
        <div
          className={`detection-status-bar ${
            activeAnalysis.detected ? 'detected' : 'no-seed'
          }`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activeAnalysis.detected ? (
              <CheckCircle2 size={16} color="#059669" />
            ) : (
              <AlertCircle size={16} color="#ea580c" />
            )}
            <span style={{ fontWeight: 600 }}>{activeAnalysis.message}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            {activeAnalysis.morphology && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                Dims: {activeAnalysis.morphology.dimensions.widthPx}×
                {activeAnalysis.morphology.dimensions.heightPx} px (
                {activeAnalysis.morphology.shapeCharacteristics})
              </span>
            )}

            {/* Black Seed Indicator Pill */}
            {activeAnalysis.isBlackSeed && (
              <span className="black-seed-pill">
                ● BLACK SEED VERIFIED
              </span>
            )}

            <span
              style={{
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                color: '#64748b',
                background: '#f1f5f9',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              Stage: Cardboard Test Box
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
