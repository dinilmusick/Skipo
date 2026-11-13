from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "docs" / "guest-access-security-model.md"


def test_guest_security_contract_declares_distinct_non_identity_principal():
    text = CONTRACT.read_text(encoding="utf-8")
    assert "Skipo guest lease" in text
    assert "MUST NOT create a user" in text
    assert "No implicit conversion exists between these variants" in text
    assert "x-user-id" in text
    assert "Luth session" in text


def test_guest_security_contract_is_default_deny_and_luth_excluded():
    text = CONTRACT.read_text(encoding="utf-8")
    assert "An unclassified route is denied" in text
    assert "| Unclassified or newly added route | DENY |" in text
    assert "Luth is denied before issuance" in text
    assert "Luth is excluded from guest issuance" in text


def test_guest_security_contract_forbids_persistent_workspace_paths():
    text = CONTRACT.read_text(encoding="utf-8")
    assert "ephemeral" in text.lower()
    assert "| Persistent workspace creation, attachment or provider selection | DENY |" in text
    assert "No Local Folder, S3/B2, Google Drive or other durable adapter" in text
    assert "fail closed on exhaustion" in text.lower()


def test_guest_security_contract_requires_server_authoritative_expiry_and_cleanup():
    text = CONTRACT.read_text(encoding="utf-8")
    assert "server-side expiry is the authoritative reclamation mechanism" in text
    assert "TTL reaper is authoritative" in text
    assert "Teardown is idempotent" in text
    assert "partial cleanup failures" in text.lower()


def test_guest_security_contract_covers_required_threats():
    text = CONTRACT.read_text(encoding="utf-8")
    for threat in (
        "Forged or guessed lease",
        "Replay after expiry/revocation",
        "Cross-app / cross-deployment reuse",
        "Cross-lease IDOR",
        "Guest-to-user privilege escalation",
        "CSRF / origin confusion",
        "Resource exhaustion",
        "Cleanup race / partial failure",
        "Persistence escape",
        "Secret / content leakage through telemetry",
    ):
        assert threat in text
