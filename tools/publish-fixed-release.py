"""Explicit publisher: no remote writes occur without --publish.

C contains the runtime/root manifest; D adds the regex that pins C. Only a new tag for D is pushed.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'Adirm007/Protelysion'
ASSET = 'protelysion-fixed.regex.json'


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()


def api(method, route, token, payload=None, content_type='application/json'):
    data = json.dumps(payload).encode() if isinstance(payload, dict) else payload
    url = route if route.startswith('https://uploads.github.com/') else 'https://api.github.com/' + route
    request = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Protelysion-fixed-publisher', 'Content-Type': content_type,
    })
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'GitHub {method} request failed: HTTP {error.code}; no existing release is overwritten') from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', required=True)
    parser.add_argument('--publish', action='store_true', help='Perform new-tag/draft/publish remote writes')
    args = parser.parse_args()
    if not re.fullmatch(r'\d{1,8}(?:\.\d{1,8}){1,5}', args.version):
        parser.error('version must contain only dotted numeric components')
    output = ROOT / 'artifacts/fixed-release'
    report = json.loads((output / 'fixed-release.json').read_text(encoding='utf-8'))
    artifact = (output / ASSET).read_bytes()
    source = git('rev-parse', 'HEAD')
    expected = {'schema': 1, 'repository': REPOSITORY, 'version': args.version, 'sourceCommit': source}
    if any(report.get(key) != value for key, value in expected.items()):
        raise RuntimeError('Build report does not describe this source commit/version')
    if len(artifact) != report['bytes'] or hashlib.sha256(artifact).hexdigest() != report['sha256']:
        raise RuntimeError('Fixed regex no longer matches the reviewed build report')
    regex = json.loads(artifact)
    markers = re.findall(r'<!-- FIXED_RELEASE:(\{[^\r\n]*?\}) -->', regex.get('replaceString', ''))
    if len(markers) != 1:
        raise RuntimeError('Fixed regex marker missing or duplicated')
    marker = json.loads(markers[0])
    if any(marker.get(key) != value for key, value in expected.items()) or marker.get('manifestSha256') != report['manifestSha256']:
        raise RuntimeError('Fixed regex root does not match the source commit report')
    root_manifest = subprocess.check_output(['git', '-C', str(ROOT), 'show', source + ':site/release-manifest.json'])
    if hashlib.sha256(root_manifest).hexdigest() != report['manifestSha256']:
        raise RuntimeError('Root manifest hash is not the source commit hash')
    tag = 'v' + args.version
    print(json.dumps({'sourceCommitC': source, 'newDistributionTag': tag, 'artifactSha256': report['sha256'], 'publish': args.publish}, indent=2))
    if not args.publish:
        return
    token = os.environ.get('GH_TOKEN', '')
    if not token:
        raise RuntimeError('Set FIXED_RELEASE_TOKEN with Contents write and Administration read; repository immutable releases must already be enabled')
    state = api('GET', f'repos/{REPOSITORY}/immutable-releases', token)
    if state.get('enabled') is not True:
        raise RuntimeError('Repository immutable releases are disabled. Enable them in GitHub settings before publishing')
    if git('status', '--porcelain'):
        raise RuntimeError('Source worktree must be clean before creating the separate distribution commit')
    result = subprocess.run(['git', '-C', str(ROOT), 'ls-remote', '--exit-code', '--tags', 'origin', 'refs/tags/' + tag], capture_output=True, text=True)
    if result.returncode != 2:
        raise RuntimeError('Tag already exists, or remote tag absence could not be confirmed; refusing to overwrite')
    # The token is passed via the child process environment and askpass, never a command-line URL or log.
    askpass = output / 'git-askpass.sh'
    askpass.write_text('#!/bin/sh\ncase "$1" in *Username*) printf "%s\\n" x-access-token;; *) printf "%s\\n" "$GH_TOKEN";; esac\n', encoding='utf-8')
    askpass.chmod(0o700)
    env = os.environ.copy()
    env.update({'GIT_ASKPASS': str(askpass), 'GIT_TERMINAL_PROMPT': '0'})
    git('checkout', '--detach', source)
    target = ROOT / 'install' / ASSET
    target.write_bytes(artifact)
    git('add', '--', 'install/' + ASSET)
    git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-m', 'Distribute fixed regex ' + tag)
    distribution_commit = git('rev-parse', 'HEAD')
    git('tag', tag)
    subprocess.run(['git', '-C', str(ROOT), 'push', 'origin', 'refs/tags/' + tag], env=env, check=True)
    body = f'固定版 {args.version}。源码提交：{source}；分发提交：{distribution_commit}。\n\n默认不会追随 main。根清单 SHA-256：{report["manifestSha256"]}。\n\n附件 SHA-256：{report["sha256"]}。'
    release = api('POST', f'repos/{REPOSITORY}/releases', token, {'tag_name': tag, 'target_commitish': distribution_commit, 'name': '固定版 ' + tag, 'body': body, 'draft': True, 'prerelease': False})
    upload_url = release['upload_url'].split('{', 1)[0] + '?name=' + urllib.parse.quote(ASSET)
    asset = api('POST', upload_url, token, artifact, 'application/json')
    if asset.get('digest') != 'sha256:' + report['sha256'] or asset.get('size') != len(artifact):
        raise RuntimeError('GitHub uploaded asset digest differs; the draft is left unpublished for inspection')
    published = api('PATCH', f'repos/{REPOSITORY}/releases/{release["id"]}', token, {'draft': False})
    confirmed = api('GET', f'repos/{REPOSITORY}/releases/{release["id"]}', token)
    if confirmed.get('immutable') is not True:
        raise RuntimeError('GitHub did not confirm release immutability; do not distribute this release until its status is verified')
    print('Published immutable fixed release: ' + published['html_url'])
    # The signed proof exists only after publication; a failed catalog push can be retried separately.
    from publish_update_catalog import fetch_proof, publish_catalog
    bundle, _ = fetch_proof(REPOSITORY, args.version, token)
    publish_catalog(REPOSITORY, {args.version: bundle})


if __name__ == '__main__':
    main()
