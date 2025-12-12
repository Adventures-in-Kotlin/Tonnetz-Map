import React from 'react';
import { CHORDS, NOTES } from '../utils/music';

interface SidebarProps {
  onChordSelect: (chordType: string) => void;
  onClear: () => void;
  selectedRoot: number | null;
  selectedChord: string | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onChordSelect, 
  onClear, 
  selectedRoot, 
  selectedChord,
  onZoomIn,
  onZoomOut
}) => {
  const rootName = selectedRoot !== null ? NOTES[selectedRoot].name : '—';

  return (
    <div className="w-full md:w-80 bg-surface border-r border-slate-700 flex flex-col h-full shadow-xl z-10 transition-all duration-300">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-white mb-1">Tonnetz</h1>
        <p className="text-slate-400 text-sm">Harmonic Lattice</p>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3">
            Selected Root
          </h2>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-bold text-lg shadow-lg border-2 border-orange-600">
               {rootName}
             </div>
             <div className="text-sm text-slate-300">
               {selectedRoot !== null ? 'Click grid to change' : 'Select a note'}
             </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3">
            Chord Highlights
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(CHORDS).map((chordKey) => {
              const isSelected = selectedChord === chordKey;
              return (
                <button
                  key={chordKey}
                  onClick={() => onChordSelect(chordKey)}
                  disabled={selectedRoot === null}
                  className={`
                    w-full text-left px-3 py-2 rounded-md font-medium text-sm transition-all duration-200
                    flex justify-between items-center
                    ${selectedRoot === null 
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                      : isSelected
                        ? 'bg-primary text-white shadow-lg ring-1 ring-white/20'
                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white active:bg-primary active:text-white'
                    }
                  `}
                >
                  <span className="truncate mr-1">{CHORDS[chordKey].name}</span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-white shadow-sm flex-shrink-0" title="Active" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-700 bg-slate-900/50 space-y-4">
        {/* Zoom Controls */}
        <div className="flex items-center justify-between bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button 
              onClick={onZoomOut}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
              title="Zoom Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
              </svg>
            </button>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Zoom</span>
            <button 
              onClick={onZoomIn}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
              title="Zoom In"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
        </div>

        <button
          onClick={onClear}
          className="w-full py-2 px-4 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
        >
          <span>Clear Grid</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;