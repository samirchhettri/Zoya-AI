/**
 * Utility functions for audio processing.
 */

/**
 * Converts Float32Array to Int16Array (PCM16).
 */
export function float32ToInt16(buffer: Float32Array): Int16Array {
  const l = buffer.length;
  const buf = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return buf;
}

/**
 * Converts Int16Array (PCM16) to Float32Array.
 */
export function int16ToFloat32(buffer: Int16Array): Float32Array {
  const l = buffer.length;
  const buf = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    buf[i] = buffer[i] / (buffer[i] < 0 ? 0x8000 : 0x7fff);
  }
  return buf;
}

/**
 * Encodes ArrayBuffer to Base64.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Decodes Base64 to ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
