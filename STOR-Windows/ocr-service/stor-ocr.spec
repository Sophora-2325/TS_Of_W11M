from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules, copy_metadata

root = Path(SPECPATH)
package = root / '.venv' / 'Lib' / 'site-packages' / 'rapidocr'

def cpu_modules(name):
    if '.inference_engine.' in name:
        return any(name.startswith('rapidocr.inference_engine.' + backend)
                   for backend in ('onnxruntime', 'base'))
    return True

a = Analysis(
    [str(root / 'worker.py')],
    pathex=[str(root)],
    binaries=[],
    datas=[(str(package / 'config.yaml'), 'rapidocr'),
           (str(package / 'default_models.yaml'), 'rapidocr')] + copy_metadata('rapidocr'),
    hiddenimports=collect_submodules('rapidocr', filter=cpu_modules),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['torch', 'paddle', 'matplotlib', 'tkinter', 'PIL._avif', 'PIL.AvifImagePlugin'],
    noarchive=False,
)
# PNG screenshot OCR never opens video streams. Keep OpenCV's image pipeline.
a.binaries = [entry for entry in a.binaries if 'opencv_videoio_ffmpeg' not in entry[0].lower()]
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='stor-ocr',
          debug=False, strip=False, upx=False, console=True)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='stor-ocr')
