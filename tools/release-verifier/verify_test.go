package main

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"
)

func fixture(t *testing.T) request {
	t.Helper()
	data, err := os.ReadFile("testdata/reader-v2026.10.27.4.bundle.json")
	if err != nil {
		t.Fatal(err)
	}
	return request{Bundle: data, Repository: "Adirm007/reader", Version: "2026.10.27.4", Trust: trustFixture(t)}
}
func trustFixture(t *testing.T) *trustEnvelope {
	t.Helper()
	data, err := os.ReadFile("testdata/github-trust-2026-10-27.json")
	if err != nil {
		t.Fatal(err)
	}
	var v trustEnvelope
	if err = json.Unmarshal(data, &v); err != nil {
		t.Fatal(err)
	}
	return &v
}
func check(t *testing.T, r request, ok bool) result {
	t.Helper()
	b, _ := json.Marshal(r)
	out := verifyRequestAt(string(b), time.Date(2026, 10, 27, 0, 0, 0, 0, time.UTC))
	if out.OK != ok {
		t.Fatalf("ok=%v want=%v: %s", out.OK, ok, out.Error)
	}
	return out
}
func modifyBundle(t *testing.T, r *request, change func(map[string]any)) {
	t.Helper()
	var b map[string]any
	if err := json.Unmarshal(r.Bundle, &b); err != nil {
		t.Fatal(err)
	}
	change(b)
	r.Bundle, _ = json.Marshal(b)
}
func modifyStatement(t *testing.T, r *request, change func(map[string]any)) {
	modifyBundle(t, r, func(b map[string]any) {
		e := b["dsseEnvelope"].(map[string]any)
		data, _ := base64.StdEncoding.DecodeString(e["payload"].(string))
		var p map[string]any
		json.Unmarshal(data, &p)
		change(p)
		data, _ = json.Marshal(p)
		e["payload"] = base64.StdEncoding.EncodeToString(data)
	})
}
func TestRealRelease(t *testing.T) {
	r := check(t, fixture(t), true)
	if r.DistributionCommit != "1380301914c403f28302d50f2394580f80c2e672" || r.Digest != "2090a5ced30241e32afb74a98963417ad97d7ca9089193cdd5c7a9a5bfb75150" {
		t.Fatal(r)
	}
}
func TestReleaseFailures(t *testing.T) {
	tests := map[string]func(*request){
		"wrong repository":   func(r *request) { r.Repository = "Adirm007/Protelysion" },
		"unknown repository": func(r *request) { r.Repository = "attacker/reader" },
		"wrong version":      func(r *request) { r.Version = "2026.10.27.5" },
		"invalid version":    func(r *request) { r.Version = "main" },
		"tampered digest": func(r *request) {
			modifyStatement(t, r, func(s map[string]any) {
				s["subject"].([]any)[1].(map[string]any)["digest"].(map[string]any)["sha256"] = strings.Repeat("1", 64)
			})
		},
		"wrong owner id": func(r *request) {
			modifyStatement(t, r, func(s map[string]any) { s["predicate"].(map[string]any)["ownerId"] = "1" })
		},
		"wrong repo id": func(r *request) {
			modifyStatement(t, r, func(s map[string]any) { s["predicate"].(map[string]any)["repositoryId"] = "1" })
		},
		"wrong purl": func(r *request) {
			modifyStatement(t, r, func(s map[string]any) { s["predicate"].(map[string]any)["purl"] = "pkg:github/attacker/reader@v1.0" })
		},
		"wrong tag": func(r *request) {
			modifyStatement(t, r, func(s map[string]any) { s["predicate"].(map[string]any)["tag"] = "v1.0" })
		},
		"wrong predicate": func(r *request) {
			modifyStatement(t, r, func(s map[string]any) { s["predicateType"] = "https://slsa.dev/provenance/v1" })
		},
		"duplicate asset": func(r *request) {
			modifyStatement(t, r, func(s map[string]any) { ss := s["subject"].([]any); s["subject"] = append(ss, ss[1]) })
		},
		"tampered signature": func(r *request) {
			modifyBundle(t, r, func(b map[string]any) {
				e := b["dsseEnvelope"].(map[string]any)
				sig := e["signatures"].([]any)[0].(map[string]any)
				x, _ := base64.StdEncoding.DecodeString(sig["sig"].(string))
				x[len(x)-1] ^= 1
				sig["sig"] = base64.StdEncoding.EncodeToString(x)
			})
		},
		"missing timestamp": func(r *request) {
			modifyBundle(t, r, func(b map[string]any) {
				delete(b["verificationMaterial"].(map[string]any), "timestampVerificationData")
			})
		},
		"tampered timestamp": func(r *request) {
			modifyBundle(t, r, func(b map[string]any) {
				ts := b["verificationMaterial"].(map[string]any)["timestampVerificationData"].(map[string]any)["rfc3161Timestamps"].([]any)[0].(map[string]any)
				x, _ := base64.StdEncoding.DecodeString(ts["signedTimestamp"].(string))
				x[len(x)-1] ^= 1
				ts["signedTimestamp"] = base64.StdEncoding.EncodeToString(x)
			})
		},
		"tampered certificate": func(r *request) {
			modifyBundle(t, r, func(b map[string]any) {
				cert := b["verificationMaterial"].(map[string]any)["certificate"].(map[string]any)
				x, _ := base64.StdEncoding.DecodeString(cert["rawBytes"].(string))
				x[len(x)-1] ^= 1
				cert["rawBytes"] = base64.StdEncoding.EncodeToString(x)
			})
		},
	}
	for name, change := range tests {
		t.Run(name, func(t *testing.T) { r := fixture(t); change(&r); check(t, r, false) })
	}
}
func TestTUFTrust(t *testing.T) {
	now := time.Date(2026, 10, 27, 0, 0, 0, 0, time.UTC)
	if _, err := releaseTrustRootAt(trustFixture(t), now); err != nil {
		t.Fatal(err)
	}
	tests := map[string]func(*trustEnvelope){
		"missing root rotation": func(v *trustEnvelope) { v.Roots = v.Roots[1:] },
		"root signature":        func(v *trustEnvelope) { v.Roots[0] = append(v.Roots[0], byte(1)) },
		"timestamp":             func(v *trustEnvelope) { v.Timestamp = append(v.Timestamp, byte(1)) },
		"snapshot":              func(v *trustEnvelope) { v.Snapshot = append(v.Snapshot, byte(1)) },
		"targets":               func(v *trustEnvelope) { v.Targets = append(v.Targets, byte(1)) },
		"trusted root":          func(v *trustEnvelope) { v.TrustedRoot = append(v.TrustedRoot, byte(1)) },
	}
	for name, change := range tests {
		t.Run(name, func(t *testing.T) {
			v := trustFixture(t)
			change(v)
			if _, err := releaseTrustRootAt(v, now); err == nil {
				t.Fatal("accepted tampered TUF material")
			}
		})
	}
	if _, err := releaseTrustRootAt(trustFixture(t), time.Date(2028, 1, 1, 0, 0, 0, 0, time.UTC)); err == nil {
		t.Fatal("accepted expired TUF metadata")
	}
}
func TestNoDowngradeAfterInvalidTrust(t *testing.T) {
	r := fixture(t)
	r.Trust = &trustEnvelope{Schema: 1}
	check(t, r, false)
}
func TestInputLimits(t *testing.T) {
	if verifyRequest(strings.Repeat("x", 1024*1024+1)).OK || verifyRequest("{").OK {
		t.Fatal("accepted invalid input")
	}
	check(t, request{TrustOnly: true}, false)
	r := fixture(t)
	r.Trust = nil
	check(t, r, false)
}

func TestRealBookseaRelease(t *testing.T) {
	data, err := os.ReadFile("testdata/protelysion-v0.42.2.bundle.json")
	if err != nil {
		t.Fatal(err)
	}
	r := check(t, request{Bundle: data, Repository: "Adirm007/Protelysion", Version: "0.42.2", Trust: trustFixture(t)}, true)
	if r.DistributionCommit != "7dea1c06de0a9cc8d8e34dbc0cf929da902116bc" || r.Digest != "df5f81163cf423f64ea7bd89854be58dd6e1396bf5a823e6ab4e9bf1efe11ba2" {
		t.Fatal(r)
	}
}
func TestInputCannotOverrideVerificationClock(t *testing.T) {
	r := fixture(t)
	data, err := json.Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	var input map[string]any
	if err = json.Unmarshal(data, &input); err != nil {
		t.Fatal(err)
	}
	input["now"] = "2026-10-27T00:00:00Z"
	input["time"] = "2026-10-27T00:00:00Z"
	input["currentTime"] = "2026-10-27T00:00:00Z"
	data, err = json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	future := time.Date(2028, 1, 1, 0, 0, 0, 0, time.UTC)
	out := verifyRequestAt(string(data), future)
	if out.OK || !strings.Contains(out.Error, "expired") {
		t.Fatalf("input overrode verification clock: %+v", out)
	}
}
