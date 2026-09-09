// src/audio-midi/audioInputManager.ts
var AudioInputManager = class {
  audioCtx = null;
  mediaStream = null;
  sourceNode = null;
  channelSplitter = null;
  namedBuses = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  availableDevices = [];
  activeDeviceId = null;
  isDeviceChangeBound = false;
  constructor() {
    this.handleDeviceChange = this.handleDeviceChange.bind(this);
  }
  /**
   * Initializes audio hardware. MUST be gated behind explicit user gesture.
   */
  async initialize(config = { name: "master-in" }) {
    this.assertIframePermissions();
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContextClass({
          latencyHint: "interactive",
          sampleRate: config.sampleRate
        });
      }
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }
      await this.connectAudioStream(config);
      await this.refreshDeviceList();
      if (!this.isDeviceChangeBound && navigator.mediaDevices) {
        navigator.mediaDevices.addEventListener("devicechange", this.handleDeviceChange);
        this.isDeviceChangeBound = true;
      }
      this.notifyListeners();
    } catch (err) {
      this.handleAudioError(err);
      throw err;
    }
  }
  /**
   * Connects raw pro-audio input stream strictly disabling consumer audio processing.
   */
  async connectAudioStream(config) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("navigator.mediaDevices.getUserMedia is unsupported in this environment.");
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
    }
    const constraints = {
      audio: {
        deviceId: config.targetDeviceId ? { exact: config.targetDeviceId } : void 0,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: config.channelCount ?? 2
      },
      video: false
    };
    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.activeDeviceId = config.targetDeviceId ?? "default";
    if (!this.audioCtx) return;
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
    const trackSettings = this.mediaStream.getAudioTracks()[0]?.getSettings();
    const resolvedChannels = trackSettings?.channelCount ?? config.channelCount ?? 2;
    this.channelSplitter = this.audioCtx.createChannelSplitter(resolvedChannels);
    this.sourceNode.connect(this.channelSplitter);
    this.namedBuses.set(config.name, this.channelSplitter);
  }
  /**
   * Accesses a discrete physical channel output from the channel splitter.
   */
  getChannelOutput(channelIndex, busName = "master-in") {
    const bus = this.namedBuses.get(busName);
    if (!bus) {
      throw new Error(`Audio bus "${busName}" not found or not initialized.`);
    }
    return {
      connect: (destinationNode) => bus.connect(destinationNode, channelIndex, 0)
    };
  }
  /**
   * Routes audio element output to a specific device sinkId (monitors/headphones).
   */
  async routeOutputSink(audioElement, deviceId) {
    const el = audioElement;
    if (typeof el.setSinkId === "function") {
      await el.setSinkId(deviceId);
    } else {
      console.warn("HTMLMediaElement.setSinkId is not supported in this browser.");
    }
  }
  /**
   * Enumerates audio input and output devices.
   */
  async refreshDeviceList() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.availableDevices = devices.filter((d) => d.kind === "audioinput" || d.kind === "audiooutput").map((d) => ({
      deviceId: d.deviceId,
      label: d.label || `${d.kind} (${d.deviceId.slice(0, 5)})`,
      kind: d.kind,
      groupId: d.groupId
    }));
    return this.availableDevices;
  }
  getNamedBus(name) {
    return this.namedBuses.get(name);
  }
  getAudioContext() {
    return this.audioCtx;
  }
  getState() {
    return {
      isInitialized: this.audioCtx !== null && this.audioCtx.state === "running",
      activeDeviceId: this.activeDeviceId,
      channelCount: this.channelSplitter?.numberOfOutputs ?? 0,
      availableDevices: [...this.availableDevices],
      sampleRate: this.audioCtx?.sampleRate ?? 44100,
      state: this.audioCtx?.state ?? "suspended"
    };
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }
  async dispose() {
    if (this.isDeviceChangeBound && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener("devicechange", this.handleDeviceChange);
      this.isDeviceChangeBound = false;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      await this.audioCtx.close();
      this.audioCtx = null;
    }
    this.namedBuses.clear();
    this.listeners.clear();
  }
  async handleDeviceChange() {
    await this.refreshDeviceList();
    this.notifyListeners();
  }
  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }
  assertIframePermissions() {
    if (typeof window !== "undefined" && window.self !== window.top) {
      const docWithPolicy = typeof document !== "undefined" ? document : null;
      const isMicrophoneAllowed = docWithPolicy?.featurePolicy?.allowsFeature?.("microphone") ?? true;
      if (!isMicrophoneAllowed) {
        console.warn("Audio Input Warning: Microphone feature may be blocked by parent iframe permissions policy.");
      }
    }
  }
  handleAudioError(err) {
    const error = err;
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      console.error(
        'Audio Permission Denied: If running in an iframe, ensure allow="microphone" is present, or open the application in a new tab.'
      );
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      console.error("Audio Hardware Error: Requested audio input device could not be found.");
    }
  }
};

// src/audio-midi/midiManager.ts
var MidiManager = class {
  midiAccess = null;
  eventListeners = /* @__PURE__ */ new Set();
  stateListeners = /* @__PURE__ */ new Set();
  boundInputs = /* @__PURE__ */ new Set();
  isInitialized = false;
  constructor() {
    this.handleStateChange = this.handleStateChange.bind(this);
  }
  /**
   * Initializes Web MIDI access. MUST be gated behind explicit user gesture.
   */
  async initialize(options = { sysex: true, software: true }) {
    if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) {
      throw new Error("Web MIDI API is not supported in this environment.");
    }
    this.assertIframePermissions();
    try {
      this.midiAccess = await navigator.requestMIDIAccess({
        sysex: options.sysex ?? true,
        software: options.software ?? true
      });
      this.isInitialized = true;
      this.bindExistingPorts();
      this.midiAccess.onstatechange = this.handleStateChange;
      this.notifyState();
    } catch (err) {
      this.handleMidiError(err);
      throw err;
    }
  }
  /**
   * Reactive hot-plug port binding handler.
   */
  handleStateChange(event) {
    if (event.port && event.port.type === "input" && event.port.state === "connected") {
      this.bindMidiPort(event.port);
    }
    this.notifyState();
  }
  /**
   * Binds all existing input ports upon initialization.
   */
  bindExistingPorts() {
    if (!this.midiAccess) return;
    this.midiAccess.inputs.forEach((port) => {
      this.bindMidiPort(port);
    });
  }
  /**
   * Binds onmidimessage handler to a specific MIDIInput port.
   */
  bindMidiPort(port) {
    if (this.boundInputs.has(port.id)) return;
    port.onmidimessage = (msgEvent) => {
      if (!msgEvent.data) return;
      const payload = this.parseRawMidiBytes(msgEvent.data, port.id, port.name || "MIDI Input", msgEvent.timeStamp);
      this.dispatchEvent(payload);
    };
    this.boundInputs.add(port.id);
  }
  /**
   * Virtual MIDI Loopback: On-screen UI components (virtual keyboards, sequencers)
   * can trigger the exact same event streams as physical hardware.
   */
  emitVirtualMidi(payload) {
    const defaultRaw = this.synthesizeRawBytes(payload);
    const fullPayload = {
      command: payload.command,
      channel: payload.channel ?? 1,
      note: payload.note,
      velocity: payload.velocity,
      controller: payload.controller,
      value: payload.value,
      rawBytes: payload.rawBytes ?? defaultRaw,
      timestamp: payload.timestamp ?? (typeof performance !== "undefined" ? performance.now() : Date.now()),
      sourceId: payload.sourceId ?? "virtual",
      sourceName: payload.sourceName ?? "Virtual MIDI Controller"
    };
    this.dispatchEvent(fullPayload);
  }
  /**
   * Translates raw byte arrays into high-level MidiEventPayload.
   */
  parseRawMidiBytes(bytes, sourceId, sourceName, timestamp) {
    const status = bytes[0];
    const commandNibble = status & 240;
    const channel = (status & 15) + 1;
    const b1 = bytes[1] ?? 0;
    const b2 = bytes[2] ?? 0;
    let command = "UNKNOWN";
    let note;
    let velocity;
    let controller;
    let value;
    if (commandNibble === 144) {
      if (b2 === 0) {
        command = "NOTE_OFF";
      } else {
        command = "NOTE_ON";
      }
      note = b1;
      velocity = b2;
    } else if (commandNibble === 128) {
      command = "NOTE_OFF";
      note = b1;
      velocity = b2;
    } else if (commandNibble === 176) {
      command = "CONTROL_CHANGE";
      controller = b1;
      value = b2;
    } else if (commandNibble === 224) {
      command = "PITCH_BEND";
      value = b1 | b2 << 7;
    } else if (commandNibble === 192) {
      command = "PROGRAM_CHANGE";
      value = b1;
    } else if (commandNibble === 208) {
      command = "CHANNEL_PRESSURE";
      value = b1;
    } else if (status === 240) {
      command = "SYSEX";
    } else if (status === 248) {
      command = "CLOCK";
    } else if (status === 250) {
      command = "START";
    } else if (status === 251) {
      command = "CONTINUE";
    } else if (status === 252) {
      command = "STOP";
    }
    return {
      command,
      channel: status >= 240 ? 0 : channel,
      note,
      velocity,
      controller,
      value,
      rawBytes: bytes,
      timestamp,
      sourceId,
      sourceName
    };
  }
  synthesizeRawBytes(payload) {
    const ch = Math.max(0, Math.min(15, (payload.channel ?? 1) - 1));
    switch (payload.command) {
      case "NOTE_ON":
        return new Uint8Array([144 | ch, payload.note ?? 60, payload.velocity ?? 100]);
      case "NOTE_OFF":
        return new Uint8Array([128 | ch, payload.note ?? 60, payload.velocity ?? 0]);
      case "CONTROL_CHANGE":
        return new Uint8Array([176 | ch, payload.controller ?? 1, payload.value ?? 0]);
      case "PITCH_BEND": {
        const val = payload.value ?? 8192;
        return new Uint8Array([224 | ch, val & 127, val >> 7 & 127]);
      }
      case "PROGRAM_CHANGE":
        return new Uint8Array([192 | ch, payload.value ?? 0]);
      default:
        return new Uint8Array([144 | ch, 60, 100]);
    }
  }
  subscribeEvents(listener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }
  subscribeState(listener) {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }
  getState() {
    const inputs = [];
    const outputs = [];
    if (this.midiAccess) {
      this.midiAccess.inputs.forEach((port) => {
        inputs.push({
          id: port.id,
          name: port.name || "Unnamed Input",
          manufacturer: port.manufacturer ?? void 0,
          type: "input",
          state: port.state,
          connection: port.connection
        });
      });
      this.midiAccess.outputs.forEach((port) => {
        outputs.push({
          id: port.id,
          name: port.name || "Unnamed Output",
          manufacturer: port.manufacturer ?? void 0,
          type: "output",
          state: port.state,
          connection: port.connection
        });
      });
    }
    return {
      isSupported: typeof navigator !== "undefined" && !!navigator.requestMIDIAccess,
      isInitialized: this.isInitialized,
      inputs,
      outputs,
      sysexEnabled: this.midiAccess?.sysexEnabled ?? false
    };
  }
  dispose() {
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null;
      this.midiAccess.inputs.forEach((port) => {
        port.onmidimessage = null;
      });
      this.midiAccess = null;
    }
    this.boundInputs.clear();
    this.eventListeners.clear();
    this.stateListeners.clear();
    this.isInitialized = false;
  }
  dispatchEvent(payload) {
    this.eventListeners.forEach((fn) => fn(payload));
  }
  notifyState() {
    const state = this.getState();
    this.stateListeners.forEach((fn) => fn(state));
  }
  assertIframePermissions() {
    if (typeof window !== "undefined" && window.self !== window.top) {
      const docWithPolicy = typeof document !== "undefined" ? document : null;
      const isMidiAllowed = docWithPolicy?.featurePolicy?.allowsFeature?.("midi") ?? true;
      if (!isMidiAllowed) {
        console.warn("MIDI Subsystem Warning: MIDI feature may be blocked by parent iframe permissions policy.");
      }
    }
  }
  handleMidiError(err) {
    const error = err;
    if (error.name === "SecurityError" || error.name === "NotAllowedError") {
      console.error(
        'MIDI Access Blocked: Web MIDI permissions denied or blocked by iframe policy. Ensure allow="midi" is present in iframe attributes or open in a direct browser tab.'
      );
    }
  }
};

export {
  AudioInputManager,
  MidiManager
};
