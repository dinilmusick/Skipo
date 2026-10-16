#!/usr/bin/env python3
"""
Aspect 13: Deterministic Service UI Composition & Provenance Generator
Spec: ECOSYSTEM-TIGHTENING-PLAN §6-§7, KRUSBL-PLAN-PATCH §1-§8
Generates:
- Complete Service UI Section suite ([ServiceName]Section.tsx)
- Embeds strict provenance comment blocks (@skipo:service, @skipo:schema, @skipo:package, etc.)
- Resolves public FLOKS exports (@ultrst-armada/floks/ui)
- Emits fully editable React/TypeScript source (< 200 lines).
"""

from pathlib import Path
from typing import List, Dict, Any
import time

try:
    from .common import (
        GeneratedFile, GeneratorResult, section_header,
        generate_ascii_flowchart, emit_directory, parse_generator_args,
        print_generator_report
    )
except ImportError:
    from common import (
        GeneratedFile, GeneratorResult, section_header,
        generate_ascii_flowchart, emit_directory, parse_generator_args,
        print_generator_report
    )

GENERATOR_ID = "13_service_ui_generator"
GENERATOR_TITLE = "Deterministic Service UI Composition & Provenance Generator"

CANONICAL_UI_REGISTRY = {
    "auth": {
        "service_id": "kloks.service.auth",
        "schema_id": "kloks.service.auth.ui",
        "schema_version": "1.0.0",
        "requirement_mode": "required",
        "package_id": "@ultrst-armada/floks",
        "package_version": "^1.2.3",
        "export_path": "ui",
        "page_name": "Auth.ui",
        "section_name": "Auth.ui.LoginSection",
        "component_name": "AuthPage",
        "title": "AuthSection",
    },
    "storage": {
        "service_id": "kloks.service.storage",
        "schema_id": "kloks.service.storage.ui",
        "schema_version": "1.0.0",
        "requirement_mode": "optional",
        "package_id": "@ultrst-armada/floks",
        "package_version": "^1.2.3",
        "export_path": "ui",
        "page_name": "Storage.ui",
        "section_name": "Storage.ui.TilesSection",
        "component_name": "WorkspaceTilesMenu",
        "title": "StorageSection",
    },
}

def generate_service_ui_suite(target_dir: Path, params: Dict[str, Any]) -> GeneratorResult:
    start_time = time.time()
    files: List[GeneratedFile] = []

    raw_name = params.get("name") or "Auth"
    lookup_key = raw_name.lower().replace("service", "").replace("section", "")
    config = CANONICAL_UI_REGISTRY.get(lookup_key) or {
        "service_id": f"kloks.service.{lookup_key}",
        "schema_id": f"kloks.service.{lookup_key}.ui",
        "schema_version": "1.0.0",
        "requirement_mode": "optional",
        "package_id": "@ultrst-armada/floks",
        "package_version": "^1.2.3",
        "export_path": "ui",
        "page_name": f"{raw_name}.ui",
        "section_name": f"{raw_name}.ui.MainSection",
        "component_name": f"{raw_name}Component",
        "title": f"{raw_name}Section",
    }

    comp_name = config["title"]
    floks_comp = config["component_name"]

    # 1. Section Component with Provenance
    section_code = f"""// @skipo:service   {config['service_id']}
// @skipo:schema    {config['schema_id']}@{config['schema_version']}
// @skipo:package   {config['package_id']}@{config['package_version']}
// @skipo:export    {config['export_path']}
// @skipo:page      {config['page_name']}
// @skipo:section   {config['section_name']}
// @skipo:component {config['component_name']}
// @skipo:origin    GENERATED
{section_header(f"{comp_name} - Service UI Composition")}
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import {{ {floks_comp} }} from '{config['package_id']}/{config['export_path']}';

export interface {comp_name}Props {{
  title?: string;
  onSuccess?: (result: any) => void;
  className?: string;
}}

export const {comp_name}: React.FC<{comp_name}Props> = ({{
  title = '{comp_name}',
  onSuccess,
  className = '',
}}) => {{
  return (
    <div className={{`skipo-section-${lookup_key} ${{className}}`}}>
      <{floks_comp}
        appName={{title}}
        onLogin={{async (email: string, password: string) => {{
          const res = await fetch('/api/auth/login', {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json' }},
            body: JSON.stringify({{ email, password }}),
          }});
          return res.json();
        }}}}
        onRegister={{async (input: any) => {{
          const res = await fetch('/api/auth/register', {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json' }},
            body: JSON.stringify(input),
          }});
          return res.json();
        }}}}
        onSuccess={{onSuccess}}
      />
    </div>
  );
}};

export default {comp_name};
"""

    files.append(GeneratedFile(
        relative_path=f"{comp_name}.tsx",
        content=section_code,
        description=f"Deterministic React composition for {config['section_name']} backed by {config['package_id']}."
    ))

    # 2. Barrel index.ts
    index_code = f"""export * from './{comp_name}';
export {{ default }} from './{comp_name}';
"""
    files.append(GeneratedFile(
        relative_path="index.ts",
        content=index_code,
        description=f"Barrel export for {comp_name} suite."
    ))

    # Emit files to target directory
    emit_directory(target_dir, files, dry_run=params.get("dry_run", False), force=params.get("force", False))

    messages = [
        f"Generated Service UI Suite for '{config['service_id']}' in {target_dir}",
        f"Bound to public FLOKS export: {config['package_id']}/{config['export_path']} -> {floks_comp}",
        f"Requirement mode: {config['requirement_mode'].upper()}",
        "Embedded full provenance comments for KRUSBL discovery"
    ]

    return GeneratorResult(
        generator_id=GENERATOR_ID,
        generator_title=GENERATOR_TITLE,
        success=True,
        target_directory=str(target_dir),
        files=files,
        duration_ms=round((time.time() - start_time) * 1000, 2),
        messages=messages
    )

if __name__ == "__main__":
    target, params = parse_generator_args("Generate Service UI Composition Suite", ["name"])
    res = generate_service_ui_suite(target, params)
    print_generator_report(res)
