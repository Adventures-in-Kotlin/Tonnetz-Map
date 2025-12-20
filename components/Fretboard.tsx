import React, { useState, useMemo } from 'react';
import { playNote, InstrumentType } from '../utils/audio';
import { mod, NOTES } from '../utils/music';

interface FretboardProps {
  instrument: InstrumentType;
  onInstrumentChange: (type: InstrumentType) => void;
}

const INSTRUMENTS: { label: string; value: InstrumentType }[] = [
  { label: 'Simple Synth', value: 'Synth' },
  { label: 'FM Synth', value: 'FMSynth' },
  { label: 'AM Synth', value: 'AMSynth' },
  { label: 'Duo Synth', value: 'DuoSynth' },
  { label: 'Membrane Synth', value: 'MembraneSynth' },
];

const STRINGS = [
  { root: 'E', octave: 5, name: 'e' },
  { root: 'B', octave: 4, name: 'B' },
  { root: 'G', octave: 4, name: 'G' },
  { root: 'D', octave: 4, name: 'D' },
  { root: 'A', octave: 3, name: 'A' },
  { root: 'E', octave: 3, name: 'E' },
];

const NOTE_TO_INDEX: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

const FRET_COUNT = 15;
const INLAYS = [3, 5, 7, 9, 12, 15];

/**
 * Standard 2-note-per-string Pentatonic Box Offsets.
 * Array order: [high e, B, G, D, A, E]
 * Relative to the Minor Root fret on String 6 (Low E).
 */
const MINOR_PENT_POSITIONS: Record<number, number[][]> = {
  1: [[0, 3], [0, 3], [0, 2], [0, 2], [0, 2], [0, 3]],
  2: [[3, 5], [3, 5], [2, 4], [2, 5], [2, 5], [3, 5]],
  3: [[5, 7], [5, 8], [4, 7], [5, 7], [5, 7], [5, 7]],
  4: [[7, 10], [8, 10], [7, 9], [7, 9], [7, 10], [7, 10]],
  5: [[10, 12], [10, 12], [9, 12], [9, 12], [10, 12], [10, 12]]
};

// Major Pentatonic shares shapes with Minor (Relative Minor)
// Major Pos 1 = Minor Pos 2, Major Pos 5 = Minor Pos 1
const MAJOR_TO_MINOR_MAP: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 1 };

type ScaleType = 'none' | 'major_pent' | 'minor_pent';

interface ScaleConfig {
  type: ScaleType;
  position: 'all' | 1 | 2 | 3 | 4 | 5;
}

const Fretboard: React.FC<FretboardProps> = ({ instrument, onInstrumentChange }) => {
  const [activeNote, setActiveNote] = useState<{ stringIdx: number, fret: number } | null>(null);
  const [handedness, setHandedness] = useState<'right' | 'left'>('right');
  
  const [scaleRoot, setScaleRoot] = useState<string>('A');
  const [scaleConfig, setScaleConfig] = useState<ScaleConfig>({ type: 'major_pent', position: 'all' });

  const handleNoteClick = (stringIdx: number, fret: number) => {
    const string = STRINGS[stringIdx];
    const rootIdx = NOTE_TO_INDEX[string.root];
    const targetIdx = mod(rootIdx + fret, 12);
    const octaveOffset = Math.floor((rootIdx + fret) / 12);
    const noteName = NOTES[targetIdx].name;
    const octave = string.octave + octaveOffset;

    playNote(noteName, octave);
    setActiveNote({ stringIdx, fret });
    
    setTimeout(() => setActiveNote(null), 500);
  };

  const logicalFrets = Array.from({ length: FRET_COUNT + 1 }, (_, i) => i);
  const displayFrets = handedness === 'right' ? logicalFrets : [...logicalFrets].reverse();
  const segmentWidth = 100 / (FRET_COUNT + 1);

  const highlightedPoints = useMemo(() => {
    if (scaleConfig.type === 'none') return new Set<string>();
    
    const rootIdx = NOTE_TO_INDEX[scaleRoot];
    const isMajor = scaleConfig.type === 'major_pent';
    const intervals = isMajor ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10];
    const scaleNoteIndices = new Set(intervals.map(i => mod(rootIdx + i, 12)));
    
    const points = new Set<string>();
    const lowE_RootIdx = NOTE_TO_INDEX['E'];
    
    // Find the RELATIVE MINOR root fret on the 6th string to anchor our boxes
    const minorRootIdx = mod(rootIdx - (isMajor ? 3 : 0), 12);
    let minorRootFret_String6 = mod(minorRootIdx - lowE_RootIdx, 12);

    if (scaleConfig.position === 'all') {
      STRINGS.forEach((string, sIdx) => {
        const stringRootIdx = NOTE_TO_INDEX[string.root];
        for (let f = 0; f <= FRET_COUNT; f++) {
          const noteIdx = mod(stringRootIdx + f, 12);
          if (scaleNoteIndices.has(noteIdx)) points.add(`${sIdx}-${f}`);
        }
      });
    } else {
      const minorPosNum = isMajor ? MAJOR_TO_MINOR_MAP[scaleConfig.position] : scaleConfig.position;
      const boxOffsets = MINOR_PENT_POSITIONS[minorPosNum];
      
      // Determine if the entire box needs to shift an octave to fit on the fretboard
      let needsOctaveShiftDown = false;
      let needsOctaveShiftUp = false;

      boxOffsets.forEach(pair => {
        pair.forEach(off => {
          if (minorRootFret_String6 + off > FRET_COUNT) needsOctaveShiftDown = true;
          if (minorRootFret_String6 + off < 0) needsOctaveShiftUp = true;
        });
      });

      if (needsOctaveShiftDown) {
        minorRootFret_String6 -= 12;
      } else if (needsOctaveShiftUp) {
        minorRootFret_String6 += 12;
      }

      boxOffsets.forEach((offsets, stringIdx) => {
        offsets.forEach(off => {
          const fret = minorRootFret_String6 + off;
          if (fret >= 0 && fret <= FRET_COUNT) {
            points.add(`${stringIdx}-${fret}`);
          }
        });
      });
    }

    return points;
  }, [scaleRoot, scaleConfig]);

  const isRootNote = (stringIdx: number, fret: number) => {
    const stringRootIdx = NOTE_TO_INDEX[STRINGS[stringIdx].root];
    return mod(stringRootIdx + fret, 12) === NOTE_TO_INDEX[scaleRoot];
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex-none p-6 border-b border-slate-700 bg-surface flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="p-2 rounded bg-primary/10 border border-primary/20">
             <i className="fas fa-guitar text-primary text-xl"></i>
           </div>
           <div>
              <h2 className="text-xl font-bold text-white leading-tight">Guitar Explorer</h2>
              <p className="text-slate-400 text-xs uppercase tracking-tighter font-bold">Pentatonic Box Shapes</p>
           </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Key</label>
              <select
                value={scaleRoot}
                onChange={(e) => setScaleRoot(e.target.value)}
                className="h-9 w-20 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded focus:ring-primary p-1 cursor-pointer hover:bg-slate-700 transition-colors"
              >
                {NOTES.map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Scale Shape</label>
              <select
                value={`${scaleConfig.type}-${scaleConfig.position}`}
                onChange={(e) => {
                  const [type, pos] = e.target.value.split('-');
                  setScaleConfig({ 
                    type: type as ScaleType, 
                    position: pos === 'all' ? 'all' : parseInt(pos) as any 
                  });
                }}
                className="h-9 w-52 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded focus:ring-primary p-1 cursor-pointer hover:bg-slate-700 transition-colors"
              >
                <option value="none-all">Scale: None</option>
                <optgroup label="Major Pentatonic">
                  <option value="major_pent-all">Full Neck</option>
                  <option value="major_pent-1">Position 1</option>
                  <option value="major_pent-2">Position 2</option>
                  <option value="major_pent-3">Position 3</option>
                  <option value="major_pent-4">Position 4</option>
                  <option value="major_pent-5">Position 5</option>
                </optgroup>
                <optgroup label="Minor Pentatonic">
                  <option value="minor_pent-all">Full Neck</option>
                  <option value="minor_pent-1">Position 1</option>
                  <option value="minor_pent-2">Position 2</option>
                  <option value="minor_pent-3">Position 3</option>
                  <option value="minor_pent-4">Position 4</option>
                  <option value="minor_pent-5">Position 5</option>
                </optgroup>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Hand</label>
              <div className="flex bg-slate-800 p-0.5 rounded border border-slate-700 h-9 w-24">
                <button
                  onClick={() => setHandedness('right')}
                  className={`flex-1 text-[9px] font-bold uppercase rounded transition-all ${handedness === 'right' ? 'bg-primary text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Right
                </button>
                <button
                  onClick={() => setHandedness('left')}
                  className={`flex-1 text-[9px] font-bold uppercase rounded transition-all ${handedness === 'left' ? 'bg-primary text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Left
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Instrument</label>
              <select
                value={instrument}
                onChange={(e) => onInstrumentChange(e.target.value as InstrumentType)}
                className="h-9 w-36 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded focus:ring-primary p-1 cursor-pointer hover:bg-slate-700 transition-colors"
              >
                {INSTRUMENTS.map((inst) => (
                  <option key={inst.value} value={inst.value}>{inst.label}</option>
                ))}
              </select>
            </div>
        </div>
      </div>

      {/* Fretboard Container */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-900/80 overflow-x-auto custom-scrollbar">
        <div className="relative min-w-[1100px] h-[320px] flex">
          
          {/* Wood Background */}
          <div className="absolute inset-0 bg-[#3d2b1f] rounded shadow-2xl border-y-2 border-black/60 overflow-hidden" style={{
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 50%, transparent 50%), repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 100px, transparent 100px, transparent 200px)',
            backgroundSize: '100% 4px, 200px 100%'
          }}></div>

          {/* Nut and Fret wires */}
          <div 
            className="absolute top-0 bottom-0 w-[14px] bg-gradient-to-r from-slate-300 via-white to-slate-300 shadow-[0_0_15px_rgba(255,255,255,0.2)] z-40 rounded-sm -translate-x-1/2"
            style={{ left: handedness === 'right' ? `${segmentWidth}%` : `${(100 - segmentWidth)}%` }}
          ></div>

          {logicalFrets.slice(1).map((fret) => {
             const boundaryIndex = fret + 1;
             const posPercent = handedness === 'right' ? boundaryIndex * segmentWidth : (100 - boundaryIndex * segmentWidth);
             return (
               <div key={fret} className="absolute top-0 bottom-0 w-[4px] bg-gradient-to-r from-slate-500 via-slate-200 to-slate-500 shadow-sm z-10 -translate-x-1/2" style={{ left: `${posPercent}%` }}></div>
             );
          })}

          {/* Fret Markers */}
          {INLAYS.map(fret => {
              const visualIndex = displayFrets.indexOf(fret);
              if (visualIndex === -1) return null;
              const left = `${(visualIndex + 0.5) * segmentWidth}%`;
              return (
                  <div key={fret} className="absolute inset-y-0 pointer-events-none z-0" style={{ left, width: `${segmentWidth}%`, transform: 'translateX(-50%)' }}>
                      {fret === 12 ? (
                          <>
                            <div className="absolute w-5 h-5 rounded-full bg-slate-100/20 shadow-inner left-1/2 -translate-x-1/2" style={{ top: '25%' }}></div>
                            <div className="absolute w-5 h-5 rounded-full bg-slate-100/20 shadow-inner left-1/2 -translate-x-1/2" style={{ top: '70%' }}></div>
                          </>
                      ) : (
                          <div className="absolute w-5 h-5 rounded-full bg-slate-100/20 shadow-inner left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2"></div>
                      )}
                  </div>
              );
          })}

          {/* Fret Numbers */}
          <div className="absolute -top-8 left-0 right-0 flex pointer-events-none">
             {displayFrets.map(f => (
                 <div key={f} className={`flex-1 text-center text-[10px] font-black tracking-tighter ${f === 0 ? 'text-primary' : 'text-slate-600'}`}>
                     {f === 0 ? 'OPEN' : f}
                 </div>
             ))}
          </div>

          {/* Strings and Notes */}
          <div className="absolute inset-0 flex flex-col justify-between py-6">
             {STRINGS.map((string, sIdx) => {
                 const thickness = 1.2 + sIdx * 0.9; 
                 return (
                     <div key={sIdx} className="relative h-6 flex items-center group">
                         {/* String Line */}
                         <div className="absolute left-0 right-0 bg-gradient-to-b from-slate-400 via-slate-100 to-slate-500 z-20 pointer-events-none shadow-sm opacity-80" style={{ height: `${thickness}px` }}></div>
                         
                         <div className="flex w-full h-full z-30">
                            {displayFrets.map((fret) => {
                                const isActive = activeNote?.stringIdx === sIdx && activeNote?.fret === fret;
                                const stringRootIdx = NOTE_TO_INDEX[string.root];
                                const noteIdx = mod(stringRootIdx + fret, 12);
                                const currentNoteName = NOTES[noteIdx].name;
                                const isScale = highlightedPoints.has(`${sIdx}-${fret}`);
                                const isRoot = isRootNote(sIdx, fret);

                                return (
                                    <div 
                                      key={fret} 
                                      onClick={() => handleNoteClick(sIdx, fret)}
                                      className="flex-1 h-full cursor-pointer relative flex items-center justify-center group/fret"
                                    >
                                        <div className={`absolute inset-0 ${fret === 0 ? 'bg-primary/5 hover:bg-primary/20' : 'bg-primary/0 group-hover/fret:bg-primary/10'} transition-colors`}></div>
                                        
                                        {/* Scale Marker - Large Solid Dots */}
                                        {isScale && !isActive && (
                                          <div className={`
                                            absolute w-7 h-7 rounded-full shadow-xl z-10 transition-transform scale-100
                                            ${isRoot ? 'bg-red-600 ring-4 ring-red-400/40' : 'bg-black'}
                                          `}></div>
                                        )}

                                        {/* Interaction Marker */}
                                        <div className={`
                                            w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black transition-all z-20
                                            ${isActive 
                                              ? 'scale-125 bg-accent text-white shadow-[0_0_20px_rgba(245,158,11,1)] opacity-100' 
                                              : 'scale-0 group-hover/fret:scale-100 bg-white/90 text-slate-900 opacity-0 group-hover/fret:opacity-100'
                                            }
                                        `}>
                                            {currentNoteName}
                                        </div>
                                        
                                        {fret === 0 && !isActive && !isScale && (
                                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                             <div className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-black text-slate-500 group-hover/fret:opacity-0 transition-opacity">
                                                 {string.name}
                                             </div>
                                          </div>
                                        )}
                                    </div>
                                );
                            })}
                         </div>
                     </div>
                 );
             })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-surface/50 border-t border-slate-700 flex flex-wrap items-center justify-center gap-10">
          <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-red-600 shadow-sm border border-red-700 ring-2 ring-red-400/20"></div>
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Root Note</span>
          </div>
          <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-black shadow-sm border border-slate-800"></div>
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Scale Degree</span>
          </div>
          <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-accent shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Playing</span>
          </div>
          <div className="text-[10px] text-slate-600 italic font-bold max-w-lg text-center leading-relaxed">
              Box patterns automatically shift an octave if they extend past fret {FRET_COUNT}. Root notes are red across all positions.
          </div>
      </div>
    </div>
  );
};

export default Fretboard;