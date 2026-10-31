import base64
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import cv2
import numpy as np

import worker


def encoded_image(image):
    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return base64.b64encode(encoded).decode("ascii")


class ProtocolTests(unittest.TestCase):
    def run_requests(self, packets, recognize):
        source = io.BytesIO(b"".join(packet + b"\n" for packet in packets))
        output = io.StringIO()
        with patch.object(worker, "recognize", side_effect=recognize):
            worker.serve(object(), source, output)
        return [json.loads(line) for line in output.getvalue().splitlines()]

    def test_bad_request_does_not_poison_next_capture(self):
        responses = self.run_requests([b"not-json", b'{"id":2,"png":"png"}'], ["hello"])
        self.assertEqual(responses[0]["code"], "invalid_request")
        self.assertEqual(responses[1]["id"], 2)
        self.assertEqual(responses[1]["text"], "hello")

    def test_content_and_tracebacks_are_not_exposed_on_inference_failure(self):
        responses = self.run_requests([b'{"id":1,"png":"private"}'], RuntimeError("private screenshot text"))
        self.assertEqual(responses[0]["code"], "inference_failed")
        self.assertNotIn("private", json.dumps(responses))

    def test_empty_result_has_specific_recoverable_error(self):
        responses = self.run_requests([b'{"id":1}'], worker.RequestError("no_text", "empty"))
        self.assertEqual(responses[0]["code"], "no_text")

    def test_library_stdout_cannot_corrupt_protocol(self):
        def noisy(*_):
            print("library diagnostic")
            return "你好"
        with patch.object(worker.sys, "stderr", io.StringIO()) as diagnostics:
            responses = self.run_requests([b'{"id":1}'], noisy)
        self.assertIn("library diagnostic", diagnostics.getvalue())
        self.assertEqual(responses[0]["text"], "你好")

    def test_library_value_error_is_an_inference_failure(self):
        responses = self.run_requests([b'{"id":1}'], ValueError("tensor error"))
        self.assertEqual(responses[0]["code"], "inference_failed")

    def test_image_is_not_forced_to_gray_or_upscaled(self):
        image = np.full((8, 12, 3), [220, 90, 15], dtype=np.uint8)
        decoded = worker.decode_image(encoded_image(image))
        np.testing.assert_array_equal(decoded, image)

    def test_rejects_invalid_image_and_dimensions_before_decoding(self):
        for encoded in [None, "***", base64.b64encode(b"not PNG").decode("ascii")]:
            with self.assertRaises(worker.RequestError):
                worker.decode_image(encoded)
        header = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + (100_000).to_bytes(4, "big") * 2
        with patch.object(cv2, "imdecode") as decoder:
            with self.assertRaises(worker.RequestError):
                worker.decode_image(base64.b64encode(header).decode("ascii"))
            decoder.assert_not_called()

    def test_model_corruption_fails_before_session_creation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / "manifest.json").write_text(json.dumps({"name": worker.MODEL, "models": [
                {"role": "det", "sha256": "invalid"}, {"role": "rec", "sha256": "invalid"}
            ]}), encoding="utf-8")
            (path / "det.onnx").write_bytes(b"damaged")
            with self.assertRaisesRegex(RuntimeError, "checksum"):
                worker.verify_models(path)


if __name__ == "__main__":
    unittest.main()
