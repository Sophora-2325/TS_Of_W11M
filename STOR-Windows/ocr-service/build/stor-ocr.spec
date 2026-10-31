# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules
from PyInstaller.utils.hooks import copy_metadata

datas = [('D:\\STOR\\ocr-service\\.venv\\Lib\\site-packages\\rapidocr\\config.yaml', 'rapidocr'), ('D:\\STOR\\ocr-service\\.venv\\Lib\\site-packages\\rapidocr\\default_models.yaml', 'rapidocr')]
hiddenimports = []
datas += copy_metadata('rapidocr')
hiddenimports += collect_submodules('rapidocr')


a = Analysis(
    ['D:\\STOR\\ocr-service\\worker.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['torch', 'paddle', 'matplotlib', 'tkinter'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='stor-ocr',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='stor-ocr',
)
