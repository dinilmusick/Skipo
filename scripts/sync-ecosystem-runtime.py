#!/usr/bin/env python3
"""Copy the canonical Skipo ecosystem runtime to an application backend."""
import argparse
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "backend" / "ecosystem"
FILES = {
    Path("deploymentStore_Impure.ts"): Path("src/backend/ecosystem/generated/deploymentStore_Impure.ts"),
    Path("ecosystemRuntime_Impure.ts"): Path("src/backend/ecosystem/generated/ecosystemRuntime_Impure.ts"),
    Path("verifiedCapabilityDiscovery_Impure.ts"): Path("src/backend/ecosystem/generated/verifiedCapabilityDiscovery_Impure.ts"),
    Path("workspaceCapabilities_Impure.ts"): Path("src/backend/ecosystem/generated/workspaceCapabilities_Impure.ts"),
    Path("db/deployments.sql"): Path("db/skipo-ecosystem-deployments.sql"),
}


def sync(app: Path, check: bool) -> None:
    for source, target in FILES.items():
        contents = (SOURCE / source).read_bytes()
        destination = app / target
        if check:
            if not destination.is_file() or destination.read_bytes() != contents:
                raise SystemExit(f"Outdated Skipo ecosystem runtime: {destination}")
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(contents)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apps", nargs="+", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    for app in args.apps:
        sync(app, args.check)
