export const ORB_BARS = 13;

const timeBuf = new Uint8Array(256);
const freqBuf = new Uint8Array(128);

export function createAnalyser(ctx: AudioContext, stream: MediaStream) {
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 256;
  an.smoothingTimeConstant = 0.75;
  src.connect(an);
  return an;
}

/** RMS level, scaled to 0–1. */
export function levelOf(an: AnalyserNode | null) {
  if (!an) return 0;
  an.getByteTimeDomainData(timeBuf);
  let s = 0;
  for (let i = 0; i < timeBuf.length; i++) {
    const v = (timeBuf[i] - 128) / 128;
    s += v * v;
  }
  return Math.min(1, Math.sqrt(s / timeBuf.length) * 4);
}

/** ORB_BARS bands from the lower (voice) half of the spectrum, each 0–1. */
export function readBands(an: AnalyserNode, out: number[]) {
  an.getByteFrequencyData(freqBuf);
  const usable = 64;
  for (let i = 0; i < ORB_BARS; i++) {
    const a = Math.floor((i * usable) / ORB_BARS), b = Math.floor(((i + 1) * usable) / ORB_BARS);
    let sum = 0;
    for (let k = a; k < b; k++) sum += freqBuf[k];
    out[i] = sum / ((b - a) * 255);
  }
  return out;
}
