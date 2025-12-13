import React, { useState, useCallback } from 'react';
import TonnetzGrid from './components/TonnetzGrid';
import Sidebar from './components/Sidebar';
import RandomChordGenerator from './components/RandomChordGenerator';
import { CHORDS, findChordLayout } from './utils/music';

interface RootNodeInfo {
  lx: number;
  ly: number;
  noteIndex: number;
}

type Tab = 'tonnetz' | 'generator';

const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<Tab>('tonnetz');

  // Tonnetz State
  const [activeNodeIds, setActiveNodeIds] = useState<Set<string>>(new Set());
  const [rootNode, setRootNode] = useState<RootNodeInfo | null>(null);
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Tonnetz Handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.4));
  }, []);

  const handleNoteClick = useCallback((noteIndex: number, lx: number, ly: number) => {
    setRootNode({ noteIndex, lx, ly });

    if (selectedChord) {
      const intervals = CHORDS[selectedChord].intervals;
      const chordNodes = findChordLayout(lx, ly, intervals);
      const newActiveIds = new Set<string>();
      chordNodes.forEach(node => newActiveIds.add(`${node.lx},${node.ly}`));
      setActiveNodeIds(newActiveIds);
    } else {
      const id = `${lx},${ly}`;
      setActiveNodeIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
      });
      setSelectedChord(null);
    }
  }, [selectedChord]);

  const handleChordSelect = useCallback((chordType: string) => {
    if (!rootNode) return;
    const intervals = CHORDS[chordType].intervals;
    const chordNodes = findChordLayout(rootNode.lx, rootNode.ly, intervals);
    const newActiveIds = new Set<string>();
    chordNodes.forEach(node => newActiveIds.add(`${node.lx},${node.ly}`));
    setActiveNodeIds(newActiveIds);
    setSelectedChord(chordType);
  }, [rootNode]);

  const handleClear = useCallback(() => {
    setActiveNodeIds(new Set());
    setRootNode(null);
    setSelectedChord(null);
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
            Tonnetz Grid
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
            Chord Generator
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
            />
            <main className="flex-1 relative h-full">
              <TonnetzGrid 
                  activeNodeIds={activeNodeIds} 
                  rootNodeId={rootNode ? `${rootNode.lx},${rootNode.ly}` : null} 
                  onNoteClick={handleNoteClick} 
                  zoomLevel={zoomLevel}
              />
              <div className="md:hidden absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                <span className="text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded">
                  Tap nodes. Scroll panel for chords.
                </span>
              </div>
            </main>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <RandomChordGenerator />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;