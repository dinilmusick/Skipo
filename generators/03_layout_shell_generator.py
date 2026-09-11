#!/usr/bin/env python3
"""
Aspect 03: Layout Shell Invariants & Shell Suite Generator
Generates:
- Complete Layout Shell Suite folder (shell/)
  - AppShell.tsx (Root layout orchestrating top, bottom, and center content)
  - TopToolbar.tsx (Strictly 44px height, flat tabs, anti-nested tabs)
  - BottomStrip.tsx (Strictly 30px height, hover inspection text, telemetry indicators)
  - FloatingDetailsPanel.tsx (8-way resize inspector, pinned/unpinned state)
  - types.ts & index.ts
"""

from pathlib import Path
from typing import List, Dict, Any
import json
import sys
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

GENERATOR_ID = "03_layout_shell_generator"
GENERATOR_TITLE = "Layout Shell & UX Invariants Suite Generator"

def generate_shell_suite(target_dir: Path, params: Dict[str, Any]) -> GeneratorResult:
    start_time = time.time()
    files: List[GeneratedFile] = []

    app_name = params.get("name") or "SkipoApp"
    custom = params.get("custom", {})
    tabs = custom.get("tabs", ["Overview", "Workspaces", "Telemetry", "Settings"])

    # 1. types.ts
    tab_literal = " | ".join(f"'{t.lower()}'" for t in tabs)
    types_content = f"""{section_header("Shell Suite Types")}
// ══════════════════════════════════════════════════════════════════════════════

export type ShellTab = {tab_literal};

export interface ShellState {{
  activeTab: ShellTab;
  inspectorPinned: boolean;
  statusMessage: string;
  telemetryLatencyMs: number;
}}

export interface TopToolbarProps {{
  activeTab: ShellTab;
  onTabChange: (tab: ShellTab) => void;
  title?: string;
}}

export interface BottomStripProps {{
  hoverText?: string;
  latencyMs?: number;
  environment?: string;
}}

export interface FloatingDetailsPanelProps {{
  isOpen: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}}
"""
    files.append(GeneratedFile(
        relative_path="types.ts",
        content=types_content,
        description="Layout shell TypeScript types and interfaces"
    ))

    # 2. TopToolbar.tsx (strictly 44px)
    tabs_jsx = []
    for t in tabs:
        t_id = t.lower()
        tabs_jsx.append(f"""        <BaseButton
          key="{t_id}"
          variant={{activeTab === '{t_id}' ? 'primary' : 'ghost'}}
          onClick={{() => onTabChange('{t_id}'))}}
          style={{{{
            padding: '0 16px',
            height: '100%',
            borderRadius: '0',
            borderBottom: activeTab === '{t_id}' ? '2px solid var(--skipo-accent)' : '2px solid transparent'
          }}}}
        >
          {t}
        </BaseButton>""")

    flowchart_toolbar = generate_ascii_flowchart("TopToolbar 44px Invariant", [
        "Render TopToolbar at 44px Height",
        "Render Flat Navigation Tabs (Anti-Nested)",
        "Dispatch Tab State Updates to AppShell"
    ])

    toolbar_content = f"""import React from 'react';
import {{ BaseButton }} from '@skipo/ui';
import type {{ TopToolbarProps, ShellTab }} from './types';

{flowchart_toolbar}

{section_header("TopToolbar (44px Fixed Height)")}
// ══════════════════════════════════════════════════════════════════════════════

export const TopToolbar: React.FC<TopToolbarProps> = ({{
  activeTab,
  onTabChange,
  title = '{app_name}'
}}) => {{
  return (
    <header
      role="banner"
      style={{{{
        height: 'var(--skipo-toolbar-height, 44px)',
        minHeight: '44px',
        maxHeight: '44px',
        backgroundColor: 'var(--skipo-surface)',
        borderBottom: '1px solid var(--skipo-border-color)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        justifyContent: 'space-between',
        userSelect: 'none'
      }}}}
    >
      <div style={{{{ display: 'flex', alignItems: 'center', gap: '16px', height: '100%' }}}}>
        <span style={{{{ fontWeight: 700, fontSize: '14px', color: 'var(--skipo-text-primary)' }}}}>
          {{title}}
        </span>
        <nav role="tablist" style={{{{ display: 'flex', height: '100%' }}}}>
{chr(10).join(tabs_jsx)}
        </nav>
      </div>
    </header>
  );
}};

export default TopToolbar;
"""
    files.append(GeneratedFile(
        relative_path="TopToolbar.tsx",
        content=toolbar_content,
        description="TopToolbar enforcing strictly 44px height and flat tabs"
    ))

    # 3. BottomStrip.tsx (strictly 30px)
    flowchart_bottom = generate_ascii_flowchart("BottomStrip 30px Invariant", [
        "Receive Workspace State & Telemetry",
        "Render 30px Bottom Inspection Bar",
        "Display Live Inspection Hover Text"
    ])

    bottom_content = f"""import React from 'react';
import type {{ BottomStripProps }} from './types';

{flowchart_bottom}

{section_header("BottomStrip (30px Fixed Height)")}
// ══════════════════════════════════════════════════════════════════════════════

export const BottomStrip: React.FC<BottomStripProps> = ({{
  hoverText = 'System Ready',
  latencyMs = 12,
  environment = 'production'
}}) => {{
  return (
    <footer
      role="contentinfo"
      style={{{{
        height: 'var(--skipo-bottom-strip-height, 30px)',
        minHeight: '30px',
        maxHeight: '30px',
        backgroundColor: 'var(--skipo-surface-muted)',
        borderTop: '1px solid var(--skipo-border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: '11px',
        color: 'var(--skipo-text-secondary)',
        userSelect: 'none'
      }}}}
    >
      <div style={{{{ display: 'flex', alignItems: 'center', gap: '8px' }}}}>
        <span style={{{{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--skipo-success, #2a9d8f)' }}}} />
        <span>{{hoverText}}</span>
      </div>

      <div style={{{{ display: 'flex', alignItems: 'center', gap: '16px' }}}}>
        <span>Env: {{environment}}</span>
        <span>Latency: {{latencyMs}}ms</span>
      </div>
    </footer>
  );
}};

export default BottomStrip;
"""
    files.append(GeneratedFile(
        relative_path="BottomStrip.tsx",
        content=bottom_content,
        description="BottomStrip enforcing strictly 30px height and inspection text"
    ))

    # 4. FloatingDetailsPanel.tsx
    panel_content = f"""import React from 'react';
import {{ IconOnlyButton }} from '@skipo/ui';
import type {{ FloatingDetailsPanelProps }} from './types';

{section_header("FloatingDetailsPanel (8-Way Resize Inspector)")}
// ══════════════════════════════════════════════════════════════════════════════

export const FloatingDetailsPanel: React.FC<FloatingDetailsPanelProps> = ({{
  isOpen,
  isPinned,
  onTogglePin,
  onClose,
  title,
  children
}}) => {{
  if (!isOpen) return null;

  return (
    <aside
      role="complementary"
      aria-label={{title}}
      style={{{{
        position: isPinned ? 'relative' : 'absolute',
        top: isPinned ? 0 : '44px',
        right: 0,
        width: '320px',
        height: isPinned ? '100%' : 'calc(100% - 74px)',
        backgroundColor: 'var(--skipo-surface)',
        borderLeft: '1px solid var(--skipo-border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        boxShadow: isPinned ? 'none' : 'var(--skipo-shadow-lg, 0 10px 25px rgba(0,0,0,0.2))'
      }}}}
    >
      <div
        style={{{{
          height: '36px',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--skipo-border-color)'
        }}}}
      >
        <span style={{{{ fontWeight: 600, fontSize: '12px', color: 'var(--skipo-text-primary)' }}}}>
          {{title}}
        </span>
        <div style={{{{ display: 'flex', gap: '8px' }}}}>
          <IconOnlyButton
            icon={{isPinned ? '📌' : '📍'}}
            aria-label={{isPinned ? 'Unpin inspector' : 'Pin inspector'}}
            onClick={{onTogglePin}}
          />
          <IconOnlyButton
            icon="✕"
            aria-label="Close inspector"
            onClick={{onClose}}
          />
        </div>
      </div>

      <div style={{{{ flex: 1, overflowY: 'auto', padding: '12px' }}}}>
        {{children}}
      </div>
    </aside>
  );
}};

export default FloatingDetailsPanel;
"""
    files.append(GeneratedFile(
        relative_path="FloatingDetailsPanel.tsx",
        content=panel_content,
        description="Floating details panel with pin/unpin inspection invariants"
    ))

    # 5. AppShell.tsx
    appshell_content = f"""import React, {{ useState }} from 'react';
import {{ TopToolbar }} from './TopToolbar';
import {{ BottomStrip }} from './BottomStrip';
import type {{ ShellTab, ShellState }} from './types';

{section_header("AppShell Root Container")}
// ══════════════════════════════════════════════════════════════════════════════

export interface AppShellProps {{
  children: React.ReactNode;
  title?: string;
  onTabChange?: (tab: ShellTab) => void;
}}

export const AppShell: React.FC<AppShellProps> = ({{
  children,
  title = '{app_name}',
  onTabChange
}}) => {{
  const [activeTab, setActiveTab] = useState<ShellTab>('{tabs[0].lower()}');
  const [hoverText, setHoverText] = useState<string>('Ready');

  const handleTabChange = (tab: ShellTab) => {{
    setActiveTab(tab);
    setHoverText(`Switched to ${{tab}}`);
    if (onTabChange) onTabChange(tab);
  }};

  return (
    <div
      style={{{{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--skipo-surface-background, #121214)'
      }}}}
    >
      <TopToolbar
        title={{title}}
        activeTab={{activeTab}}
        onTabChange={{handleTabChange}}
      />

      <main style={{{{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}}}>
        {{children}}
      </main>

      <BottomStrip hoverText={{hoverText}} />
    </div>
  );
}};

export default AppShell;
"""
    files.append(GeneratedFile(
        relative_path="AppShell.tsx",
        content=appshell_content,
        description="Root AppShell integrating 44px TopToolbar and 30px BottomStrip"
    ))

    # 6. index.ts
    index_content = f"""{section_header("Layout Shell Suite Barrel")}
// ══════════════════════════════════════════════════════════════════════════════

export * from './types';
export * from './TopToolbar';
export * from './BottomStrip';
export * from './FloatingDetailsPanel';
export * from './AppShell';
"""
    files.append(GeneratedFile(
        relative_path="index.ts",
        content=index_content,
        description="Shell suite barrel facade"
    ))

    # Write files
    result = emit_directory(
        target_dir=target_dir,
        files=files,
        dry_run=params.get("dry_run", False),
        force=params.get("force", False)
    )
    result.generator_id = GENERATOR_ID
    result.generator_title = GENERATOR_TITLE
    result.duration_ms = (time.time() - start_time) * 1000
    return result

def main():
    args = parse_generator_args("Skipo Layout Shell & UX Invariants Suite Generator")
    target_path = Path(args["target_path"] or "src/frontend/shell").resolve()
    result = generate_shell_suite(target_path, args)

    if args["json"]:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print_generator_report(result)

    sys.exit(0 if result.success else 1)

if __name__ == "__main__":
    main()
