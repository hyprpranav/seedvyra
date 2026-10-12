/**
 * SEEDVYRA - Calculations & Viability Evaluation Service
 * Enforces scientific rigor and transparent distinction between:
 * - Seed detection
 * - Visible seed condition
 * - Environmental & optical sensor measurements
 * - Predicted viability (requires calibrated crop-specific model)
 * - Confirmed germination
 */

export class CalculationService {
  /**
   * Evaluate the integrity and validity of incoming test data
   * @param {Object} params
   * @param {Object} params.sensorData - Latest ESP32 telemetry
   * @param {Object} params.imageAnalysis - Latest CV analysis output
   * @param {boolean} params.isDeviceConnected - Whether ESP32 is currently connected
   */
  validateTestData({ sensorData, imageAnalysis, isDeviceConnected }) {
    const issues = [];
    const missingSensors = [];

    // 1. Connection check
    if (!isDeviceConnected) {
      issues.push('ESP32 hardware is disconnected. Real-time telemetry is required for calibrated testing.');
    }

    // 2. Seed detection check
    if (!imageAnalysis || !imageAnalysis.detected) {
      issues.push('No seed detected. Place a seed inside the camera testing area.');
    }

    // 3. Sensor data availability check
    if (!sensorData) {
      missingSensors.push('DHT11 Environmental Temp & Humidity', 'DS18B20 Sample Temp', 'TCS34725 RGB Sensor');
    } else {
      if (sensorData.ambientTemp === null || sensorData.ambientTemp === undefined) {
        missingSensors.push('DHT11 Ambient Temperature');
      }
      if (sensorData.humidity === null || sensorData.humidity === undefined) {
        missingSensors.push('DHT11 Humidity');
      }
      if (sensorData.sampleTemp === null || sensorData.sampleTemp === undefined) {
        missingSensors.push('DS18B20 Sample Temperature');
      }
      if (sensorData.red === null || sensorData.clear === null) {
        missingSensors.push('TCS34725 RGB & Clear Photodiode');
      }

      // Freshness check: readings should have arrived within 25 seconds
      const dataAgeMs = Date.now() - (sensorData.timestamp || 0);
      if (dataAgeMs > 25000) {
        issues.push(`Sensor telemetry is stale (last update ${Math.round(dataAgeMs / 1000)}s ago).`);
      }
    }

    return {
      isValid: issues.length === 0 && missingSensors.length === 0,
      issues,
      missingSensors
    };
  }

  /**
   * Run analytical synthesis for the current seed test run
   * 
   * @param {Object} params
   * @param {Object} params.sensorData
   * @param {Object} params.imageAnalysis
   * @param {boolean} params.hasValidatedModel - Whether a validated prediction model is loaded
   * @param {Function} [params.customModelPredictor] - Optional calibrated model evaluation function
   */
  processTestRun({ sensorData, imageAnalysis, hasValidatedModel = false, customModelPredictor = null }) {
    // If no seed was detected, do not calculate viability
    if (!imageAnalysis || !imageAnalysis.detected) {
      return {
        success: false,
        status: 'NO_SEED',
        summary: 'No seed detected. Place a seed inside the camera testing area.',
        observations: [],
        viabilityPrediction: null
      };
    }

    const morphology = imageAnalysis.morphology || {};
    const dims = morphology.dimensions || {};
    const color = morphology.visualMeanColor || {};

    // 1. Visible Seed Condition Observations (purely empirical, non-fabricating)
    const observations = [];
    
    if (dims.widthPx && dims.heightPx) {
      observations.push({
        label: 'Optical Dimensions',
        value: `${dims.widthPx} × ${dims.heightPx} px (Area: ${dims.areaPx} px²)`
      });
    }

    if (morphology.shapeCharacteristics) {
      observations.push({
        label: 'Morphological Profile',
        value: morphology.shapeCharacteristics
      });
    }

    if (dims.circularity) {
      observations.push({
        label: 'Circularity Index',
        value: `${dims.circularity} (Roundness factor)`
      });
    }

    if (morphology.surfaceUniformity) {
      observations.push({
        label: 'Surface Uniformity',
        value: morphology.surfaceUniformity
      });
    }

    // 2. Optical Spectral Balance
    let opticalSummary = 'N/A';
    if (sensorData && sensorData.clear > 0) {
      const rRatio = ((sensorData.red / sensorData.clear) * 100).toFixed(1);
      const gRatio = ((sensorData.green / sensorData.clear) * 100).toFixed(1);
      const bRatio = ((sensorData.blue / sensorData.clear) * 100).toFixed(1);
      opticalSummary = `R: ${rRatio}% | G: ${gRatio}% | B: ${bRatio}% (Clear: ${sensorData.clear})`;
    }

    // 3. Thermal Delta
    let thermalDelta = null;
    if (sensorData && sensorData.sampleTemp != null && sensorData.ambientTemp != null) {
      thermalDelta = parseFloat((sensorData.sampleTemp - sensorData.ambientTemp).toFixed(2));
    }

    // 4. Viability Prediction Logic
    // IMPORTANT: Scientifically honest! We strictly do NOT invent a formula or fake viability.
    let viabilityPrediction = {
      isAvailable: false,
      classification: 'INCONCLUSIVE',
      message: 'Viability prediction unavailable — model validation required.',
      confidence: null,
      disclaimer:
        'Preliminary observations and sensor telemetry reflect physical characteristics only. Validated crop-specific germination models are required for predictive classification.'
    };

    if (hasValidatedModel && typeof customModelPredictor === 'function') {
      try {
        const modelOutput = customModelPredictor({
          sensorData,
          morphology,
          opticalSummary,
          thermalDelta
        });
        viabilityPrediction = {
          isAvailable: true,
          classification: modelOutput.classification || 'INCONCLUSIVE', // 'VIABLE' | 'NON-VIABLE' | 'INCONCLUSIVE'
          message: modelOutput.message || 'Model prediction completed.',
          confidence: modelOutput.confidence || null,
          disclaimer:
            'Estimated prediction based on calibrated machine learning model. Does not guarantee 100% field emergence.'
        };
      } catch (err) {
        viabilityPrediction = {
          isAvailable: false,
          classification: 'ERROR',
          message: `Model inference error: ${err.message}`,
          confidence: null,
          disclaimer: 'Validation model encountered an execution exception.'
        };
      }
    }

    return {
      success: true,
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
      summary: 'Physical measurements and optical telemetry collected successfully.',
      opticalSummary,
      thermalDelta,
      observations,
      morphology,
      sensorSnapshot: sensorData ? { ...sensorData } : null,
      viabilityPrediction
    };
  }

  /**
   * Calculate batch viability statistics from test history
   * @param {Array} historyList - List of completed test runs
   */
  calculateBatchMetrics(historyList = []) {
    const totalTested = historyList.length;
    if (totalTested === 0) {
      return {
        totalTested: 0,
        viableCount: 0,
        nonViableCount: 0,
        inconclusiveCount: 0,
        estimatedViabilityPercentage: null,
        label: 'No tests recorded in current session'
      };
    }

    let viableCount = 0;
    let nonViableCount = 0;
    let inconclusiveCount = 0;

    for (const test of historyList) {
      const cls = test?.viabilityPrediction?.classification;
      if (cls === 'VIABLE') viableCount++;
      else if (cls === 'NON-VIABLE') nonViableCount++;
      else inconclusiveCount++;
    }

    // Only compute percentage if a validated model was active and classified samples
    const hasClassifiedSeeds = viableCount + nonViableCount > 0;
    const estPercentage = hasClassifiedSeeds
      ? parseFloat(((viableCount / totalTested) * 100).toFixed(1))
      : null;

    return {
      totalTested,
      viableCount,
      nonViableCount,
      inconclusiveCount,
      estimatedViabilityPercentage: estPercentage,
      note: 'Estimate based strictly on tested sample size. Field germination may vary due to soil and environmental factors.'
    };
  }
}

export const calculationService = new CalculationService();
