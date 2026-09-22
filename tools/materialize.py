import gzip,hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[1]/'site'
m=json.loads((root/'release-manifest.json').read_text(encoding='utf-8'))
for name,entry in m['files'].items():
 p=root/name
 if len(p.read_bytes())!=entry['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=entry['sha256']:raise SystemExit('Corrupt file: '+name)
for kind in ['pck','wasm']:
 payload=gzip.decompress(b''.join((root/name).read_bytes() for name in m[kind+'Parts']))
 if len(payload)!=m[kind]['bytes'] or hashlib.sha256(payload).hexdigest()!=m[kind]['sha256']:raise SystemExit('Corrupt '+kind)
 if '--raw' in sys.argv:(root/('game.'+kind)).write_bytes(payload)
print('Verified 48-theme game distribution. Compressed chunks are loaded and cached by the browser.')
