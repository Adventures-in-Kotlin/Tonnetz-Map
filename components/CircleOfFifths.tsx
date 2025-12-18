import React, { useState, useMemo } from 'react';
import { mod } from '../utils/music';
import { playChord, InstrumentType } from '../utils/audio';

const MAJORS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const MINORS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];
const DIMS = ['Bdim', 'F#dim', 'C#dim', 'G#dim', 'D#dim', 'A#dim', 'Fdim', 'Cdim', 'Gdim', 'Ddim', 'Adim', 'Edim'];

const NOTE_TO_INDEX: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

const CHROMATIC_SCALE_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const INSTRUMENTS: { label: string; value: InstrumentType }[] = [
  { label: 'Simple Synth', value: 'Synth' },
  { label: 'FM Synth', value: 'FMSynth' },
  { label: 'AM Synth', value: 'AMSynth' },
  { label: 'Duo Synth', value: 'DuoSynth' },
  { label: 'Membrane Synth', value: 'MembraneSynth' },
];

// Key Signature Data
const KEY_SIGNATURES = [
    { type: 'natural', count: 0 }, // C
    { type: 'sharp', count: 1 },   // G
    { type: 'sharp', count: 2 },   // D
    { type: 'sharp', count: 3 },   // A
    { type: 'sharp', count: 4 },   // E
    { type: 'sharp', count: 5 },   // B
    { type: 'sharp', count: 6 },   // F#
    { type: 'flat', count: 5 },    // Db
    { type: 'flat', count: 4 },    // Ab
    { type: 'flat', count: 3 },    // Eb
    { type: 'flat', count: 2 },    // Bb
    { type: 'flat', count: 1 },    // F
];

const SHARP_ORDER = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'];
const FLAT_ORDER = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'];

const SHARP_POSITIONS = [0, 30, -10, 20, 50, 10, 40];
const FLAT_POSITIONS = [40, 10, 50, 20, 60, 30, 70];
const SHARP_Y_OFFSET = 3;
const FLAT_Y_OFFSET = -2.5; 

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_INDICES = [0, 2, 4, 5, 7, 9, 11]; // C=0, D=2, E=4, F=5, G=7, A=9, B=11

// Helpers to generate correct spellings
const getNoteFromInterval = (rootIndex: number, interval: number, rootLetterIdx: number, stepIndex: number) => {
    const targetIndex = mod(rootIndex + interval, 12);
    const targetLetterIdx = (rootLetterIdx + stepIndex) % 7;
    const targetLetter = LETTERS[targetLetterIdx];
    const baseIndex = LETTER_INDICES[targetLetterIdx];

    let diff = targetIndex - baseIndex;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;

    let accidentals = '';
    if (diff > 0) accidentals = '#'.repeat(diff);
    else if (diff < 0) accidentals = 'b'.repeat(Math.abs(diff));

    return targetLetter + accidentals;
};

const getScaleNotes = (rootName: string, mode: 'Major' | 'Minor') => {
    let rootBase = rootName.charAt(0);
    let rootAcc = rootName.slice(1);
    
    let rootLetterIdx = LETTERS.indexOf(rootBase);
    let baseVal = LETTER_INDICES[rootLetterIdx];
    
    if (rootAcc === '#') baseVal += 1;
    if (rootAcc === 'b') baseVal -= 1;
    const rootIndex = mod(baseVal, 12);

    const intervals = mode === 'Major' 
        ? [0, 2, 4, 5, 7, 9, 11] 
        : [0, 2, 3, 5, 7, 8, 10]; 

    return intervals.map((interval, i) => getNoteFromInterval(rootIndex, interval, rootLetterIdx, i));
};

// Chord Quality Templates
const CHORD_QUALITIES_MAJOR = [
    { tri: '', sev: 'Maj7', nin: 'Maj9', ele: 'Maj11', thi: 'Maj13' },       
    { tri: 'm', sev: 'm7', nin: 'm9', ele: 'm11', thi: 'm13' },          
    { tri: 'm', sev: 'm7', nin: 'm7(b9)', ele: 'm11(b9)', thi: 'm11(b9,b13)' }, 
    { tri: '', sev: 'Maj7', nin: 'Maj9', ele: 'Maj9(#11)', thi: 'Maj13(#11)' }, 
    { tri: '', sev: '7', nin: '9', ele: '11', thi: '13' },             
    { tri: 'm', sev: 'm7', nin: 'm9', ele: 'm11', thi: 'm11(b13)' },     
    { tri: 'dim', sev: 'm7b5', nin: 'm7b5(b9)', ele: null, thi: null },
];

const CHORD_QUALITIES_MINOR = [
    { tri: 'm', sev: 'm7', nin: 'm9', ele: 'm11', thi: 'm13' },          
    { tri: 'dim', sev: 'm7b5', nin: 'm7b5(b9)', ele: null, thi: null },
    { tri: '', sev: 'Maj7', nin: 'Maj9', ele: 'Maj11', thi: 'Maj13' },       
    { tri: 'm', sev: 'm7', nin: 'm9', ele: 'm11', thi: 'm13' },          
    { tri: 'm', sev: 'm7', nin: 'm7(b9)', ele: 'm11(b9)', thi: 'm11(b9,b13)' }, 
    { tri: '', sev: 'Maj7', nin: 'Maj9', ele: 'Maj9(#11)', thi: 'Maj13(#11)' }, 
    { tri: '', sev: '7', nin: '9', ele: '11', thi: '13' },             
];

interface CircleOfFifthsProps {
  instrument: InstrumentType;
  onInstrumentChange: (type: InstrumentType) => void;
}

const CircleOfFifths: React.FC<CircleOfFifthsProps> = ({ instrument, onInstrumentChange }) => {
  const [rotation, setRotation] = useState(0); 
  const [mode, setMode] = useState<'Major' | 'Minor'>('Major');

  const currentIndex = Math.round(mod(-rotation / 30, 12));
  const currentKey = KEY_SIGNATURES[currentIndex];
  
  const currentRootName = mode === 'Major' 
    ? MAJORS[currentIndex] 
    : MINORS[currentIndex].replace('m', '');

  const scaleNotes = useMemo(() => {
      return getScaleNotes(currentRootName, mode);
  }, [currentRootName, mode]);

  const scaleChords = useMemo(() => {
      const qualities = mode === 'Major' ? CHORD_QUALITIES_MAJOR : CHORD_QUALITIES_MINOR;
      return scaleNotes.map((root, i) => {
          const notes = [
              scaleNotes[i],
              scaleNotes[(i + 2) % 7],
              scaleNotes[(i + 4) % 7]
          ];
          const notes7 = [...notes, scaleNotes[(i + 6) % 7]];
          const notes9 = [...notes7, scaleNotes[(i + 1) % 7]];
          const notes11 = [...notes9, scaleNotes[(i + 3) % 7]];
          const notes13 = [...notes11, scaleNotes[(i + 5) % 7]];
          
          return {
              triadName: root + qualities[i].tri,
              triadNotes: notes.join(' '),
              sevName: root + qualities[i].sev,
              sevNotes: notes7.join(' '),
              ninName: root + qualities[i].nin,
              ninNotes: notes9.join(' '),
              eleName: qualities[i].ele ? root + qualities[i].ele : null,
              eleNotes: qualities[i].ele ? notes11.join(' ') : null,
              thiName: qualities[i].thi ? root + qualities[i].thi : null,
              thiNotes: qualities[i].thi ? notes13.join(' ') : null,
          };
      });
  }, [scaleNotes, mode]);

  // Geometry
  const size = 600;
  const center = size / 2;
  const outerR = 280;
  const midR = 190;
  const innerR = 120;
  const centerR = 60;

  const createSector = (startDeg: number, endDeg: number, inner: number, outer: number) => {
    const toRad = (d: number) => (d - 90) * (Math.PI / 180);
    const start = toRad(startDeg);
    const end = toRad(endDeg);
    
    const x1 = center + outer * Math.cos(start);
    const y1 = center + outer * Math.sin(start);
    const x2 = center + outer * Math.cos(end);
    const y2 = center + outer * Math.sin(end);
    const x3 = center + inner * Math.cos(end);
    const y3 = center + inner * Math.sin(end);
    const x4 = center + inner * Math.cos(start);
    const y4 = center + inner * Math.sin(start);

    return `M ${x1} ${y1} A ${outer} ${outer} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 0 0 ${x4} ${y4} Z`;
  };

  const rotateLeft = () => setRotation(r => r - 30);
  const rotateRight = () => setRotation(r => r + 30);
  
  const handleWheelClick = (index: number) => {
      const target = -index * 30;
      let diff = (target - rotation) % 360;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      setRotation(rotation + diff);
      
      // Play Root Chord correctly by using reliable note-to-index map
      const rootStr = mode === 'Major' ? MAJORS[index] : MINORS[index];
      const cleanRoot = rootStr.replace('m', '');
      const rootIdx = NOTE_TO_INDEX[cleanRoot] ?? 0;
      
      const intervals = mode === 'Major' ? [0, 4, 7] : [0, 3, 7];
      playChord(intervals.map(i => CHROMATIC_SCALE_SHARPS[mod(rootIdx + i, 12)]));
  };

  const getLabel = (position: string) => {
    if (mode === 'Major') {
        switch(position) {
            case 'top-outer': return 'I';
            case 'top-mid': return 'vi';
            case 'top-inner': return 'vii°';
            case 'left-outer': return 'IV';
            case 'left-mid': return 'ii';
            case 'right-outer': return 'V';
            case 'right-mid': return 'iii';
            default: return '';
        }
    } else {
        switch(position) {
            case 'top-outer': return 'III';
            case 'top-mid': return 'i';
            case 'top-inner': return 'ii°';
            case 'left-outer': return 'VI';
            case 'left-mid': return 'iv';
            case 'right-outer': return 'VII';
            case 'right-mid': return 'v';
            default: return '';
        }
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-background overflow-hidden relative select-none">
      
      {/* Sidebar Panel */}
      <div className="w-full md:w-80 bg-surface border-r border-slate-700 flex flex-col p-6 z-10 shadow-xl overflow-y-auto shrink-0">
         <h2 className="text-2xl font-bold text-white mb-1">Circle of Fifths</h2>
         <p className="text-slate-400 text-sm mb-6">Key Relationships</p>
         
         {/* Instrument Selector */}
         <div className="mb-6">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Sound Engine</label>
            <div className="relative">
                <select
                value={instrument}
                onChange={(e) => onInstrumentChange(e.target.value as InstrumentType)}
                className="w-full appearance-none bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-primary focus:border-primary p-2.5 pr-8 cursor-pointer hover:bg-slate-700 transition-colors"
                >
                {INSTRUMENTS.map((inst) => (
                    <option key={inst.value} value={inst.value}>
                    {inst.label}
                    </option>
                ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                <i className="fas fa-chevron-down text-xs"></i>
                </div>
            </div>
         </div>

         <div className="mb-8">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Perspective</label>
            <div className="flex flex-col gap-2">
                <button 
                    onClick={() => setMode('Major')}
                    className={`p-3 rounded-lg text-sm font-bold flex items-center justify-between transition-all border ${
                        mode === 'Major' 
                        ? 'bg-blue-600/20 border-blue-500 text-blue-100' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                >
                    <span>Major Key</span>
                    {mode === 'Major' && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>}
                </button>
                <button 
                    onClick={() => setMode('Minor')}
                    className={`p-3 rounded-lg text-sm font-bold flex items-center justify-between transition-all border ${
                        mode === 'Minor' 
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                >
                    <span>Minor Key</span>
                    {mode === 'Minor' && <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>}
                </button>
            </div>
         </div>

         <div className="mb-6">
             <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Functional Harmony</label>
             <div className="space-y-3">
                <div className="flex items-start gap-3 p-2 rounded bg-slate-800/30">
                    <div className="mt-1 w-3 h-3 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)] shrink-0"></div>
                    <div>
                        <div className="text-sm font-medium text-slate-200">Tonic Function</div>
                        <div className="text-xs text-slate-500 mt-0.5">Home base, stability.</div>
                        <div className="text-xs font-mono text-sky-400 mt-1">{mode === 'Major' ? 'I, vi' : 'i, III'}</div>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-2 rounded bg-slate-800/30">
                    <div className="mt-1 w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0"></div>
                    <div>
                        <div className="text-sm font-medium text-slate-200">Subdominant</div>
                        <div className="text-xs text-slate-500 mt-0.5">Movement away from home.</div>
                        <div className="text-xs font-mono text-emerald-400 mt-1">{mode === 'Major' ? 'IV, ii' : 'iv, VI'}</div>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-2 rounded bg-slate-800/30">
                    <div className="mt-1 w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] shrink-0"></div>
                    <div>
                        <div className="text-sm font-medium text-slate-200">Dominant</div>
                        <div className="text-xs text-slate-500 mt-0.5">Tension, leading to home.</div>
                        <div className="text-xs font-mono text-rose-400 mt-1">{mode === 'Major' ? 'V, iii' : 'v, VII'}</div>
                    </div>
                </div>
                 <div className="flex items-start gap-3 p-2 rounded bg-slate-800/30">
                    <div className="mt-1 w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0"></div>
                    <div>
                        <div className="text-sm font-medium text-slate-200">Leading Tone</div>
                        <div className="text-xs font-mono text-amber-400 mt-1">{mode === 'Major' ? 'vii°' : 'ii°'}</div>
                    </div>
                </div>
             </div>
         </div>
      </div>

      {/* Main Container: Circle + Key Signature Panel */}
      <div className="flex-1 flex flex-col md:flex-row bg-slate-900 overflow-hidden relative">
        
        {/* Center: Circle */}
        <div className="flex-1 flex flex-col items-center justify-center relative min-h-[400px]">
            {/* Controls */}
            <div className="absolute bottom-8 flex gap-4 z-20">
                <button 
                    onClick={rotateRight}
                    className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
                    title="Rotate Counter-Clockwise"
                >
                    <i className="fas fa-undo"></i>
                </button>
                <div className="px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium flex items-center">
                    Tap a Key to Select
                </div>
                <button 
                    onClick={rotateLeft}
                    className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
                    title="Rotate Clockwise"
                >
                    <i className="fas fa-redo"></i>
                </button>
            </div>

            {/* Main SVG */}
            <div className="relative" style={{ width: 'min(80vw, 550px)', height: 'min(80vw, 550px)' }}>
                <svg 
                    viewBox={`0 0 ${size} ${size}`} 
                    className="w-full h-full drop-shadow-2xl"
                >
                    <g 
                        style={{ 
                            transform: `rotate(${rotation}deg)`, 
                            transformOrigin: 'center', 
                            transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' 
                        }}
                    >
                        {MAJORS.map((note, i) => {
                            const startDeg = i * 30 - 15;
                            const endDeg = i * 30 + 15;
                            const midDeg = i * 30;
                            
                            const textRad = (deg: number, r: number) => {
                                const rad = (deg - 90) * (Math.PI / 180);
                                return {
                                    x: center + r * Math.cos(rad),
                                    y: center + r * Math.sin(rad)
                                };
                            };
                            
                            const majPos = textRad(midDeg, (outerR + midR) / 2);
                            const minPos = textRad(midDeg, (midR + innerR) / 2);
                            const dimPos = textRad(midDeg, (innerR + centerR) / 2);

                            return (
                                <g key={i} onClick={() => handleWheelClick(i)} className="cursor-pointer hover:opacity-90">
                                    <path d={createSector(startDeg, endDeg, midR, outerR)} fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
                                    <path d={createSector(startDeg, endDeg, innerR, midR)} fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
                                    <path d={createSector(startDeg, endDeg, centerR, innerR)} fill="#94a3b8" stroke="#475569" strokeWidth="1" />
                                    
                                    <text 
                                        x={majPos.x} y={majPos.y} 
                                        textAnchor="middle" dominantBaseline="middle" 
                                        className="font-bold text-2xl fill-slate-900"
                                        transform={`rotate(${midDeg}, ${majPos.x}, ${majPos.y})`}
                                    >
                                        {note}
                                    </text>
                                    <text 
                                        x={minPos.x} y={minPos.y} 
                                        textAnchor="middle" dominantBaseline="middle" 
                                        className="font-semibold text-xl fill-slate-800"
                                        transform={`rotate(${midDeg}, ${minPos.x}, ${minPos.y})`}
                                    >
                                        {MINORS[i]}
                                    </text>
                                    <text 
                                        x={dimPos.x} y={dimPos.y} 
                                        textAnchor="middle" dominantBaseline="middle" 
                                        className="text-sm fill-slate-700"
                                        transform={`rotate(${midDeg}, ${dimPos.x}, ${dimPos.y})`}
                                    >
                                        {DIMS[i]}
                                    </text>
                                </g>
                            );
                        })}
                    </g>

                    <g className="pointer-events-none">
                        <circle cx={center} cy={center} r={centerR} fill="#0f172a" stroke="#334155" strokeWidth="2" />
                        
                        <path d={createSector(-15, 15, midR, outerR)} fill="rgba(56, 189, 248, 0.4)" stroke="#38bdf8" strokeWidth="3" />
                        <path d={createSector(-15, 15, innerR, midR)} fill="rgba(56, 189, 248, 0.4)" stroke="#38bdf8" strokeWidth="3" />
                        <path d={createSector(-15, 15, centerR, innerR)} fill="rgba(245, 158, 11, 0.4)" stroke="#f59e0b" strokeWidth="3" />

                        <path d={createSector(-45, -15, midR, outerR)} fill="rgba(16, 185, 129, 0.3)" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />
                        <path d={createSector(-45, -15, innerR, midR)} fill="rgba(16, 185, 129, 0.3)" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />

                        <path d={createSector(15, 45, midR, outerR)} fill="rgba(244, 63, 94, 0.3)" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 2" />
                        <path d={createSector(15, 45, innerR, midR)} fill="rgba(244, 63, 94, 0.3)" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 2" />

                        <text x={center} y={center - (outerR + midR)/2 + 25} textAnchor="middle" className="text-xs font-bold fill-blue-900 opacity-70">
                            {getLabel('top-outer')}
                        </text>
                        <text x={center} y={center - (midR + innerR)/2 + 20} textAnchor="middle" className="text-xs font-bold fill-blue-900 opacity-70">
                            {getLabel('top-mid')}
                        </text>
                        <text x={center} y={center - (innerR + centerR)/2 + 15} textAnchor="middle" className="text-[10px] font-bold fill-amber-900 opacity-70">
                            {getLabel('top-inner')}
                        </text>

                        <g transform="rotate(-30, 300, 300)">
                            <text x={center} y={center - (outerR + midR)/2 + 25} textAnchor="middle" className="text-xs font-bold fill-emerald-900 opacity-70">
                                {getLabel('left-outer')}
                            </text>
                            <text x={center} y={center - (midR + innerR)/2 + 20} textAnchor="middle" className="text-xs font-bold fill-emerald-900 opacity-70">
                                {getLabel('left-mid')}
                            </text>
                        </g>

                        <g transform="rotate(30, 300, 300)">
                            <text x={center} y={center - (outerR + midR)/2 + 25} textAnchor="middle" className="text-xs font-bold fill-rose-900 opacity-70">
                                {getLabel('right-outer')}
                            </text>
                            <text x={center} y={center - (midR + innerR)/2 + 20} textAnchor="middle" className="text-xs font-bold fill-rose-900 opacity-70">
                                {getLabel('right-mid')}
                            </text>
                        </g>
                        
                        <text x={center} y={center} dy=".3em" textAnchor="middle" className="fill-slate-500 font-serif text-3xl font-bold opacity-30">Key</text>

                    </g>
                </svg>
            </div>
        </div>

        {/* Right: Key Signature Panel */}
        <div className="w-full md:w-80 bg-slate-900/50 border-t md:border-t-0 md:border-l border-slate-700 flex flex-col shrink-0 z-10 overflow-y-auto">
           <div className="p-6 pb-2 flex flex-col items-center">
                <h3 className="text-lg font-bold text-slate-300 mb-6 uppercase tracking-wider">Key Signature</h3>
                
                <div className="bg-slate-100 rounded-lg p-4 w-full aspect-video shadow-inner flex items-center justify-center relative overflow-hidden mb-6">
                        <svg viewBox="0 0 200 120" className="w-full h-full">
                            {[0, 20, 40, 60, 80].map(y => (
                                <line key={y} x1="10" y1={y + 20} x2="190" y2={y + 20} stroke="#334155" strokeWidth="1" />
                            ))}
                            <text x="25" y="90" fontSize="70" className="fill-slate-800 font-serif" style={{ fontFamily: 'Times New Roman, serif' }}>𝄞</text>
                            <g transform="translate(60, 20)">
                            {currentKey.count > 0 && Array.from({length: currentKey.count}).map((_, i) => {
                                const pos = currentKey.type === 'sharp' ? SHARP_POSITIONS[i] : FLAT_POSITIONS[i];
                                const symbol = currentKey.type === 'sharp' ? '♯' : '♭';
                                const yOffset = currentKey.type === 'sharp' ? SHARP_Y_OFFSET : FLAT_Y_OFFSET;
                                const isSharp = currentKey.type === 'sharp';
                                return (
                                    <text 
                                        key={i} 
                                        x={i * 20} 
                                        y={pos + yOffset}
                                        fontSize="38" 
                                        className="fill-slate-800 font-bold"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        stroke={isSharp ? "#1e293b" : "none"}
                                        strokeWidth={isSharp ? "2" : "0"}
                                    >
                                        {symbol}
                                    </text>
                                );
                            })}
                            {currentKey.count === 0 && (
                                <text x="30" y="50" fontSize="12" className="fill-slate-400 italic">Natural</text>
                            )}
                            </g>
                        </svg>
                </div>
                
                <div className="text-center mb-6">
                    <div className="text-3xl font-bold text-white mb-1" onClick={() => handleWheelClick(currentIndex)} style={{cursor: 'pointer'}}>
                        {mode === 'Major' ? MAJORS[currentIndex] : MINORS[currentIndex]}
                    </div>
                    <div className="text-sm text-slate-400">
                        {mode} Key
                    </div>
                    <div className="mt-4 px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 border border-slate-700 inline-block">
                        {currentKey.count === 0 
                            ? 'No Sharps or Flats' 
                            : `${currentKey.count} ${currentKey.type === 'sharp' ? 'Sharps' : 'Flats'}`
                        }
                    </div>
                    {currentKey.count > 0 && (
                        <div className="mt-2 text-sm text-slate-500 font-medium tracking-wide">
                            {(currentKey.type === 'sharp' ? SHARP_ORDER : FLAT_ORDER).slice(0, currentKey.count).join(', ')}
                        </div>
                    )}
                </div>
           </div>

           {/* Chord Table Section */}
           <div className="px-6 pb-8">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Scale Chords</h4>
               <div className="space-y-3">
                   {scaleChords.map((chord, i) => {
                       const roman = mode === 'Major' 
                           ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'][i] 
                           : ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'][i];

                       return (
                           <div key={i} className="bg-slate-800/40 rounded border border-slate-700/50 px-3 py-1.5 cursor-pointer hover:bg-slate-800 transition-colors"
                                onClick={() => playChord(chord.triadNotes.split(' '))}>
                               {/* Triad Row (with Roman Numeral) */}
                               <div className="flex justify-between items-center mb-0.5 pb-1 border-b border-slate-700/30">
                                   <div className="flex items-center gap-3">
                                       <span className="text-xs font-mono text-slate-500 w-6 text-center bg-slate-900/50 rounded py-0.5 border border-slate-700/50">{roman}</span>
                                       <span className="font-bold text-white text-sm">{chord.triadName}</span>
                                   </div>
                                   <span className="text-xs text-slate-400 font-mono tracking-tight">{chord.triadNotes}</span>
                               </div>
                               
                               {/* Seventh Row */}
                               <div className="flex justify-between items-center mb-0.5 pl-9 group" onClick={(e) => { e.stopPropagation(); playChord(chord.sevNotes.split(' ')); }}>
                                   <span className="font-bold text-indigo-300 text-sm hover:text-white transition-colors">{chord.sevName}</span>
                                   <span className="text-xs text-indigo-200/60 font-mono tracking-tight">{chord.sevNotes}</span>
                               </div>

                               {/* Ninth Row */}
                               <div className="flex justify-between items-center mb-0.5 pl-9" onClick={(e) => { e.stopPropagation(); playChord(chord.ninNotes.split(' ')); }}>
                                   <span className="font-bold text-violet-300 text-sm hover:text-white transition-colors">{chord.ninName}</span>
                                   <span className="text-xs text-violet-200/60 font-mono tracking-tight">{chord.ninNotes}</span>
                               </div>

                               {/* Eleventh Row (if exists) */}
                               {chord.eleName && (
                                   <div className="flex justify-between items-center mb-0.5 pl-9" onClick={(e) => { e.stopPropagation(); playChord(chord.eleNotes!.split(' ')); }}>
                                       <span className="font-bold text-fuchsia-300 text-sm hover:text-white transition-colors">{chord.eleName}</span>
                                       <span className="text-xs text-fuchsia-200/60 font-mono tracking-tight">{chord.eleNotes}</span>
                                   </div>
                               )}

                               {/* Thirteenth Row (if exists) */}
                               {chord.thiName && (
                                   <div className="flex justify-between items-center pl-9" onClick={(e) => { e.stopPropagation(); playChord(chord.thiNotes!.split(' ')); }}>
                                       <span className="font-bold text-pink-300 text-sm hover:text-white transition-colors">{chord.thiName}</span>
                                       <span className="text-xs text-pink-200/60 font-mono tracking-tight">{chord.thiNotes}</span>
                                   </div>
                               )}
                           </div>
                       );
                   })}
               </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default CircleOfFifths;