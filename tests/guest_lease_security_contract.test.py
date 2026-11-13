"""Regression checks for the guest lease security ADR's non-negotiable contract."""

from pathlib import Path

ADR = Path(__file__).parents[1] / "architecture" / "guest-access" / "GUEST_LEASE_SECURITY_CONTRACT.md"


def test_guest_is_anonymous_lease_not_an_identity():
    text = ADR.read_text(encoding="utf-8")
    assert "anonymous runtime lease" in text
    assert "MUST NOT populate" in text
    assert "Luth session" in text


def test_guest_capabilities_are_default_deny():
    text = ADR.read_text(encoding="utf-8")
    assert "Unknown capabilities and unclassified routes are denied" in text
    assert "Default-deny capability matrix" in text
    assert "UI hiding is not authorization" in text


def test_guest_credentials_are_bound_and_expiring():
    text = ADR.read_text(encoding="utf-8")
    for marker in ("256 bits", "deploymentId", "revocation", "absolute maximum lifetime", "atomic"):
        assert marker in text


def test_guest_never_persists_or_satisfies_luth():
    text = ADR.read_text(encoding="utf-8")
    assert "MUST NOT be written to durable user storage" in text
    assert "Do not make a guest credential a fallback" in text
    assert "Luth itself is excluded" in text


def test_threat_model_covers_replay_idor_csrf_and_exhaustion():
    text = ADR.read_text(encoding="utf-8")
    for marker in ("Credential theft/replay", "Cross-lease/workspace IDOR", "CSRF / origin abuse", "Resource exhaustion"):
        assert marker in text


def test_authenticated_transition_does_not_copy_guest_data():
    text = ADR.read_text(encoding="utf-8")
    assert "Do not copy guest files" in text
    assert "its TTL remains authoritative" in text
