import React, { useState } from 'react';

export function MainPage({ children }: { children?: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div data-skipo-main-page="true" style={{ minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
        <button type="button" onClick={() => setSettingsOpen(value => !value)}>Settings</button>
      </header>
      <main>{settingsOpen ? <div>Settings</div> : children}</main>
    </div>
  );
}

export default MainPage;
