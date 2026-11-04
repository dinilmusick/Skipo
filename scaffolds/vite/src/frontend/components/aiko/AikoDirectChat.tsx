import { useEffect, useMemo, useRef, useState } from 'react';
import { luthAuthClient } from '../../../libraries/client/luthAuthClient.js';

export interface AikoDirectChatAgent { id: string; name: string; description?: string; }
export interface BugReportContext {
  applicationId: string;
  applicationType: 'skipo' | 'hubrys-composite';
  applicationVersion?: string;
  deploymentId?: string;
  workspaceId?: string;
  route?: string;
  correlationId?: string;
  conversationId?: string;
  messageId?: string;
  sourceRevision?: string;
  diagnostics?: Record<string, unknown>;
}
export interface BugReportPayload {
  description: string;
  context: BugReportContext;
  reporterId?: string;
}
export interface AikoDirectChatRuntime {
  listAgents(): Promise<AikoDirectChatAgent[]>;
  executeAgent(agentId: string, input: string): Promise<unknown>;
  reportBug?(report: BugReportPayload, authToken?: string): Promise<unknown>;
}
export interface AikoDirectChatProps {
  runtime: AikoDirectChatRuntime;
  workspaceId: string;
  applicationId?: string;
  authToken?: string;
}
interface Message { id: string; role: 'user' | 'assistant' | 'system'; content: string; }

function mention(input: string, agents: AikoDirectChatAgent[]) {
  const match = input.match(/^\s*@([^\s]+)\s*([\s\S]*)$/);
  if (!match) return { query: input.trim() };
  const token = match[1].toLowerCase();
  return { agent: agents.find(a => a.id.toLowerCase() === token || a.name.toLowerCase().replace(/\s+/g, '-') === token), query: match[2].trim() };
}

export function AikoDirectChat({ runtime, workspaceId, applicationId = 'skipo-app', authToken }: AikoDirectChatProps) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AikoDirectChatAgent[]>([]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState(false);
  const diagnosticsRef = useRef<Record<string, unknown>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onError = (event: ErrorEvent) => { diagnosticsRef.current = { ...diagnosticsRef.current, errors: [...((diagnosticsRef.current.errors as string[]) || []), event.message], stackTraces: [...((diagnosticsRef.current.stackTraces as string[]) || []), event.error?.stack || event.message] }; };
    const onReject = (event: PromiseRejectionEvent) => { diagnosticsRef.current = { ...diagnosticsRef.current, errors: [...((diagnosticsRef.current.errors as string[]) || []), String(event.reason)] }; };
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onReject);
    let active = true;
    void runtime.listAgents().then(value => active && setAgents(value)).catch(() => active && setAgents([]));
    return () => { active = false; window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onReject); };
  }, [runtime, workspaceId]);

  const filtered = useMemo(() => {
    const q = input.match(/(?:^|\s)@([^\s]*)$/)?.[1]?.toLowerCase() ?? '';
    return agents.filter(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)).slice(0, 8);
  }, [agents, input]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const resolved = mention(text, agents);
    const targetAgent = resolved.agent ?? agents.find(a => a.id === 'skipo-application-agent' || a.id === 'application' || a.name.toLowerCase().includes('application')) ?? agents[0];
    const targetQuery = resolved.agent ? resolved.query : text;
    if (!targetAgent) {
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'system', content: 'No Aiko agents available in workspace.' }]);
      return;
    }
    if (!targetQuery) return;
    setInput('');
    setSuggestions(false);
    setMessages(m => [...m, { id: crypto.randomUUID(), role: 'user', content: text }]);
    setBusy(true);
    try {
      const result = await runtime.executeAgent(targetAgent.id, targetQuery);
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }]);
    } catch (error) {
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'system', content: error instanceof Error ? error.message : String(error) }]);
    } finally {
      setBusy(false);
    }
  };

  const reportBug = async (desc: string) => {
    const text = desc.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const route = typeof window !== 'undefined' ? window.location.pathname : '/';
      const correlationId = `corr-${Date.now().toString(36)}`;
      const payload: BugReportPayload = {
        description: text,
        context: {
          applicationId,
          applicationType: 'skipo',
          applicationVersion: '1.0.0',
          workspaceId,
          route,
          correlationId,
          conversationId: messages[0]?.id,
          messageId: crypto.randomUUID(),
          diagnostics: { ...diagnosticsRef.current, activeRoute: route, timestamp: new Date().toISOString() },
        },
      };
      if (typeof runtime.reportBug === 'function') {
        const authorization = new Headers(luthAuthClient.getAuthHeaders()).get('authorization');
        const token = authToken || authorization?.replace(/^Bearer\s+/i, '');
        if (!token) throw new Error('A verified Luth session is required to report a bug.');
        await runtime.reportBug(payload, token);
      }
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'system', content: `Bug reported: "${text}"` }]);
      setInput('');
    } catch (err) {
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'system', content: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" data-skipo-aiko-chat-trigger="true" aria-label={open ? 'Close Aiko Direct Chat' : 'Open Aiko Direct Chat'} onClick={() => setOpen(v => !v)} style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 10000 }}>{open ? '×' : 'Aiko'}</button>
      {open && (
        <section role="dialog" aria-label="Aiko Direct Chat" data-skipo-aiko-direct-chat="true" style={{ position: 'fixed', right: 20, bottom: 72, zIndex: 9999, width: 'min(520px,calc(100vw - 32px))', height: 'min(680px,calc(100vh - 96px))', display: 'flex', flexDirection: 'column', background: 'var(--skipo-surface,#111)', color: 'var(--skipo-text,#fff)', border: '1px solid var(--skipo-border,#333)', borderRadius: 10, overflow: 'hidden' }}>
          <header style={{ padding: 12, borderBottom: '1px solid var(--skipo-border,#333)' }}><strong>Aiko Direct Chat</strong><div style={{ fontSize: 12, opacity: 0.7 }}>Ask the application agent directly, or mention @AgentName</div></header>
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>{messages.map(m => (<div key={m.id} style={{ marginBottom: 10, whiteSpace: 'pre-wrap' }}><strong>{m.role}: </strong>{m.content}</div>))}{busy && <div aria-live="polite">Aiko is executing…</div>}</div>
          <div style={{ position: 'relative', padding: 12, borderTop: '1px solid var(--skipo-border,#333)' }}>
            {suggestions && filtered.length > 0 && (<div role="listbox" style={{ position: 'absolute', left: 12, right: 12, bottom: 76, border: '1px solid var(--skipo-border,#333)', background: 'var(--skipo-surface,#111)', maxHeight: 220, overflow: 'auto' }}>{filtered.map(a => (<button key={a.id} type="button" role="option" onClick={() => { setInput('@' + a.name.replace(/\s+/g, '-') + ' '); setSuggestions(false); inputRef.current?.focus(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8 }}><strong>@{a.name}</strong>{a.description ? ` — ${a.description}` : ''}</button>))}</div>)}
            <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); setSuggestions(/(?:^|\s)@[^\s]*$/.test(e.target.value)); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="@AgentName ask the agent to do something…" disabled={busy} rows={3} style={{ width: '100%', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => void send()} disabled={busy || !input.trim()} style={{ flex: 1 }}>{busy ? 'Executing…' : 'Send'}</button>
              <button type="button" title="Report bug" aria-label="Report bug" onClick={() => void reportBug(input)} disabled={busy || !input.trim()} style={{ background: 'var(--skipo-surface-danger, #3a1515)', color: 'var(--skipo-text-danger, #ff8888)', border: '1px solid var(--skipo-border-danger, #5a2020)', padding: '0 12px' }}>Report bug</button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
export default AikoDirectChat;