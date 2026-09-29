/**
 * ASCII Architecture Flowchart: types
 *
 *   ┌──────────────────────────────────────┐
 *   │           Initialize types           │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │  Execute Component / Pipeline Logic  │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │    Return State / Result Payload     │
 *   └──────────────────────────────────────┘
 */

// ════ AUDIOINPUTMANAGER EXTRACTED TYPES ═══════════════════════════════════════════
export interface AudioDeviceDescriptor {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
  groupId: string;
}
export interface AudioBusConfig {
  name: string;
  targetDeviceId?: string;
  channelCount?: number;
  sampleRate?: number;
}
export interface AudioHardwareState {
  isInitialized: boolean;
  activeDeviceId: string | null;
  channelCount: number;
  availableDevices: AudioDeviceDescriptor[];
  sampleRate: number;
  state: AudioContextState;
}
export type AudioStateListener = (state: AudioHardwareState) => void;