#!/usr/bin/env python3
"""Fetch raw GitHub TUF metadata for offline verification by the release verifier.

This downloader is deliberately not a trust decision. The verifier must validate
the root rotation signatures, current metadata signatures/expiry, target version,
and target length/digests against the bundled github-tuf-root.json bootstrap.
No author-provided key or unsigned trusted_root.json is accepted by the client.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

BASE = 'https://tuf-repo.github.com/'
SEED = Path(__file__).with_name('github-tuf-root.json')
MAX_METADATA_BYTES = 4_000_000
MAX_ROOT_ROTATIONS = 64


def download(path, missing=False):
    request = urllib.request.Request(BASE + path, headers={
        'User-Agent': 'fixed-release-trust-mirror', 'Accept': 'application/json',
        'Cache-Control': 'no-cache',
    })
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if int(response.headers.get('Content-Length', '0')) > MAX_METADATA_BYTES:
                raise ValueError('GitHub TUF metadata exceeds the size limit')
            data = response.read(MAX_METADATA_BYTES + 1)
    except urllib.error.HTTPError as error:
        if missing and error.code == 404:
            return None
        raise ValueError(f'GitHub TUF download failed for {path}: HTTP {error.code}') from None
    if len(data) > MAX_METADATA_BYTES:
        raise ValueError('GitHub TUF metadata exceeds the size limit')
    return data


def signed(data, kind):
    value = json.loads(data)
    body = value.get('signed')
    if not isinstance(body, dict) or body.get('_type') != kind or not isinstance(value.get('signatures'), list):
        raise ValueError('Invalid GitHub TUF ' + kind + ' metadata')
    return body


def version(value):
    if type(value) is not int or not 1 <= value < 2 ** 53:
        raise ValueError('Invalid GitHub TUF metadata version')
    return value


def fetch_trust():
    seed = signed(SEED.read_bytes(), 'root')
    root_version = version(seed.get('version'))
    final_root = seed
    rotations = []
    for number in range(root_version + 1, root_version + MAX_ROOT_ROTATIONS + 2):
        raw = download(f'{number}.root.json', missing=True)
        if raw is None:
            break
        if len(rotations) == MAX_ROOT_ROTATIONS:
            raise ValueError('Too many GitHub TUF root rotations; update the bundled bootstrap explicitly')
        final_root = signed(raw, 'root')
        if final_root.get('version') != number:
            raise ValueError('Unexpected GitHub TUF root version')
        rotations.append(raw)
    timestamp = download('timestamp.json')
    stamp = signed(timestamp, 'timestamp')
    snapshot_version = version(stamp.get('meta', {}).get('snapshot.json', {}).get('version'))
    consistent = final_root.get('consistent_snapshot') is True
    snapshot = download((str(snapshot_version) + '.' if consistent else '') + 'snapshot.json')
    snap = signed(snapshot, 'snapshot')
    targets_version = version(snap.get('meta', {}).get('targets.json', {}).get('version'))
    targets = download((str(targets_version) + '.' if consistent else '') + 'targets.json')
    target_metadata = signed(targets, 'targets')
    spec = target_metadata.get('targets', {}).get('trusted_root.json')
    if not isinstance(spec, dict) or type(spec.get('length')) is not int or not 0 < spec['length'] <= MAX_METADATA_BYTES:
        raise ValueError('GitHub TUF trusted_root.json target is missing or too large')
    digest = spec.get('hashes', {}).get('sha256')
    if not isinstance(digest, str) or not re.fullmatch(r'[a-f0-9]{64}', digest):
        raise ValueError('GitHub TUF trusted_root.json target has no SHA-256 digest')
    trusted_root = download('targets/' + (digest + '.' if consistent else '') + 'trusted_root.json')
    if len(trusted_root) != spec['length'] or hashlib.sha256(trusted_root).hexdigest() != digest:
        raise ValueError('GitHub TUF trusted_root.json download does not match the target metadata')
    encode = lambda data: base64.b64encode(data).decode('ascii')
    return {
        'schema': 1,
        'roots': [encode(raw) for raw in rotations],
        'timestamp': encode(timestamp),
        'snapshot': encode(snapshot),
        'targets': encode(targets),
        'trustedRoot': encode(trusted_root),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        result = (json.dumps(fetch_trust(), sort_keys=True, separators=(',', ':')) + '\n').encode()
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_bytes(result)
        else:
            sys.stdout.buffer.write(result)
    except (ValueError, OSError, urllib.error.URLError) as error:
        parser.exit(1, 'Trust metadata download failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
