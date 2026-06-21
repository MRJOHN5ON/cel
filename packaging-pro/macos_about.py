"""Custom About panel and menu hook for Cel Pro on macOS."""

from __future__ import annotations

import os
from pathlib import Path

APP_NAME = "Cel Pro"
APP_VERSION = "1.0.0"

ABOUT_TEXT = """\
Version 1.0.0

Cel Pro — local background removal with pro cutout editing.

Remove backgrounds on your Mac, then refine edges with erase and restore brushes, zoom, and undo/redo.

• Your images never leave this Mac
• No cloud, no account, no credits
• Works fully offline after install

© 2026 Cel Pro. MIT License.\
"""

_about_delegate = None


def _icon_path() -> str | None:
    app_bundle = os.environ.get("CEL_APP_BUNDLE", "").strip()
    if app_bundle:
        path = Path(app_bundle) / "Contents" / "Resources" / "CelPro.icns"
        if path.is_file():
            return str(path)

    resources = Path(__file__).resolve().parent
    bundled = resources / "CelPro.icns"
    return str(bundled) if bundled.is_file() else None


def show_about_panel() -> None:
    import AppKit

    alert = AppKit.NSAlert.alloc().init()
    alert.setMessageText_(APP_NAME)
    alert.setInformativeText_(ABOUT_TEXT)
    alert.setAlertStyle_(AppKit.NSInformationalAlertStyle)

    icon_file = _icon_path()
    if icon_file:
        icon = AppKit.NSImage.alloc().initByReferencingFile_(icon_file)
        if icon is not None:
            alert.setIcon_(icon)

    alert.addButtonWithTitle_("OK")
    alert.runModal()


def patch_bundle_display_name(app_name: str) -> None:
    try:
        import AppKit

        bundle = AppKit.NSBundle.mainBundle()
        info = bundle.infoDictionary()
        if info is not None:
            info["CFBundleName"] = app_name
            info["CFBundleDisplayName"] = app_name
    except Exception:
        pass


def _fix_menu_titles(submenu, app_name: str) -> None:
    for index in range(submenu.numberOfItems()):
        item = submenu.itemAtIndex_(index)
        if item is None:
            continue
        title = str(item.title())
        if "Python" in title:
            item.setTitle_(title.replace("Python", app_name))


def configure_app_menu(app_name: str = APP_NAME) -> None:
    global _about_delegate

    import AppKit
    from Foundation import NSObject, NSProcessInfo

    NSProcessInfo.processInfo().setProcessName_(app_name)

    app = AppKit.NSApplication.sharedApplication()
    main_menu = app.mainMenu()
    if not main_menu or main_menu.numberOfItems() == 0:
        return

    app_item = main_menu.itemAtIndex_(0)
    if app_item is not None:
        app_item.setTitle_(app_name)
        submenu = app_item.submenu()
        if submenu is not None:
            submenu.setTitle_(app_name)
            _fix_menu_titles(submenu, app_name)

            class AboutDelegate(NSObject):
                def showAbout_(self, sender) -> None:
                    show_about_panel()

            about_item = submenu.itemAtIndex_(0)
            if about_item is not None:
                about_item.setTitle_(f"About {app_name}")
                _about_delegate = AboutDelegate.alloc().init()
                about_item.setTarget_(_about_delegate)
                about_item.setAction_("showAbout:")


def install_custom_about_menu() -> None:
    configure_app_menu()
