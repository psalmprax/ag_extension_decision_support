import React, { useState } from 'react';

interface Plot {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

const IsometricFarmOverview: React.FC = () => {
  const [hoveredPlot, setHoveredPlot] = useState<string | null>(null);

  const plots: Plot[] = [
    { id: '1', name: 'North Field', status: 'healthy', x: 0, y: 0, width: 2, height: 2, color: '#4FD1C5' },
    { id: '2', name: 'East Orchard', status: 'warning', x: 2.5, y: 0, width: 1.5, height: 3, color: '#F6AD55' },
    { id: '3', name: 'Lower Valley', status: 'healthy', x: 0, y: 2.5, width: 2.2, height: 1.8, color: '#4FD1C5' },
    { id: '4', name: 'Research Plot', status: 'critical', x: 2.5, y: 3.5, width: 1.5, height: 1.5, color: '#F56565' },
  ];

  // Tile size for isometric grid
  const tileW = 100;
  const tileH = 50;

  const toIso = (x: number, y: number) => {
    return {
      px: (x - y) * (tileW / 2),
      py: (x + y) * (tileH / 2)
    };
  };

  return (
    <div className="relative w-full h-[500px] overflow-hidden cyber-grid-premium rounded-3xl border border-primary-500/10 glass-premium group">
      <div className="absolute top-6 left-8 z-10">
        <h3 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <span className="w-2 h-8 bg-primary-500 rounded-full animate-pulse"></span>
          TERRAFLUX FARM
        </h3>
        <p className="text-primary-300/60 text-sm font-medium ml-5">AGENT-FARMER AI WORKBENCH</p>
      </div>

      <div className="absolute top-6 right-8 z-10 flex items-center gap-4">
        <div className="glass-premium px-4 py-2 rounded-xl border-primary-500/20 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
            <span className="text-xs font-bold text-white uppercase tracking-widest">Live Joint View</span>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center translate-y-12 scale-110">
        <svg viewBox="-300 -50 600 400" className="w-full h-full drop-shadow-[0_0_30px_rgba(79,209,197,0.1)]">
          {/* Base Grid */}
          <g opacity="0.15">
            {Array.from({ length: 10 }).map((_, i) => (
              Array.from({ length: 10 }).map((_, j) => {
                const { px, py } = toIso(i - 4.5, j - 4.5);
                return (
                  <path
                    key={`${i}-${j}`}
                    d={`M${px},${py} L${px + tileW/2},${py + tileH/2} L${px},${py + tileH} L${px - tileW/2},${py + tileH/2} Z`}
                    fill="none"
                    stroke="#4FD1C5"
                    strokeWidth="0.5"
                  />
                );
              })
            ))}
          </g>

          {/* Plots */}
          {plots.map((plot) => {
            const { px, py } = toIso(plot.x - 2, plot.y - 2);
            const w = plot.width * (tileW / 2);
            const h = plot.height * (tileH / 2);
            
            // Simplified polygon for a rectangle in isometric view
            const p1 = { x: px, y: py };
            const p2 = { x: px + plot.width * (tileW/2), y: py + plot.width * (tileH/2) };
            const p3 = { x: px + (plot.width - plot.height) * (tileW/2), y: py + (plot.width + plot.height) * (tileH/2) };
            const p4 = { x: px - plot.height * (tileW/2), y: py + plot.height * (tileH/2) };

            const points = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
            const isHovered = hoveredPlot === plot.id;

            return (
              <g 
                key={plot.id} 
                onMouseEnter={() => setHoveredPlot(plot.id)}
                onMouseLeave={() => setHoveredPlot(null)}
                className="cursor-pointer transition-all duration-300"
              >
                {/* Glow layer */}
                <polygon
                  points={points}
                  fill={plot.color}
                  fillOpacity={isHovered ? 0.3 : 0.15}
                  stroke={plot.color}
                  strokeWidth={isHovered ? 2 : 1}
                  className="transition-all duration-300"
                />
                
                {/* Border layer */}
                <polygon
                  points={points}
                  fill="none"
                  stroke={plot.color}
                  strokeWidth={isHovered ? 3 : 1}
                  strokeOpacity={isHovered ? 1 : 0.6}
                  className="transition-all duration-300"
                />

                {/* Animated Scan Line */}
                {isHovered && (
                    <g>
                         <line 
                            x1={p1.x} y1={p1.y} 
                            x2={p2.x} y2={p2.y} 
                            stroke={plot.color} 
                            className="animate-pulse"
                            strokeWidth="2"
                         >
                            <animateTransform 
                                attributeName="transform" 
                                type="translate" 
                                values={`0,0; 0,${plot.height * tileH}`} 
                                dur="2s" 
                                repeatCount="indefinite" 
                            />
                         </line>
                    </g>
                )}

                {/* Plot Label (only on hover or significant ones) */}
                {isHovered && (
                  <foreignObject x={p3.x - 50} y={p3.y - 80} width="120" height="60">
                    <div className="glass-premium px-3 py-2 rounded-lg border-primary-500/30 animate-slide-up">
                      <p className="text-[10px] font-bold text-white uppercase tracking-tighter">{plot.name}</p>
                      <p className="text-[8px] text-primary-300/80 uppercase">Status: {plot.status}</p>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Atmospheric UI overlays */}
      <div className="absolute bottom-8 right-8 z-10 glass-premium px-6 py-4 rounded-2xl border-white/5 animate-fade-in">
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="text-[10px] font-bold text-primary-300/40 uppercase tracking-widest">Partly Cloudy</p>
                <p className="text-sm font-bold text-white uppercase tracking-tighter">Farm Conditions</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
            </div>
        </div>
      </div>
    </div>
  );
};

export default IsometricFarmOverview;
