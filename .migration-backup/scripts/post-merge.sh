#!/bin/bash
set -e
npm install --prefer-offline --no-audit 2>/dev/null || npm install
