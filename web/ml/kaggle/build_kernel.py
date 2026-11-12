"""Builds the Kaggle script kernel that trains CornerNet2 on a GPU: kernel/train_kernel.py + kernel/kernel-metadata.json.
The kernel carries the training sources inside it (model.py, model2.py, gen.py, train2.py) and reads the data from the private
dataset <user>/page-corners-train (train_*.npz, val.npz, mend_train.zip, mend_val.zip).
Run: KAGGLE_USER=<name> python3 build_kernel.py [EPOCHS]   then push with kapi (see README.md here)."""
import base64, json, os, sys
user = os.environ['KAGGLE_USER']; epochs = int(sys.argv[1]) if len(sys.argv) > 1 else 30
here = os.path.dirname(os.path.abspath(__file__)); os.makedirs(f'{here}/kernel', exist_ok=True)
src = {f: base64.b64encode(open(f'{here}/../{f}', 'rb').read()).decode() for f in ['model.py', 'model2.py', 'gen.py', 'train2.py']}
code = f'''import base64, glob, os, subprocess, sys, zipfile
SRC = {json.dumps(src)}
os.makedirs('/kaggle/working/src', exist_ok=True)
for name, b in SRC.items(): open('/kaggle/working/src/' + name, 'wb').write(base64.b64decode(b))
hits = glob.glob('/kaggle/input/**/val.npz', recursive=True); assert hits, 'dataset not attached'
data = os.path.dirname(hits[0]); print('data', data, os.listdir(data), flush=True)
for z in ('mend_train', 'mend_val'):
    p = glob.glob(f'{{data}}/**/{{z}}/corners.json', recursive=True)   # Kaggle may already have unpacked the zip
    if not p: zipfile.ZipFile(f'{{data}}/{{z}}.zip').extractall('/kaggle/working/real')
real = lambda z: os.path.dirname((glob.glob(f'{{data}}/**/{{z}}/corners.json', recursive=True) + glob.glob(f'/kaggle/working/real/**/{{z}}/corners.json', recursive=True))[0])
subprocess.run('nvidia-smi', shell=True)
env = dict(os.environ, DATA=data, REAL=real('mend_train'), REAL_VAL=real('mend_val'), REAL_SHARE='0.25', DEVICE='cuda', THREADS='4')
r = subprocess.run([sys.executable, '/kaggle/working/src/train2.py', '{epochs}'], env=env, cwd='/kaggle/working')
sys.exit(r.returncode)
'''
open(f'{here}/kernel/train_kernel.py', 'w').write(code)
json.dump({'id': f'{user}/page-corners-train-gpu', 'title': 'page-corners-train-gpu', 'code_file': 'train_kernel.py', 'language': 'python',
           'kernel_type': 'script', 'is_private': True, 'enable_gpu': True, 'enable_internet': False,
           'dataset_sources': [f'{user}/page-corners-train'], 'competition_sources': [], 'kernel_sources': []},
          open(f'{here}/kernel/kernel-metadata.json', 'w'), indent=1)
print('built for', user, epochs, 'epochs')
