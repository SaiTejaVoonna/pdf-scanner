"""The Kaggle Python API for a session where the network proxy adds the real token (see kg.py for why).
from kapi import api   # then api.dataset_create_new(...), api.kernels_push(...), api.kernels_status(...), ..."""
import os
os.environ.setdefault('KAGGLE_API_TOKEN', 'proxy-injected')
import kagglesdk.kaggle_env as env
env._env_to_endpoint[env.KaggleEnv.PROD] = 'https://www.kaggle.com/api'
from kaggle.api.kaggle_api_extended import KaggleApi
KaggleApi._introspect_token = lambda self, token: os.environ['KAGGLE_USER']
import contextlib, io
with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
    import kaggle  # its import tries to sign in and prints help when that fails; the real sign-in is the next line
api = kaggle.api; api.authenticate()
