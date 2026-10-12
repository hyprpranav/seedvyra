import React, { useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, Video, Crosshair, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cameraService } from '../services/camera';
import { seedAnalysisService } from '../services/seedAnalysis';

export default function CameraPanel({
  onFrameCaptured,
  latestAnalysis,
  testingStatus,
  onCameraStateChange
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [continuousAnalysis, setContinuousAnalysis] = useState(null);

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
      
      // Update device list in case labels became available
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
    if (onCameraStateChange) onCameraStateChange(false);

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
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

  // Real-time canvas overlay rendering loop while camera is active
  useEffect(() => {
    let animId;
    let lastScanTime = 0;

    const renderOverlay = async (time) => {
      if (isCameraActive && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState >= 2) {
          // Sync canvas dimensions with video
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
          }

          // Run lightweight scan periodically (every 400ms) to avoid CPU thrashing
          if (time - lastScanTime > 400) {
            lastScanTime = time;
            try {
              // 1. Morphological canvas scan
              const currentResult = seedAnalysisService.analyzeImage(video);

              // 2. Check general objects if coco is loaded
              const generalObjects = await seedAnalysisService.detectGeneralObjects(video);
              currentResult.generalObjects = generalObjects;

              setContinuousAnalysis(currentResult);

              // Clear and draw reticle and overlays
              const ctx = canvas.getContext('2d');
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              seedAnalysisService.drawOverlay(canvas, currentResult);
            } catch (err) {
              console.warn('Real-time frame evaluation warning:', err);
            }
          }
        }
      }
      animId = requestAnimationFrame(renderOverlay);
    };

    if (isCameraActive) {
      animId = requestAnimationFrame(renderOverlay);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isCameraActive]);

  // Priority analysis object: latest from test workflow or live continuous analysis
  const activeAnalysis = latestAnalysis || continuousAnalysis;

  return (
    <div className="panel camera-panel" aria-label="Visual Inspection & Camera Feed">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <Camera size={20} className="text-emerald-600" />
            Bio-Optical Imaging & Inspection Stage
          </h2>
          <p className="panel-subtitle">
            Laptop built-in camera & computer vision seed detection target zone
          </p>
        </div>
        <div className="camera-badge">
          <span
            className={`status-pill ${isCameraActive ? 'connected' : 'disconnected'}`}
          >
            <span className="status-dot"></span>
            {isCameraActive ? 'CAMERA STREAMING' : 'CAMERA OFF'}
          </span>
        </div>
      </div>

      {/* Error Banner */}
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

      {/* Camera Video Viewport */}
      <div className="camera-stage-container">
        <video
          ref={videoRef}
          className="camera-video"
          playsInline
          muted
          style={{ display: isCameraActive ? 'block' : 'none' }}
        />
        <canvas
          ref={canvasRef}
          className="camera-overlay-canvas"
          style={{ display: isCameraActive ? 'block' : 'none' }}
        />

        {!isCameraActive && (
          <div className="camera-idle-placeholder">
            <Video size={48} strokeWidth={1.5} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Camera Offline</h3>
            <p style={{ fontSize: '0.8rem', maxWidth: '360px' }}>
              Click <strong>START CAMERA</strong> below to initialize the video feed
              and align a seed on the target reticle.
            </p>
          </div>
        )}
      </div>

      {/* Controls Toolbar */}
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
        </div>

        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
          Align seed within center reticle for optical evaluation
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {activeAnalysis.morphology && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                Dims: {activeAnalysis.morphology.dimensions.widthPx}×
                {activeAnalysis.morphology.dimensions.heightPx} px (
                {activeAnalysis.morphology.shapeCharacteristics})
              </span>
            )}

            {/* Seed-specific model indicator */}
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
              {activeAnalysis.seedModelConfigured
                ? 'Seed Model: ACTIVE'
                : 'Seed-specific model not configured.'}
            </span>
          </div>
        </div>
      )}

      {/* General Object Detection Alert (if non-seed objects detected) */}
      {isCameraActive &&
        activeAnalysis?.generalObjects?.length > 0 && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.45rem 0.75rem',
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>Background objects detected:</span>
            {activeAnalysis.generalObjects.map((obj, i) => (
              <span
                key={i}
                style={{
                  fontWeight: 600,
                  background: 'rgba(217, 119, 6, 0.15)',
                  padding: '1px 5px',
                  borderRadius: '3px'
                }}
              >
                {obj.class} ({Math.round(obj.score * 100)}%)
              </span>
            ))}
          </div>
        )}
    </div>
  );
}
