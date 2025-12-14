import React, { useMemo, useState, useEffect, useRef } from 'react';
import { GridNode, ViewMode } from '../types';
import { mod, NOTES } from '../utils/music';

interface TonnetzGridProps {
  activeNodeIds: Set<string>; 
  rootNodeId: string | null;  
  onNoteClick: (noteIndex: number, lx: number, ly: number) => void;
  onChordClick: (chordId: string) => void;
  zoomLevel: number;
  viewMode: ViewMode;
}

const BASE_CELL_SIZE = 60; 
const BASE_NODE_RADIUS = 22;

const TonnetzGrid: React.FC<TonnetzGridProps> = ({ activeNodeIds, rootNodeId, onNoteClick, onChordClick, zoomLevel, viewMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const prevZoomRef = useRef(zoomLevel);
  const dragStart = useRef({ x: 0, y: 0 });

  // Handle resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    window.addEventListener('resize', updateSize);
    updateSize();
    
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Handle Zoom Scaling
  useEffect(() => {
    if (prevZoomRef.current !== zoomLevel) {
        const ratio = zoomLevel / prevZoomRef.current;
        setPan(p => ({ x: p.x * ratio, y: p.y * ratio }));
        prevZoomRef.current = zoomLevel;
    }
  }, [zoomLevel]);

  // Handle Auto-Center on Root Node Change
  useEffect(() => {
    if (rootNodeId) {
        const [lxStr, lyStr] = rootNodeId.split(',');
        const lx = parseInt(lxStr);
        const ly = parseInt(lyStr);
        
        const cellSize = BASE_CELL_SIZE * zoomLevel;
        // Inverted Y axis for v2
        const v1 = { x: 1 * cellSize, y: 0 };
        const v2 = { x: Math.cos(Math.PI / 3) * cellSize, y: -Math.sin(Math.PI / 3) * cellSize }; 
        
        const targetX = -(lx * v1.x + ly * v2.x);
        const targetY = -(lx * v1.y + ly * v2.y);
        
        setPan({ x: targetX, y: targetY });
    }
  }, [rootNodeId]); 

  // Geometry Helpers
  const getGeometry = () => {
    const cellSize = BASE_CELL_SIZE * zoomLevel;
    const v1 = { x: 1 * cellSize, y: 0 };
    // Invert Y axis: Negative Sin for Up-Right direction
    const v2 = { x: Math.cos(Math.PI / 3) * cellSize, y: -Math.sin(Math.PI / 3) * cellSize };
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const originX = centerX + pan.x;
    const originY = centerY + pan.y;
    
    return { cellSize, v1, v2, originX, originY };
  };
  
  const getScreenPoint = (lx: number, ly: number, geom: any) => {
    const { v1, v2, originX, originY } = geom;
    return {
      x: originX + (lx * v1.x) + (ly * v2.x),
      y: originY + (lx * v1.y) + (ly * v2.y)
    };
  };

  // Pointer Events
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    const dist = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
    
    if (dist < 5 && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const geom = getGeometry();
        const { v1, v2, originX, originY } = geom;
        const det = v1.x * v2.y - v2.x * v1.y;
        const dx = clickX - originX;
        const dy = clickY - originY;
        
        const flx = (v2.y * dx - v2.x * dy) / det;
        const fly = (-v1.y * dx + v1.x * dy) / det;
        const lx = Math.round(flx);
        const ly = Math.round(fly);

        if (viewMode === 'notes') {
          const nodeScreen = getScreenPoint(lx, ly, geom);
          const distToNode = Math.hypot(clickX - nodeScreen.x, clickY - nodeScreen.y);
          const radius = BASE_NODE_RADIUS * zoomLevel;
          
          if (distToNode <= radius * 1.5) {
              const noteIndex = mod(lx * 7 + ly * 4, 12);
              onNoteClick(noteIndex, lx, ly);
          }
        } else {
          // Chord Click Logic
          // Check nearby centroids (lx, ly) and neighbors
          let closestDist = Infinity;
          let closestId = null;
          
          const checkCentroid = (cx: number, cy: number, type: string, clx: number, cly: number) => {
             const d = Math.hypot(clickX - cx, clickY - cy);
             if (d < closestDist) {
               closestDist = d;
               closestId = `${type}:${clx},${cly}`;
             }
          };

          // Search range: current rounded node and neighbors
          for(let dx = -1; dx <= 1; dx++) {
            for(let dy = -1; dy <= 1; dy++) {
              const cx_lx = lx + dx;
              const cx_ly = ly + dy;
              
              // Major Centroid
              const majCx = originX + (cx_lx + 1/3) * v1.x + (cx_ly + 1/3) * v2.x;
              const majCy = originY + (cx_lx + 1/3) * v1.y + (cx_ly + 1/3) * v2.y;
              checkCentroid(majCx, majCy, 'M', cx_lx, cx_ly);

              // Minor Centroid
              const minCx = originX + (cx_lx + 2/3) * v1.x + (cx_ly - 1/3) * v2.x;
              const minCy = originY + (cx_lx + 2/3) * v1.y + (cx_ly - 1/3) * v2.y;
              checkCentroid(minCx, minCy, 'm', cx_lx, cx_ly);
            }
          }
          
          // Selection Threshold: Roughly half cell size
          if (closestId && closestDist < (geom.cellSize * 0.4)) {
            onChordClick(closestId);
          }
        }
    }
  };

  // Generate grid nodes based on visible area
  const { nodes, bounds } = useMemo(() => {
    const grid: GridNode[] = [];
    const geom = getGeometry();
    const { v1, v2, originX, originY } = geom;

    const det = v1.x * v2.y - v2.x * v1.y;
    const getLatticeCoords = (sx: number, sy: number) => {
        const dx = sx - originX;
        const dy = sy - originY;
        return {
            lx: (v2.y * dx - v2.x * dy) / det,
            ly: (-v1.y * dx + v1.x * dy) / det
        };
    };

    const corners = [
        { x: 0, y: 0 },
        { x: dimensions.width, y: 0 },
        { x: dimensions.width, y: dimensions.height },
        { x: 0, y: dimensions.height }
    ];

    let minLx = Infinity, maxLx = -Infinity;
    let minLy = Infinity, maxLy = -Infinity;

    corners.forEach(c => {
        const p = getLatticeCoords(c.x, c.y);
        minLx = Math.min(minLx, Math.floor(p.lx));
        maxLx = Math.max(maxLx, Math.ceil(p.lx));
        minLy = Math.min(minLy, Math.floor(p.ly));
        maxLy = Math.max(maxLy, Math.ceil(p.ly));
    });

    const buffer = 2;
    minLx -= buffer; maxLx += buffer;
    minLy -= buffer; maxLy += buffer;

    for (let ly = minLy; ly <= maxLy; ly++) {
      for (let lx = minLx; lx <= maxLx; lx++) {
        const p = getScreenPoint(lx, ly, geom);
        const noteIndex = mod(lx * 7 + ly * 4, 12);
        grid.push({ lx, ly, noteIndex, id: `${lx},${ly}`, screenX: p.x, screenY: p.y });
      }
    }
    return { nodes: grid, bounds: { minLx, maxLx, minLy, maxLy } };
  }, [dimensions, zoomLevel, pan]);

  // Generate lines
  const lines = useMemo(() => {
    const edges: React.ReactElement[] = [];
    const nodeMap = new Map<string, GridNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    nodes.forEach(node => {
      const neighbors = [
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: -1 }
      ];

      neighbors.forEach(offset => {
        const neighborId = `${node.lx + offset.dx},${node.ly + offset.dy}`;
        const neighbor = nodeMap.get(neighborId);

        if (neighbor) {
          const isNodeActive = activeNodeIds.has(node.id);
          const isNeighborActive = activeNodeIds.has(neighbor.id);
          const isConnected = isNodeActive && isNeighborActive;

          const baseOpacity = viewMode === 'chords' ? 0.3 : 0.3;
          const stroke = isConnected ? 'rgba(56, 189, 248, 0.8)' : `rgba(255, 255, 255, ${baseOpacity})`;
          const baseStrokeWidth = isConnected ? 4 : (viewMode === 'chords' ? 1.5 : 1);
          const strokeWidth = baseStrokeWidth * Math.sqrt(zoomLevel);

          edges.push(
            <line
              key={`${node.id}-${neighborId}`}
              x1={node.screenX}
              y1={node.screenY}
              x2={neighbor.screenX}
              y2={neighbor.screenY}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{ opacity: isConnected ? 1 : (viewMode === 'chords' ? 0.2 : 0.3) }}
            />
          );
        }
      });
    });
    return edges;
  }, [nodes, activeNodeIds, zoomLevel, viewMode]);

  // Generate Chord Labels (Triangles)
  const chordLabels = useMemo(() => {
    if (viewMode !== 'chords') return [];

    const labels: React.ReactElement[] = [];
    const geom = getGeometry();
    const { v1, v2, originX, originY } = geom;
    
    const polyString = (pts: {x: number, y: number}[]) => pts.map(p => `${p.x},${p.y}`).join(' ');

    for (let ly = bounds.minLy; ly <= bounds.maxLy; ly++) {
      for (let lx = bounds.minLx; lx <= bounds.maxLx; lx++) {
        
        const noteIndex = mod(lx * 7 + ly * 4, 12);
        const noteName = NOTES[noteIndex].name;
        
        // --- Major Triad ---
        // ID: M:lx,ly
        const majId = `M:${lx},${ly}`;
        const isMajSelected = activeNodeIds.has(majId);
        
        const majCx = originX + (lx + 1/3) * v1.x + (ly + 1/3) * v2.x;
        const majCy = originY + (lx + 1/3) * v1.y + (ly + 1/3) * v2.y;
        
        // Vertices for highlight (relative to node 0,0: 0,0 - 1,0 - 0,1)
        const majP1 = getScreenPoint(lx, ly, geom);
        const majP2 = getScreenPoint(lx + 1, ly, geom);
        const majP3 = getScreenPoint(lx, ly + 1, geom);
        
        if (isMajSelected) {
          labels.push(
            <polygon
              key={`poly-maj-${lx},${ly}`}
              points={polyString([majP1, majP2, majP3])}
              fill="#ef4444"
              opacity={0.3}
              stroke="#ef4444"
              strokeWidth={2}
            />
          );
        }

        // --- Minor Triad ---
        // ID: m:lx,ly
        const minId = `m:${lx},${ly}`;
        const isMinSelected = activeNodeIds.has(minId);

        const minCx = originX + (lx + 2/3) * v1.x + (ly - 1/3) * v2.x;
        const minCy = originY + (lx + 2/3) * v1.y + (ly - 1/3) * v2.y;
        
        // Vertices for highlight (relative to node 0,0: 1,0 - 1,-1 - 0,0)
        // Wait, min centroid is avg of (lx,ly), (lx+1,ly), (lx+1,ly-1)
        const minP1 = getScreenPoint(lx, ly, geom);
        const minP2 = getScreenPoint(lx + 1, ly, geom);
        const minP3 = getScreenPoint(lx + 1, ly - 1, geom);

        if (isMinSelected) {
           labels.push(
            <polygon
              key={`poly-min-${lx},${ly}`}
              points={polyString([minP1, minP2, minP3])}
              fill="#f59e0b"
              opacity={0.3}
              stroke="#f59e0b"
              strokeWidth={2}
            />
          );
        }

        // --- Labels ---
        const fontSize = Math.max(12, 16 * zoomLevel);

        labels.push(
          <text
            key={`maj-${lx},${ly}`}
            x={majCx}
            y={majCy}
            dy=".3em"
            textAnchor="middle"
            fill={isMajSelected ? '#ffffff' : '#ef4444'}
            fontSize={fontSize}
            fontWeight="bold"
            className="select-none pointer-events-none"
            style={{ textShadow: isMajSelected ? '0 0 10px rgba(239, 68, 68, 0.8)' : '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            {noteName}
          </text>
        );

        labels.push(
          <text
            key={`min-${lx},${ly}`}
            x={minCx}
            y={minCy}
            dy=".3em"
            textAnchor="middle"
            fill={isMinSelected ? '#ffffff' : '#f59e0b'}
            fontSize={fontSize}
            fontWeight="bold"
            className="select-none pointer-events-none"
            style={{ textShadow: isMinSelected ? '0 0 10px rgba(245, 158, 11, 0.8)' : '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            {noteName.toLowerCase()}
          </text>
        );
      }
    }
    return labels;
  }, [bounds, viewMode, dimensions, zoomLevel, pan, activeNodeIds]);

  return (
    <div 
        ref={containerRef} 
        className={`w-full h-full bg-background relative overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }}
    >
      <svg width="100%" height="100%" className="block">
        {lines}
        
        {/* Render Nodes (Circles) only in Notes Mode */}
        {viewMode === 'notes' && nodes.map((node) => {
          const isActive = activeNodeIds.has(node.id);
          const isRoot = rootNodeId === node.id;
          
          let fill = '#1e293b'; 
          let stroke = '#475569'; 
          let textFill = '#94a3b8'; 
          
          const r = BASE_NODE_RADIUS * zoomLevel;
          const fontSize = Math.max(10, 14 * zoomLevel);

          if (isActive) {
            fill = isRoot ? '#f59e0b' : '#38bdf8'; 
            stroke = isRoot ? '#b45309' : '#0284c7';
            textFill = isRoot ? '#ffffff' : '#0f172a';
          }

          return (
            <g 
              key={node.id} 
              transform={`translate(${node.screenX}, ${node.screenY})`}
              style={{ pointerEvents: 'none' }}
              className="transition-colors duration-200"
            >
              <circle
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={(isRoot ? 3 : 2) * Math.sqrt(zoomLevel)}
                className="transition-all duration-300 ease-in-out"
              />
              <text
                dy=".3em"
                textAnchor="middle"
                fill={textFill}
                fontSize={fontSize}
                fontWeight="bold"
                className="select-none"
              >
                {NOTES[node.noteIndex].name}
              </text>
            </g>
          );
        })}

        {/* Render Chord Labels only in Chords Mode */}
        {viewMode === 'chords' && chordLabels}
      </svg>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 pointer-events-none text-right opacity-50 bg-slate-900/50 p-2 rounded">
         <div className="flex items-center justify-end gap-2 mb-1">
           <span className="text-xs text-white">P5 —</span>
         </div>
         <div className="flex items-center justify-end gap-2 mb-1">
           <span className="text-xs text-white">M3 /</span>
         </div>
         <div className="flex items-center justify-end gap-2">
           <span className="text-xs text-white">m3 \</span>
         </div>
      </div>
    </div>
  );
};

export default TonnetzGrid;