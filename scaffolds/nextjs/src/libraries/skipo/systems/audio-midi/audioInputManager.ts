/**
 * ASCII Architecture Flowchart: audioInputManager
 *
 *   ┌──────────────────────────────────────┐
 *   │     Initialize audioInputManager     │
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

// ════ AUDIOINPUTMANAGER BACKWARD-COMPATIBLE BARREL FACADE ═════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export * from './audioInputManager/audioInputManager';
export * from './audioInputManager/types';
export { AudioInputManager as default } from './audioInputManager/audioInputManager';