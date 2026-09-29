/**
 * ASCII Architecture Flowchart: midiManager
 *
 *   ┌──────────────────────────────────────┐
 *   │        Initialize midiManager        │
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

// ════ MIDIMANAGER BACKWARD-COMPATIBLE BARREL FACADE ═══════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export * from './midiManager/midiManager';
export * from './midiManager/types';
export { MidiManager as default } from './midiManager/midiManager';