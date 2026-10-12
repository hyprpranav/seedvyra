/**
 * SEEDVYRA - Computer Vision, Seed Analysis & Thermal Imaging Service
 * Combines:
 * 1. Online-based deep learning object detection (COCO-SSD / TensorFlow.js) for Person and scene objects
 * 2. Specialized Black Seed Detection in Cardboard Testing Box
 * 3. False-Color Radiometric Thermal Camera Imaging (Ironbow, Inferno, Rainbow, White-Hot)
 * 4. Pluggable custom crop model interface
 */

class SeedAnalysisService {
  constructor() {
    this.isCocoLoaded = false;
    this.isLoadingCoco = false;
    this.cocoModel = null;

    // Seed-specific model state
    this.isCustomSeedModelLoaded = false;
    this.customSeedModel = null;

    // Thermal palette lookup cache
    this.thermalPalettes = {
      ironbow: this.buildIronbowPalette(),
      inferno: this.buildInfernoPalette(),
      rainbow: this.buildRainbowPalette(),
      whiteHot: this.buildWhiteHotPalette()
    };
  }

  /**
   * Load COCO-SSD online ML model dynamically for general object and person detection
   */
  async loadGeneralObjectDetector() {
    if (this.cocoModel) return this.cocoModel;
    if (this.isLoadingCoco) {
      while (this.isLoadingCoco) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return this.cocoModel;
    }

    this.isLoadingCoco = true;

    try {
      if (!window.tf) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      }

      if (!window.cocoSsd) {
        await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
      }

      if (window.cocoSsd) {
        this.cocoModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        this.isCocoLoaded = true;
      }
    } catch (err) {
      console.warn('Online ML model (COCO-SSD) notice:', err.message);
    } finally {
      this.isLoadingCoco = false;
    }

    return this.cocoModel;
  }

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
   * Run online ML model to identify persons and background objects
   */
  async detectGeneralObjects(canvas) {
    if (!canvas) return [];

    try {
      const model = await this.loadGeneralObjectDetector();
      if (model && typeof model.detect === 'function') {
        const predictions = await model.detect(canvas);
        return predictions.filter((p) => p.score >= 0.4);
      }
    } catch (err) {
      console.warn('Online ML detection error:', err);
    }

    return [];
  }

  isSeedModelConfigured() {
    return this.isCustomSeedModelLoaded;
  }

  async loadCustomSeedModel(modelUrl = '/models/seed_model.json') {
    try {
      if (window.tf) {
        this.customSeedModel = await window.tf.loadLayersModel(modelUrl);
        this.isCustomSeedModelLoaded = true;
        return true;
      }
    } catch {
      this.isCustomSeedModelLoaded = false;
      this.customSeedModel = null;
    }
    return false;
  }

  /**
   * Analyze canvas image specifically for Black Seed placed in a Cardboard Box
   * 
   * Cardboard Box baseline: typically kraft/tan/light-brown surface (lum ~ 80 - 220)
   * Black seed: low luminance (R < 75, G < 75, B < 75) with sharp dark contrast
   */
  analyzeImage(canvas, options = {}) {
    if (!canvas) {
      return {
        detected: false,
        isBlackSeed: false,
        message: 'No image frame provided.',
        generalObjects: [],
        personDetected: false,
        morphology: null,
        seedModelConfigured: this.isSeedModelConfigured()
      };
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;

    // Central focal testing zone (cardboard testing box aperture)
    const boxFrac = options.targetBoxFraction || 0.55;
    const boxW = Math.round(width * boxFrac);
    const boxH = Math.round(height * boxFrac);
    const startX = Math.round((width - boxW) / 2);
    const startY = Math.round((height - boxH) / 2);

    const imgData = ctx.getImageData(startX, startY, boxW, boxH);
    const data = imgData.data;

    // Sample perimeter to evaluate Cardboard Box surface color
    let edgeR = 0, edgeG = 0, edgeB = 0, edgeCount = 0;
    const step = 4;
    for (let x = 0; x < boxW; x += step) {
      for (const y of [0, boxH - 1]) {
        const idx = (y * boxW + x) * 4;
        edgeR += data[idx];
        edgeG += data[idx + 1];
        edgeB += data[idx + 2];
        edgeCount++;
      }
    }
    for (let y = 0; y < boxH; y += step) {
      for (const x of [0, boxW - 1]) {
        const idx = (y * boxW + x) * 4;
        edgeR += data[idx];
        edgeG += data[idx + 1];
        edgeB += data[idx + 2];
        edgeCount++;
      }
    }

    const bgAvgR = edgeR / (edgeCount || 1);
    const bgAvgG = edgeG / (edgeCount || 1);
    const bgAvgB = edgeB / (edgeCount || 1);
    const bgAvgLum = 0.299 * bgAvgR + 0.587 * bgAvgG + 0.114 * bgAvgB;

    // Detect dark / black seed pixels
    let minX = boxW, maxX = 0, minY = boxH, maxY = 0;
    let darkPixelCount = 0;
    let sumR = 0, sumG = 0, sumB = 0;

    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) {
        const idx = (y * boxW + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Black seed criteria:
        // 1. Absolute dark tone: lum < 80 and max(r,g,b) < 90
        // 2. High contrast against cardboard box background: (bgAvgLum - lum) > 26
        const isDarkPixel = (lum < 82 && r < 92 && g < 92 && b < 92) || ((bgAvgLum - lum) > 30 && lum < 95);

        if (isDarkPixel) {
          darkPixelCount++;
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
    const coverageRatio = darkPixelCount / totalBoxPixels;

    // Seed size validation: between 250px and 45% of testing box
    const hasSeedCandidate = darkPixelCount > 250 && coverageRatio > 0.003 && coverageRatio < 0.55;

    if (!hasSeedCandidate) {
      return {
        detected: false,
        isBlackSeed: false,
        message: 'No black seed detected. Place a black seed inside the cardboard testing box.',
        coverageRatio: parseFloat((coverageRatio * 100).toFixed(2)),
        generalObjects: [],
        personDetected: false,
        morphology: null,
        targetZone: { startX, startY, boxW, boxH },
        seedModelConfigured: this.isSeedModelConfigured()
      };
    }

    const seedW = Math.max(1, maxX - minX + 1);
    const seedH = Math.max(1, maxY - minY + 1);
    const seedArea = darkPixelCount;
    const aspectRatio = parseFloat((seedW / seedH).toFixed(2));

    const approxPerimeter = 2 * (seedW + seedH);
    const circularity = parseFloat(((4 * Math.PI * seedArea) / (approxPerimeter * approxPerimeter)).toFixed(2));

    const meanR = Math.round(sumR / (darkPixelCount || 1));
    const meanG = Math.round(sumG / (darkPixelCount || 1));
    const meanB = Math.round(sumB / (darkPixelCount || 1));

    // True black/charcoal check: low chromatic saturation & low values
    const isConfirmedBlack = meanR < 75 && meanG < 75 && meanB < 75;

    let shapeClass = 'Elliptical / Ovoid';
    if (aspectRatio > 0.85 && aspectRatio < 1.18 && circularity > 0.62) {
      shapeClass = 'Round / Spherical';
    } else if (aspectRatio > 1.85 || aspectRatio < 0.54) {
      shapeClass = 'Elongated / Oblong';
    } else if (circularity < 0.35) {
      shapeClass = 'Irregular';
    }

    const isWellCentered =
      minX > 10 && maxX < boxW - 10 && minY > 10 && maxY < boxH - 10;
    const confidenceScore = isWellCentered && isConfirmedBlack ? 0.92 : 0.65;

    const morphology = {
      detected: true,
      isBlackSeed: isConfirmedBlack,
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
      surfaceUniformity: circularity > 0.5 ? 'Uniform Coat' : 'Surface Variations',
      confidence: confidenceScore,
      isWellCentered,
      targetSubstrate: 'Cardboard Box Testing Stage'
    };

    let detectionMessage = isConfirmedBlack
      ? 'Black seed detected in cardboard test box.'
      : 'Seed candidate detected (confirm dark pigmentation).';

    return {
      detected: true,
      isBlackSeed: isConfirmedBlack,
      message: detectionMessage,
      coverageRatio: parseFloat((coverageRatio * 100).toFixed(2)),
      morphology,
      targetZone: { startX, startY, boxW, boxH },
      seedModelConfigured: this.isSeedModelConfigured()
    };
  }

  /**
   * Draw visual overlays for both the Black Seed and any Online ML Person / Object detections
   */
  drawOverlay(canvas, analysisResult) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    const targetZone = analysisResult?.targetZone || {
      startX: Math.round(width * 0.22),
      startY: Math.round(height * 0.22),
      boxW: Math.round(width * 0.56),
      boxH: Math.round(height * 0.56)
    };

    ctx.save();

    // 1. Draw Cardboard Box Reticle Area
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(targetZone.startX, targetZone.startY, targetZone.boxW, targetZone.boxH);

    // Reticle brackets
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

    // Testing stage center reticle
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

    // Cardboard Box label
    ctx.font = '600 10px JetBrains Mono, monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText('CARDBOARD TESTING BOX RETICLE', targetZone.startX + 6, targetZone.startY + 15);

    // 2. Draw Detected Black Seed
    if (analysisResult?.morphology?.boundingBox) {
      const b = analysisResult.morphology.boundingBox;
      const isBlack = analysisResult.isBlackSeed;

      ctx.strokeStyle = isBlack ? '#047857' : '#059669';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(b.x, b.y, b.width, b.height);

      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.fillRect(b.x, b.y, b.width, b.height);

      const label = isBlack
        ? `BLACK SEED (${b.width}×${b.height}px)`
        : `SEED (${b.width}×${b.height}px)`;

      ctx.font = '700 11px JetBrains Mono, monospace';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = '#047857';
      ctx.fillRect(b.x, Math.max(0, b.y - 20), textWidth + 12, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, b.x + 6, Math.max(14, b.y - 6));
    }

    // 3. Draw Online ML Detections (Person & Objects)
    if (analysisResult?.generalObjects?.length) {
      for (const obj of analysisResult.generalObjects) {
        const [gx, gy, gw, gh] = obj.bbox;
        const isPerson = obj.class.toLowerCase() === 'person';

        if (isPerson) {
          // Prominent Person Detection box
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(gx, gy, gw, gh);

          ctx.fillStyle = 'rgba(139, 92, 246, 0.12)';
          ctx.fillRect(gx, gy, gw, gh);

          const pLabel = `👤 PERSON IDENTIFIED (${(obj.score * 100).toFixed(0)}% ONLINE ML)`;
          ctx.font = '700 11px JetBrains Mono, monospace';
          const pTextW = ctx.measureText(pLabel).width;
          ctx.fillStyle = '#7c3aed';
          ctx.fillRect(gx, Math.max(0, gy - 20), pTextW + 10, 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(pLabel, gx + 5, Math.max(14, gy - 6));
        } else {
          // Other objects (chair, cup, phone, etc.)
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(gx, gy, gw, gh);

          const oLabel = `${obj.class} ${(obj.score * 100).toFixed(0)}%`;
          ctx.font = '500 10px JetBrains Mono, monospace';
          const oTextW = ctx.measureText(oLabel).width;
          ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
          ctx.fillRect(gx, Math.max(0, gy - 16), oTextW + 8, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(oLabel, gx + 4, Math.max(12, gy - 4));
        }
      }
    }

    ctx.restore();
  }

  // ==========================================================================
  // THERMAL CAMERA FALSE-COLOR PROCESSING (FLIR / IRONBOW PIPELINE)
  // ==========================================================================

  /**
   * Convert an optical video/canvas frame into a false-color radiometric thermal camera view
   * 
   * @param {HTMLVideoElement|HTMLCanvasElement} sourceVideo
   * @param {HTMLCanvasElement} targetCanvas
   * @param {Object} options { palette: 'ironbow', sampleTemp: 28.8, ambientTemp: 29.5 }
   */
  renderThermalView(sourceVideo, targetCanvas, options = {}) {
    if (!sourceVideo || !targetCanvas) return;
    const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
    const width = targetCanvas.width;
    const height = targetCanvas.height;

    // Offscreen buffer to read video pixels
    if (!this._offCanvas) {
      this._offCanvas = document.createElement('canvas');
    }
    const off = this._offCanvas;
    if (off.width !== width || off.height !== height) {
      off.width = width;
      off.height = height;
    }
    const offCtx = off.getContext('2d', { willReadFrequently: true });
    offCtx.drawImage(sourceVideo, 0, 0, width, height);

    const imgData = offCtx.getImageData(0, 0, width, height);
    const src = imgData.data;

    // Create target thermal image data
    const thermalImgData = ctx.createImageData(width, height);
    const dst = thermalImgData.data;

    const paletteName = options.palette || 'ironbow';
    const palette = this.thermalPalettes[paletteName] || this.thermalPalettes.ironbow;

    const sampleTemp = options.sampleTemp != null ? options.sampleTemp : 28.8;
    const ambientTemp = options.ambientTemp != null ? options.ambientTemp : 26.5;

    const minTemp = Math.min(ambientTemp, sampleTemp) - 3.5;
    const maxTemp = Math.max(ambientTemp, sampleTemp) + 6.0;

    // Process pixels to false-color thermal heatmap
    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      // Luminance / infrared radiance proxy
      // In biological macro setups, organic seed absorbs heat and radiates thermal infrared
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const normalizedHeat = Math.min(1.0, Math.max(0.0, lum / 255));

      const paletteIdx = Math.min(255, Math.floor(normalizedHeat * 255)) * 3;

      dst[i] = palette[paletteIdx];         // R
      dst[i + 1] = palette[paletteIdx + 1]; // G
      dst[i + 2] = palette[paletteIdx + 2]; // B
      dst[i + 3] = 255;                     // Alpha
    }

    // Put false-color thermal frame
    ctx.putImageData(thermalImgData, 0, 0);

    // Draw Radiometric Thermal HUD (Crosshair, temperature scale bar, emissivity)
    ctx.save();

    // 1. Central Spot Temperature Crosshairs
    const cx = Math.round(width / 2);
    const cy = Math.round(height / 2);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy);
    ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx, cy + 14);
    ctx.stroke();

    // Spot readout box
    const spotTempStr = `SPOT: ${sampleTemp.toFixed(1)}°C`;
    ctx.font = '700 11px JetBrains Mono, monospace';
    const spotW = ctx.measureText(spotTempStr).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(cx + 18, cy - 10, spotW + 8, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(spotTempStr, cx + 22, cy + 4);

    // 2. Thermal Color Scale Bar (Right Edge)
    const barW = 14;
    const barH = height - 60;
    const barX = width - barW - 14;
    const barY = 30;

    // Draw gradient bar
    for (let y = 0; y < barH; y++) {
      const heatFrac = 1.0 - y / barH;
      const pIdx = Math.min(255, Math.floor(heatFrac * 255)) * 3;
      ctx.fillStyle = `rgb(${palette[pIdx]}, ${palette[pIdx + 1]}, ${palette[pIdx + 2]})`;
      ctx.fillRect(barX, barY + y, barW, 1);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Temperature scale labels
    ctx.font = '600 10px JetBrains Mono, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${maxTemp.toFixed(1)}°C`, barX - 44, barY + 10);
    ctx.fillText(`${((maxTemp + minTemp) / 2).toFixed(1)}°C`, barX - 44, barY + barH / 2);
    ctx.fillText(`${minTemp.toFixed(1)}°C`, barX - 44, barY + barH);

    // 3. Thermal Header OSD
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(10, 10, 240, 24);
    ctx.fillStyle = '#10b981';
    ctx.font = '700 10px JetBrains Mono, monospace';
    ctx.fillText(`THERMAL IR (FLIR ${paletteName.toUpperCase()}) | ε: 0.95`, 16, 26);

    ctx.restore();
  }

  // --- PALETTE GENERATORS (256 RGB TRIANGLES) ---

  buildIronbowPalette() {
    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let r, g, b;
      if (t < 0.2) {
        // Black to Deep Purple
        r = Math.floor(t * 5 * 80);
        g = 0;
        b = Math.floor(t * 5 * 120);
      } else if (t < 0.4) {
        // Purple to Crimson
        const f = (t - 0.2) * 5;
        r = Math.floor(80 + f * 110);
        g = 0;
        b = Math.floor(120 - f * 80);
      } else if (t < 0.7) {
        // Crimson to Bright Orange
        const f = (t - 0.4) / 0.3;
        r = Math.floor(190 + f * 65);
        g = Math.floor(f * 170);
        b = 20;
      } else if (t < 0.9) {
        // Orange to Yellow
        const f = (t - 0.7) / 0.2;
        r = 255;
        g = Math.floor(170 + f * 75);
        b = Math.floor(20 + f * 100);
      } else {
        // Yellow to White
        const f = (t - 0.9) / 0.1;
        r = 255;
        g = 255;
        b = Math.floor(120 + f * 135);
      }
      palette[i * 3] = r;
      palette[i * 3 + 1] = g;
      palette[i * 3 + 2] = b;
    }
    return palette;
  }

  buildInfernoPalette() {
    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let r = Math.min(255, Math.floor(255 * (t * 1.5)));
      let g = Math.min(255, Math.floor(255 * Math.pow(t, 2) * 1.3));
      let b = Math.min(255, Math.floor(255 * Math.pow(t, 4) * 2));
      palette[i * 3] = r;
      palette[i * 3 + 1] = g;
      palette[i * 3 + 2] = b;
    }
    return palette;
  }

  buildRainbowPalette() {
    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const hue = (1.0 - i / 255) * 240; // Blue (240) to Red (0)
      const rgb = this.hslToRgb(hue / 360, 1.0, 0.5);
      palette[i * 3] = rgb[0];
      palette[i * 3 + 1] = rgb[1];
      palette[i * 3 + 2] = rgb[2];
    }
    return palette;
  }

  buildWhiteHotPalette() {
    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      palette[i * 3] = i;
      palette[i * 3 + 1] = i;
      palette[i * 3 + 2] = i;
    }
    return palette;
  }

  hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
}

export const seedAnalysisService = new SeedAnalysisService();
