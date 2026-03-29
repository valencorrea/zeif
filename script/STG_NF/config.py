"""
Centralised hyperparameters and paths for the STG-NF system.
All other modules import from here – no magic numbers scattered around.
"""
from __future__ import annotations
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT          = Path(__file__).parent
DATA_ROOT     = ROOT / "data"
CHECKPOINT_DIR = ROOT / "checkpoints"
BUFFER_DIR    = ROOT / "buffer"

RETAIL_ZIP    = ROOT / "RetailS.zip"
RETAIL_DIR    = DATA_ROOT / "RetailS"

CLIPS_DIR     = ROOT / "clips"

CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
BUFFER_DIR.mkdir(parents=True, exist_ok=True)
CLIPS_DIR.mkdir(parents=True, exist_ok=True)

# ── Skeleton / window ──────────────────────────────────────────────────────────
NUM_JOINTS    = 15          # 15-keypoint schema (no facial landmarks)
COORDS        = 2           # x, y only
WINDOW_T      = 24          # frames per window
STRIDE        = 6           # sliding window stride
INPUT_DIM     = NUM_JOINTS * COORDS   # 30 per frame

# ── Flow model ─────────────────────────────────────────────────────────────────
FLOW_DEPTH        = 8       # number of coupling layers
HIDDEN_CHANNELS   = 64      # coupling-network hidden size
ACTNORM_INIT_ITERS = 256    # mini-batches for data-dependent ActNorm init

# ── Training ───────────────────────────────────────────────────────────────────
BATCH_SIZE    = 256
LR            = 1e-4
WEIGHT_DECAY  = 1e-5
MAX_EPOCHS    = 100
GRAD_CLIP     = 5.0
MIX_RATIO     = 9           # 9 normal : 1 anomaly for periodic update

# ── Adaptation ─────────────────────────────────────────────────────────────────
ADAPT_INTERVAL_H  = 12      # hours between periodic training jobs
BUFFER_CAPACITY   = 20_000  # max windows in D_low
ADAPT_BATCH       = 128
ADAPT_EPOCHS      = 10

# ── Inference / thresholding ───────────────────────────────────────────────────
TARGET_FPS        = 5
ANOMALY_TAU       = None    # None → calibrated from HPRS; float → fixed
CONF_THRESH       = 0.4     # YOLO person confidence
