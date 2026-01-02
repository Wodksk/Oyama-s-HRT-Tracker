#!/usr/bin/env python3
"""
Set project version in three places and optionally run tauri build.
Usage:
  python3 scripts/set_version.py 1.2.3          # only update versions
  python3 scripts/set_version.py 1.2.3 --build  # update versions and npm run tauri:build
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def update_package_json(version: str) -> None:
    path = ROOT / "package.json"
    data = json.loads(path.read_text())
    data["version"] = version
    path.write_text(json.dumps(data, indent=2) + "\n")


def update_tauri_conf(version: str) -> None:
    path = ROOT / "src-tauri" / "tauri.conf.json"
    data = json.loads(path.read_text())
    if "package" not in data:
        data["package"] = {}
    data["package"]["version"] = version
    path.write_text(json.dumps(data, indent=2) + "\n")


def update_cargo_toml(version: str) -> None:
    path = ROOT / "src-tauri" / "Cargo.toml"
    text = path.read_text()
    pattern = r"(?m)^(version\s*=\s*\")([0-9.]+)(\")"
    new_text, count = re.subn(pattern, lambda m: f"{m.group(1)}{version}{m.group(3)}", text, count=1)
    if count == 0:
        sys.exit(f"version line not found in {path}")
    path.write_text(new_text)


def run_build() -> None:
    subprocess.check_call(["npm", "run", "tauri:build"], cwd=ROOT)


def main() -> None:
    parser = argparse.ArgumentParser(description="Set unified version and optionally build")
    parser.add_argument("version", help="Version string, e.g. 1.2.3")
    parser.add_argument("--build", action="store_true", help="Run npm run tauri:build after updating")
    args = parser.parse_args()

    if not re.fullmatch(r"\d+\.\d+\.\d+", args.version):
        sys.exit("Version must look like X.Y.Z")

    update_package_json(args.version)
    update_tauri_conf(args.version)
    update_cargo_toml(args.version)

    print(f"Version set to {args.version}")
    if args.build:
        run_build()


if __name__ == "__main__":
    main()

    #example: python3 scripts/set_version.py 0.2.0 --build
    #example: python3 scripts/set_version.py 0.2.0
