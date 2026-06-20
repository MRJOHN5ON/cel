"""Native bridges exposed to the Cel web UI via pywebview."""

from __future__ import annotations

import base64
import os


class CelApi:
    """JS API: window.pywebview.api.*"""

    def save_file(self, data_base64: str, suggested_name: str) -> dict:
        """Show the macOS save panel and write file bytes to the chosen path."""
        import webview
        from webview import FileDialog

        try:
            data = base64.b64decode(data_base64, validate=True)
        except Exception:
            return {"ok": False, "error": "Could not read image data."}

        if not data:
            return {"ok": False, "error": "File is empty."}

        window = webview.active_window()
        if window is None:
            return {"ok": False, "error": "App window is not available."}

        ext = os.path.splitext(suggested_name)[1].lower()
        if ext == ".zip":
            file_types = ("ZIP archives (*.zip)", "All files (*.*)")
        else:
            file_types = ("PNG images (*.png)", "All files (*.*)")

        downloads = os.path.expanduser("~/Downloads")
        if not os.path.isdir(downloads):
            downloads = os.path.expanduser("~")

        try:
            result = window.create_file_dialog(
                FileDialog.SAVE,
                directory=downloads,
                save_filename=suggested_name,
                file_types=file_types,
            )
        except Exception as exc:
            print(f"Save dialog failed: {exc}", flush=True)
            return {"ok": False, "error": "Could not open the save dialog."}

        if not result:
            return {"ok": False, "cancelled": True}

        path = result[0] if isinstance(result, (tuple, list)) else str(result)
        if ext and not path.lower().endswith(ext):
            path = f"{path}{ext}"

        try:
            with open(path, "wb") as handle:
                handle.write(data)
        except OSError as exc:
            print(f"Save write failed: {exc}", flush=True)
            return {"ok": False, "error": f"Could not write file: {exc}"}

        print(f"Saved result to {path}", flush=True)
        return {"ok": True, "path": path}
