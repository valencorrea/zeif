#!/usr/bin/env bash
# Sets up the Python virtual environment and installs all dependencies.
# Run once from the script/PoseBasedModel/ directory:
#   bash setup_venv.sh

set -euo pipefail

VENV_DIR=".venv"

echo "==> Creating virtual environment in ${VENV_DIR}/"
python3 -m venv "${VENV_DIR}"

echo "==> Activating venv"
# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"

echo "==> Upgrading pip"
pip install --upgrade pip --quiet

echo "==> Installing PyTorch (MPS-capable wheel for macOS)"
# The stock pip PyTorch wheel includes MPS support on Apple Silicon.
pip install torch torchvision --quiet

echo "==> Installing remaining requirements"
pip install -r requirements.txt --quiet

echo ""
echo "✅  Setup complete."
echo ""
echo "To activate the venv:"
echo "  source ${VENV_DIR}/bin/activate"
echo ""
echo "To run the detector:"
echo "  python main.py"
echo "  python main.py --weights path/to/weights.pt"
echo "  python main.py --help"
