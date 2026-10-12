/**
 * SEEDVYRA - Computer Vision & Seed Analysis Service
 * Combines browser-compatible general object detection, Canvas-based morphological seed inspection,
 * and a pluggable interface for custom seed-specific deep learning models.
 */

class SeedAnalysisService {
  constructor() {
    this.isCocoLoaded = false;
    this.isLoadingCoco = false;
    this.cocoModel = null;

    // Seed-specific model state
    // Default false: no weights are bundled or assumed without actual training assets
    this.isCustomSeedModelLoaded = false;
    this.customSeedModel = null;
  }

  /**
   * Load COCO-SSD dynamically for general object detection (Person, Chair, Bag, Phone, etc.)
   */
  async loadGeneralObjectDetector() {
    if (this.cocoModel) return this.cocoModel;
    if (this.isLoadingCoco) {
      // Wait if already loading
      while (this.isLoadingCoco) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return this.cocoModel;
    }

    this.isLoadingCoco = true;

    try {
      // Check if TensorFlow.js is already in window
      if (!window.tf) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      }

      // Check if cocoSsd is already in window
      if (!window.cocoSsd) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
      }

      if (window.cocoSsd) {
        this.cocoModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        this.isCocoLoaded = true;
      }
    } catch (err) {
      console.warn('General object detector (COCO-SSD) could not be loaded via CDN:', err.message);
      // Fallback: system will still run local Canvas computer vision
    } finally {
      this.isLoadingCoco = false;
    }

    return this.cocoModel;
  }

  /**
   * Helper to load external scripts dynamically
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Run general object detection on the canvas frame
   */
  async detectGeneralObjects(canvas) {
    if (!canvas) return [];

    try {
      const model = await this.loadGeneralObjectDetector();
      if (model && typeof model.detect === 'function') {
        const predictions = await model.detect(canvas);
        // Filter out low confidence detections
        return predictions.filter((p) => p.score >= 0.45);
      }
    } catch (err) {
      console.warn('General object detection error:', err);
    }

    return [];
  }

  /**
   * Check if a custom seed-specific deep learning model is configured
   */
  isSeedModelConfigured() {
    return this.isCustomSeedModelLoaded;
  }

  /**
   * Pluggable loader for custom seed-specific trained models
   * Example: tf.loadLayersModel('/models/seed_model.json')
   */
  async loadCustomSeedModel(modelUrl = '/models/seed_model.json') {
    try {
      if (window.tf) {
        this.customSeedModel = await window.tf.loadLayersModel(modelUrl);
        this.isCustomSeedModelLoaded = true;
        return true;
      }
    } catch {
      // Model not found in public folder
      this.isCustomSeedModelLoaded = false;
      this.customSeedModel = null;
    }
    return false;
  }

  /**
   * Analyze canvas image for seed region, dimensions, morphology and optical features.
   * Uses direct HTML5 Canvas 2D image processing on the designated testing plate target zone.
   * 
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options { targetBoxFraction: 0.5 }
   */
  analyzeImage(canvas, options = {}) {
    if (!canvas) {
      return {
        detected: false,
        message: 'No image frame provided.',
        generalObjects: [],
        morphology: null,
        seedModelConfigured: this.isSeedModelConfigured()
      };
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Define central focal testing zone (e.g. 50% central window)
    const boxFrac = options.targetBoxFraction || 0.55;
    const boxW = Math.round(width * boxFrac);
    const boxH = Math.round(height * boxFrac);
    const startX = Math.round((width - boxW) / 2);
    const startY = Math.round((height - boxH) / 2);

    const imgData = ctx.getImageData(startX, startY, boxW, boxH);
    const data = imgData.data;

    // Calculate background baseline from edges of target zone
    let edgeR = 0, edgeG = 0, edgeB = 0, edgeCount = 0;
    const step = 4;
    for (let x = 0; x < boxW; x += step) {
      // top & bottom row
      for (const y of [0, boxH - 1]) {
        const idx = (y * boxW + x) * 4;
        edgeR += data[idx];
        edgeG += data[idx + 1];
        edgeB += data[idx + 2];
        edgeCount++;
      }
    }
    const bgAvg = (edgeR + edgeG + edgeB) / (edgeCount * 3 || 1);

    // Binarize and locate seed candidate foreground pixels
    // Using luminance delta against background
    let minX = boxW, maxX = 0, minY = boxH, maxY = 0;
    let foregroundPixelCount = 0;
    let sumR = 0, sumG = 0, sumB = 0;
    const thresholdDelta = 28; // noticeable contrast difference from sample stage

    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) {
        const idx = (y * boxW + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (Math.abs(lum - bgAvg) > thresholdDelta) {
          foregroundPixelCount++;
          sumR += r;
          sumG += g;
          sumB += b;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const totalBoxPixels = boxW * boxH;
    const coverageRatio = foregroundPixelCount / totalBoxPixels;

    // A seed placed in the target area must occupy a realistic pixel cluster
    // (not an empty plate <0.3% and not a huge hand or background item >65%)
    const hasSeedCandidate = foregroundPixelCount > 350 && coverageRatio > 0.004 && coverageRatio < 0.65;

    if (!hasSeedCandidate) {
      return {
        detected: false,
        message: 'No seed detected. Place a seed inside the camera testing area.',
        coverageRatio: parseFloat((coverageRatio * 100).toFixed(2)),
        generalObjects: [],
        morphology: null,
        targetZone: { startX, startY, boxW, boxH },
        seedModelConfigured: this.isSeedModelConfigured()
      };
    }

    // Candidate bounding box in canvas coordinates
    const seedW = Math.max(1, maxX - minX + 1);
    const seedH = Math.max(1, maxY - minY + 1);
    const seedArea = foregroundPixelCount;
    const aspectRatio = parseFloat((seedW / seedH).toFixed(2));
    
    // Approximate circularity (isoperimetric quotient)
    // 4 * PI * Area / Perimeter^2 where perimeter ~ 2*(w+h)
    const approxPerimeter = 2 * (seedW + seedH);
    const circularity = parseFloat(((4 * Math.PI * seedArea) / (approxPerimeter * approxPerimeter)).toFixed(2));

    // Seed mean color
    const meanR = Math.round(sumR / (foregroundPixelCount || 1));
    const meanG = Math.round(sumG / (foregroundPixelCount || 1));
    const meanB = Math.round(sumB / (foregroundPixelCount || 1));

    // Shape classification based on aspect ratio & circularity
    let shapeClass = 'Elliptical / Ovoid';
    if (aspectRatio > 0.85 && aspectRatio < 1.18 && circularity > 0.65) {
      shapeClass = 'Round / Spherical';
    } else if (aspectRatio > 1.85 || aspectRatio < 0.54) {
      shapeClass = 'Elongated / Oblong';
    } else if (circularity < 0.35) {
      shapeClass = 'Irregular / Angular';
    }

    // Check positioning confidence
    const isWellCentered =
      minX > 10 && maxX < boxW - 10 && minY > 10 && maxY < boxH - 10;

    const confidenceScore = isWellCentered ? 0.88 : 0.42;

    const morphology = {
      detected: true,
      boundingBox: {
        x: startX + minX,
        y: startY + minY,
        width: seedW,
        height: seedH
      },
      dimensions: {
        widthPx: seedW,
        heightPx: seedH,
        areaPx: seedArea,
        aspectRatio: aspectRatio,
        circularity: circularity
      },
      shapeCharacteristics: shapeClass,
      visualMeanColor: { r: meanR, g: meanG, b: meanB },
      surfaceUniformity: circularity > 0.5 ? 'Uniform' : 'Surface Variations Detected',
      confidence: confidenceScore,
      isWellCentered
    };

    let detectionStatusMessage = 'Seed detected within inspection area.';
    if (!isWellCentered || confidenceScore < 0.5) {
      detectionStatusMessage = 'Detection uncertain — reposition the seed and try again.';
    }

    return {
      detected: true,
      message: detectionStatusMessage,
      coverageRatio: parseFloat((coverageRatio * 100).toFixed(2)),
      morphology,
      targetZone: { startX, startY, boxW, boxH },
      seedModelConfigured: this.isSeedModelConfigured()
    };
  }

  /**
   * Draw visual bounding reticle and seed contour highlight on a target canvas
   */
  drawOverlay(canvas, analysisResult, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    const targetZone = analysisResult?.targetZone || {
      startX: Math.round(width * 0.22),
      startY: Math.round(height * 0.22),
      boxW: Math.round(width * 0.56),
      boxH: Math.round(height * 0.56)
    };

    // Draw central inspection target boundary
    ctx.save();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(targetZone.startX, targetZone.startY, targetZone.boxW, targetZone.boxH);

    // Reticle corner brackets
    const bracketLen = 22;
    ctx.setLineDash([]);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(targetZone.startX, targetZone.startY + bracketLen);
    ctx.lineTo(targetZone.startX, targetZone.startY);
    ctx.lineTo(targetZone.startX + bracketLen, targetZone.startY);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(targetZone.startX + targetZone.boxW - bracketLen, targetZone.startY);
    ctx.lineTo(targetZone.startX + targetZone.boxW, targetZone.startY);
    ctx.lineTo(targetZone.startX + targetZone.boxW, targetZone.startY + bracketLen);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(targetZone.startX, targetZone.startY + targetZone.boxH - bracketLen);
    ctx.lineTo(targetZone.startX, targetZone.startY + targetZone.boxH);
    ctx.lineTo(targetZone.startX + bracketLen, targetZone.startY + targetZone.boxH);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(targetZone.startX + targetZone.boxW - bracketLen, targetZone.startY + targetZone.boxH);
    ctx.lineTo(targetZone.startX + targetZone.boxW, targetZone.startY + targetZone.boxH);
    ctx.lineTo(targetZone.startX + targetZone.boxW, targetZone.startY + targetZone.boxH - bracketLen);
    ctx.stroke();

    // Center focal crosshair
    const cx = targetZone.startX + targetZone.boxW / 2;
    const cy = targetZone.startY + targetZone.boxH / 2;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy + 12);
    ctx.stroke();

    // Draw detected seed bounding box if available
    if (analysisResult?.morphology?.boundingBox) {
      const b = analysisResult.morphology.boundingBox;
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.width, b.height);

      // Semi-transparent highlight
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fillRect(b.x, b.y, b.width, b.height);

      // Label tag
      const label = `SEED (${b.width}×${b.height}px)`;
      ctx.font = '600 11px JetBrains Mono, monospace';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = '#059669';
      ctx.fillRect(b.x, Math.max(0, b.y - 18), textWidth + 10, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, b.x + 5, Math.max(13, b.y - 5));
    }

    // Draw general objects if detected
    if (analysisResult?.generalObjects?.length) {
      for (const obj of analysisResult.generalObjects) {
        const [gx, gy, gw, gh] = obj.bbox;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gx, gy, gw, gh);

        const gLabel = `${obj.class} ${(obj.score * 100).toFixed(0)}%`;
        ctx.font = '500 10px JetBrains Mono, monospace';
        const gTextW = ctx.measureText(gLabel).width;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.fillRect(gx, Math.max(0, gy - 16), gTextW + 8, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(gLabel, gx + 4, Math.max(12, gy - 4));
      }
    }

    ctx.restore();
  }
}

export const seedAnalysisService = new SeedAnalysisService();
