# GitHub release verification

This folder builds the offline verifier used when checking for fixed releases.
It uses Sigstore's official Go verifier, with the same GitHub release identity
and RFC 3161 timestamp policy as `gh release verify`.

Run `python build.py` to rebuild with Go 1.25.8, and `go test ./...` to test.
`go.mod` and `go.sum` pin dependencies. The compressed WebAssembly build and its
runtime are recorded in `descriptor.json`. The browser must pin those bytes to
a full Git commit and verify both hashes before running them. Run them in a Web
Worker; they do not need Web Crypto, a secure context, a filesystem, or network
access.

`DreamReleaseAttestationVerify(JSON_STRING)` returns a JSON string. The request
contains `bundle`, `repository`, and numeric `version`. A successful result
contains `ok`, `repository`, `version`, `distributionCommit`, and `digest`.
`node verify.mjs` accepts the same request on standard input and returns the
same result on standard output. It checks the runtime and WebAssembly hashes
before loading them. It exits nonzero on verification failure.

The verifier requires GitHub's release signer certificate identity, a verified
RFC 3161 timestamp, the signed release predicate, the exact owner and repository
IDs, the tag, the package URL, the release commit subject, and the fixed regex
asset subject. A recreated repository with the same name is rejected. Discovery
catalog fields are not signing authority.

For rotating GitHub certificates, pass `trust` from `fetch_trust.py`. All fields
preserve the original metadata bytes in base64. The verifier checks the complete
TUF root rotation chain, timestamp, snapshot, targets, target length, SHA-256,
and current expiry using the official TUF library. GitHub's bootstrap TUF root
is pinned in `github-tuf-root.json`. `trustOnly: true` validates this trust data
without a release bundle. Invalid supplied trust data never falls back to the
embedded certificate set. Trust material is mandatory for every request; there is no unsigned trust-root
fallback and no way for JSON input to override the verification clock.

The TUF mirror must be refreshed regularly. Stale or invalid metadata causes a
failed update check; it cannot authorize new code or report that the installed
version is current. A valid signed release proves its contents and identity;
it does not prove that an untrusted discovery catalog lists the newest release.

`third_party/in-toto-golang` contains the non-test Go sources of upstream v0.11.0.
Its only port changes are the build constraint on `in_toto/util_unix.go` and an
added `util_js.go`. The upstream Unix filesystem permission probe accidentally
matches GOOS=js. The JS replacement rejects filesystem writes. The release
verification path does not call this function. All cryptographic verification
continues through the unmodified Sigstore, TUF, and Go crypto code. Third-party
licenses are included in `licenses/` and listed in `THIRD_PARTY_LICENSES.txt`.

Sources:
- https://github.com/cli/cli/blob/trunk/pkg/cmd/release/shared/attestation.go
- https://github.com/cli/cli/blob/trunk/pkg/cmd/attestation/verification/sigstore.go
- https://github.com/cli/cli/blob/trunk/pkg/cmd/attestation/verification/tuf.go
- https://github.com/sigstore/sigstore-go/tree/v1.3.0
- https://github.com/theupdateframework/go-tuf/tree/v2.4.2
