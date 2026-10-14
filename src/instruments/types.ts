/** 0 = open, 0.5 = half-holed, 1 = closed. Holes are listed from the mouthpiece end downward. */
export type HoleState = 0 | 0.5 | 1;

/** Keys on a Boehm-system C flute that can be pressed. */
export type ConcertKey =
  | 'Tb' // left thumb on the B-flat lever
  | 'T' // left thumb on the B key
  | 'L1' | 'L2' | 'L3'
  | 'Gs' // left pinky G# key
  | 'R1' | 'R2' | 'R3'
  | 'Tr1' | 'Tr2' // first and second trill keys (worked by right index/middle finger)
  | 'Eb' // right pinky D#/E-flat key
  | 'Cs' // right pinky C# roller (foot joint)
  | 'C'; // right pinky low C roller (foot joint)

export interface KeyFingering {
  keys: ConcertKey[];
  /** Short note for players, e.g. "thumb B-flat" or "trill key". */
  hint?: string;
}

export interface HoleFingering {
  holes: HoleState[];
  /** Register: 1 = gentle breath, 2 = overblown, 3 = third register. */
  register: 1 | 2 | 3;
  hint?: string;
}

/** Fingering chart keyed by semitone offset (meaning depends on the instrument, see each data file). */
export type FingeringTable<F> = Record<number, { primary: F; alternates?: F[] }>;
