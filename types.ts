export interface Note {
  index: number; // 0-11
  name: string;
}

export interface GridNode {
  lx: number; // Lattice X (P5 axis)
  ly: number; // Lattice Y (M3 axis)
  noteIndex: number;
  id: string; // Unique string key "lx,ly"
  screenX: number;
  screenY: number;
}

export type ViewMode = 'notes' | 'chords';

export type ChordType = 
  | 'Major' | 'Minor' | 'Diminished' | 'Augmented' 
  | 'Sus2' | 'Sus4' | 'Maj6' | 'Min6' | 'Add9'
  | 'Maj7' | 'Min7' | 'Dom7' | 'HalfDim7' | 'Dim7'
  | 'Maj9' | 'Min9' | 'Dom9' 
  | 'Maj11' | 'Maj13';

export interface ChordDefinition {
  name: string;
  intervals: number[];
}