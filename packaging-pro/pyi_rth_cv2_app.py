# PyInstaller runtime hook. In a macOS .app, cv2's loader resolves its own path into
# Contents/Resources, fails its sys.path[0] check, and re-imports the Python package
# instead of the native extension ("recursion is detected during loading of cv2").
# This is OpenCV's documented switch for forcing the extension path first.
import sys

sys.OpenCV_REPLACE_SYS_PATH_0 = True
