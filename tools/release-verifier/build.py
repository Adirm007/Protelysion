"""Build the offline GitHub release verifier with a pinned Go toolchain."""
from pathlib import Path
import gzip
import hashlib
import json
import os
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
ENV = {**os.environ, 'GOOS': 'js', 'GOARCH': 'wasm', 'GOTOOLCHAIN': 'go1.25.8'}
def run(*args):
    return subprocess.check_output(args, cwd=ROOT, env=ENV, text=True).strip()
def record(path, data):
    return {'path': path, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
def main():
    if run('go', 'env', 'GOVERSION') != 'go1.25.8':
        raise SystemExit('Go 1.25.8 is required')
    with tempfile.TemporaryDirectory(prefix='release-verifier-') as temporary:
        raw_path = Path(temporary) / 'verifier.wasm'
        run('go', 'build', '-trimpath', '-buildvcs=false', '-ldflags=-s -w', '-o', str(raw_path), '.')
        raw = raw_path.read_bytes()
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    (ROOT / 'verifier.wasm.gz').write_bytes(compressed)
    runtime_path = Path(run('go', 'env', 'GOROOT')) / 'lib' / 'wasm' / 'wasm_exec.js'
    runtime = runtime_path.read_bytes()
    (ROOT / 'wasm_exec.js').write_bytes(runtime)
    descriptor = {'schema': 1, 'go': 'go1.25.8', 'exportedFunction': 'DreamReleaseAttestationVerify',
                  'runtime': record('wasm_exec.js', runtime),
                  'wasm': {**record('verifier.wasm.gz', compressed), 'rawBytes': len(raw), 'rawSha256': hashlib.sha256(raw).hexdigest()}}
    (ROOT / 'descriptor.json').write_text(json.dumps(descriptor, indent=2) + '\n', encoding='utf-8', newline='\n')
    modules = set(run('go', 'list', '-deps', '-f', '{{if .Module}}{{.Module.Path}}|{{.Module.Dir}}{{end}}', '.').splitlines())
    notices = []
    go_license = Path(run('go', 'env', 'GOROOT')) / 'LICENSE'
    (ROOT / 'licenses' / 'go').mkdir(parents=True, exist_ok=True)
    shutil.copyfile(go_license, ROOT / 'licenses' / 'go' / 'LICENSE')
    notices.append('Go runtime: licenses/go/LICENSE')
    for entry in sorted(modules):
        if '|' not in entry:
            continue
        name, directory = entry.split('|', 1)
        if not directory or name.startswith('github.com/Adirm007/'):
            continue
        module = Path(directory)
        destination = ROOT / 'licenses' / name.replace('/', '__')
        for filename in ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'COPYING', 'NOTICE']:
            source = module / filename
            if source.is_file():
                destination.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, destination / filename)
                notices.append(f'{name}: licenses/{destination.name}/{filename}')
    (ROOT / 'THIRD_PARTY_LICENSES.txt').write_text('\n'.join(notices) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(descriptor, indent=2))
if __name__ == '__main__':
    main()
