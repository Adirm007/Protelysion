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
import http.client
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

BASE = 'https://tuf-repo.github.com/'
SEED = Path(__file__).with_name('github-tuf-root.json')
MAX_METADATA_BYTES = 4_000_000
MAX_ROOT_ROTATIONS = 64
REQUEST_TIMEOUT = 12
DOWNLOAD_ATTEMPTS = 3
CACHE = Path(tempfile.gettempdir()) / 'github-tuf-fixed-releases-cache-v1'


class DownloadUnavailable(ValueError):
    """A transient transport failure, eligible for a currently valid cache."""


def immutable_path(path):
    # A mutable timestamp is always fetched. The complete returned envelope is
    # still verified by the caller, including signatures, versions and expiry.
    return re.fullmatch(r'(?:\d+\.(?:root|snapshot|targets)\.json|'
                        r'targets/[a-f0-9]{64}\.trusted_root\.json)', path) is not None


def cache_file(path):
    return CACHE / (hashlib.sha256((BASE + path).encode()).hexdigest() + '.json')


def cached_download(path):
    if not immutable_path(path):
        return None
    try:
        data = cache_file(path).read_bytes()
        if len(data) > MAX_METADATA_BYTES or not isinstance(json.loads(data), dict):
            return None
        return data
    except (OSError, ValueError):
        return None


def cache_download(path, data):
    if not immutable_path(path):
        return
    temporary = None
    try:
        if not isinstance(json.loads(data), dict):
            return
        CACHE.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=CACHE, delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(data)
        os.replace(temporary, cache_file(path))
    except (OSError, ValueError):
        # Caching is optional; verification never depends on a cache write.
        pass
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass


def download(path, missing=False):
    cached = cached_download(path)
    if cached is not None:
        return cached
    request = urllib.request.Request(BASE + path, headers={
        'User-Agent': 'fixed-release-trust-mirror', 'Accept': 'application/json',
        'Cache-Control': 'no-cache',
    })
    for attempt in range(DOWNLOAD_ATTEMPTS):
        delay = attempt + 1
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                if int(response.headers.get('Content-Length', '0')) > MAX_METADATA_BYTES:
                    raise ValueError('GitHub TUF metadata exceeds the size limit')
                data = response.read(MAX_METADATA_BYTES + 1)
            if len(data) > MAX_METADATA_BYTES:
                raise ValueError('GitHub TUF metadata exceeds the size limit')
            cache_download(path, data)
            return data
        except urllib.error.HTTPError as error:
            if missing and error.code == 404:
                return None
            if error.code not in (408, 429) and not 500 <= error.code <= 599:
                raise ValueError(f'GitHub TUF download failed for {path}: HTTP {error.code}') from None
            reason = f'HTTP {error.code}'
            retry_after = error.headers.get('Retry-After', '')
            if retry_after.isdigit():
                delay = min(5, max(delay, int(retry_after)))
        except (OSError, urllib.error.URLError, http.client.HTTPException) as error:
            reason = f'{type(error).__name__}: {error}'
        if attempt + 1 == DOWNLOAD_ATTEMPTS:
            raise DownloadUnavailable(f'GitHub TUF download failed for {path} after '
                                      f'{DOWNLOAD_ATTEMPTS} attempts: {reason}') from None
        print(f'GitHub TUF {path}: {reason}; retry {attempt + 2}/'
              f'{DOWNLOAD_ATTEMPTS} in {delay}s', file=sys.stderr, flush=True)
        time.sleep(delay)


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


def verify_trust(candidate):
    """Use the pinned native verifier's actual clock; never override expiry."""
    try:
        result = subprocess.run(
            ['node', str(Path(__file__).with_name('verify.mjs'))],
            input=json.dumps({'trustOnly': True, 'trust': candidate}),
            text=True, capture_output=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ValueError('Cannot run the GitHub trust verifier: ' + str(error)) from None
    try:
        verified = json.loads(result.stdout)
    except ValueError:
        raise ValueError('GitHub trust verifier returned no valid result: ' +
                         result.stderr.strip()[-300:]) from None
    if not isinstance(verified, dict):
        raise ValueError('GitHub trust verifier returned an invalid result')
    if result.returncode or verified.get('ok') is not True:
        raise ValueError('GitHub trust verification failed: ' +
                         str(verified.get('error', 'unknown error')))


def save_verified_trust(candidate):
    """Only the caller's already verified candidate reaches this cache."""
    temporary = None
    try:
        CACHE.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=CACHE, delete=False) as handle:
            temporary = Path(handle.name)
            handle.write((json.dumps(candidate, sort_keys=True,
                                     separators=(',', ':')) + '\n').encode())
        os.replace(temporary, CACHE / 'verified-trust.json')
    except OSError:
        pass
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass


def current_trust():
    try:
        candidate = fetch_trust()
    except DownloadUnavailable as error:
        path = CACHE / 'verified-trust.json'
        try:
            raw = path.read_bytes()
            if len(raw) > MAX_METADATA_BYTES:
                raise ValueError('Cached trust material is too large')
            candidate = json.loads(raw)
            verify_trust(candidate)
        except (OSError, ValueError) as cache_error:
            raise ValueError(str(error) + '; no currently valid verified trust cache: ' +
                             str(cache_error)) from None
        print(str(error) + '; using cached trust metadata after '
              'signature and current expiry verification', file=sys.stderr, flush=True)
        return candidate
    # Structure, signatures, target hashes or expiry errors never use a cache.
    verify_trust(candidate)
    save_verified_trust(candidate)
    return candidate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        result = (json.dumps(current_trust(), sort_keys=True, separators=(',', ':')) + '\n').encode()
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_bytes(result)
        else:
            sys.stdout.buffer.write(result)
    except (ValueError, OSError, urllib.error.URLError) as error:
        parser.exit(1, 'Trust metadata download failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
