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
