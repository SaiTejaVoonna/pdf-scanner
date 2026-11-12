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
