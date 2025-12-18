import * as Tone from 'tone';

export type InstrumentType = 'Synth' | 'AMSynth' | 'FMSynth' | 'DuoSynth' | 'MembraneSynth';

let currentSynthType: InstrumentType = 'Synth';
let synth: Tone.PolySynth | null = null;

const getConstructor = (type: InstrumentType) => {
  switch (type) {
    case 'AMSynth': return Tone.AMSynth;
    case 'FMSynth': return Tone.FMSynth;
    case 'DuoSynth': return Tone.DuoSynth;
    case 'MembraneSynth': return Tone.MembraneSynth;
    default: return Tone.Synth;
  }
};

const ensureSynth = (type: InstrumentType = currentSynthType) => {
  if (!synth || type !== currentSynthType) {
    if (synth) {
      synth.dispose();
    }
    currentSynthType = type;
    
    // @ts-ignore - PolySynth accepts these constructors
    synth = new Tone.PolySynth(getConstructor(type)).toDestination();
    
    // Default nice settings for most synths
    synth.set({
      volume: -12
    });

    if (type === 'Synth') {
        synth.set({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
        });
    } else if (type === 'MembraneSynth') {
        synth.set({
            envelope: {
                attack: 0.001,
                decay: 0.4,
                sustain: 0.01,
                release: 1.4
            },
            octaves: 10,
            pitchDecay: 0.05
        });
    }
  }
  return synth;
};

export const setInstrument = (type: InstrumentType) => {
    ensureSynth(type);
};

// Map note names to their pitch class (0-11)
const NOTE_TO_PC: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

export const playNote = async (note: string, octave: number = 4) => {
  if (Tone.getContext().state !== 'running') {
    await Tone.start();
  }
  const s = ensureSynth();
  s.triggerAttackRelease(`${note}${octave}`, '8n');
};

/**
 * Plays a chord with intelligent octave wrapping to ensure 
 * the chord sounds "correctly" voiced (ascending from the root).
 */
export const playChord = async (notes: string[], baseOctave: number = 4) => {
  if (Tone.getContext().state !== 'running') {
    await Tone.start();
  }
  const s = ensureSynth();

  let lastMidiValue = -1;

  const notesWithOctave = notes.map((noteName, index) => {
    // Strip existing octaves if present
    const cleanName = noteName.replace(/[0-9]/g, '');
    const pc = NOTE_TO_PC[cleanName] ?? 0;
    
    // Initial pitch for the root
    if (index === 0) {
      lastMidiValue = (baseOctave + 1) * 12 + pc;
      return `${cleanName}${baseOctave}`;
    }

    // For subsequent notes, ensure they are higher than the previous note
    let currentOctave = baseOctave;
    let currentMidi = (currentOctave + 1) * 12 + pc;

    while (currentMidi <= lastMidiValue) {
      currentOctave++;
      currentMidi += 12;
    }

    lastMidiValue = currentMidi;
    return `${cleanName}${currentOctave}`;
  });

  s.triggerAttackRelease(notesWithOctave, '2n');
};
