"""Publish only the byte-verified Booksea release from its existing Git checkout.
No reset, clean, force push, credential export, or unrelated workspace upload.
"""
from __future__ import annotations
import argparse, hashlib, json, os, pathlib, re, subprocess, time
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=ROOT/'22-发布/booksea-github'
OUT=ROOT/'09-实现/verification/exit-0241/publication'
OUT.mkdir(parents=True,exist_ok=True)
REMOTE='https://github.com/Adirm007/Protelysion.git'
REVISION='protelysion-0.24.1-20260923-r2'
parser=argparse.ArgumentParser();parser.add_argument('--publish',action='store_true');args=parser.parse_args()
def digest(b):return hashlib.sha256(b).hexdigest()
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def readj(p):return json.loads(p.read_text(encoding='utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def say(**v):print(json.dumps(v,ensure_ascii=False),flush=True)
secrets=re.compile(rb'(?:gg-gcli-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{35,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='never',GCM_GUI_PROMPT='0')
for k in list(env):
    if k.startswith(('GIT_TRACE','GCM_TRACE')) or k in ['GIT_CURL_VERBOSE','CURL_VERBOSE']:env.pop(k)
def git(*words,timeout=180):
    last=None
    for attempt in range(3 if words[0] in ['fetch','ls-remote','push'] else 1):
        settings=['-c','http.sslVerify=true','-c','http.sslBackend='+('schannel' if attempt==1 else 'openssl'),'-c','http.version=HTTP/1.1','-c','credential.helper=','-c','credential.helper=manager','-c','credential.username=Adirm007','-c','core.autocrlf=false']
        p=subprocess.run(['git',*settings,*words],cwd=SOURCE,env=env,capture_output=True,timeout=timeout)
        if p.returncode==0:return p.stdout
        last=secrets.sub(b'[REDACTED]',p.stderr).decode('utf-8','replace')
        if attempt<2 and words[0] in ['fetch','ls-remote','push']:say(retryOperation=words[0],certificateVerification=True);time.sleep(3)
    raise RuntimeError('Git '+words[0]+' failed: '+str(last))
manifest=readj(SOURCE/'site/release-manifest.json');assert manifest['revision']==REVISION
audit=readj(ROOT/'09-实现/verification/exit-0241/final-audit.json')
assert audit['passed'] and audit['revision']==REVISION
assert audit['frequency']['theory']=={'totalAppearance':.08,'ordinary':.04,'mimic':.04,'conditionalMimicShare':.5}
assert audit['artifacts']['distributionSha256']==manifest['files']['distribution.js']['sha256']
proof=readj(ROOT/'09-实现/verification/exit-0241/release-browser/release-browser.json')
assert proof['passed'] and proof['publicDistributionBundleSha256']==manifest['files']['distribution.js']['sha256']
assert proof['pck']==manifest['pck'] and proof['warm']['networkRequests']==0
art=readj(ROOT/'09-实现/verification/exit-0241/features-browser/browser-features.json')
assert art['passed'] and len(art['portraitRows'])==433 and art['pckSHA256']==manifest['pck']['sha256']
files={'site/'+k:v for k,v in manifest['files'].items()}
meta=['.gitattributes','.gitignore','.github/workflows/pages.yml','LICENSE','NOTICE.md','README.md','site/release-manifest.json','tools/materialize.py','install/读者对话渲染0917 (new).json','install/读者核心本体 (new).txt','install/普罗泰利西翁-书海外链加载正则.json']
meta+=['docs/'+name for name in ['mcp-controls-mobile-rollback-023-20260922.md','mcp-rpg-ui-022-20260922.md','mcp-seven-fixes-024-20260923.md','mcp-publish-024-20260923.md','mcp-exit-mimic-0241-20260923.md']]
for name in meta:
    b=(SOURCE/name).read_bytes();files[name]={'bytes':len(b),'sha256':digest(b)}
actual={p.relative_to(SOURCE).as_posix() for p in SOURCE.rglob('*') if p.is_file() and '.git' not in p.relative_to(SOURCE).parts}
assert actual==set(files),'Non-allowlisted or missing release paths: '+str(sorted(actual.symmetric_difference(files)))
expected={}
for name,spec in files.items():
    b=(SOURCE/name).read_bytes();assert len(b)==spec['bytes'] and digest(b)==spec['sha256'],'Stale '+name
    assert len(b)<100*1024*1024,'Oversized Git file'
    if pathlib.Path(name).suffix in ['.js','.html','.json','.txt','.md','.yml']:assert not secrets.search(b),'Credential-like value; publication blocked without printing it'
    expected[name]=blob(b)
assert git('remote','get-url','origin').decode().strip()==REMOTE,'Unexpected publication remote'
assert git('branch','--show-current').decode().strip()=='main','Expected main checkout'
tracked={p.decode('utf-8') for p in git('ls-files','-z').split(b'\0') if p}
assert tracked<=set(files),'Unreviewed tracked files'
remote_before=git('ls-remote','origin','refs/heads/main').decode().split()[0]
head=git('rev-parse','HEAD').decode().strip()
pending=readj(OUT/'pending.json') if (OUT/'pending.json').exists() else None
assert head==remote_before or (pending and pending['commit']==head and pending['parent']==remote_before),'Local/remote history diverged; no reset or force push allowed'
say(ready=True,revision=REVISION,verifiedFiles=len(files),remoteBefore=remote_before,publishRequested=args.publish)
if not args.publish:raise SystemExit(0)
git('fetch','origin','main')
assert git('rev-parse','origin/main').decode().strip()==remote_before,'Remote changed during preflight'
for k,v in [('core.autocrlf','false'),('user.name','Adirm007'),('user.email','Adirm007@users.noreply.github.com')]:git('config','--local',k,v)
git('add','--all','--force')
index={}
for row in git('ls-files','--stage','-z').split(b'\0'):
    if row:
        fields,name=row.split(b'\t',1);assert fields.split()[2]==b'0';index[name.decode('utf-8')]=fields.split()[1].decode()
assert index==expected,'Git index bytes differ from verified release; publication stopped'
changed=git('diff','--cached','--name-only','-z').split(b'\0')
if any(changed):git('commit','-m','Release 0.24.1: verified exit summaries and 8% chest pool (4% normal, 4% mimic)')
commit=git('rev-parse','HEAD').decode().strip();save(OUT/'pending.json',{'commit':commit,'parent':remote_before,'revision':REVISION})
current=git('ls-remote','origin','refs/heads/main').decode().split()[0]
assert current in [remote_before,commit],'Remote main changed; refusing push'
say(pushingCommit=commit)
git('push','origin','HEAD:main',timeout=900)
assert git('ls-remote','origin','refs/heads/main').decode().split()[0]==commit
report={'published':True,'repository':REMOTE.removesuffix('.git'),'branch':'main','commit':commit,'revision':REVISION,'files':len(files),'changedPaths':[p.decode('utf-8') for p in changed if p],'distributionSha256':manifest['files']['distribution.js']['sha256'],'coreSha256':audit['artifacts']['coreSha256'],'certificateVerification':True,'forcePush':False,'credentialsExported':False,'deploymentVerified':False}
save(OUT/'publish.json',report);say(**report)
