package main

import (
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/theupdateframework/go-tuf/v2/metadata/trustedmetadata"
	"regexp"
	"time"

	protobundle "github.com/sigstore/protobuf-specs/gen/pb-go/bundle/v1"
	"github.com/sigstore/sigstore-go/pkg/bundle"
	"github.com/sigstore/sigstore-go/pkg/fulcio/certificate"
	"github.com/sigstore/sigstore-go/pkg/root"
	"github.com/sigstore/sigstore-go/pkg/verify"
	"google.golang.org/protobuf/encoding/protojson"
)

//go:embed github-tuf-root.json
var githubTUFRootJSON []byte

var versionPattern = regexp.MustCompile(`^[0-9]+(?:\.[0-9]+)+$`)
var sha1Pattern = regexp.MustCompile(`^[0-9a-f]{40}$`)
var sha256Pattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

type request struct {
	Bundle     json.RawMessage `json:"bundle"`
	Repository string          `json:"repository"`
	Version    string          `json:"version"`
	Trust      *trustEnvelope  `json:"trust,omitempty"`
	TrustOnly  bool            `json:"trustOnly,omitempty"`
}
type trustEnvelope struct {
	Schema      int      `json:"schema"`
	Roots       [][]byte `json:"roots"`
	Timestamp   []byte   `json:"timestamp"`
	Snapshot    []byte   `json:"snapshot"`
	Targets     []byte   `json:"targets"`
	TrustedRoot []byte   `json:"trustedRoot"`
}
type result struct {
	OK                 bool   `json:"ok"`
	Repository         string `json:"repository,omitempty"`
	Version            string `json:"version,omitempty"`
	DistributionCommit string `json:"distributionCommit,omitempty"`
	Digest             string `json:"digest,omitempty"`
	Error              string `json:"error,omitempty"`
}
type subject struct {
	URI    string            `json:"uri"`
	Name   string            `json:"name"`
	Digest map[string]string `json:"digest"`
}
type statement struct {
	Type          string    `json:"_type"`
	Subject       []subject `json:"subject"`
	PredicateType string    `json:"predicateType"`
	Predicate     struct {
		Repository   string `json:"repository"`
		RepositoryID string `json:"repositoryId"`
		OwnerID      string `json:"ownerId"`
		Tag          string `json:"tag"`
		PURL         string `json:"purl"`
		PackageID    string `json:"packageId"`
	} `json:"predicate"`
}

var repositories = map[string]struct{ ID, Asset string }{
	"Adirm007/reader":      {"1407613869", "reader-fixed.regex.json"},
	"Adirm007/Protelysion": {"1380640190", "protelysion-fixed.regex.json"},
}

func verifyRequest(input string) result { return verifyRequestAt(input, time.Now().UTC()) }

func verifyRequestAt(input string, now time.Time) (r result) {
	defer func() {
		if p := recover(); p != nil {
			r = result{Error: "invalid verification input"}
		}
	}()
	if len(input) > 1024*1024 {
		return result{Error: "verification input too large"}
	}
	var req request
	if err := json.Unmarshal([]byte(input), &req); err != nil {
		return result{Error: "invalid verification input"}
	}
	r, err := verifyReleaseAt(req, now)
	if err != nil {
		return result{Error: err.Error()}
	}
	return r
}
func verifyReleaseAt(req request, now time.Time) (result, error) {
	if req.TrustOnly {
		if req.Trust == nil {
			return result{}, fmt.Errorf("trust material required")
		}
		_, err := releaseTrustRootAt(req.Trust, now)
		if err != nil {
			return result{}, err
		}
		return result{OK: true}, nil
	}
	repo, ok := repositories[req.Repository]
	if !ok || !versionPattern.MatchString(req.Version) {
		return result{}, fmt.Errorf("unexpected repository or version")
	}
	var pb protobundle.Bundle
	if err := protojson.Unmarshal(req.Bundle, &pb); err != nil {
		return result{}, fmt.Errorf("invalid bundle: %w", err)
	}
	if pb.MediaType != "application/vnd.dev.sigstore.bundle.v0.3+json" {
		return result{}, fmt.Errorf("unsupported bundle")
	}
	env := pb.GetDsseEnvelope()
	if env == nil || env.PayloadType != "application/vnd.in-toto+json" || len(env.Signatures) != 1 {
		return result{}, fmt.Errorf("invalid release envelope")
	}
	var s statement
	if err := json.Unmarshal(env.Payload, &s); err != nil {
		return result{}, fmt.Errorf("invalid statement")
	}
	purl := "pkg:github/" + req.Repository + "@v" + req.Version
	p := s.Predicate
	if s.Type != "https://in-toto.io/Statement/v1" || s.PredicateType != "https://in-toto.io/attestation/release/v0.2" || p.Repository != req.Repository || p.RepositoryID != repo.ID || p.OwnerID != "87485413" || p.Tag != "v"+req.Version || p.PURL != purl || p.PackageID != repo.ID {
		return result{}, fmt.Errorf("release identity mismatch")
	}
	var commit, digest string
	var refs, assets int
	for _, sub := range s.Subject {
		if sub.URI == purl {
			refs++
			commit = sub.Digest["sha1"]
		}
		if sub.Name == repo.Asset {
			assets++
			digest = sub.Digest["sha256"]
		}
	}
	if refs != 1 || assets != 1 || !sha1Pattern.MatchString(commit) || !sha256Pattern.MatchString(digest) {
		return result{}, fmt.Errorf("release subject mismatch")
	}
	tr, err := releaseTrustRootAt(req.Trust, now)
	if err != nil {
		return result{}, err
	}
	verifier, err := verify.NewVerifier(tr, verify.WithSignedTimestamps(1))
	if err != nil {
		return result{}, err
	}
	b, err := bundle.NewBundle(&pb)
	if err != nil {
		return result{}, err
	}
	san, err := verify.NewSANMatcher("https://dotcom.releases.github.com", "")
	if err != nil {
		return result{}, err
	}
	issuer, err := verify.NewIssuerMatcher("", ".*")
	if err != nil {
		return result{}, err
	}
	ci, err := verify.NewCertificateIdentity(san, issuer, certificate.Extensions{})
	if err != nil {
		return result{}, err
	}
	digestBytes, _ := hex.DecodeString(digest)
	_, err = verifier.Verify(b, verify.NewPolicy(verify.WithArtifactDigest("sha256", digestBytes), verify.WithCertificateIdentity(ci)))
	if err != nil {
		return result{}, fmt.Errorf("release signature verification failed: %w", err)
	}
	return result{OK: true, Repository: req.Repository, Version: req.Version, DistributionCommit: commit, Digest: digest}, nil
}

// releaseTrustRoot authenticates mirrored trust data using GitHub's pinned TUF
// root. No network, filesystem, author public key, or mutable self-claim is used.
func releaseTrustRoot(t *trustEnvelope) (*root.TrustedRoot, error) {
	return releaseTrustRootAt(t, time.Now().UTC())
}

func releaseTrustRootAt(t *trustEnvelope, now time.Time) (*root.TrustedRoot, error) {
	if t == nil {
		return nil, fmt.Errorf("trust material required")
	}
	if t.Schema != 1 || len(t.Roots) > 128 || len(t.Timestamp) == 0 || len(t.Snapshot) == 0 || len(t.Targets) == 0 || len(t.TrustedRoot) == 0 {
		return nil, fmt.Errorf("invalid trust material")
	}
	tm, err := trustedmetadata.New(githubTUFRootJSON)
	if err != nil {
		return nil, err
	}
	tm.RefTime = now
	for _, data := range t.Roots {
		if _, err = tm.UpdateRoot(data); err != nil {
			return nil, fmt.Errorf("TUF root: %w", err)
		}
	}
	if _, err = tm.UpdateTimestamp(t.Timestamp); err != nil {
		return nil, fmt.Errorf("TUF timestamp: %w", err)
	}
	if _, err = tm.UpdateSnapshot(t.Snapshot, false); err != nil {
		return nil, fmt.Errorf("TUF snapshot: %w", err)
	}
	targets, err := tm.UpdateTargets(t.Targets)
	if err != nil {
		return nil, fmt.Errorf("TUF targets: %w", err)
	}
	target, ok := targets.Signed.Targets["trusted_root.json"]
	if !ok || len(target.Hashes["sha256"]) == 0 {
		return nil, fmt.Errorf("GitHub trust root missing")
	}
	if err = target.VerifyLengthHashes(t.TrustedRoot); err != nil {
		return nil, fmt.Errorf("TUF trusted root: %w", err)
	}
	return root.NewTrustedRootFromJSON(t.TrustedRoot)
}
