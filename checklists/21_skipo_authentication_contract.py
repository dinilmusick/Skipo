from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
doc = root / "architecture" / "authentication" / "SKILL.md"
text = doc.read_text(encoding="utf-8") if doc.exists() else ""
required = [
    "FLOKS", "KLOKS", "SRKL", "Better Auth", "Google sign-in", "Google Drive",
    "SRKL_AUTH_BASE_URL", "password hashing", "session",
    "Auth state is never stored in application-local", "Google Drive authorization is separate",
    "legacy password hashes", "Completion gate",
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit("Missing canonical auth markers: " + ", ".join(missing))
print("Canonical authentication architecture contract: PASS")
