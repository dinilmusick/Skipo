import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('Canonical Vite application shell', () => {
  const page = read('../scaffolds/vite/src/frontend/pages/main/page.tsx');
  const app = read('../scaffolds/vite/src/frontend/App.tsx');

  it('uses the Floks AppShell as the managed root and bottom-bar owner', () => {
    expect(page).toContain("import { AppShell, BaseButton, type WorkspaceRecord } from '@ultrst-armada/floks/ui'");
    expect(page).toContain('<AppShell data-skipo-main-page="true" header={header}');
    expect(page).toContain('</AppShell>');
    expect(page).not.toContain('<BottomStrip');
    expect(page).not.toContain('centerSlot=');
  });

  it('preserves workspace switch, settings and registered tabs', () => {
    expect(page).toContain('onSwitchWorkspace && <BaseButton');
    expect(page).toContain("showSettings ? 'Back to workspace' : 'Settings'");
    expect(page).toContain('<SettingsPage activeWorkspaceName=');
    expect(page).toContain('<MainTabs />');
    expect(page).toContain("isGuest ? 'Guest' : undefined");
  });

  it('accepts a typed Floks chat adapter, never creating local agent authority', () => {
    expect(page).toContain("agentChat?: ScopedAgentChatHost;");
    expect(page).toContain('agentChat={scopedAgentChat}');
    expect(page).toContain('Kloks/Luth after permission filtering');
    expect(page).toContain('bindAuthorizedAgentChat(agentChat, {');
    expect(page).toContain('principalId, workspaceId: activeWorkspace?.id, isGuest');
    expect(page).not.toMatch(/import .*Aiko/);
    expect(page).not.toMatch(/import .*AgentChatPanel/);
    expect(page).not.toContain('new Agent');
    expect(page).not.toContain('fetch(');
  });

  it('does not activate a stale or unauthenticated chat directory in guest/no-workspace mode', () => {
    expect(page).toContain('agentChat={scopedAgentChat}');
    expect(page).not.toContain('agentChat={agentChat}');
    expect(page).not.toContain('agentChat={{');
  });

  it('does not retain another principal\'s selected workspace on Luth session change', () => {
    expect(app).toContain('selection?.principalId === principalId');
    expect(app).toContain('if (principalId) setSelection({ principalId, workspace: selected })');
    expect(app).toContain('key={`\u0024{principalId}:\u0024{workspace.id}`}');
    expect(app).toContain('principalId={principalId} activeWorkspace={workspace}');
    expect(app).not.toContain('onSelectWorkspace={setWorkspace}');
  });

  it('is the existing canonical Skipo shell source for Vite repairs', () => {
    const generator = read('../scripts/skipo_canonical_shell.py');
    expect(generator).toContain('SOURCE = Path(__file__).resolve().parents[1] / "scaffolds/vite"');
    expect(generator).toContain('"src/frontend/pages/main/page.tsx"');
    expect(page).not.toContain('AikoRuntime');
    expect(page).not.toContain('AgentChatPanel');
  });
});
