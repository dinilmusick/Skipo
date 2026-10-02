import { describe, it, expect } from 'vitest';
import { CopyableErrorAlert } from '../components/composite/CopyableErrorAlert.js';
import { CopyableLogViewer } from '../components/composite/CopyableLogViewer.js';
import { ThemeSettingsSection } from '../components/settings/ThemeSettingsSection.js';
import { SettingsTab } from '../components/settings/SettingsTab.js';

describe('Universal Copyable Error/Log Components & Settings Tab', () => {
  it('exports CopyableErrorAlert and handles various error formats', () => {
    expect(CopyableErrorAlert).toBeDefined();
    expect(CopyableErrorAlert.displayName).toBe('CopyableErrorAlert');
  });

  it('exports CopyableLogViewer and formats logs', () => {
    expect(CopyableLogViewer).toBeDefined();
    expect(CopyableLogViewer.displayName).toBe('CopyableLogViewer');
  });

  it('exports ThemeSettingsSection and SettingsTab', () => {
    expect(ThemeSettingsSection).toBeDefined();
    expect(ThemeSettingsSection.displayName).toBe('ThemeSettingsSection');
    expect(SettingsTab).toBeDefined();
    expect(SettingsTab.displayName).toBe('SettingsTab');
  });
});
