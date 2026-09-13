#!/bin/zsh
set -e
cd "${0:A:h}"
export UV_CACHE_DIR="${TMPDIR:-/tmp}/car-inspection-uv-cache"
if [[ ! -d .venv ]]; then uv venv .venv --python 3.12; fi
source .venv/bin/activate
uv sync
# bpy is supplied by Blender; its embedded interpreter is required for scene authoring.
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python build_vehicle.py
