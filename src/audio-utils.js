export function getRecorderOptions() {
  if (!window.MediaRecorder?.isTypeSupported) return null;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  const mimeType = candidates.find(candidate => MediaRecorder.isTypeSupported(candidate));
  return mimeType ? { mimeType } : null;
}

export async function normalizeRecordedAudio(recordedBlob) {
  try {
    return await convertBlobToWav(recordedBlob);
  } catch (error) {
    console.warn('[CliNotes] Could not convert recording to WAV; sending original browser recording.', error);
    return recordedBlob;
  }
}

async function convertBlobToWav(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('AudioContext is not supported in this browser.');

  const audioContext = new AudioContextClass();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const wavBuffer = encodeAudioBufferAsWav(audioBuffer);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } finally {
    if (typeof audioContext.close === 'function') {
      await audioContext.close();
    }
  }
}

function encodeAudioBufferAsWav(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = interleaveAudioChannels(audioBuffer);
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
}

function interleaveAudioChannels(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const result = new Float32Array(length * numberOfChannels);

  for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      result[sampleIndex * numberOfChannels + channel] = audioBuffer.getChannelData(channel)[sampleIndex];
    }
  }

  return result;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export class PCMRecorder {
  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.mimeType = 'audio/wav';
    this.audioContext = null;
    this.processor = null;
    this.source = null;
    this.chunks = [];
  }

  start(timeslice) {
    if (this.state !== 'inactive') return;
    this.state = 'recording';
    this.chunks = [];

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.source = this.audioContext.createMediaStreamAudioSource(this.stream);
    
    // 4096 buffer size, 1 input channel, 1 output channel
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      if (this.state !== 'recording') return;
      const channelData = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(channelData));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  async stop() {
    if (this.state !== 'recording') return;
    this.state = 'inactive';

    if (this.source) {
      this.source.disconnect();
    }
    if (this.processor) {
      this.processor.disconnect();
    }

    const sampleRate = this.audioContext.sampleRate;
    if (this.audioContext && typeof this.audioContext.close === 'function') {
      try {
        await this.audioContext.close();
      } catch (err) {
        console.warn('[CliNotes] Error closing AudioContext:', err);
      }
    }

    // Concatenate all recorded Float32Array chunks
    let totalLength = 0;
    for (const chunk of this.chunks) {
      totalLength += chunk.length;
    }
    const samples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    // Encode to WAV format
    const wavBuffer = this.encodeWAV(samples, sampleRate);
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

    if (this.ondataavailable) {
      this.ondataavailable({ data: wavBlob });
    }
    if (this.onstop) {
      this.onstop();
    }
  }

  encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    /* RIFF identifier */
    this.writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    this.writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    this.writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    this.writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    // Write PCM samples (16-bit signed integer)
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }

    return buffer;
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

export function createAudioRecorder(stream) {
  // Check if browser is Chromium-based
  const isChromium = /Chrome|Chromium|CriOS/i.test(navigator.userAgent);
  if (isChromium) {
    console.log('[CliNotes] Chromium browser detected. Using PCMRecorder.');
    return new PCMRecorder(stream);
  }
  
  console.log('[CliNotes] Non-Chromium browser detected. Using native MediaRecorder.');
  const recorderOptions = getRecorderOptions();
  return recorderOptions
    ? new MediaRecorder(stream, recorderOptions)
    : new MediaRecorder(stream);
}
