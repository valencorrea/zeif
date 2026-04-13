"""
9:1 normal-to-anomaly data mixing for periodic adaptation training.

The RetailS staged subset provides labelled shoplifting windows.
For each adaptation round, a DataLoader is built that yields mini-batches
with exactly 9 normal samples for every 1 anomaly sample.

This class is *also* used during initial training when --mix flag is set,
to provide the model a weak signal about what NOT to model normally.
"""
from __future__ import annotations
from typing import List

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler


class MixedWindowDataset(Dataset):
    """
    Concatenates a normal dataset and an anomaly dataset and exposes a
    WeightedRandomSampler that enforces the desired ratio.

    Usage:
        dataset = MixedWindowDataset(normal_ds, anomaly_ds, ratio=9)
        loader  = dataset.build_loader(batch_size=128)
    """

    def __init__(
        self,
        normal_dataset: Dataset,
        anomaly_dataset: Dataset,
        ratio: int = 9,          # normal : anomaly  (e.g. 9 means 9:1)
    ) -> None:
        self.normal  = normal_dataset
        self.anomaly = anomaly_dataset
        self.ratio   = ratio

        n_normal  = len(normal_dataset)
        n_anomaly = len(anomaly_dataset)

        if n_anomaly == 0:
            raise ValueError("Anomaly dataset is empty – cannot create mixed loader")

        # Weight each sample so expected counts match the requested ratio
        # w_normal : w_anomaly  =  ratio : 1
        # → normalise so they sum to 1 within each class
        w_normal  = ratio  / n_normal
        w_anomaly = 1.0    / n_anomaly
        self._weights = (
            [w_normal]  * n_normal +
            [w_anomaly] * n_anomaly
        )
        self._weights = torch.tensor(self._weights, dtype=torch.float32)

        self._n_total  = n_normal + n_anomaly

    def __len__(self) -> int:
        return self._n_total

    def __getitem__(self, idx: int) -> torch.Tensor:
        n = len(self.normal)
        item = self.normal[idx] if idx < n else self.anomaly[idx - n]
        # Strip label if the underlying dataset returns (tensor, label) tuples
        return item[0] if isinstance(item, (list, tuple)) else item

    def build_loader(
        self,
        batch_size: int,
        num_workers: int = 0,
        num_samples: int | None = None,
    ) -> DataLoader:
        """
        Returns a DataLoader that samples with the mix ratio.

        Args:
            num_samples: total draws per epoch (default: len(normal) * (1 + 1/ratio))
        """
        if num_samples is None:
            # One full pass over normal data + proportional anomaly samples
            num_samples = int(len(self.normal) * (1 + 1 / self.ratio))

        sampler = WeightedRandomSampler(
            weights     = self._weights,
            num_samples = num_samples,
            replacement = True,
        )
        return DataLoader(
            self,
            batch_size  = batch_size,
            sampler     = sampler,
            num_workers = num_workers,
            pin_memory  = False,   # MPS doesn't benefit from pin_memory
            drop_last   = True,
        )
