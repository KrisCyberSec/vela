#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_DIR="$(mktemp -d /tmp/vela-netlify-deploy.XXXXXX)"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

cd "$ROOT_DIR"
npm run verify:netlify-scope

rsync -a \
  netlify.toml \
  package.json \
  package-lock.json \
  landing \
  netlify \
  "$STAGING_DIR/"

cd "$STAGING_DIR"
netlify deploy "$@"
