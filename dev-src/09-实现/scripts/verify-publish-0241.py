"""Confirm the pushed commit's Pages workflow and byte-exact public artifacts.
GitHub credential is read only into memory. No credential is sent to Pages or raw URLs.
"""
import hashlib,json,os,pathlib,re,subprocess,time,urllib.request,urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'09-实现/verification/exit-0241/publication'
proof=json.loads((OUT/'publish.json').read_text(encoding='utf8'))
assert proof['published'] and re.fullmatch('[0-9a-f]{40}',proof['commit'])
commit=proof['commit'];target='/repos/Adirm007/Protelysion';base='https://adirm007.github.io/Protelysion/'
p=subprocess.run(['git','credential-manager','get'],input='protocol=https\nhost=github.com\nusername=Adirm007\n\n',text=True,capture_output=True,timeout=30,env=dict(os.environ,GCM_INTERACTIVE='never',GIT_TERMINAL_PROMPT='0'))
fields=dict(line.split('=',1) for line in p.stdout.splitlines() if '=' in line)
if p.returncode or not fields.get('password'):raise RuntimeError('GitHub status credential unavailable; no token was logged')
token=fields['password']
def say(**v):print(json.dumps(v,ensure_ascii=False),flush=True)
def api(route):
    assert route.startswith(target+'/')
    req=urllib.request.Request('https://api.github.com'+route,headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Booksea-Verified-Release','Authorization':'Bearer '+token})
    with urllib.request.urlopen(req,timeout=40) as r:return json.loads(r.read())
def public(url):
    req=urllib.request.Request(url,headers={'Cache-Control':'no-cache','User-Agent':'Booksea-Verified-Release'})
    with urllib.request.urlopen(req,timeout=60) as r:return r.read()
def sha(b):return hashlib.sha256(b).hexdigest()
start=time.monotonic();last=None;result=None
while time.monotonic()-start<360:
    rows=api(target+'/actions/runs?branch=main&per_page=6')['workflow_runs']
    matches=[r for r in rows if r['head_sha']==commit and r.get('path','').split('@')[0]=='.github/workflows/pages.yml']
    run=matches[0] if matches else None
    state=(run.get('status'),run.get('conclusion')) if run else ('awaiting_workflow',None)
    if state!=last:say(commit=commit,workflowStatus=state[0],conclusion=state[1]);last=state
    if run and run['status']=='completed':
        if run['conclusion']!='success':raise RuntimeError('Pages workflow did not succeed: '+str(run['conclusion']))
        try:
            raw=public(base+'release-manifest.json?verify='+commit);manifest=json.loads(raw)
            if manifest['revision']==proof['revision'] and manifest['files']['distribution.js']['sha256']==proof['distributionSha256']:
                bundle=public(base+'distribution.js?verify='+commit);assert sha(bundle)==proof['distributionSha256'],'Public game bytes differ'
                core_url='https://raw.githubusercontent.com/Adirm007/Protelysion/'+commit+'/install/'+urllib.parse.quote('读者核心本体 (new).txt')
                assert sha(public(core_url))==proof['coreSha256'],'Published reader core differs'
                result={**proof,'deploymentVerified':True,'pagesUrl':base,'workflowUrl':run['html_url'],'workflowId':run['id'],'publicRevision':manifest['revision'],'publicDistributionHashMatches':True,'publishedCoreHashMatches':True,'coreDownloadUrl':core_url}
                break
        except (urllib.error.URLError,TimeoutError):pass
    time.sleep(10)
if result is None:
    result={**proof,'deploymentVerified':False,'pagesUrl':base,'reason':'Push succeeded; Pages confirmation exceeded bounded wait'}
(OUT/'deployment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');say(**result)
if not result['deploymentVerified']:raise SystemExit(2)
