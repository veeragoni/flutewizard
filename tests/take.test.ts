import { describe, expect, it } from 'vitest';
import { analyseTake } from '../src/audio/customSamples';

const SR = 48000;
function tone(midi: number, seconds: number, cents = 0) {
  const f = 440 * Math.pow(2, (midi - 69 + cents / 100) / 12);
  const x = new Float32Array(Math.floor(SR * (seconds + 1)));
  for (let i = 0; i < x.length; i++) {
    const t = i / SR - 0.5; // half a second of silence first
    if (t < 0 || t > seconds) continue;
    const env = Math.min(1, t / 0.05);
    x[i] = env * (0.3 * Math.sin(2 * Math.PI * f * t) + 0.08 * Math.sin(4 * Math.PI * f * t) + 0.01 * (Math.random() * 2 - 1));
  }
  return x;
}

describe('own recordings', () => {
  it('keeps a steady, right note and measures its tuning', () => {
    const r = analyseTake(tone(64, 2.5, 8), SR, 64);
    expect(r.ok).toBe(true);
    expect(r.cents).toBeGreaterThan(4);
    expect(r.cents).toBeLessThan(12);
    expect(r.seconds).toBeGreaterThan(2);
  });
  it('rejects the wrong note', () => {
    const r = analyseTake(tone(66, 2.5), SR, 64);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/higher by 2 semitones/);
  });
  it('rejects silence and too-short notes', () => {
    expect(analyseTake(new Float32Array(SR * 2), SR, 64).ok).toBe(false);
    expect(analyseTake(tone(64, 0.3), SR, 64).ok).toBe(false);
  });
});
