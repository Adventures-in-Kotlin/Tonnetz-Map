import { ChordDefinition, Note } from '../types';

export const NOTES: Note[] = [
  { index: 0, name: 'C' },
  { index: 1, name: 'C#' },
  { index: 2, name: 'D' },
  { index: 3, name: 'D#' },
  { index: 4, name: 'E' },
  { index: 5, name: 'F' },
  { index: 6, name: 'F#' },
  { index: 7, name: 'G' },
  { index: 8, name: 'G#' },
  { index: 9, name: 'A' },
  { index: 10, name: 'A#' },
  { index: 11, name: 'B' },
];

export const CHORDS: Record<string, ChordDefinition> = {
  // Triads
  Major: { name: 'Major', intervals: [0, 4, 7] },
  Minor: { name: 'Minor', intervals: [0, 3, 7] },
  Augmented: { name: 'Augmented', intervals: [0, 4, 8] },
  Diminished: { name: 'Diminished', intervals: [0, 3, 6] },

  // Suspended & Adds & 6ths
  Sus2: { name: 'Sus2', intervals: [0, 2, 7] },
  Sus4: { name: 'Sus4', intervals: [0, 5, 7] },
  Maj6: { name: 'Maj6', intervals: [0, 4, 7, 9] },
  Min6: { name: 'Min6', intervals: [0, 3, 7, 9] },
  Add9: { name: 'Add9', intervals: [0, 4, 7, 2] },

  // 7ths
  Maj7: { name: 'Maj7', intervals: [0, 4, 7, 11] },
  Min7: { name: 'Min7', intervals: [0, 3, 7, 10] },
  Dom7: { name: 'Dom7', intervals: [0, 4, 7, 10] },
  HalfDim7: { name: 'Half-Dim7', intervals: [0, 3, 6, 10] }, // m7b5
  Dim7: { name: 'Full Dim7', intervals: [0, 3, 6, 9] },

  // Extensions
  Maj9: { name: 'Maj9', intervals: [0, 4, 7, 11, 2] },
  Min9: { name: 'Min9', intervals: [0, 3, 7, 10, 2] },
  Dom9: { name: 'Dom9', intervals: [0, 4, 7, 10, 2] },
  Maj11: { name: 'Maj11', intervals: [0, 4, 7, 11, 2, 5] },
  Maj13: { name: 'Maj13', intervals: [0, 4, 7, 11, 2, 9] },
};

// Modulo helper that handles negative numbers correctly
export const mod = (n: number, m: number): number => {
  return ((n % m) + m) % m;
};

// Calculate pitch class for a given grid coordinate
export const getPitchClass = (lx: number, ly: number): number => {
  return mod(lx * 7 + ly * 4, 12);
};

// Get the 6 immediate neighbors on the Tonnetz lattice
export const getNeighbors = (lx: number, ly: number): {lx: number, ly: number}[] => {
  return [
    { lx: lx + 1, ly: ly },     // P5 (+7)
    { lx: lx - 1, ly: ly },     // P4 (+5)
    { lx: lx, ly: ly + 1 },     // M3 (+4)
    { lx: lx, ly: ly - 1 },     // m6 (+8)
    { lx: lx + 1, ly: ly - 1 }, // m3 (+3)
    { lx: lx - 1, ly: ly + 1 }  // M6 (+9)
  ];
};

// Find grid coordinates for a chord by constructing a connected path
export const findChordLayout = (rootLx: number, rootLy: number, intervals: number[]): {lx: number, ly: number}[] => {
  const selected = [{lx: rootLx, ly: rootLy}];
  const rootPC = getPitchClass(rootLx, rootLy);
  
  // Iterate through intervals (skipping root which is 0)
  for (let i = 1; i < intervals.length; i++) {
    const targetPC = mod(rootPC + intervals[i], 12);
    
    // Breadth-First Search to find the closest node matching targetPC
    // Prioritizing connectivity to the last added node, then other selected nodes
    
    const queue: {lx: number, ly: number, dist: number}[] = [];
    const visited = new Set<string>();
    
    // Mark already selected nodes as visited so we don't select them again
    selected.forEach(n => visited.add(`${n.lx},${n.ly}`));

    const enqueue = (lx: number, ly: number, dist: number) => {
        const key = `${lx},${ly}`;
        if (!visited.has(key)) {
            visited.add(key);
            queue.push({lx, ly, dist});
        }
    };
    
    // Priority 1: Neighbors of the last note in the sequence
    const lastNode = selected[selected.length - 1];
    getNeighbors(lastNode.lx, lastNode.ly).forEach(n => enqueue(n.lx, n.ly, 1));
    
    // Priority 2: Neighbors of all other selected nodes
    for (let j = 0; j < selected.length - 1; j++) {
        getNeighbors(selected[j].lx, selected[j].ly).forEach(n => enqueue(n.lx, n.ly, 1));
    }
    
    let found = null;
    let head = 0;
    
    // Execute BFS
    while(head < queue.length) {
        const curr = queue[head++];
        
        if (getPitchClass(curr.lx, curr.ly) === targetPC) {
            found = curr;
            break;
        }
        
        // Expand search radius slightly if needed (though neighbors usually suffice)
        if (curr.dist < 4) {
             getNeighbors(curr.lx, curr.ly).forEach(n => enqueue(n.lx, n.ly, curr.dist + 1));
        }
    }
    
    if (found) {
        selected.push({lx: found.lx, ly: found.ly});
    }
  }
  
  return selected;
};