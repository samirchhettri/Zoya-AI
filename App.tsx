import { float32ToInt16, int16ToFloat32, arrayBufferToBase64 } from "./audio-utils";

export type AudioStreamerCallback = (base64Data: string) => void;

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyzer: AnalyserNode | null = null;
  
  private playbackContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private audioQueue: AudioBuffer[] = [];

  constructor() {}

  async start(onAudioData: AudioStreamerCallback) {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Analyzer for visualization
    this.analyzer = this.audioContext.createAnalyser();
    this.analyzer.fftSize = 256;
    this.source.connect(this.analyzer);

    // Capture mono 16kHz
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = float32ToInt16(inputData);
      const base64 = arrayBufferToBase64(pcm16.buffer);
      onAudioData(base64);
    };

    // Playback setup
    this.playbackContext = new AudioContext({ sampleRate: 24000 });
    this.nextStartTime = this.playbackContext.currentTime;
  }

  stop() {
    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.processor?.disconnect();
    this.source?.disconnect();
    this.audioContext?.close();
    this.playbackContext?.close();
    this.audioContext = null;
    this.playbackContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.source = null;
  }

  addAudioChunk(base64Data: string) {
    if (!this.playbackContext) return;

    const arrayBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
    const pcm16 = new Int16Array(arrayBuffer);
    const float32 = int16ToFloat32(pcm16);

    const audioBuffer = this.playbackContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    this.playBuffer(audioBuffer);
  }

  private playBuffer(buffer: AudioBuffer) {
    if (!this.playbackContext) return;

    const source = this.playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackContext.destination);

    const currentTime = this.playbackContext.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  clearQueue() {
    // For interruptions, we want to stop current playback
    // This is hard with ScriptProcessor/BufferSource patterns without keeping track of all sources
    // In a real app we'd use a more sophisticated scheduler.
    // Simplifying: we'll restart the playback context for a "hard stop"
    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = this.playbackContext.currentTime;
    }
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyzer) return new Uint8Array(0);
    const data = new Uint8Array(this.analyzer.frequencyBinCount);
    this.analyzer.getByteFrequencyData(data);
    return data;
  }
}
