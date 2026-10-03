# HPC training runbook

## Before submitting

1. Copy this repository and the two raw CSV files to a project or scratch directory with enough free space for generated artifacts.
2. Create a Python 3.11+ environment and install `requirements-ml.txt`.
3. Set `FRAUD_DATA_DIR` to the directory holding `fraudTrain.csv` and `fraudTest.csv`. The files may remain at the repository root for a local run.
4. Run the data audit before training:

```bash
python -m fraudguard.train --audit-only
```

5. Start a small CPU smoke run before requesting GPUs:

```bash
python -m fraudguard.train --smoke-test
```

## Full training

```bash
python -m fraudguard.train --output-dir artifacts/rebuilt-model
```

The pipeline uses XGBoost GPU acceleration when `--device cuda` is passed and a CUDA-capable XGBoost installation is available. It otherwise runs on CPU with the same data split and feature contract.

## Slurm template

`scripts/train_slurm.sh` is intentionally a template. Replace the account, partition, module, and environment activation lines with the values shown by Northeastern's current HPC documentation before submitting it. Do not submit it unchanged.

## Result checklist

Keep the generated `metrics.json`, `model_card.json`, `calibration.png`, `confusion_matrix.png`, and `model_bundle.joblib` together. Deploy only a bundle whose model card identifies the source data, split timestamps, selected calibration method (which may correctly be unchanged raw scores), threshold policy, and final test metrics.
