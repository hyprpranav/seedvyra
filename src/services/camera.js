/**
 * SEEDVYRA - Camera Service
 * Manages video streams from laptop built-in camera and optional external USB webcams.
 */

class CameraService {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.activeDeviceId = null;
    this.isStreaming = false;
    this.devices = [];
  }

  /**
   * Check if mediaDevices API is available
   */
  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Enumerate available video input devices (cameras)
   */
  async getAvailableCameras() {
    if (!this.isSupported()) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter((device) => device.kind === 'videoinput');
      return this.devices;
    } catch (err) {
      console.warn('Could not enumerate video devices:', err);
      return [];
    }
  }

  /**
   * Start camera stream with specified device or default built-in camera
   */
  async startCamera(deviceId = null, videoElement = null) {
    if (!this.isSupported()) {
      throw new Error(
        'Camera API is not supported in this browser environment. Ensure you are using HTTPS or localhost.'
      );
    }

    // Stop any existing stream first
    this.stopCamera();

    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    };

    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.activeDeviceId = deviceId;
      this.isStreaming = true;

      if (videoElement) {
        this.videoElement = videoElement;
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
      }

      // Re-query devices in case labels are now populated after permission grant
      await this.getAvailableCameras();

      return this.stream;
    } catch (err) {
      this.isStreaming = false;
      this.stream = null;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Camera access was denied by the user. Please allow camera permissions in your browser.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No camera detected on this system.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        throw new Error('Camera is currently in use by another application.');
      } else {
        throw new Error(`Camera error: ${err.message}`);
      }
    }
  }

  /**
   * Attach existing stream to a video DOM element
   */
  attachToVideo(videoElement) {
    if (!videoElement) return;
    this.videoElement = videoElement;
    if (this.stream) {
      videoElement.srcObject = this.stream;
      videoElement.play().catch(() => {});
    }
  }

  /**
   * Capture single frame to an offscreen or provided canvas
   */
  captureFrame(targetCanvas = null) {
    if (!this.videoElement || !this.isStreaming) {
      throw new Error('Camera is not active or video element is missing.');
    }

    const video = this.videoElement;
    const canvas = targetCanvas || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /**
   * Stop active camera stream and release hardware tracks
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.isStreaming = false;
    this.activeDeviceId = null;
  }
}

export const cameraService = new CameraService();
