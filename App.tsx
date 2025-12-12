import React, { useState, useCallback } from 'react';
import TonnetzGrid from './components/TonnetzGrid';
import Sidebar from './components/Sidebar';
import { CHORDS, findChordLayout } from './utils/music';

interface RootNodeInfo {
  lx: number;
  ly: number;
  noteIndex: number;
}

const App: React.FC = () => {
  // Global State
  // activeNodeIds: A set of specific node IDs "lx,ly" that are lit up
  const [activeNodeIds, setActiveNodeIds] = useState<Set<string>>(new Set());
  
  // rootNode: The currently 'focused' node info
  const [rootNode, setRootNode] = useState<RootNodeInfo | null>(null);

  // selectedChord: The currently active chord type (for UI highlighting)
  const [selectedChord, setSelectedChord] = useState<string | null>(null);

  // Zoom level state
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.4));
  }, []);

  // Handle clicking a node on the grid
  const handleNoteClick = useCallback((noteIndex: number, lx: number, ly: number) => {
    // 1. Set as root
    setRootNode({ noteIndex, lx, ly });

    if (selectedChord) {
      // If a chord is active, move it to the new root
      const intervals = CHORDS[selectedChord].intervals;
      
      // Use the path-finding logic to get the best layout for this chord at the new position
      const chordNodes = findChordLayout(lx, ly, intervals);
      
      const newActiveIds = new Set<string>();
      chordNodes.forEach(node => {
        newActiveIds.add(`${node.lx},${node.ly}`);
      });
      
      setActiveNodeIds(newActiveIds);
    } else {
      // Manual Mode: Toggle visibility state
      const id = `${lx},${ly}`;
      setActiveNodeIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
      
      // Ensure selected chord is null since we are manually modifying
      setSelectedChord(null);
    }
  }, [selectedChord]);

  // Handle clicking a chord button
  const handleChordSelect = useCallback((chordType: string) => {
    if (!rootNode) return;

    const intervals = CHORDS[chordType].intervals;
    
    // Use the path-finding logic to get the best layout for this chord
    const chordNodes = findChordLayout(rootNode.lx, rootNode.ly, intervals);
    
    const newActiveIds = new Set<string>();
    chordNodes.forEach(node => {
      newActiveIds.add(`${node.lx},${node.ly}`);
    });
    
    // Replace current active notes with this chord shape
    setActiveNodeIds(newActiveIds);
    setSelectedChord(chordType);
  }, [rootNode]);

  const handleClear = useCallback(() => {
    setActiveNodeIds(new Set());
    setRootNode(null);
    setSelectedChord(null);
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-background overflow-hidden">
      {/* Sidebar Controls */}
      <Sidebar 
        onChordSelect={handleChordSelect} 
        onClear={handleClear}
        selectedRoot={rootNode ? rootNode.noteIndex : null}
        selectedChord={selectedChord}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      {/* Main Visualization Area */}
      <main className="flex-1 relative h-full">
         <TonnetzGrid 
            activeNodeIds={activeNodeIds} 
            rootNodeId={rootNode ? `${rootNode.lx},${rootNode.ly}` : null} 
            onNoteClick={handleNoteClick} 
            zoomLevel={zoomLevel}
         />
         
         {/* Mobile overlay hint if needed */}
         <div className="md:hidden absolute bottom-4 left-0 right-0 text-center pointer-events-none">
           <span className="text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded">
             Tap nodes to toggle. Scroll panel for chords.
           </span>
         </div>
      </main>
    </div>
  );
};

export default App;