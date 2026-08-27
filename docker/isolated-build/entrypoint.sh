#!/bin/sh
set -e

# Contract with the worker (apps/worker/src/lib/docker.ts):
#   - the project tarball is streamed in on stdin
#   - this entrypoint untars it, installs deps and runs the production build
#   - the built `dist` directory is streamed back as a gzipped tarball on stdout
#   - all build logging goes to stderr so stdout stays a clean archive
# No host filesystem is mounted and no cloud credentials are ever provided.

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [ -t 0 ]; then
  echo "error: expected project tarball on stdin" >&2
  exit 1
fi

echo "[build] reading project tarball from stdin" >&2
cat > "$TMP_DIR/project.tar.gz"

mkdir -p /build
tar --no-same-owner -xzf "$TMP_DIR/project.tar.gz" -C /build

cd /build

echo "[build] installing dependencies" >&2
npm install --no-audit --no-fund >&2

echo "[build] running production build" >&2
npm run build >&2

if [ ! -d dist ]; then
  echo "error: build produced no dist directory" >&2
  exit 1
fi

echo "[build] build complete" >&2
tar -czf - -C /build dist