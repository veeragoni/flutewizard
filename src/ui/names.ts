import { noteName, sargamName, sargamOctaveLabel, useFlatsForKey } from '../music/theory';
import { naming, tonic } from '../state';

/** Main label for a note in the current naming system (Sargam relative to Sa, or letters). */
export function label(midi: number, opts: { octave?: boolean } = {}): string {
  if (naming.value === 'sargam') return sargamName(midi, tonic.value);
  return noteName(midi, { flats: useFlatsForKey(tonic.value), octave: opts.octave ?? true });
}

/** Secondary label: the other system, so learners connect both. */
export function subLabel(midi: number): string {
  if (naming.value === 'sargam') return `${sargamOctaveLabel(midi, tonic.value)} · ${noteName(midi, { flats: useFlatsForKey(tonic.value) })}`;
  return noteName(midi);
}
