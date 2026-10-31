# STOR OCR third-party notices

The recognition helper uses CPU ONNX Runtime and RapidOCR's image processing pipeline.

- PP-OCRv6 small detection and recognition models: PaddlePaddle / PaddleOCR authors, Apache-2.0.
  Official model repositories, fixed revisions and SHA-256 digests are recorded in `models/manifest.json`.
  Original model cards are included as `models/det-README.md` and `models/rec-README.md`.
  https://github.com/PaddlePaddle/PaddleOCR
- RapidOCR: RapidAI contributors, Apache-2.0. https://github.com/RapidAI/RapidOCR
- ONNX Runtime: Microsoft contributors, MIT. https://github.com/microsoft/onnxruntime
- Python and dependency license files are collected under `licenses/` during packaging.

Models run locally. There is no OCR HTTP server, automatic model download, telemetry,
or screenshot/text logging in the STOR worker. Translation remains a separate user-triggered API action.
