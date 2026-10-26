#!/usr/bin/env python3
"""Mirror GitHub-signed immutable release bundles on a JSON-only branch.

No release/tag is changed. Without --publish, only fetch and verify the proof.
Run again after an interrupted catalog push; never republish the release itself.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = {
    'Adirm007/reader': ('reader-fixed.regex.json', 'regex/reader-fixed.regex.json'),
    'Adirm007/Protelysion': ('protelysion-fixed.regex.json', 'install/protelysion-fixed.regex.json'),
}
BRANCH = 'fixed-updates'


def git(*args, data=None, env=None, check=True):
    env = (env or os.environ).copy()
    env.setdefault('GIT_TERMINAL_PROMPT', '0')
    env.setdefault('GCM_INTERACTIVE', 'Never')
    token = env.get('GH_TOKEN') or env.get('GITHUB_TOKEN')
    options = []
    if token:
        env['GH_TOKEN'] = token
        # The shell sees a constant program; credentials travel only through its environment.
        options = ['-c', 'credential.helper=', '-c',
                   'credential.helper=!f() { printf "%s\\n" username=x-access-token "password=$GH_TOKEN"; }; f']
    return subprocess.run(['git', '-C', str(ROOT), *options, *args], input=data, capture_output=True,
                          env=env, check=check)


def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()


def credential():
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if token:
        return token
    result = git('credential', 'fill', data=b'protocol=https\nhost=github.com\n\n')
    values = dict(line.split('=', 1) for line in result.stdout.decode().splitlines() if '=' in line)
    if not values.get('password'):
        raise ValueError('Publishing requires GitHub credentials; no token is included in the client')
    return values['password']


def api(path, token):
    request = urllib.request.Request('https://api.github.com/' + path, headers={
        'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
        'User-Agent': 'fixed-update-catalog-publisher', 'X-GitHub-Api-Version': '2022-11-28'})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise ValueError(f'GitHub proof request failed: HTTP {error.code}') from None


def current_trust():
    result = subprocess.run(['python', str(ROOT / 'tools/release-verifier/fetch_trust.py')],
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def verify(bundle, repository, version, trust):
    request = {'bundle': bundle, 'repository': repository, 'version': version, 'trust': trust}
    result = subprocess.run(['node', str(ROOT / 'tools/release-verifier/verify.mjs')],
                            input=json.dumps(request), text=True, capture_output=True, check=True)
    verified = json.loads(result.stdout)
    if verified.get('ok') is not True:
        raise ValueError('GitHub release proof verification failed: ' + str(verified.get('error', 'unknown error')))
    return verified


def fetch_proof(repository, version, token, trust=None):
    if repository not in PROJECTS or not re.fullmatch(r'\d{1,8}(?:\.\d{1,8}){1,5}', version):
        raise ValueError('Unsupported repository or numeric version')
    asset_name, asset_path = PROJECTS[repository]
    trust = trust or current_trust()
    tag = 'v' + version
    release = api(f'repos/{repository}/releases/tags/{tag}', token)
    if release.get('immutable') is not True or release.get('draft') or release.get('prerelease'):
        raise ValueError('Only immutable, published, stable releases enter the update catalog')
    ref = api(f'repos/{repository}/git/ref/tags/{tag}', token)['object']
    if ref.get('type') != 'commit':
        raise ValueError('Use a lightweight release tag pointing directly to distribution commit D')
    digest = ref['sha']
    # GitHub creates the proof after publication. A brief delay is normal; never fall back to an unsigned entry.
    for attempt in range(6):
        response = api(f'repos/{repository}/attestations/sha1:{digest}?predicate_type=release&per_page=100', token)
        candidates = []
        for item in response.get('attestations', []):
            if item.get('initiator') != 'github' or not isinstance(item.get('bundle'), dict):
                continue
            try:
                verified = verify(item['bundle'], repository, version, trust)
                if verified['distributionCommit'] == digest:
                    candidates.append((item['bundle'], verified))
            except (ValueError, subprocess.CalledProcessError):
                continue
        if candidates:
            break
        if attempt < 5:
            time.sleep(5)
    if len(candidates) != 1:
        raise ValueError('Exactly one valid GitHub release attestation is required; release remains published, rerun this catalog command later')
    bundle, verified = candidates[0]
    assets = [asset for asset in release.get('assets', []) if asset.get('name') == asset_name]
    if len(assets) != 1 or assets[0].get('digest') != 'sha256:' + verified['digest']:
        raise ValueError('Signed proof and release attachment digest differ')
    request = urllib.request.Request(f'https://raw.githubusercontent.com/{repository}/{digest}/{asset_path}',
                                     headers={'User-Agent': 'fixed-update-catalog-publisher'})
    with urllib.request.urlopen(request, timeout=60) as response:
        artifact = response.read(4000001)
    if len(artifact) > 4000000 or hashlib.sha256(artifact).hexdigest() != verified['digest']:
        raise ValueError('Distribution commit does not contain the signed regex bytes')
    return bundle, verified


def publish_catalog(repository, proofs, trust=None):
    trust = trust or current_trust()
    result = subprocess.run(['node', str(ROOT / 'tools/release-verifier/verify.mjs')],
                            input=json.dumps({'trustOnly': True, 'trust': trust}),
                            text=True, capture_output=True, check=True)
    if json.loads(result.stdout).get('ok') is not True:
        raise ValueError('GitHub TUF trust verification failed; static catalog is unchanged')
    origin = git('remote', 'get-url', 'origin').stdout.decode().strip()
    if origin not in {f'https://github.com/{repository}.git', f'https://github.com/{repository}',
                      f'git@github.com:{repository}.git'}:
        raise ValueError('origin does not match the selected repository')
    remote = git('ls-remote', '--heads', 'origin', 'refs/heads/' + BRANCH).stdout.decode().split()
    parent = None
    index = {'schema': 1, 'repository': repository, 'versions': []}
    if remote:
        git('fetch', '--no-tags', 'origin', 'refs/heads/' + BRANCH)
        parent = git('rev-parse', 'FETCH_HEAD').stdout.decode().strip()
        index = json.loads(git('show', parent + ':index.json').stdout)
        if index.get('schema') != 1 or index.get('repository') != repository or not isinstance(index.get('versions'), list):
            raise ValueError('Existing static catalog format is invalid')
    with tempfile.TemporaryDirectory(prefix='fixed-update-index-') as directory:
        env = os.environ.copy()
        env['GIT_INDEX_FILE'] = str(Path(directory) / 'index')
        git('read-tree', parent or '--empty', env=env)
        for version, bundle in proofs.items():
            path = f'releases/v{version}.json'
            data = canonical(bundle)
            previous = git('show', parent + ':' + path, check=False) if parent else None
            if previous and previous.returncode == 0:
                if json.loads(previous.stdout) != bundle:
                    raise ValueError('Refusing to replace an already mirrored proof: ' + version)
            else:
                object_id = git('hash-object', '-w', '--stdin', data=data).stdout.decode().strip()
                git('update-index', '--add', '--cacheinfo', f'100644,{object_id},{path}', env=env)
            if version not in index['versions']:
                index['versions'].append(version)
        object_id = git('hash-object', '-w', '--stdin', data=canonical(trust)).stdout.decode().strip()
        git('update-index', '--add', '--cacheinfo', f'100644,{object_id},trust.json', env=env)
        index['versions'].sort(key=lambda value: tuple(map(int, value.split('.'))))
        object_id = git('hash-object', '-w', '--stdin', data=canonical(index)).stdout.decode().strip()
        git('update-index', '--add', '--cacheinfo', f'100644,{object_id},index.json', env=env)
        tree = git('write-tree', env=env).stdout.decode().strip()
        if parent and tree == git('rev-parse', parent + '^{tree}').stdout.decode().strip():
            return parent
        args = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
                'commit-tree', tree]
        if parent:
            args += ['-p', parent]
        commit = git(*args, data=b'Update verified fixed release catalog\n').stdout.decode().strip()
        # Non-force push makes concurrent publishers fail safely. Rerun to merge the index after a conflict.
        result = git('push', 'origin', commit + ':refs/heads/' + BRANCH, check=False)
        if result.returncode:
            raise ValueError('Static catalog push failed; rerun this command to merge concurrent updates')
        return commit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repository', choices=PROJECTS)
    parser.add_argument('versions', nargs='*')
    parser.add_argument('--refresh-trust', action='store_true', help='Refresh only the signed GitHub TUF mirror; no release API request')
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    if not args.versions and not args.refresh_trust:
        parser.error('Specify a release version or --refresh-trust')
    token = credential() if args.versions else None
    trust = current_trust()
    proofs = {}
    for version in args.versions:
        bundle, verified = fetch_proof(args.repository, version, token, trust)
        proofs[version] = bundle
        print(json.dumps(verified, ensure_ascii=False))
    if args.publish:
        print('Catalog commit: ' + publish_catalog(args.repository, proofs, trust))


if __name__ == '__main__':
    main()
