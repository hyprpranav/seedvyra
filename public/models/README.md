# SEEDVYRA Model Asset Directory

This directory hosts custom pre-trained and fine-tuned machine learning models for the SEEDVYRA Smart Seed Viability Analysis System.

## Architecture & Integration Points

The system uses a tiered computer vision & detection pipeline:

1. **General Object Detection (Baseline)**
   - Utilizes standard browser-compatible object detection (e.g., COCO-SSD) to identify common objects (person, mobile phone, container, desk items) in the field of view.
   - Prevents arbitrary background items from falsely triggering seed testing.

2. **Morphological Seed Feature Extractor (Local Canvas CV)**
   - Always functional without external dependencies.
   - Uses adaptive thresholding and contour bounding on the test plate region.
   - Measures:
     - Area (pixels)
     - Estimated dimensions (width x height in px)
     - Aspect ratio & roundness/circularity
     - Surface uniformity & color distribution (mean R, G, B in seed region)

3. **Crop-Specific Seed Viability Model (Pluggable)**
   - To integrate a custom TensorFlow.js / ONNX model:
     - Place your model architecture and weight shards here:
       - `model.json`
       - `group1-shard1of1.bin`
     - Update `src/services/seedAnalysis.js` to enable the model endpoint.
   - **Current State**: Seed-specific deep learning weights are **not configured by default**.
   - When not configured, the UI explicitly and truthfully displays:
     > `"Seed-specific model not configured."`
   - No scientifically unvalidated formulas or fake predictions are fabricated.
