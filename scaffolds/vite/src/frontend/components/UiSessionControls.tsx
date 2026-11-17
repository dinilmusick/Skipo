'use client';

import { useEffect, useRef, useState } from 'react';
import { BaseButton, getFloksFrnlFrontendApi } from '@ultrst-armada/floks/ui';
import { startFrnlUiSession } from '@ultrst-armada/frnlts/runtime';

export function UiSessionControls({ request }: { request: typeof fetch }) {
  const [enabled, setEnabled] = useState(false);
  const [endpoint, setEndpoint] = useState<string>();
  const [failed, setFailed] = useState(false);
  const session = useRef<ReturnType<typeof startFrnlUiSession> | null>(null);

  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).get('inspectUi') === '1');
    const stop = () => {
      session.current?.stop();
      session.current = null;
      setEndpoint(undefined);
    };
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, []);

  if (!enabled) return null;

  function toggle() {
    if (session.current) {
      session.current.stop();
      session.current = null;
      setEndpoint(undefined);
      setFailed(false);
      return;
    }
    session.current = startFrnlUiSession({
      api: getFloksFrnlFrontendApi(),
      request,
      allowAction: (component, action) => component.type === 'tilesMenu' && ['select', 'search'].includes(action),
      describe: (component) => component.type === 'tilesMenu' ? {
        visibleTiles: component.properties.visibleTiles,
        selectedId: component.properties.selectedId,
      } : undefined,
      onError: () => setFailed(true),
    });
    setEndpoint(session.current.endpoint);
  }

  return (
    <aside aria-label="UI inspection">
      <BaseButton type="button" onClick={toggle}>{endpoint ? 'Stop UI inspection' : 'Start UI inspection'}</BaseButton>
      {endpoint && <output aria-live="polite">{endpoint}</output>}
      {failed && <p role="status">The UI inspection session could not sync.</p>}
    </aside>
  );
}
