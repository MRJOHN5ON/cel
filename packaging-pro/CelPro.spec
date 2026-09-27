# PyInstaller spec for Cel Pro.app — bundles Python, so users need nothing installed.
# Built by scripts/build_release.sh; expects frontend-pro/dist and packaging/models_cache.

import os
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

ROOT = Path(SPECPATH).parent
VERSION = os.environ.get("CEL_VERSION", "0.0.0-dev")
BUNDLED_MODELS = ["isnet-general-use", "u2net", "u2net_human_seg"]

datas = [
    (str(ROOT / "frontend-pro" / "dist"), "frontend/dist"),
    (str(ROOT / "packaging-pro" / "CelPro.icns"), "."),
]
datas += [
    (str(ROOT / "packaging" / "models_cache" / f"{name}.onnx"), "models")
    for name in BUNDLED_MODELS
]
binaries = []
hiddenimports = ["main", "remover", "jobs", "cel_api", "macos_about"]

for package in ("rembg", "onnxruntime", "pymatting", "pillow_heif", "webview", "uvicorn"):
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(package)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden

# numba caches compiled functions next to their .py source, so ship pymatting's sources.
datas += collect_data_files("pymatting", include_py_files=True)
hiddenimports += collect_submodules("rembg.sessions")

a = Analysis(
    [str(ROOT / "packaging-pro" / "launcher.py")],
    pathex=[str(ROOT / "backend"), str(ROOT / "packaging-pro")],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    runtime_hooks=[str(ROOT / "packaging-pro" / "pyi_rth_cv2_app.py")],
    excludes=["tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6", "gi", "matplotlib", "IPython", "pytest"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="CelPro",
    console=False,
    upx=False,
    target_arch=None,
    codesign_identity=None,
)

coll = COLLECT(exe, a.binaries, a.datas, name="CelPro", upx=False)

app = BUNDLE(
    coll,
    name="Cel Pro.app",
    icon=str(ROOT / "packaging-pro" / "CelPro.icns"),
    bundle_identifier="com.celpro.removebg",
    version=VERSION,
    info_plist={
        "CFBundleName": "Cel Pro",
        "CFBundleDisplayName": "Cel Pro",
        "CFBundleShortVersionString": VERSION,
        "CFBundleVersion": VERSION,
        # SciPy's macOS 12 arm64 wheels are built for 12.3; verify_bundle.py enforces this.
        "LSMinimumSystemVersion": "12.3",
        "NSHighResolutionCapable": True,
        "NSHumanReadableCopyright": "© 2026 Cel Pro. MIT License. Local processing — your images never leave your Mac.",
    },
)
