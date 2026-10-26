#!/usr/bin/env bash
set -e

echo "====================================================================="
echo " Starting AeroCast UK (Backend + Frontend)"
echo "====================================================================="

cd "$(dirname "$0")/backend"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
