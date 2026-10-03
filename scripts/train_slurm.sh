#!/usr/bin/env bash
# Template only. Replace these settings with Northeastern's current scheduler,
# account, partition, module, and environment instructions before submission.
#SBATCH --job-name=fraudguard-train
#SBATCH --time=04:00:00
#SBATCH --cpus-per-task=8
#SBATCH --mem=48G
#SBATCH --output=logs/fraudguard-%j.out

set -euo pipefail

# module load python/3.11
# source /path/to/venv/bin/activate
export FRAUD_DATA_DIR="${FRAUD_DATA_DIR:?Set FRAUD_DATA_DIR to the raw CSV directory}"
python -m fraudguard.train --device cuda --output-dir artifacts/rebuilt-model
