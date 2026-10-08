"""Publish ONLY the verified game distribution through GitHub's official API.
Git HTTPS can be unavailable while api.github.com remains reachable. Credentials are
obtained from the local Credential Manager, kept in memory and never logged/saved.
No force-push, private workspace export, certificate bypass or third-party proxy.
"""
from __future__ import annotations
import argparse, base64, concurrent.futures, hashlib, json, os, pathlib, re, subprocess, threading, time, urllib.error, urllib.request
PROJECT=pathlib.Path(__file__).resolve().parents[2]
REPO=PROJECT/'22-发布/booksea-github'
EVIDENCE=PROJECT/'09-实现/verification/release-20260922'
API='https://api.github.com'
TARGET='/repos/Adirm007/Protelysion'
CACHE=EVIDENCE/'github-upload-state.json'
RESULT=EVIDENCE/'github-publish.json'
parser=argparse.ArgumentParser();parser.add_argument('--publish',action='store_true');parser.add_argument('--status',action='store_true');args=parser.parse_args()

def sha256(data):return hashlib.sha256(data).hexdigest()
def gitsha(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def save(file,data):
    file.parent.mkdir(parents=True,exist_ok=True);part=file.with_name(file.name+'.part');part.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');part.replace(file)
def say(**data):print(json.dumps(data,ensure_ascii=False),flush=True)
class ApiError(Exception):
    def __init__(self,status,message):self.status=status;super().__init__('GitHub HTTP '+str(status)+': '+message)

def credential():
    proc=subprocess.run(['git','credential-manager','get'],input='protocol=https\nhost=github.com\nusername=Adirm007\n\n',text=True,capture_output=True,timeout=30,env=dict(os.environ,GCM_INTERACTIVE='never',GIT_TERMINAL_PROMPT='0'))
    fields=dict(s.split('=',1) for s in proc.stdout.splitlines() if '=' in s)
    if proc.returncode or not fields.get('password'):raise RuntimeError('No usable local GitHub credential. Sign in locally; do not paste a token in chat.')
    return fields['password']
TOKEN=credential()
rate_lock=threading.Lock();last_mutation=0.0

def api(method,route,payload=None):
    global last_mutation
    assert route=='/user' or route.startswith(TARGET+'/') or route==TARGET
    encoded=json.dumps(payload,ensure_ascii=False).encode() if payload is not None else None
    for attempt in range(4):
        if method!='GET':
            # Stay below GitHub's general 80 content-creating requests/minute threshold.
            with rate_lock:
                delay=1.02-(time.monotonic()-last_mutation)
                if delay>0:time.sleep(delay)
                last_mutation=time.monotonic()
        req=urllib.request.Request(API+route,data=encoded,method=method,headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Protelysion-Release','Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req,timeout=180) as response:
                body=response.read();return json.loads(body) if body else {}
        except urllib.error.HTTPError as exc:
            body=exc.read()
            try:message=json.loads(body).get('message','Request rejected')
            except Exception:message='Request rejected'
            if attempt<3 and (exc.code in [429,500,502,503,504] or (exc.code==403 and 'rate limit' in message.lower())):
                wait=int(exc.headers.get('Retry-After','65'));wait=max(5,min(wait,180));say(retryStatus=exc.code,waitSeconds=wait);time.sleep(wait);continue
            raise ApiError(exc.code,message) from None
        except (urllib.error.URLError,TimeoutError) as exc:
            if attempt<3:time.sleep(3*(attempt+1));continue
            raise RuntimeError('Verified TLS API connection failed; credentials were not logged') from None
    raise RuntimeError('API retries exhausted')

def status():
    repo=api('GET',TARGET)
    try:pages=api('GET',TARGET+'/pages')
    except ApiError as exc:pages={'status':exc.status}
    runs=api('GET',TARGET+'/actions/runs?per_page=3').get('workflow_runs',[])
    return {'repository':repo['html_url'],'sizeKiB':repo['size'],'pages':{k:pages.get(k) for k in ['html_url','status','build_type']},'runs':[{'id':r['id'],'headSha':r['head_sha'],'status':r['status'],'conclusion':r['conclusion'],'htmlUrl':r['html_url']}for r in runs]}

def verify():
    m=json.loads((REPO/'site/release-manifest.json').read_text(encoding='utf-8'))
    assert m['scope']=={'themes':48,'species':432,'tierTemplates':3024}
    assert m['player']['author']=='Pipoya'
    browser=json.loads((PROJECT/'09-实现/verification/release-audit-20260922/release-browser.json').read_text(encoding='utf-8'))
    assert browser['passed'] and browser['publicDistributionBundleSha256']==m['files']['distribution.js']['sha256'],'Browser acceptance must match the exact release bundle'
    assert browser['pck']==m['pck'] and browser['warm']['networkRequests']==0,'PCK/cache acceptance is missing'
    packed=json.loads((PROJECT/'16-Godot可玩区域/verification/release-pack-audit.json').read_text(encoding='utf-8'))
    assert packed['passed'] and packed['portraits']==432 and packed['licensedHeroine'] and packed['neutralWalkerExcluded']
    files={'site/'+k:v for k,v in m['files'].items()}
    for name in ['site/release-manifest.json','README.md','NOTICE.md','LICENSE','.gitignore','.gitattributes','.github/workflows/pages.yml','tools/materialize.py','install/读者对话渲染0917 (new).json','install/读者核心本体 (new).txt','install/普罗泰利西翁-书海外链加载正则.json']:
        data=(REPO/name).read_bytes();files[name]={'bytes':len(data),'sha256':sha256(data)}
    actual={p.relative_to(REPO).as_posix()for p in REPO.rglob('*')if p.is_file() and '.git' not in p.relative_to(REPO).parts}
    assert actual==set(files),'Non-allowlisted/missing release paths: '+str(sorted(actual.symmetric_difference(files)))
    secret=re.compile(rb'(?:gh[pousr]_[A-Za-z0-9_]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{35,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
    for name,spec in files.items():
        data=(REPO/name).read_bytes()
        assert len(data)==spec['bytes'] and sha256(data)==spec['sha256'],'Stale release: '+name
        assert len(data)<100*1024*1024,'GitHub file-size limit: '+name
        if pathlib.Path(name).suffix.lower() in ['.js','.json','.html','.txt','.md','.yml']:
            assert not secret.search(data),'Potential credential in '+name+'; upload blocked (content not printed)'
    return m,files

user=api('GET','/user');repo=api('GET',TARGET)
if user.get('login','').lower()!='adirm007' or not repo.get('permissions',{}).get('push'):raise RuntimeError('The local account is not Adirm007 with push permission')
say(authenticatedLogin=user['login'],canPush=True,credentialsPersisted=False,certificateVerification=True)
if args.status:
    report=status();save(EVIDENCE/'github-deployment-status.json',report);say(**report);raise SystemExit(0)
m,files=verify();say(verifiedFiles=len(files),bytes=sum(v['bytes']for v in files.values()),revision=m['revision'])
if not args.publish:
    say(ready=True,published=False);raise SystemExit(0)

# A tree/ref is never replaced blindly. Existing non-game projects require review.
try:
    reference=api('GET',TARGET+'/git/ref/heads/main');old_sha=reference['object']['sha'];parent=api('GET',TARGET+'/git/commits/'+old_sha)
    old_tree=api('GET',TARGET+'/git/trees/'+parent['tree']['sha']+'?recursive=1')
    if old_tree.get('truncated'):raise RuntimeError('Existing repository tree is truncated; refusing write')
    existing=[i for i in old_tree['tree'] if i['type']=='blob']
    if existing:
        if len(existing)==1 and existing[0]['path']=='README.md' and parent.get('message')=='Initialize Protelysion game release':
            # Resume our interrupted initialization, not an unrelated repository.
            previous=api('GET',TARGET+'/contents/README.md');initial=base64.b64decode(previous['content']).decode()
            if not initial.startswith('# 普罗泰利西翁（Protelysion）·《书海》迷宫'):raise RuntimeError('Unrecognized initial README')
            existing=[]
        elif 'site/release-manifest.json' not in {i['path']for i in existing}:raise RuntimeError('Repository is no longer empty and is not a known game release; review before publishing')
        if existing:
            known=api('GET',TARGET+'/contents/site/release-manifest.json')
            old_manifest=json.loads(base64.b64decode(known['content']))
            if not str(old_manifest.get('revision','')).startswith('protelysion-'):raise RuntimeError('Unrecognized existing game release')
except ApiError as exc:
    if exc.status not in [404,409]:raise
    author={'name':'Adirm007','email':str(user['id'])+'+Adirm007@users.noreply.github.com'}
    api('PUT',TARGET+'/contents/README.md',{'message':'Initialize Protelysion game release','content':base64.b64encode((REPO/'README.md').read_bytes()).decode(),'branch':'main','committer':author,'author':author})
    reference=api('GET',TARGET+'/git/ref/heads/main');old_sha=reference['object']['sha'];parent=api('GET',TARGET+'/git/commits/'+old_sha);existing=[]
try:
    pages=api('GET',TARGET+'/pages')
    if pages.get('build_type')!='workflow':api('PUT',TARGET+'/pages',{'build_type':'workflow'})
except ApiError as exc:
    if exc.status!=404:raise
    api('POST',TARGET+'/pages',{'build_type':'workflow'})
try:state=json.loads(CACHE.read_text(encoding='utf-8'))
except FileNotFoundError:state={'repository':'Adirm007/Protelysion','blobs':{}}
if state.get('repository')!='Adirm007/Protelysion':raise RuntimeError('Upload resume record targets another repository')
lock=threading.Lock();completed=0

def upload(item):
    global completed
    name,spec=item;data=(REPO/name).read_bytes();assert sha256(data)==spec['sha256'],'Release changed while uploading: '+name
    sha=gitsha(data);key=spec['sha256']
    with lock:cached=state['blobs'].get(key)
    if cached!=sha:
        try:response=api('POST',TARGET+'/git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'})
        except ApiError as exc:
            say(uploadFailed=name,bytes=len(data),status=exc.status);raise
        if response.get('sha')!=sha:raise RuntimeError('GitHub blob hash mismatch: '+name)
        with lock:
            state['blobs'][key]=sha;save(CACHE,state)
    with lock:
        completed+=1
        if completed%10==0 or completed==len(files):say(uploadedFiles=completed,totalFiles=len(files),name=name)
    return {'path':name,'mode':'100644','type':'blob','sha':sha}

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:tree=list(pool.map(upload,files.items()))
# Keep unknown existing files. Delete only obsolete files explicitly owned by the prior game manifest.
if existing:
    old_paths={'site/'+n for n in old_manifest['files']}|{'site/release-manifest.json'}
    for entry in existing:
        if entry['path'] in old_paths and entry['path'] not in files:tree.append({'path':entry['path'],'mode':'100644','type':'blob','sha':None})
# Build directory trees bottom-up: bounded API bodies, and preserve unknown files via base_tree.
base_trees={'':parent['tree']['sha']}
for entry in old_tree.get('tree',[]) if 'old_tree' in globals() else []:
    if entry['type']=='tree':base_trees[entry['path']]=entry['sha']
def create_directory_tree(prefix,items):
    direct=[];groups={}
    for entry in items:
        head,separator,rest=entry['path'].partition('/')
        if separator:groups.setdefault(head,[]).append(dict(entry,path=rest))
        else:direct.append(entry)
    for name,children in groups.items():
        sub=prefix+'/'+name if prefix else name
        result=create_directory_tree(sub,children)
        direct.append({'path':name,'mode':'040000','type':'tree','sha':result['sha']})
    payload={'tree':direct}
    if prefix in base_trees:payload['base_tree']=base_trees[prefix]
    say(creatingTree=prefix or '/',entries=len(direct))
    return api('POST',TARGET+'/git/trees',payload)
created=create_directory_tree('',tree)
author={'name':'Adirm007','email':str(user['id'])+'+Adirm007@users.noreply.github.com'}
commit=api('POST',TARGET+'/git/commits',{'message':'Release Protelysion 0.20.0: 48 themes, licensed heroine, reader handoff and verified persistent cache','tree':created['sha'],'parents':[old_sha],'author':author,'committer':author})
current=api('GET',TARGET+'/git/ref/heads/main')['object']['sha']
if current!=old_sha:raise RuntimeError('Remote main changed during upload; no force push was attempted. Uploaded blobs can be reused.')
api('PATCH',TARGET+'/git/refs/heads/main',{'sha':commit['sha'],'force':False})
remote=api('GET',TARGET+'/git/ref/heads/main')['object']['sha'];assert remote==commit['sha']
report={'published':True,'repository':'https://github.com/Adirm007/Protelysion','branch':'main','commit':remote,'files':len(files),'bytes':sum(v['bytes']for v in files.values()),'revision':m['revision'],'pagesConfigured':True,'deploymentVerified':False,'credentialsPersisted':False,'publicDistributionBundleSha256':m['files']['distribution.js']['sha256'],'pck':m['pck'],'time':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
save(RESULT,report);say(**report)
