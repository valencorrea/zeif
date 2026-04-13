"""
main_detect.py – Real-time STG-NF shoplifting detection with adaptation.

Usage:
    # Run with trained weights + calibrated threshold (standard):
    python main_detect.py --weights checkpoints/stgnf_best.pt

    # Override threshold manually:
    python main_detect.py --weights checkpoints/stgnf_best.pt --tau 12.5

    # Disable adaptation (observation-only mode):
    python main_detect.py --no-adapt

    # Use a video file instead of webcam:
    python main_detect.py --source path/to/video.mp4

Options:
    --weights     Path to STG-NF weights  (.pt)
    --tau         Manual anomaly threshold (overrides calibrated tau.json)
    --source      Webcam index or video path (default: 0)
    --no-adapt    Disable Periodic Adaptation Pipeline
    --no-skeleton Hide skeleton overlay
    --retail-zip  Path to RetailS.zip (for adaptation's anomaly pool)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent))

from config import (
    CHECKPOINT_DIR, DATA_ROOT, FLOW_DEPTH, HIDDEN_CHANNELS, RETAIL_ZIP,
)
from dataset.extract import extract_dataset
from dataset.retail_dataset import RetailSTestDataset
from model.stg_nf import build_model
from training.trainer import load_checkpoint
from adaptation.buffer import LowScoreBuffer
from adaptation.pipeline import AdaptationPipeline
from inference.detector import RealTimeDetector


def _select_device() -> torch.device:
    if torch.backends.mps.is_available():
        print("[device] MPS (Apple Silicon GPU)")
        return torch.device("mps")
    if torch.cuda.is_available():
        print("[device] CUDA")
        return torch.device("cuda")
    print("[device] CPU")
    return torch.device("cpu")


def _parse() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="STG-NF Real-time Detector")
    p.add_argument("--weights",     type=Path, default=None)
    p.add_argument("--tau",         type=float, default=None)
    p.add_argument("--source",      default=0)
    p.add_argument("--no-adapt",    action="store_true")
    p.add_argument("--no-skeleton", action="store_true")
    p.add_argument("--retail-zip",  type=Path, default=RETAIL_ZIP)
    return p.parse_args()


def _load_tau(args: argparse.Namespace) -> float:
    """Resolve threshold: CLI > tau.json > fallback."""
    if args.tau is not None:
        print(f"[tau] Using CLI override: τ={args.tau}")
        return args.tau

    tau_path = CHECKPOINT_DIR / "tau.json"
    if tau_path.exists():
        with open(tau_path) as f:
            d = json.load(f)
        tau = float(d["tau"])
        print(f"[tau] Loaded calibrated τ={tau:.6f}  (HPRS={d.get('hprs', '?'):.4f})")
        return tau

    fallback = 0.0
    print(f"[tau] No tau.json found – using fallback τ={fallback}  "
          "Run main_train.py --calibrate to calibrate properly.")
    return fallback


def main() -> None:
    args   = _parse()
    device = _select_device()

    # ── Build + load model ────────────────────────────────────────────────────
    model = build_model(FLOW_DEPTH, HIDDEN_CHANNELS, device=device)

    weights = args.weights or (CHECKPOINT_DIR / "stgnf_best.pt")
    if weights.exists():
        load_checkpoint(model, weights, device=device)
        print(f"[model] Loaded {weights}")
    else:
        print(f"[model] No weights at {weights} – running with random init (demo mode)")

    model.eval()

    tau = _load_tau(args)

    # ── Adaptation pipeline (optional) ────────────────────────────────────────
    pipeline = None
    if not args.no_adapt:
        retail_root = DATA_ROOT / "RetailS"
        if not retail_root.exists():
            zip_path = args.retail_zip
            if zip_path.exists():
                extract_dataset(zip_path, DATA_ROOT)
            else:
                print("[adapt] RetailS data not found – adaptation disabled")
                args.no_adapt = True

    if not args.no_adapt:
        try:
            anomaly_ds = RetailSTestDataset(retail_root, split="staged")
            buffer     = LowScoreBuffer()
            pipeline   = AdaptationPipeline(
                model           = model,
                device          = device,
                anomaly_dataset = anomaly_ds,
                tau             = tau,
                buffer          = buffer,
            )
            pipeline.start()
        except Exception as e:
            print(f"[adapt] Pipeline init failed ({e}) – running without adaptation")
            pipeline = None

    # ── Launch detector ───────────────────────────────────────────────────────
    source = int(args.source) if str(args.source).isdigit() else args.source

    detector = RealTimeDetector(
        model    = model,
        tau      = tau,
        device   = device,
        source   = source,
        pipeline = pipeline,
    )
    detector.run()


if __name__ == "__main__":
    main()
