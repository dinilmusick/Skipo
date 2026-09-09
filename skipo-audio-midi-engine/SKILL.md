---
name: skipo-audio-midi-engine
description: Architectural invariants, hardware I/O, Web Audio Named Bus routing, reactive Web MIDI port binding, virtual loopback, and iframe permission security policies for Skipo audio and MIDI applications.
---

# SKIPO AUDIO & MIDI ENGINE ARCHITECTURE (`skipo-audio-midi-engine`)

All future applications requiring Web Audio API or Web MIDI hardware connectivity **MUST** adhere to these architectural invariants to avoid common iframe, browser permission, audio distortion, and hardware routing failures.

---

## 1. AUDIO HARDWARE I/O: NAMED BUS ARCHITECTURE
Audio engines must decouple UI nodes and business logic from physical hardware via a **Named Bus Abstraction Layer** (`AudioInputManager`).

### A. Pro-Audio Stream Constraints (Strict Anti-Filtering Mandate)
When invoking `navigator.mediaDevices.getUserMedia()`, the application **MUST strictly disable consumer audio processing**. 
Standard browser speech processors (AEC, NS, AGC) treat low-end bass frequencies, synthesizers, and sustained instrument notes as "background noise" and aggressively filter or distort them:

```typescript
const constraints: MediaStreamConstraints = {
  audio: {
    deviceId: targetDevId ? { exact: targetDevId } : undefined,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: channelCount ?? 2
  },
  video: false
};
const stream = await navigator.mediaDevices.getUserMedia(constraints);
```

### B. Multi-Channel Interface Support (Channel Splitting)
For multi-channel pro interfaces (e.g. Focusrite Scarlett 18i20, Universal Audio Apollo, MOTU), route the raw `MediaStreamAudioSourceNode` into a dedicated `ChannelSplitterNode`:
```typescript
const sourceNode = audioCtx.createMediaStreamSource(stream);
const channelSplitter = audioCtx.createChannelSplitter(resolvedChannelCount);
sourceNode.connect(channelSplitter);
namedBuses.set('master-in', channelSplitter);
```
Consumers bind to individual discrete hardware inputs using `bus.connect(destinationNode, physicalChannelIndex, 0)`.

### C. Output Sink Routing
Applications must not assume the system default output is the target monitor:
- Use `HTMLMediaElement.setSinkId(deviceId)` to route outputs directly to physical studio monitors or cue headphone mixes.

### D. Hot-Plugging Support
- Register an event listener on `navigator.mediaDevices.addEventListener('devicechange', ...)` to dynamically re-enumerate interfaces without requiring an application reload.

---

## 2. MIDI SUBSYSTEM: REACTIVE PORT BINDING & VIRTUAL LOOPBACK
The MIDI manager (`MidiManager`) acts as a centralized, reactive event dispatch hub translating raw MIDI bytes into high-level structured events (`MidiEventPayload`).

### A. Initialization Options
Always request access supporting virtual MIDI cables and SysEx communication:
```typescript
const midiAccess = await navigator.requestMIDIAccess({
  sysex: true,
  software: true
});
```

### B. Reactive Hot-Plug Port Binding
Bind listeners to all existing ports upon initialization, **and** immediately hook the `onstatechange` event of `MIDIAccess` to automatically discover and bind controllers connected while the application is active:
```typescript
midiAccess.onstatechange = (event: MIDIConnectionEvent) => {
  if (event.port.type === 'input' && event.port.state === 'connected') {
    bindMidiPort(event.port as MIDIInput);
  }
};

function bindMidiPort(port: MIDIInput) {
  port.onmidimessage = (msgEvent: MIDIMessageEvent) => {
    if (!msgEvent.data) return;
    const payload = parseRawMidiBytes(msgEvent.data, port.id, port.name, msgEvent.timeStamp);
    dispatchEvent(payload);
  };
}
```

### C. Virtual MIDI Loopback
The subsystem MUST expose an `emitVirtualMidi(payload)` method:
- Enables on-screen UI components (piano rolls, onscreen keyboards, algorithmic sequencers, touch drum pads) to emit into the exact same event stream as physical hardware controllers.

---

## 3. CRITICAL SECURITY & UX ERROR AVOIDANCE

### A. User Gesture Gating (Autoplay Policy Invariant)
- **NEVER** initialize `AudioContext`, request `getUserMedia()`, or call `requestMIDIAccess()` during page load or component mount.
- Hardware initialization **MUST** be explicitly gated behind a user interaction (e.g., clicking a `"Connect Audio/MIDI"` button or starting playback).

### B. Iframe Sandbox & Permission Policy Awareness
Applications running within iframes (e.g., embedded IDEs, testing playgrounds, modal previews) must defensively inspect permission policies:
- Inspect `document.featurePolicy?.allowsFeature('microphone')` and `('midi')`.
- Catch DOM Exceptions (`NotAllowedError`, `SecurityError`, `NotFoundError`).
- Provide immediate, actionable fallback UI informing the user:
  > *"Hardware access blocked by iframe policy. Grant `allow="microphone; midi"` or open application in a new tab."*

---

## 4. CANONICAL CODE TEMPLATES LOCATION
- Audio Manager: [`skipo-audio-midi-engine/audioInputManager.ts`](./audioInputManager.ts)
- MIDI Manager: [`skipo-audio-midi-engine/midiManager.ts`](./midiManager.ts)
- Root Exports: [`skipo-audio-midi-engine/index.ts`](./index.ts)
