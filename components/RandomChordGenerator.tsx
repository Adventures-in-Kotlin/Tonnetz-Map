import React, { useState, useEffect, useMemo } from 'react';

// Type definition for the global Midi object provided by jsmidgen
declare global {
  interface Window {
    Midi: any;
  }
}

const NOTES_FLAT = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const NOTE_TO_MIDI: Record<string, number> = {
  'C': 60, 'C#': 61, 'D': 62, 'D#': 63, 'E': 64, 'F': 65,
  'F#': 66, 'G': 67, 'G#': 68, 'A': 69, 'A#': 70, 'B': 71
};

interface ScaleDefinition {
  name: string;
  formula: number[];
}

interface ScaleCategory {
  categoryName?: string;
  items: Record<string, ScaleDefinition>;
}

const SCALES: Record<string, ScaleCategory> = {
  'manual': {
    items: {
      'none': { name: 'Manual Selection', formula: [] }
    }
  },
  'fiveNote': {
    categoryName: '5 Note Scales',
    items: {
      'major_pentatonic': { name: 'Major Pentatonic', formula: [0, 2, 4, 7, 9] },
      'minor_pentatonic': { name: 'Minor Pentatonic', formula: [0, 3, 5, 7, 10] }
    }
  },
  'sixNote': {
    categoryName: '6 Note Scales',
    items: {
      'blues': { name: 'Blues', formula: [0, 3, 5, 6, 7, 10] }
    }
  },
  'sevenNote': {
    categoryName: '7 Note Scales',
    items: {
      'major': { name: 'Major', formula: [0, 2, 4, 5, 7, 9, 11] },
      'natural_minor': { name: 'Natural Minor', formula: [0, 2, 3, 5, 7, 8, 10] },
      'harmonic_minor': { name: 'Harmonic Minor', formula: [0, 2, 3, 5, 7, 8, 11] }
    }
  }
};

const RandomChordGenerator: React.FC = () => {
  // State
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [rootNote, setRootNote] = useState<string>('C');
  const [scaleKey, setScaleKey] = useState<string>('none');
  const [maxNotes, setMaxNotes] = useState<number>(5);
  
  const [currentChord, setCurrentChord] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  
  const [isScaleDropdownOpen, setIsScaleDropdownOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Derived state for Scale Name
  const scaleName = useMemo(() => {
    for (const cat of Object.values(SCALES)) {
      if (cat.items[scaleKey]) return cat.items[scaleKey].name;
    }
    return 'Select Scale';
  }, [scaleKey]);

  // Effect: Update selected notes when Scale or Root changes
  useEffect(() => {
    if (scaleKey === 'none') return;

    let formula: number[] | null = null;
    for (const cat of Object.values(SCALES)) {
      if (cat.items[scaleKey]) {
        formula = cat.items[scaleKey].formula;
        break;
      }
    }

    if (!formula) return;

    const rootIndex = NOTES_FLAT.indexOf(rootNote);
    const newSelectedNotes = formula.map(interval => NOTES_FLAT[(rootIndex + interval) % 12]);
    setSelectedNotes(newSelectedNotes);
  }, [scaleKey, rootNote]);

  // Handlers
  const toggleNote = (note: string) => {
    setSelectedNotes(prev => {
      if (prev.includes(note)) return prev.filter(n => n !== note);
      return [...prev, note];
    });
    // If manually toggling, reset scale to none without clearing notes
    if (scaleKey !== 'none') {
      setScaleKey('none');
    }
  };

  const showFlashMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const generateChord = () => {
    const minChordSize = 3;
    if (selectedNotes.length < minChordSize) {
      showFlashMessage(`Please select at least ${minChordSize} notes.`);
      return;
    }
    if (maxNotes < minChordSize) {
      showFlashMessage(`Max notes must be at least ${minChordSize}.`);
      return;
    }
    if (maxNotes > selectedNotes.length) {
      showFlashMessage(`Cannot generate a chord with ${maxNotes} notes, only ${selectedNotes.length} are selected.`);
      return;
    }

    const maxChordSize = Math.min(maxNotes, selectedNotes.length);
    const chordSize = Math.floor(Math.random() * (maxChordSize - minChordSize + 1)) + minChordSize;
    
    // Shuffle and slice
    const shuffled = [...selectedNotes].sort(() => 0.5 - Math.random());
    const newChord = shuffled.slice(0, chordSize);

    setCurrentChord(newChord);
    
    const chordString = newChord.join(' - ');
    setHistory(prev => [chordString, ...prev].slice(0, 10)); // Keep last 10
  };

  const handleReset = () => {
    setSelectedNotes([]);
    setCurrentChord([]);
    setHistory([]);
    setRootNote('C');
    setScaleKey('none');
    setMaxNotes(5);
  };

  const downloadTxt = () => {
    const content = history.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chord-history.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadMidi = () => {
    if (!window.Midi) {
      showFlashMessage("MIDI library not loaded.");
      return;
    }
    const file = new window.Midi.File();
    const track = new window.Midi.Track();
    file.addTrack(track);

    history.forEach(chordStr => {
      const notes = chordStr.split(' - ');
      const midiChord = notes.map(n => NOTE_TO_MIDI[n]).filter(Boolean);
      if (midiChord.length > 0) track.addChord(0, midiChord, 128);
    });

    const dataUri = 'data:audio/midi;base64,' + btoa(file.toBytes());
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = 'chord-history.mid';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-full p-4 md:p-8 flex flex-col items-center bg-background text-white font-sans">
      <div className="w-full max-w-3xl bg-surface rounded-xl shadow-2xl p-6 relative border border-slate-700">
        
        {/* Header */}
        <h1 className="text-3xl font-bold text-center text-white mb-2">Random Chord Generator</h1>
        <p className="text-center text-slate-400 mb-6">Select notes, set the max chord size, and generate a random chord.</p>

        {/* Note Selector */}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 mb-6">
          {NOTES_FLAT.map(note => (
            <button
              key={note}
              onClick={() => toggleNote(note)}
              className={`
                p-4 text-lg font-semibold rounded-lg transition-all duration-200 shadow-md
                ${selectedNotes.includes(note) 
                  ? 'bg-primary text-white transform -translate-y-1 shadow-lg ring-2 ring-primary/50' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }
              `}
            >
              {note}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-wrap justify-center items-center gap-6">
            {/* Root Note */}
            <div className="flex items-center gap-2">
              <label className="text-slate-300 font-medium">Root:</label>
              <select 
                value={rootNote}
                onChange={(e) => setRootNote(e.target.value)}
                className="p-2 border border-slate-600 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {NOTES_FLAT.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {/* Scale Dropdown */}
            <div className="flex items-center gap-2 relative">
              <label className="text-slate-300 font-medium">Scale:</label>
              <button 
                onClick={() => setIsScaleDropdownOpen(!isScaleDropdownOpen)}
                className="p-2 w-48 text-left border border-slate-600 rounded-lg bg-slate-800 text-white flex justify-between items-center focus:ring-2 focus:ring-primary"
              >
                <span className="truncate">{scaleName}</span>
                <i className="fas fa-chevron-down text-xs ml-2"></i>
              </button>

              {/* Dropdown Menu */}
              {isScaleDropdownOpen && (
                <div className="absolute top-full mt-1 left-0 z-20 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                   <div 
                      className="p-2 hover:bg-slate-700 cursor-pointer"
                      onClick={() => { setScaleKey('none'); setIsScaleDropdownOpen(false); }}
                   >
                     Manual Selection
                   </div>
                   {Object.entries(SCALES).map(([catKey, cat]) => {
                     if (!cat.categoryName) return null;
                     return (
                       <div key={catKey} className="border-t border-slate-700">
                         <div className="px-2 py-1 text-xs uppercase text-slate-500 font-bold bg-slate-900/50">
                           {cat.categoryName}
                         </div>
                         {Object.entries(cat.items).map(([key, item]) => (
                           <div 
                             key={key}
                             className="p-2 hover:bg-slate-700 cursor-pointer pl-4"
                             onClick={() => { setScaleKey(key); setIsScaleDropdownOpen(false); }}
                           >
                             {item.name}
                           </div>
                         ))}
                       </div>
                     );
                   })}
                </div>
              )}
              {/* Overlay to close dropdown */}
              {isScaleDropdownOpen && (
                <div className="fixed inset-0 z-10" onClick={() => setIsScaleDropdownOpen(false)} />
              )}
            </div>

            {/* Max Notes */}
            <div className="flex items-center gap-2">
               <label className="text-slate-300 font-medium">Max Notes:</label>
               <input 
                  type="number" 
                  min="3" 
                  max="12"
                  value={maxNotes}
                  onChange={(e) => setMaxNotes(parseInt(e.target.value))}
                  className="w-16 p-2 border border-slate-600 rounded-lg text-center bg-slate-800 text-white focus:ring-2 focus:ring-primary"
               />
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button 
              onClick={generateChord}
              className="bg-primary hover:bg-sky-400 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <i className="fas fa-music"></i> Generate
            </button>
            <button 
              onClick={handleReset}
              className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <i className="fas fa-sync-alt"></i> Reset
            </button>
          </div>
        </div>

        {/* Result Display */}
        <div className="text-center p-8 bg-slate-800/50 rounded-lg mb-8 border border-slate-700 min-h-[100px] flex items-center justify-center">
          <p className="text-3xl font-bold text-accent tracking-wide">
            {currentChord.length > 0 ? currentChord.join(' - ') : 'Your chord will appear here'}
          </p>
        </div>

        {/* Piano Visualizer */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-center text-white mb-4">Visualizer</h2>
          <PianoVisualizer highlightedNotes={currentChord} />
        </div>

        {/* History */}
        <div>
          <h2 className="text-xl font-semibold text-center text-white mb-4">History</h2>
          <div className="flex justify-center gap-4 mb-4">
            <button 
              onClick={downloadTxt}
              disabled={history.length === 0}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg shadow transition-colors flex items-center gap-2 text-sm"
            >
              <i className="fas fa-file-alt"></i> TXT
            </button>
            <button 
              onClick={downloadMidi}
              disabled={history.length === 0}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg shadow transition-colors flex items-center gap-2 text-sm"
            >
              <i className="fas fa-file-audio"></i> MIDI
            </button>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg max-h-40 overflow-y-auto border border-slate-700">
             {history.length === 0 ? (
               <p className="text-center text-slate-500 text-sm">No chords generated yet.</p>
             ) : (
               <ul className="text-center space-y-2 text-slate-300">
                 {history.map((chord, idx) => (
                   <li key={idx} className="border-b border-slate-700 last:border-0 pb-1 last:pb-0">
                     {chord}
                   </li>
                 ))}
               </ul>
             )}
          </div>
        </div>

        {/* Message Toast */}
        {message && (
          <div className="absolute top-4 right-4 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-down z-50">
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

// Piano Visualizer Sub-component
const PianoVisualizer: React.FC<{ highlightedNotes: string[] }> = ({ highlightedNotes }) => {
  const notes = NOTES_FLAT;
  const numOctaves = 2; // C3 to B4
  
  // Generate keys
  const whiteKeys: React.ReactNode[] = [];
  const blackKeys: React.ReactNode[] = [];
  
  let whiteKeyCount = 0;
  
  for (let octave = 0; octave < numOctaves; octave++) {
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const isBlack = note.includes('#');
      const isHighlighted = highlightedNotes.includes(note);

      if (!isBlack) {
        whiteKeys.push(
          <div 
            key={`${octave}-${note}`}
            className={`
              flex-1 h-32 border border-slate-400 rounded-b-sm relative flex items-end justify-center pb-2
              ${isHighlighted ? 'bg-primary border-blue-600' : 'bg-slate-200'}
            `}
          >
            {isHighlighted && <span className="text-xs font-bold text-slate-900">{note}</span>}
          </div>
        );
        whiteKeyCount++;
      } else {
        // Calculate position based on previous white keys
        // A standard octave has 7 white keys. 
        // 0 (C) -> 1 (D) -> 2 (E) -> 3 (F) -> 4 (G) -> 5 (A) -> 6 (B)
        // Black keys are after C, D, F, G, A
        
        // Current index in white keys for this octave
        // C# is after 1st white key (0)
        // D# is after 2nd white key (1)
        // F# is after 4th white key (3)
        // G# is after 5th white key (4)
        // A# is after 6th white key (5)
        
        const whiteKeyIndexInOctave = i <= 4 ? Math.floor(i/2) : Math.floor((i+1)/2);
        const totalWhiteIndex = (octave * 7) + whiteKeyIndexInOctave;
        
        const leftPercent = ((totalWhiteIndex + 0.5) / (numOctaves * 7)) * 100;
        const widthPercent = (1 / (numOctaves * 7)) * 100 * 0.8; // Slightly narrower than a white key gap

        blackKeys.push(
           <div
             key={`${octave}-${note}`}
             className={`
               absolute top-0 h-20 z-10 rounded-b-sm border border-black
               ${isHighlighted ? 'bg-blue-600 border-blue-800' : 'bg-slate-900'}
             `}
             style={{
               left: `${leftPercent}%`,
               width: `${widthPercent}%`,
               transform: 'translateX(-50%)'
             }}
           >
              {isHighlighted && (
                <div className="absolute bottom-1 w-full text-center text-[10px] text-white font-bold">
                  {note}
                </div>
              )}
           </div>
        );
      }
    }
  }

  return (
    <div className="relative w-full h-32 bg-slate-800 rounded overflow-hidden">
      <div className="flex h-full">
        {whiteKeys}
      </div>
      {blackKeys}
    </div>
  );
};

export default RandomChordGenerator;