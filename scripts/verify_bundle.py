#!/usr/bin/env python3
"""Fail if a built .app links outside itself or needs a newer macOS than it claims."""

from __future__ import annotations

import plistlib
import re
import subprocess
import sys
from pathlib import Path

# A library path is fine if it is part of macOS or inside the bundle.
ALLOWED_PREFIXES = ("/System/Library/", "/usr/lib/", "@rpath/", "@loader_path/", "@executable_path/")


def version_tuple(value: str) -> tuple[int, ...]:
    return tuple(int(part) for part in value.split("."))


def main(app: Path) -> int:
    plist = plistlib.loads((app / "Contents" / "Info.plist").read_bytes())
    min_macos = plist.get("LSMinimumSystemVersion", "12.0")
    problems: list[str] = []
    binaries = [
        path
        for path in app.rglob("*")
        if path.is_file()
        and not path.is_symlink()
        and (path.suffix in (".so", ".dylib") or path.parent.name == "MacOS")
    ]

    for binary in binaries:
        rel = binary.relative_to(app)
        links = subprocess.run(["otool", "-L", str(binary)], capture_output=True, text=True).stdout
        for line in links.splitlines()[1:]:
            lib = line.strip().split(" (")[0]
            if not lib.startswith(ALLOWED_PREFIXES):
                problems.append(f"{rel} links outside the app: {lib}")

        build = subprocess.run(["vtool", "-show-build", str(binary)], capture_output=True, text=True).stdout
        match = re.search(r"minos (\S+)", build)
        if match and version_tuple(match.group(1)) > version_tuple(min_macos):
            problems.append(f"{rel} needs macOS {match.group(1)} (app claims {min_macos})")

    if not list((app / "Contents" / "Resources" / "models").glob("*.onnx")):
        problems.append("no bundled models in Contents/Resources/models")

    for problem in problems:
        print(f"  ✗ {problem}")
    print(f"  checked {len(binaries)} binaries against macOS {min_macos}: "
          f"{'FAILED' if problems else 'ok'}")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main(Path(sys.argv[1])))
