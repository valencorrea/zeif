# ML Scripts – Setup & Usage

Two detection pipelines live here. Both require Python 3.11+ and a separate venv.

---

## STG-NF (Spatio-Temporal Graph Normalizing Flows)

Unsupervised shoplifting detection. Trains on normal-only data; anomalies score
as low-likelihood poses.

### 1. Create the virtual environment

```bash
cd script/STG_NF
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install torch torchvision          # MPS-capable wheel on Apple Silicon
pip install -r requirements.txt
```

### 2. Add the dataset

Download `RetailS.zip` from the official repository:

> **[https://github.com/TeCSAR-UNCC/RetailS](https://github.com/TeCSAR-UNCC/RetailS?tab=readme-ov-file)**

Place the zip inside `script/STG_NF/`:

```
script/STG_NF/
  RetailS.zip   ← put it here
```

The training script extracts it automatically on first run.

### 3. Train

```bash
source .venv/bin/activate

# M4 Mac — 2h budget (100 clips, 100 epochs, fresh start — do NOT use --resume)
python main_train.py --max-clips 100 --epochs 100 --batch 256

# Calibrate the alert threshold after training
python main_train.py --calibrate --weights checkpoints/stgnf_best.pt
```

> **Note – do not add `--mix` for the initial training run.** The normalizing flow
> needs clean normal-only data to learn the normal distribution. `--mix` is only
> for supervised fine-tuning passes.

> **For best results use Google Colab (A100)** — run the full dataset, no time limit:
> ```bash
> python main_train.py --max-clips 942 --epochs 100 --batch 512
> ```
> Open `STG_NF_Shoplifting_Detection.ipynb`, upload `RetailS.zip` to Google Drive,
> run all cells, then download `checkpoints/stgnf_best.pt` and `tau.json` back into
> `script/STG_NF/checkpoints/`.

### 4. Evaluate & Diagnose

```bash
source .venv/bin/activate

# Produce a baseline diagnostic report (AUC, HPRS, confusion matrix):
python main_evaluate.py

# After retraining, compare new checkpoint against saved baseline:
python main_evaluate.py --compare checkpoints/baseline_eval.json

# Use the real-world test split instead of staged:
python main_evaluate.py --split realworld
```

The script saves results to `checkpoints/baseline_eval.json` (first run) or
`checkpoints/eval_<timestamp>.json` (subsequent runs when `--compare` is set).

**What to look for:**
- `AUC < 0.5` → inverted scores; model is undertrained or has domain shift
- `AUC 0.5–0.7` → model distinguishes but poorly; train on more clips or run
  the Periodic Adaptation Pipeline on real webcam footage
- `AUC ≥ 0.80` → model is production-ready; recalibrate tau and deploy

### 4. Run the live detector

```bash
source .venv/bin/activate
python main_detect.py --weights checkpoints/stgnf_best.pt
```

Press `q` to quit. The detector reads `checkpoints/tau.json` automatically
for the HPRS-calibrated alert threshold.

| Flag | Default | Description |
|------|---------|-------------|
| `--weights` | none | Path to trained `.pt` file |
| `--tau` | from `tau.json` | Manual anomaly threshold override |
| `--source` | `0` | Webcam index or video file path |
| `--no-adapt` | off | Disable 12-hour background fine-tuning |

---

## PoseBasedModel (LSTM + Bahdanau Attention)

Supervised baseline using a pose-based LSTM with per-PID probability aggregation.

### 1. Create the virtual environment

```bash
cd script/PoseBasedModel
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install torch torchvision
pip install -r requirements.txt
```

### 2. Run

```bash
source .venv/bin/activate

# Demo mode (random weights, webcam)
python main.py

# With trained weights
python main.py --weights path/to/weights.pt

# From a video file
python main.py --source path/to/video.mp4
```

Press `q` to quit.

---

## Configuration

Edit `config.py` in each project directory to change hyperparameters:

| Key (STG-NF) | Default | Effect |
|---|---|---|
| `FLOW_DEPTH` | `8` | Coupling layers (deeper = more expressive) |
| `HIDDEN_CHANNELS` | `64` | ST-GCN hidden size |
| `WINDOW_T` | `24` | Frames per inference window |
| `STRIDE` | `6` | Window slide step |
| `MAX_EPOCHS` | `100` | Training epochs |
| `ADAPT_INTERVAL_H` | `12` | Hours between adaptation rounds |
