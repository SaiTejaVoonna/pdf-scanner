# Training on a Kaggle GPU

The corner model trains about 20 to 50 times faster on a GPU than on the CPU machine the rest of this work runs on.
Kaggle gives a free GPU (about 30 hours a week) to accounts with a verified phone number.

| File | What |
|---|---|
| `kapi.py` | The Kaggle Python API, set up for a session where the network proxy adds the API token (the token is never stored in this repo or in a variable). On your own computer with `~/.kaggle/access_token`, use the normal `kaggle` command instead. |
| `build_kernel.py` | Writes `kernel/`: one script that carries `model.py`, `model2.py`, `gen.py` and `train2.py` and runs the training with `DEVICE=cuda`. |

## Steps
1. Data: a private dataset `<user>/page-corners-train` with `train_*.npz` and `val.npz` (from `gen.py`), plus `mend_train.zip` and
   `mend_val.zip` (the CC BY 4.0 Mendeley photos from `data/fetch_mendeley.py`, split into train and held-back).
   `api.dataset_create_new(folder, public=False)` uploads a folder that has a `dataset-metadata.json`.
   The research-only exam photos are **not** uploaded: that exam runs locally on the finished model.
2. `KAGGLE_USER=<user> python3 build_kernel.py 30` then `api.kernels_push('kernel')`.
3. `api.kernels_status('<user>/page-corners-train-gpu')` until it is complete, then `api.kernels_output(..., folder)` downloads
   `net2.pt` and the log.
4. Back here: `compare_models.py`, then port to TypeScript and run the full-app benchmark before shipping anything.

## Run 1 (12 Nov 2026): 30 rounds on a Tesla T4, 60 minutes (about 2 minutes a round)
Model only (not yet in the app), from `compare_models.py`:

| Photos | Model | IoU >= 0.9 | IoU >= 0.8 | Green | False green | Green on no-page |
|---|---|---|---|---|---|---|
| Real exam (877 pages + 123 no-page) | shipped | 42% | 59% | 92% | 36% | 60% |
| | v2 | 58% | 72% | 55% | 2% | 1% |
| Held-back Mendeley (60) | shipped | 28% | 48% | 97% | 48% | |
| | v2 | 77% | 93% | 75% | 3% | |

The held-back score was still creeping up between rounds 20 and 30 (90% to 93% at IoU >= 0.8), so it was close to flat.
