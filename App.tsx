import React, { useState, useCallback } from 'react';
import TonnetzGrid from './components/TonnetzGrid';
import Sidebar from './components/Sidebar';
import RandomChordGenerator from './components/RandomChordGenerator';
import CircleOfFifths from './components/CircleOfFifths';
import Fretboard from './components/Fretboard';
import { CHORDS, findChordLayout, NOTES, mod } from './utils/music';
import { ViewMode } from './types';
import { playNote, playChord, setInstrument, InstrumentType } from './utils/audio';

interface RootNodeInfo {
  lx: number;
  ly: number;
  noteIndex: number;
}

type Tab = 'tonnetz' | 'generator' | 'circle' | 'fretboard';

// Offsets for intervals on the Tonnetz (dx: P5 axis, dy: M3 axis)
const INTERVAL_OFFSETS: Record<string, {dx: number, dy: number}> = {
  '5th': { dx: 1, dy: 0 },      // +7 semitones
  '4th': { dx: -1, dy: 0 },     // -7 (+5) semitones
  'Maj 3rd': { dx: 0, dy: 1 },  // +4 semitones
  'Min 3rd': { dx: 1, dy: -1 }, // +7 -4 = +3 semitones
  'Maj 2nd': { dx: 2, dy: 0 },  // +14 = +2 semitones
  'Min 2nd': { dx: -1, dy: 2 }  // -7 + 8 = +1 semitone
};

const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<Tab>('tonnetz');

  // Audio State
  const [instrument, setInstrumentState] = useState<InstrumentType>('Synth');

  // Tonnetz State
  const [activeNodeIds, setActiveNodeIds] = useState<Set<string>>(new Set());
  const [rootNode, setRootNode] = useState<RootNodeInfo | null>(null);
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('notes');
  
  // Track the ID of the last chord explicitly clicked or generated
  const [lastSelectedChordId, setLastSelectedChordId] = useState<string | null>(null);

  // Audio Handlers
  const handleInstrumentChange = (type: InstrumentType) => {
    setInstrumentState(type);
    setInstrument(type);
  };

  // Tonnetz Handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.4));
  }, []);

  // Handle switching between Notes and Chords view
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    if (mode === viewMode) return;
    
    // Clear all selections when switching modes
    setActiveNodeIds(new Set());
    setRootNode(null);
    setSelectedChord(null);
    setLastSelectedChordId(null);
    setViewMode(mode);
  }, [viewMode]);

  const handleNoteClick = useCallback((noteIndex: number, lx: number, ly: number) => {
    setRootNode({ noteIndex, lx, ly });
    const noteName = NOTES[noteIndex].name;

    if (selectedChord) {
      const intervals = CHORDS[selectedChord].intervals;
      const chordNodes = findChordLayout(lx, ly, intervals);
      const newActiveIds = new Set<string>();
      const noteNames: string[] = [];
      
      chordNodes.forEach(node => {
          newActiveIds.add(`${node.lx},${node.ly}`);
          noteNames.push(NOTES[mod(node.lx * 7 + node.ly * 4, 12)].name);
      });
      
      setActiveNodeIds(newActiveIds);
      playChord(noteNames);
    } else {
      const id = `${lx},${ly}`;
      setActiveNodeIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else {
            newSet.add(id);
            playNote(noteName);
        }
        return newSet;
      });
      setSelectedChord(null);
    }
  }, [selectedChord]);

  const handleChordClick = useCallback((chordId: string) => {
    // chordId is "M:lx,ly" or "m:lx,ly"
    const parts = chordId.split(':');
    const type = parts[0];
    const coords = parts[1].split(',');
    const lx = parseInt(coords[0]);
    const ly = parseInt(coords[1]);
    
    // Determine chord notes to play
    const rootIdx = mod(lx * 7 + ly * 4, 12);
    const rootName = NOTES[rootIdx].name;
    const intervals = type === 'M' ? [0, 4, 7] : [0, 3, 7];
    const chordNotes = intervals.map(i => NOTES[mod(rootIdx + i, 12)].name);

    setActiveNodeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chordId)) {
        newSet.delete(chordId);
      } else {
        newSet.add(chordId);
        setLastSelectedChordId(chordId);
        playChord(chordNotes);
      }
      return newSet;
    });
  }, []);

  const handleChordSelect = useCallback((chordType: string) => {
    if (!rootNode) return;
    const intervals = CHORDS[chordType].intervals;
    const chordNodes = findChordLayout(rootNode.lx, rootNode.ly, intervals);
    const newActiveIds = new Set<string>();
    const noteNames: string[] = [];

    chordNodes.forEach(node => {
        newActiveIds.add(`${node.lx},${node.ly}`);
        noteNames.push(NOTES[mod(node.lx * 7 + node.ly * 4, 12)].name);
    });

    setActiveNodeIds(newActiveIds);
    setSelectedChord(chordType);
    playChord(noteNames);
  }, [rootNode]);

  const handleTranspose = useCallback((intervalName: string) => {
    if (!lastSelectedChordId) return;

    // Parse current ID: "type:lx,ly" (e.g., "M:0,0")
    const parts = lastSelectedChordId.split(':');
    if (parts.length !== 2) return;
    
    const type = parts[0]; // 'M' or 'm'
    const coords = parts[1].split(',');
    const lx = parseInt(coords[0]);
    const ly = parseInt(coords[1]);

    const offset = INTERVAL_OFFSETS[intervalName];
    if (!offset) return;

    const newLx = lx + offset.dx;
    const newLy = ly + offset.dy;
    
    const newId = `${type}:${newLx},${newLy}`;

    // Play transposed chord
    const rootIdx = mod(newLx * 7 + newLy * 4, 12);
    const intervals = type === 'M' ? [0, 4, 7] : [0, 3, 7];
    const chordNotes = intervals.map(i => NOTES[mod(rootIdx + i, 12)].name);

    setActiveNodeIds(prev => {
      const newSet = new Set(prev);
      newSet.add(newId);
      return newSet;
    });
    setLastSelectedChordId(newId);
    playChord(chordNotes);

  }, [lastSelectedChordId]);

  const handleClear = useCallback(() => {
    setActiveNodeIds(new Set());
    setRootNode(null);
    setSelectedChord(null);
    setLastSelectedChordId(null);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="flex-none h-14 bg-surface border-b border-slate-700 flex items-center justify-between px-4 z-20 shadow-md">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-background font-bold">
             <i className="fas fa-music"></i>
           </div>
           <span className="font-bold text-lg hidden sm:block">Music Tools</span>
        </div>
        
        <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
          <button
            onClick={() => setActiveTab('tonnetz')}
            className={`
              px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${activeTab === 'tonnetz' 
                ? 'bg-slate-700 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
          >
            Tonnetz
          </button>
          <button
            onClick={() => setActiveTab('circle')}
            className={`
              px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${activeTab === 'circle' 
                ? 'bg-slate-700 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
          >
            Circle of 5ths
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`
              px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${activeTab === 'generator' 
                ? 'bg-slate-700 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
          >
            Generator
          </button>
          <button
            onClick={() => setActiveTab('fretboard')}
            className={`
              px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${activeTab === 'fretboard' 
                ? 'bg-slate-700 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
          >
            Fretboard
          </button>
        </div>
        
        <div className="w-8"></div> {/* Spacer for balance */}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'tonnetz' ? (
          <div className="flex flex-col md:flex-row h-full w-full">
            <Sidebar 
              onChordSelect={handleChordSelect} 
              onClear={handleClear}
              selectedRoot={rootNode ? rootNode.noteIndex : null}
              selectedChord={selectedChord}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              onTranspose={handleTranspose}
              hasSelectedChord={!!lastSelectedChordId}
              instrument={instrument}
              onInstrumentChange={handleInstrumentChange}
            />
            <main className="flex-1 relative h-full">
              <TonnetzGrid 
                  activeNodeIds={activeNodeIds} 
                  rootNodeId={rootNode ? `${rootNode.lx},${rootNode.ly}` : null} 
                  onNoteClick={handleNoteClick} 
                  onChordClick={handleChordClick}
                  zoomLevel={zoomLevel}
                  viewMode={viewMode}
              />
              <div className="md:hidden absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                <span className="text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded">
                  {viewMode === 'notes' ? 'Tap nodes. Scroll panel for chords.' : 'Tap chords to select.'}
                </span>
              </div>
            </main>
          </div>
        ) : activeTab === 'circle' ? (
          <CircleOfFifths 
            instrument={instrument} 
            onInstrumentChange={handleInstrumentChange} 
          />
        ) : activeTab === 'generator' ? (
          <div className="h-full overflow-y-auto">
            <RandomChordGenerator 
              instrument={instrument} 
              onInstrumentChange={handleInstrumentChange} 
            />
          </div>
        ) : (
          <Fretboard
            instrument={instrument}
            onInstrumentChange={handleInstrumentChange}
          />
        )}
      </div>
    </div>
  );
};

export default App;