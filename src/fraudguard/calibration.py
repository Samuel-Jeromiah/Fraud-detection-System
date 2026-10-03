"""Serializable probability-calibration helpers."""

from __future__ import annotations

import numpy as np


class IdentityCalibrator:
    """No-op selected when fitted calibration harms a later check window."""

    def predict(self, raw_probabilities):
        return np.asarray(raw_probabilities, dtype=float)
