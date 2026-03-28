#!/usr/bin/env bash
# One-time environment setup for STG_NF.
# Run from script/STG_NF/:   bash setup_venv.sh

set -euo pipefail
VENV=".venv"

echo "==> Creating venv in ${VENV}/"
python3 -m venv "${VENV}"
source "${VENV}/bin/activate"

echo "==> Upgrading pip"
pip install --upgrade pip --quiet

echo "==> Installing PyTorch (MPS-capable wheel)"
pip install torch torchvision --quiet

echo "==> Installing remaining requirements"
pip install -r requirements.txt --quiet

echo ""
echo "✅  Setup complete."
echo ""
echo "Activate:  source ${VENV}/bin/activate"
echo "Train:     python main_train.py [--mix] [--max-clips 50]"
echo "Calibrate: python main_train.py --calibrate --weights checkpoints/stgnf_best.pt"
echo "Detect:    python main_detect.py --weights checkpoints/stgnf_best.pt"
