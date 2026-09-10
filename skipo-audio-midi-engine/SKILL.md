---
name: skipo-audio-midi-engine
description: Architectural invariants, hardware I/O, Web Audio Named Bus routing, reactive Web MIDI port binding, and iframe security.
---

# SKIPO AUDIO & MIDI ENGINE ARCHITECTURE

## 1. HARDWARE AUDIO I/O: NAMED BUS SPEC

$$\begin{array}{ll}
\mathbf{A_1} \text{ (Pro-Audio Constraints)} & \text{echoCancellation} = \text{false} \wedge \text{noiseSuppression} = \text{false} \wedge \text{autoGainControl} = \text{false} \\
\mathbf{A_2} \text{ (Channel Splitting)} & \text{stream} \to \text{MediaStreamAudioSourceNode} \to \text{ChannelSplitterNode}(N) \to \text{NamedBus} \\
\mathbf{A_3} \text{ (User Gesture Gate)} & \text{Init}(\text{AudioContext}) \subset \text{UserGestureEvents} \wedge (\text{InitOnMount} = \text{FORBIDDEN})
\end{array}$$

```typescript
// Strict anti-filtering raw pro-audio capture
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 }
});
```

## 2. REACTIVE MIDI & VIRTUAL LOOPBACK

$$\mathbf{M_1} \text{ (Access)} \implies \text{requestMIDIAccess}(\{\text{sysex: true, software: true}\})$$

$$\mathbf{M_2} \text{ (Loopback)} \implies \text{Stream}(\text{MidiEvent}) = \text{HardwarePorts} \cup \text{VirtualUIEmit}$$

```typescript
midiAccess.onstatechange = (e) => e.port.state === 'connected' && bindPort(e.port);
export const emitVirtualMidi = (event: MidiEventPayload) => dispatchMidi(event);
```

## 3. IFRAME PERMISSIONS GUARD

Catch `NotAllowedError` / `SecurityError` $\to$ display fallback: `"Hardware access requires allow='microphone; midi' or new tab"`.
