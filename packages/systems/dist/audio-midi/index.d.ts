/**
 * Pro-Audio Hardware Input/Output Manager (Named Bus Architecture)
 * Enforces raw pro-audio streams, channel splitting, output sink routing, and hot-plugging.
 */
interface AudioDeviceDescriptor {
    deviceId: string;
    label: string;
    kind: MediaDeviceKind;
    groupId: string;
}
interface AudioBusConfig {
    name: string;
    targetDeviceId?: string;
    channelCount?: number;
    sampleRate?: number;
}
interface AudioHardwareState {
    isInitialized: boolean;
    activeDeviceId: string | null;
    channelCount: number;
    availableDevices: AudioDeviceDescriptor[];
    sampleRate: number;
    state: AudioContextState;
}
type AudioStateListener = (state: AudioHardwareState) => void;
declare class AudioInputManager {
    private audioCtx;
    private mediaStream;
    private sourceNode;
    private channelSplitter;
    private namedBuses;
    private listeners;
    private availableDevices;
    private activeDeviceId;
    private isDeviceChangeBound;
    constructor();
    /**
     * Initializes audio hardware. MUST be gated behind explicit user gesture.
     */
    initialize(config?: AudioBusConfig): Promise<void>;
    /**
     * Connects raw pro-audio input stream strictly disabling consumer audio processing.
     */
    connectAudioStream(config: AudioBusConfig): Promise<void>;
    /**
     * Accesses a discrete physical channel output from the channel splitter.
     */
    getChannelOutput(channelIndex: number, busName?: string): AudioNode;
    /**
     * Routes audio element output to a specific device sinkId (monitors/headphones).
     */
    routeOutputSink(audioElement: HTMLMediaElement, deviceId: string): Promise<void>;
    /**
     * Enumerates audio input and output devices.
     */
    refreshDeviceList(): Promise<AudioDeviceDescriptor[]>;
    getNamedBus(name: string): AudioNode | undefined;
    getAudioContext(): AudioContext | null;
    getState(): AudioHardwareState;
    subscribe(listener: AudioStateListener): () => void;
    dispose(): Promise<void>;
    private handleDeviceChange;
    private notifyListeners;
    private assertIframePermissions;
    private handleAudioError;
}

/**
 * Pro-MIDI Subsystem (Reactive Port Binding & Virtual Loopback)
 * Translates raw byte arrays into high-level MidiEventPayloads, handles hot-plugging and virtual emitting.
 */
type MidiCommandType = 'NOTE_ON' | 'NOTE_OFF' | 'CONTROL_CHANGE' | 'PITCH_BEND' | 'PROGRAM_CHANGE' | 'CHANNEL_PRESSURE' | 'POLY_PRESSURE' | 'CLOCK' | 'START' | 'STOP' | 'CONTINUE' | 'SYSEX' | 'UNKNOWN';
interface MidiEventPayload {
    command: MidiCommandType;
    channel: number;
    note?: number;
    velocity?: number;
    controller?: number;
    value?: number;
    rawBytes: Uint8Array;
    timestamp: number;
    sourceId: string;
    sourceName: string;
}
interface MidiPortDescriptor {
    id: string;
    name: string;
    manufacturer?: string;
    type: 'input' | 'output';
    state: string;
    connection: string;
}
interface MidiSubsystemState {
    isSupported: boolean;
    isInitialized: boolean;
    inputs: MidiPortDescriptor[];
    outputs: MidiPortDescriptor[];
    sysexEnabled: boolean;
}
type MidiEventListener = (event: MidiEventPayload) => void;
type MidiStateListener = (state: MidiSubsystemState) => void;
declare class MidiManager {
    private midiAccess;
    private eventListeners;
    private stateListeners;
    private boundInputs;
    private isInitialized;
    constructor();
    /**
     * Initializes Web MIDI access. MUST be gated behind explicit user gesture.
     */
    initialize(options?: {
        sysex?: boolean;
        software?: boolean;
    }): Promise<void>;
    /**
     * Reactive hot-plug port binding handler.
     */
    private handleStateChange;
    /**
     * Binds all existing input ports upon initialization.
     */
    private bindExistingPorts;
    /**
     * Binds onmidimessage handler to a specific MIDIInput port.
     */
    bindMidiPort(port: MIDIInput): void;
    /**
     * Virtual MIDI Loopback: On-screen UI components (virtual keyboards, sequencers)
     * can trigger the exact same event streams as physical hardware.
     */
    emitVirtualMidi(payload: Partial<MidiEventPayload> & {
        command: MidiCommandType;
    }): void;
    /**
     * Translates raw byte arrays into high-level MidiEventPayload.
     */
    parseRawMidiBytes(bytes: Uint8Array, sourceId: string, sourceName: string, timestamp: number): MidiEventPayload;
    private synthesizeRawBytes;
    subscribeEvents(listener: MidiEventListener): () => void;
    subscribeState(listener: MidiStateListener): () => void;
    getState(): MidiSubsystemState;
    dispose(): void;
    private dispatchEvent;
    private notifyState;
    private assertIframePermissions;
    private handleMidiError;
}

export { type AudioBusConfig, type AudioDeviceDescriptor, type AudioHardwareState, AudioInputManager, type AudioStateListener, type MidiCommandType, type MidiEventListener, type MidiEventPayload, MidiManager, type MidiPortDescriptor, type MidiStateListener, type MidiSubsystemState };
