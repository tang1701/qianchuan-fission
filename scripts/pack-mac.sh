#!/usr/bin/env bash
# 在 macOS 上执行：生成 .dmg / .zip（Windows 无法直接打 Mac 包）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export CSC_IDENTITY_AUTO_DISCOVERY=false
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-https://npmmirror.com/mirrors/electron-builder-binaries/}"

OUT="${TMPDIR:-/tmp}/eauto-pack-out-mac"
rm -rf "$OUT"

echo ">>> npm run build"
npm run build

echo ">>> electron-builder --mac (output: $OUT)"
npx electron-builder --mac --arm64 --x64 --config.directories.output="$OUT"

mkdir -p "$ROOT/release"
cp -f "$OUT"/*.dmg "$OUT"/*.zip "$ROOT/release/" 2>/dev/null || true
echo ""
echo "完成。安装包在:"
ls -la "$ROOT/release"/*.dmg "$ROOT/release"/*.zip 2>/dev/null || ls -la "$OUT"
