import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface AikoDirectChatAgent {
  id: string;
  name: string;
  description?: string;
}

export interface AikoDirectChatRuntime {
  listAgents(): Promise<AikoDirectChatAgent[]>;
  executeAgent(agentId: string, input: string): Promise<unknown>;
  executeAgentStream?: (
    agentId: string,
    input: string,
    onChunk: (chunk: string) => void,
  ) => Promise<unknown>;
}

export interface AikoDirectChatProps {
  runtime: AikoDirectChatRuntime;
  workspaceId: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function resolveMention(input: string, agents: AikoDirectChatAgent[]): { agent?: AikoDirectChatAgent; query: string } {
  const match = input.match(/^\s*@([^\s]+)\s*([\s\S]*)$/);
  if (!match) return { query: input.trim() };
  const token = match[1].toLowerCase();
  const agent = agents.find((candidate) =>
    candidate.id.toLowerCase() === token || candidate.name.toLowerCase().replace(/\s+/g, '-') === token,
  );
  return { agent, query: match[2].trim() };
}

export function AikoDirectChat({ runtime, workspaceId }: AikoDirectChatProps) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AikoDirectChatAgent[]>([]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    void runtime.listAgents().then((next) => {
      if (active) setAgents(next);
    }).catch(() => {
      if (active) setAgents([]);
    });
    return () => { active = false; };
  }, [runtime, workspaceId]);

  const filteredAgents = useMemo(() => {
    const query = mentionQuery.toLowerCase();
    return agents.filter((agent) =>
      agent.name.toLowerCase().includes(query) || agent.id.toLowerCase().includes(query),
    ).slice(0, 8);
  }, [agents, mentionQuery]);

  const selectAgent = (agent: AikoDirectChatAgent) => {
    setInput((current) => {
      const withoutMention = current.replace(/^\s*@[^\s]*\s*/, '');
      return `@${agent.name.replace(/\s+/g, '-')} ${withoutMention}`.trimEnd() + ' ';
    });
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const handleInput = (value: string) => {
    setInput(value);
    const match = value.match(/(?:^|\s)@([^\s]*)$/);
    setMentionOpen(Boolean(match));
    setMentionQuery(match?.[1] ?? '');
  };

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    const { agent, query } = resolveMention(content, agents);
    if (!agent) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'system',
        content: 'Select an Aiko agent with @AgentName before sending.',
      }]);
      return;
    }
    if (!query) return;
    setInput('');
    setMentionOpen(false);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content }]);
    setBusy(true);
    try {
      let output = '';
      if (runtime.executeAgentStream) {
        await runtime.executeAgentStream(agent.id, query, (chunk) => {
          output += chunk;
          setMessages((current) => {
            const last = current[current.length - 1];
            if (last?.role === 'assistant' && last.id.startsWith('stream:')) {
              return [...current.slice(0, -1), { ...last, content: output }];
            }
            return [...current, { id: `stream:${crypto.randomUUID()}`, role: 'assistant', content: output }];
          });
        });
      } else {
        const result = await runtime.executeAgent(agent.id, query);
        output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: output }]);
      }
    } catch (error) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'system',
        content: error instanceof Error ? error.message : String(error),
      }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        data-skipo-aiko-chat-trigger="true"
        aria-label={open ? 'Close Aiko Direct Chat' : 'Open Aiko Direct Chat'}
        onClick={() => setOpen((value) => !value)}
        style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 10000 }}
      >
        {open ? '×' : 'Aiko'}
      </button>
      {open && (
        <section
          role="dialog"
          aria-label="Aiko Direct Chat"
          data-skipo-aiko-direct-chat="true"
          style={{
            position: 'fixed', right: 20, bottom: 72, zIndex: 9999,
            width: 'min(520px, calc(100vw - 32px))', height: 'min(680px, calc(100vh - 96px))',
            display: 'flex', flexDirection: 'column', border: '1px solid var(--skipo-border, #333)',
            background: 'var(--skipo-surface, #111)', color: 'var(--skipo-text, #fff)',
            borderRadius: 10, boxShadow: '0 18px 60px rgba(0,0,0,.35)', overflow: 'hidden',
          }}
        >
          <header style={{ padding: 12, borderBottom: '1px solid var(--skipo-border, #333)' }}>
            <strong>Aiko Direct Chat</strong>
            <div style={{ fontSize: 12, opacity: .7 }}>Mention an agent with @AgentName</div>
          </header>
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {messages.map((message) => (
              <div key={message.id} style={{ marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                <strong>{message.role}: </strong>{message.content}
              </div>
            ))}
            {busy && <div aria-live="polite">Aiko is executing…</div>}
          </div>
          <div style={{ position: 'relative', padding: 12, borderTop: '1px solid var(--skipo-border, #333)' }}>
            {mentionOpen && filteredAgents.length > 0 && (
              <div role="listbox" style={{ position: 'absolute', left: 12, right: 12, bottom: 76, border: '1px solid var(--skipo-border, #333)', background: 'var(--skipo-surface, #111)', maxHeight: 220, overflow: 'auto' }}>
                {filteredAgents.map((agent) => (
                  <button key={agent.id} type="button" role="option" onClick={() => selectAgent(agent)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8 }}>
                    <strong>@{agent.name}</strong>{agent.description ? ` — ${agent.description}` : ''}
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => handleInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="@AgentName ask the agent to do something…"
              disabled={busy}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
            <button type="button" onClick={() => void send()} disabled={busy || !input.trim()} style={{ marginTop: 8 }}>
              {busy ? 'Executing…' : 'Send'}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

export default AikoDirectChat;
