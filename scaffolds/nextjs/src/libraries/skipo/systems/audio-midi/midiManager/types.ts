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

// ════ MIDIMANAGER EXTRACTED TYPES ═════════════════════════════════════════════════
export type MidiCommandType =
  | 'NOTE_ON'
  | 'NOTE_OFF'
  | 'CONTROL_CHANGE'
  | 'PITCH_BEND'
  | 'PROGRAM_CHANGE'
  | 'CHANNEL_PRESSURE'
  | 'POLY_PRESSURE'
  | 'CLOCK'
  | 'START'
  | 'STOP'
  | 'CONTINUE'
  | 'SYSEX'
  | 'UNKNOWN';

export interface MidiEventPayload {
  command: MidiCommandType;
  channel: number;       // 1 - 16 (0 for system messages)
  note?: number;          // 0 - 127
  velocity?: number;      // 0 - 127
  controller?: number;    // 0 - 127
  value?: number;         // 0 - 127 (or 0 - 16383 for pitch bend)
  rawBytes: Uint8Array;
  timestamp: number;
  sourceId: string;       // Hardware port ID or 'virtual'
  sourceName: string;
}
export interface MidiPortDescriptor {
  id: string;
  name: string;
  manufacturer?: string;
  type: 'input' | 'output';
  state: string;
  connection: string;
}
export interface MidiSubsystemState {
  isSupported: boolean;
  isInitialized: boolean;
  inputs: MidiPortDescriptor[];
  outputs: MidiPortDescriptor[];
  sysexEnabled: boolean;
}
export type MidiEventListener = (event: MidiEventPayload) => void;
export type MidiStateListener = (state: MidiSubsystemState) => void;