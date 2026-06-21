#!/usr/bin/env python3
"""Cel Pro macOS app launcher — local server + native app window."""

from __future__ import annotations

import os
import socket
import sys
import threading
import time
from pathlib import Path

APP_NAME = "Cel Pro"


def resources_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


def pick_port() -> int:
    preferred = int(os.environ.get("CEL_PRO_PORT", "8743") or "8743")
    for port in (preferred, 0):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.bind(("127.0.0.1", port))
                return sock.getsockname()[1]
        except OSError:
            continue
    raise SystemExit("Could not bind a local port for Cel Pro")


def configure_environment(root: Path) -> int:
    backend_dir = root / "backend"
    models_dir = root / "models"
    frontend_dir = root / "frontend" / "dist"

    if not backend_dir.is_dir():
        raise SystemExit(f"Missing backend directory: {backend_dir}")
    if not frontend_dir.is_dir():
        raise SystemExit(f"Missing frontend build: {frontend_dir}")
    if not models_dir.is_dir():
        raise SystemExit(f"Missing models directory: {models_dir}")

    os.environ["CEL_PACKAGED"] = "1"
    os.environ["CEL_FRONTEND_DIR"] = str(frontend_dir)
    os.environ["U2NET_HOME"] = str(models_dir)

    sys.path.insert(0, str(backend_dir))
    os.chdir(backend_dir)
    sys.path.insert(0, str(root))

    return pick_port()


def apply_bundle_context() -> None:
    if sys.platform != "darwin":
        return

    try:
        from Foundation import NSProcessInfo

        NSProcessInfo.processInfo().setProcessName_(APP_NAME)
    except Exception as exc:
        print(f"Could not set process name: {exc}", flush=True)


def _set_menu_on_main_thread(name: str = APP_NAME) -> None:
    from macos_about import configure_app_menu

    configure_app_menu(name)


def schedule_menu_rename(name: str = APP_NAME) -> None:
    if sys.platform != "darwin":
        return
    try:
        from PyObjCTools import AppHelper

        AppHelper.callAfter(_set_menu_on_main_thread, name)
        AppHelper.callLater(0.35, _set_menu_on_main_thread, name)
        AppHelper.callLater(1.0, _set_menu_on_main_thread, name)
    except Exception as exc:
        print(f"Could not schedule menu rename: {exc}", flush=True)


def wait_for_server(port: int, timeout: float = 45.0) -> None:
    import urllib.error
    import urllib.request

    index_url = f"http://127.0.0.1:{port}/"
    deadline = time.time() + timeout

    while time.time() < deadline:
        try:
            with urllib.request.urlopen(index_url, timeout=1.0) as response:
                if response.status == 200 and b'id="root"' in response.read():
                    return
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.1)

    raise SystemExit(f"Cel Pro UI did not become ready on port {port}")


def run_server(port: int) -> None:
    import uvicorn

    try:
        config = uvicorn.Config(
            "main:app",
            host="127.0.0.1",
            port=port,
            log_level="info",
            access_log=True,
            timeout_graceful_shutdown=1,
        )
        server = uvicorn.Server(config)
        server.run()
    except Exception as exc:
        print(f"Cel Pro server crashed: {exc}", flush=True)
        raise


def get_window_geometry() -> tuple[int, int, int | None, int | None]:
    if sys.platform != "darwin":
        return 1120, 780, None, None

    try:
        from AppKit import NSScreen

        screen = NSScreen.mainScreen().frame()
        visible = NSScreen.mainScreen().visibleFrame()
        width = int(visible.size.width)
        height = int(visible.size.height)
        x = int(visible.origin.x)
        y = int(screen.size.height - (visible.origin.y + visible.size.height))
        return width, height, x, y
    except Exception as exc:
        print(f"Could not read screen geometry: {exc}", flush=True)
        return 1120, 780, None, None


def main() -> None:
    if sys.platform == "darwin":
        sys.argv[0] = APP_NAME

    root = resources_dir()
    port = configure_environment(root)
    url = f"http://127.0.0.1:{port}"

    print(f"Cel Pro starting at {url}", flush=True)

    threading.Thread(target=run_server, args=(port,), daemon=True).start()
    wait_for_server(port)

    if sys.platform == "darwin":
        from macos_about import patch_bundle_display_name

        patch_bundle_display_name(APP_NAME)
        apply_bundle_context()

    import webview

    from cel_api import CelApi

    win_w, win_h, win_x, win_y = get_window_geometry()

    window = webview.create_window(
        APP_NAME,
        url,
        width=win_w,
        height=win_h,
        x=win_x,
        y=win_y,
        min_size=(800, 620),
        text_select=True,
        background_color="#f5f5f7",
        js_api=CelApi(),
    )

    def on_shown() -> None:
        apply_bundle_context()
        schedule_menu_rename(APP_NAME)
        print(f"Cel Pro window shown — {window.get_current_url()}", flush=True)

    def on_loaded() -> None:
        apply_bundle_context()
        schedule_menu_rename(APP_NAME)
        print(f"Cel Pro UI loaded — {window.get_current_url()}", flush=True)

    window.events.shown += on_shown
    window.events.loaded += on_loaded

    def on_closing() -> None:
        # macOS: pywebview waits for the uvicorn thread on Quit/Cmd+Q, but
        # streaming/keep-alive connections never drain — process aborts and
        # macOS reports an unexpected quit. Exit immediately instead.
        print("Cel Pro quitting", flush=True)
        os._exit(0)

    window.events.closing += on_closing

    def on_gui_ready() -> None:
        apply_bundle_context()
        schedule_menu_rename(APP_NAME)

    webview.start(on_gui_ready)
    print("Cel Pro closed", flush=True)
    os._exit(0)


if __name__ == "__main__":
    main()
