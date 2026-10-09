"""Byte-exact, allowlisted Git publication using verified TLS and HTTP/1.1.
Uses an isolated checkout, never resets the development tree or force-pushes.
Credentials stay in the existing local Git Credential Manager.
"""
from __future__ import annotations
import hashlib,json,os,pathlib,re,shutil,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[2];SOURCE=ROOT/'22-发布/booksea-github';OUT=ROOT/'09-实现/verification/release-20260922';STAGE=OUT/'github-git-upload'
REMOTE='https://github.com/Adirm007/Protelysion.git'
def digest(b):return hashlib.sha256(b).hexdigest()
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def say(**x):print(json.dumps(x,ensure_ascii=False),flush=True)
manifest=json.loads((SOURCE/'site/release-manifest.json').read_text(encoding='utf-8'))
proof=json.loads((ROOT/'09-实现/verification/release-audit-023-20260922/release-browser.json').read_text(encoding='utf-8'))
assert proof['passed'] and proof['publicDistributionBundleSha256']==manifest['files']['distribution.js']['sha256']
assert proof['pck']==manifest['pck'] and proof['warm']['networkRequests']==0
rpg=json.loads((ROOT/'09-实现/verification/rpg-ui-023/rpg-browser.json').read_text(encoding='utf-8'))
assert rpg['passed'] and rpg['pckSha256']==manifest['pck']['sha256'],'RPG render proof must match the actual released PCK'
files={'site/'+k:v for k,v in manifest['files'].items()}
for name in ['docs/mcp-controls-mobile-rollback-023-20260922.md','docs/mcp-rpg-ui-022-20260922.md','site/release-manifest.json','README.md','NOTICE.md','LICENSE','.gitignore','.gitattributes','.github/workflows/pages.yml','tools/materialize.py','install/读者对话渲染0917 (new).json','install/读者核心本体 (new).txt','install/普罗泰利西翁-书海外链加载正则.json']:
    b=(SOURCE/name).read_bytes();files[name]={'bytes':len(b),'sha256':digest(b)}
actual={p.relative_to(SOURCE).as_posix()for p in SOURCE.rglob('*')if p.is_file()and '.git'not in p.relative_to(SOURCE).parts};assert actual==set(files),'Unexpected release files'
secrets=re.compile(rb'(?:gh[pousr]_[A-Za-z0-9_]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{35,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
expected={}
for name,spec in files.items():
    b=(SOURCE/name).read_bytes();assert len(b)==spec['bytes'] and digest(b)==spec['sha256'],'Stale '+name;assert len(b)<100*1024*1024
    if pathlib.Path(name).suffix in ['.js','.json','.html','.txt','.md','.yml']:assert not secrets.search(b),'Potential credential: '+name
    expected[name]=blob(b)
env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='never',GCM_GUI_PROMPT='0')
for key in list(env):
    if key.startswith(('GIT_TRACE','GCM_TRACE'))or key in ['GIT_CURL_VERBOSE','CURL_VERBOSE']:env.pop(key)
settings=['-c','http.sslBackend=openssl','-c','http.version=HTTP/1.1','-c','credential.helper=','-c','credential.helper=manager','-c','credential.username=Adirm007','-c','http.lowSpeedLimit=1','-c','http.lowSpeedTime=120']
def git(*args,cwd=None,capture=True,timeout=120):
    attempts=3 if args[0] in ['fetch','ls-remote','push'] else 1
    for attempt in range(attempts):
        selected=list(settings)
        if attempt==1:selected[selected.index('http.sslBackend=openssl')]='http.sslBackend=schannel'
        if attempt==2:selected+=['-c','http.sslVersion=tlsv1.2']
        p=subprocess.run(['git',*selected,*args],cwd=cwd or STAGE,env=env,stdout=subprocess.PIPE if capture else None,stderr=subprocess.PIPE if capture else None,timeout=timeout)
        if not p.returncode:return p.stdout if capture else b''
        if capture:print(p.stderr.decode('utf-8','replace'),flush=True)
        if attempt+1<attempts:say(retryGitOperation=args[0],certificateVerification=True);time.sleep(5*(attempt+1))
    raise RuntimeError('Git operation failed: '+args[0])
marker=OUT/'github-git-upload-owned.json'
if not STAGE.exists():
    git('clone','--depth','1','--single-branch','--branch','main',REMOTE,str(STAGE),cwd=OUT)
    marker.write_text(json.dumps({'managed':True,'repository':REMOTE}),encoding='utf-8')
else:
    assert marker.exists()and json.loads(marker.read_text())['repository']==REMOTE,'Unowned upload checkout'
    assert git('remote','get-url','origin').decode().strip()==REMOTE,'Unexpected remote'
    git('fetch','origin','main')
tracked={p.decode('utf-8')for p in git('ls-files','-z').split(b'\0')if p};assert tracked<=set(files),'Remote contains unreviewed files'
remote_before=git('rev-parse','origin/main').decode().strip();say(remoteBefore=remote_before,verifiedFiles=len(files),bytes=sum(x['bytes']for x in files.values()))
for key,value in [('core.autocrlf','false'),('user.name','Adirm007'),('user.email','Adirm007@users.noreply.github.com'),('pack.threads','2'),('pack.compression','1')]:git('config','--local',key,value)
for name in files:
    dest=STAGE/name;dest.parent.mkdir(parents=True,exist_ok=True)
    if dest.exists():dest.unlink()
    try:os.link(SOURCE/name,dest)
    except OSError:shutil.copyfile(SOURCE/name,dest)
git('add','--all','--force')
index={}
for row in git('ls-files','--stage','-z').split(b'\0'):
    if row:
        fields,name=row.split(b'\t',1);index[name.decode('utf-8')]=fields.split()[1].decode()
assert index==expected,'Git would alter verified bytes (line ending/filter mismatch); push refused'
if git('diff','--cached','--name-only'):
    git('commit','-m','Release Protelysion 0.23.0: touch controls, supplied sprite, battle items and message-bound rollback',capture=False)
commit=git('rev-parse','HEAD').decode().strip();current=git('ls-remote','origin','refs/heads/main').decode().split()[0]
assert current==remote_before or current==commit,'Remote main changed; no force push'
say(pushingCommit=commit)
git('push','--progress','--set-upstream','origin','main',capture=False,timeout=1200)
assert git('ls-remote','origin','refs/heads/main').decode().split()[0]==commit
report={'published':True,'method':'Git over certificate-verified HTTPS / HTTP1.1','repository':REMOTE.removesuffix('.git'),'branch':'main','commit':commit,'files':len(files),'bytes':sum(x['bytes']for x in files.values()),'revision':manifest['revision'],'pagesConfigured':True,'deploymentVerified':False,'credentialsPersisted':False,'publicDistributionBundleSha256':manifest['files']['distribution.js']['sha256'],'pck':manifest['pck']}
(OUT/'github-publish.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');say(**report)
