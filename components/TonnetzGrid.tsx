import React, { useMemo, useState, useEffect, useRef } from 'react';
import { GridNode } from '../types';
import { mod, NOTES } from '../utils/music';

interface TonnetzGridProps {
  activeNodeIds: Set<string>; 
  rootNodeId: string | null;  
  onNoteClick: (noteIndex: number, lx: number, ly: number) => void;
  zoomLevel: number;
}

const BASE_CELL_SIZE = 60; 
const BASE_NODE_RADIUS = 22;

const TonnetzGrid: React.FC<TonnetzGridProps> = ({ activeNodeIds, rootNodeId, onNoteClick, zoomLevel }) => {
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

  // Handle Zoom Scaling: Maintain relative position of the center
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
        
        // Calculate the vector to this node in screen pixels (relative to lattice origin)
        const cellSize = BASE_CELL_SIZE * zoomLevel;
        const v1 = { x: 1 * cellSize, y: 0 };
        const v2 = { x: Math.cos(Math.PI / 3) * cellSize, y: Math.sin(Math.PI / 3) * cellSize }; 
        
        // We want origin + vector = screenCenter
        // So pan = -vector
        const targetX = -(lx * v1.x + ly * v2.x);
        const targetY = -(lx * v1.y + ly * v2.y);
        
        setPan({ x: targetX, y: targetY });
    }
  }, [rootNodeId]); 

  // Geometry Helpers
  const getGeometry = () => {
    const cellSize = BASE_CELL_SIZE * zoomLevel;
    const v1 = { x: 1 * cellSize, y: 0 };
    const v2 = { x: Math.cos(Math.PI / 3) * cellSize, y: Math.sin(Math.PI / 3) * cellSize };
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const originX = centerX + pan.x;
    const originY = centerY + pan.y;
    
    return { cellSize, v1, v2, originX, originY };
  };

  // Pointer Events for Dragging and Clicking
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

    // Calculate drag distance to distinguish click from drag
    const dist = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
    
    // Threshold for click (pixels)
    if (dist < 5 && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Convert screen click to lattice coordinates
        const { v1, v2, originX, originY } = getGeometry();
        
        // Inverse Matrix Determinant
        const det = v1.x * v2.y - v2.x * v1.y;
        const dx = clickX - originX;
        const dy = clickY - originY;
        
        // Lattice coords (fractional)
        const flx = (v2.y * dx - v2.x * dy) / det;
        const fly = (-v1.y * dx + v1.x * dy) / det;
        
        // Round to nearest node
        const lx = Math.round(flx);
        const ly = Math.round(fly);

        // Check distance to center of that node to ensure we actually clicked a node
        // Re-project rounded lx, ly to screen
        const nodeScreenX = originX + (lx * v1.x) + (ly * v2.x);
        const nodeScreenY = originY + (lx * v1.y) + (ly * v2.y);
        
        const distToNode = Math.hypot(clickX - nodeScreenX, clickY - nodeScreenY);
        const radius = BASE_NODE_RADIUS * zoomLevel;

        // Allow click if within 1.5x radius (generous hit box)
        if (distToNode <= radius * 1.5) {
            const noteIndex = mod(lx * 7 + ly * 4, 12);
            onNoteClick(noteIndex, lx, ly);
        }
    }
  };

  // Generate grid nodes based on visible area
  const nodes = useMemo(() => {
    const grid: GridNode[] = [];
    const { v1, v2, originX, originY } = getGeometry();

    // Helper for generating grid bounds
    // Inverse Matrix Determinant
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
        const screenX = originX + (lx * v1.x) + (ly * v2.x);
        const screenY = originY + (lx * v1.y) + (ly * v2.y);
        
        const noteIndex = mod(lx * 7 + ly * 4, 12);

        grid.push({
          lx,
          ly,
          noteIndex,
          id: `${lx},${ly}`,
          screenX,
          screenY,
        });
      }
    }
    return grid;
  }, [dimensions, zoomLevel, pan]);

  // Generate lines
  const lines = useMemo(() => {
    const edges: React.ReactElement[] = [];
    const nodeMap = new Map<string, GridNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    nodes.forEach(node => {
      const neighbors = [
        { dx: 1, dy: 0 },    // P5
        { dx: 0, dy: 1 },    // M3
        { dx: 1, dy: -1 }    // m3
      ];

      neighbors.forEach(offset => {
        const neighborId = `${node.lx + offset.dx},${node.ly + offset.dy}`;
        const neighbor = nodeMap.get(neighborId);

        if (neighbor) {
          const isNodeActive = activeNodeIds.has(node.id);
          const isNeighborActive = activeNodeIds.has(neighbor.id);
          const isConnected = isNodeActive && isNeighborActive;

          const stroke = isConnected ? 'rgba(56, 189, 248, 0.8)' : 'rgba(255, 255, 255, 0.05)';
          const baseStrokeWidth = isConnected ? 4 : 1;
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
              style={{ opacity: isConnected ? 1 : 0.3 }}
            />
          );
        }
      });
    });
    return edges;
  }, [nodes, activeNodeIds, zoomLevel]);

  return (
    <div 
        ref={containerRef} 
        className={`w-full h-full bg-background relative overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }} // Prevent scrolling on mobile
    >
      <svg 
        width="100%" 
        height="100%" 
        className="block"
      >
        {lines}
        {nodes.map((node) => {
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
              style={{ pointerEvents: 'none' }} // Interaction handled by parent
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
      </svg>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 pointer-events-none text-right opacity-50">
         <div className="flex items-center justify-end gap-2 mb-1">
           <span className="text-xs text-white">P5 —</span>
         </div>
         <div className="flex items-center justify-end gap-2 mb-1">
           <span className="text-xs text-white">M3 \</span>
         </div>
         <div className="flex items-center justify-end gap-2">
           <span className="text-xs text-white">m3 /</span>
         </div>
      </div>
    </div>
  );
};

export default TonnetzGrid;
