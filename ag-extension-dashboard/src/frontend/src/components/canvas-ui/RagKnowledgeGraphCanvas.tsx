import React, { useRef, useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export interface GraphNode {
  id: string;
  label: string;
  category: 'fao' | 'soil' | 'nasa' | 'farmer' | 'rule';
  snippet: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  radius?: number;
  color?: string;
  score?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

export interface RagKnowledgeGraphCanvasProps {
  className?: string;
  onNodeSelect?: (node: GraphNode) => void;
  customNodes?: GraphNode[];
}

const CATEGORY_COLORS: Record<GraphNode['category'], string> = {
  fao: '#a855f7',
  soil: '#10b981',
  nasa: '#06b6d4',
  farmer: '#f59e0b',
  rule: '#ec4899',
};

const DEFAULT_NODES: GraphNode[] = [
  {
    id: 'fao-maize',
    label: 'FAO Maize Pathology Vol. 4',
    category: 'fao',
    snippet: 'Puccinia sorghi fungal pustule identification and triazole-based chemical control guidelines.',
    score: 0.96,
  },
  {
    id: 'soil-nitrogen',
    label: 'SoilGrids Sub-Saharan N Index',
    category: 'soil',
    snippet: 'Regional topsoil total nitrogen (0-30cm) median baseline in Machakos and Eastern regions.',
    score: 0.89,
  },
  {
    id: 'nasa-precip',
    label: 'NASA POWER Wet-Season Forecast',
    category: 'nasa',
    snippet: '7-day satellite precipitation coefficient and soil moisture anomaly tracking.',
    score: 0.92,
  },
  {
    id: 'farmer-mwangi',
    label: 'Farmer: Emmanuel Mwangi (Machakos)',
    category: 'farmer',
    snippet: 'Plot #12: Intercropped Maize & Beans. Prior visit flagged moderate nitrogen deficiency.',
    score: 0.85,
  },
  {
    id: 'fao-cassava',
    label: 'IITA Cassava Mosaic Guide',
    category: 'fao',
    snippet: 'Whitefly vector transmission cycles and virus-resistant clone selection recommendations.',
    score: 0.78,
  },
  {
    id: 'rule-lime',
    label: 'Agricultural Lime Dosing Matrix',
    category: 'rule',
    snippet: 'Standard application protocol for acidic clay soils below pH 5.2 (2.5 tonnes/ha).',
    score: 0.88,
  },
  {
    id: 'farmer-njeri',
    label: 'Farmer: Mary Njeri (Kirinyaga)',
    category: 'farmer',
    snippet: 'Plot #04: Coffee & Avocado grove. Soil test shows high potassium but low soil organic matter.',
    score: 0.81,
  },
];

const DEFAULT_LINKS: GraphLink[] = [
  { source: 'farmer-mwangi', target: 'soil-nitrogen', weight: 0.9 },
  { source: 'farmer-mwangi', target: 'fao-maize', weight: 0.85 },
  { source: 'soil-nitrogen', target: 'rule-lime', weight: 0.75 },
  { source: 'fao-maize', target: 'nasa-precip', weight: 0.7 },
  { source: 'farmer-njeri', target: 'soil-nitrogen', weight: 0.65 },
  { source: 'fao-cassava', target: 'nasa-precip', weight: 0.6 },
];

function applyRepulsionBetween(n1: GraphNode, n2: GraphNode, draggingNode: GraphNode | null) {
  const dx = (n2.x || 0) - (n1.x || 0);
  const dy = (n2.y || 0) - (n1.y || 0);
  const dist = Math.hypot(dx, dy) || 1;
  const minComfort = (n1.radius || 20) + (n2.radius || 20) + 40;

  if (dist < minComfort) {
    const force = ((minComfort - dist) / dist) * 0.06;
    n1.vx = (n1.vx || 0) - dx * force;
    n1.vy = (n1.vy || 0) - dy * force;
    if (n2 !== draggingNode) {
      n2.vx = (n2.vx || 0) + dx * force;
      n2.vy = (n2.vy || 0) + dy * force;
    }
  }
}

function applyGravityAndRepulsion(
  nodes: GraphNode[],
  centerX: number,
  centerY: number,
  draggingNode: GraphNode | null
) {
  for (let i = 0; i < nodes.length; i++) {
    const n1 = nodes[i];
    if (n1 === draggingNode) continue;
    n1.vx = ((n1.vx || 0) + (centerX - (n1.x || centerX)) * 0.003);
    n1.vy = ((n1.vy || 0) + (centerY - (n1.y || centerY)) * 0.003);

    for (let j = i + 1; j < nodes.length; j++) {
      applyRepulsionBetween(n1, nodes[j], draggingNode);
    }
  }
}

function applySingleLinkForce(
  link: GraphLink,
  src: GraphNode | undefined,
  tgt: GraphNode | undefined,
  draggingNode: GraphNode | null
) {
  if (!src || !tgt) return;
  const dx = (tgt.x || 0) - (src.x || 0);
  const dy = (tgt.y || 0) - (src.y || 0);
  const dist = Math.hypot(dx, dy) || 1;
  const force = (dist - 90) * 0.004 * link.weight;

  if (src !== draggingNode) {
    src.vx = (src.vx || 0) + dx * force;
    src.vy = (src.vy || 0) + dy * force;
  }
  if (tgt !== draggingNode) {
    tgt.vx = (tgt.vx || 0) - dx * force;
    tgt.vy = (tgt.vy || 0) - dy * force;
  }
}

function applyLinkForces(
  links: GraphLink[],
  nodes: GraphNode[],
  draggingNode: GraphNode | null
) {
  for (const link of links) {
    const src = nodes.find(n => n.id === link.source);
    const tgt = nodes.find(n => n.id === link.target);
    applySingleLinkForce(link, src, tgt, draggingNode);
  }
}

function updatePositionsAndDamping(
  nodes: GraphNode[],
  centerX: number,
  centerY: number,
  draggingNode: GraphNode | null,
  width: number,
  height: number
) {
  for (const n of nodes) {
    if (n === draggingNode) continue;
    n.vx = (n.vx || 0) * 0.85;
    n.vy = (n.vy || 0) * 0.85;
    n.x = Math.max(30, Math.min(width - 30, (n.x || centerX) + (n.vx || 0)));
    n.y = Math.max(30, Math.min(height - 30, (n.y || centerY) + (n.vy || 0)));
  }
}

function applyPhysics(
  nodes: GraphNode[],
  links: GraphLink[],
  centerX: number,
  centerY: number,
  draggingNode: GraphNode | null,
  width: number,
  height: number
) {
  applyGravityAndRepulsion(nodes, centerX, centerY, draggingNode);
  applyLinkForces(links, nodes, draggingNode);
  updatePositionsAndDamping(nodes, centerX, centerY, draggingNode, width, height);
}

function renderLinks(
  ctx: CanvasRenderingContext2D,
  links: GraphLink[],
  nodes: GraphNode[],
  now: number
) {
  for (const link of links) {
    const src = nodes.find(n => n.id === link.source);
    const tgt = nodes.find(n => n.id === link.target);
    if (!src || !tgt || !src.x || !src.y || !tgt.x || !tgt.y) continue;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = link.weight * 2;
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();

    const t = (now * 0.001 * link.weight) % 1;
    const px = src.x + (tgt.x - src.x) * t;
    const py = src.y + (tgt.y - src.y) * t;

    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
  }
}

function drawSingleNode(
  ctx: CanvasRenderingContext2D,
  n: GraphNode,
  isHover: boolean,
  isSel: boolean,
  opacity: number
) {
  if (!n.x || !n.y) return;
  ctx.globalAlpha = opacity;

  if (isHover || isSel) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, (n.radius || 20) + 8, 0, Math.PI * 2);
    ctx.fillStyle = n.color || '#10b981';
    ctx.globalAlpha = opacity * 0.3;
    ctx.fill();
    ctx.globalAlpha = opacity;
  }

  ctx.beginPath();
  ctx.arc(n.x, n.y, n.radius || 20, 0, Math.PI * 2);
  ctx.fillStyle = '#18181b';
  ctx.fill();
  ctx.strokeStyle = n.color || '#10b981';
  ctx.lineWidth = isSel ? 3 : 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = n.color || '#10b981';
  ctx.fill();

  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#f4f4f5';
  ctx.textAlign = 'center';
  const truncated = n.label.length > 16 ? `${n.label.substring(0, 14)}..` : n.label;
  ctx.fillText(truncated, n.x, n.y + (n.radius || 20) + 12);
  ctx.globalAlpha = 1.0;
}

function renderNodes(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  hoveredNode: GraphNode | null,
  selectedNode: GraphNode | null,
  activeCategory: string,
  searchTerm: string
) {
  for (const n of nodes) {
    const isHover = hoveredNode?.id === n.id;
    const isSel = selectedNode?.id === n.id;
    const matchesFilter = activeCategory === 'all' || n.category === activeCategory;
    const matchesSearch = !searchTerm || n.label.toLowerCase().includes(searchTerm.toLowerCase());
    const opacity = matchesFilter && matchesSearch ? 1 : 0.25;

    drawSingleNode(ctx, n, isHover, isSel, opacity);
  }
}

export const RagKnowledgeGraphCanvas: React.FC<RagKnowledgeGraphCanvasProps> = ({
  className = '',
  onNodeSelect,
  customNodes,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links] = useState<GraphLink[]>(DEFAULT_LINKS);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const draggingNodeRef = useRef<GraphNode | null>(null);

  useEffect(() => {
    const raw = customNodes && customNodes.length > 0 ? customNodes : DEFAULT_NODES;
    const count = raw.length;
    const initialized = raw.map((n, i) => {
      const angle = (i / count) * Math.PI * 2;
      const dist = 100 + Math.random() * 40;
      return {
        ...n,
        x: 250 + Math.cos(angle) * dist,
        y: 160 + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: 18 + (n.score || 0.8) * 10,
        color: CATEGORY_COLORS[n.category] || '#10b981',
      };
    });
    setNodes(initialized);
  }, [customNodes]);

  useEffect(() => {
    let animId: number;

    const tick = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const parentWidth = canvas.parentElement?.clientWidth || 500;
      const parentHeight = 340;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== parentWidth * dpr || canvas.height !== parentHeight * dpr) {
        canvas.width = parentWidth * dpr;
        canvas.height = parentHeight * dpr;
        canvas.style.width = `${parentWidth}px`;
        canvas.style.height = `${parentHeight}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, parentWidth, parentHeight);

      applyPhysics(
        nodes,
        links,
        parentWidth / 2,
        parentHeight / 2,
        draggingNodeRef.current,
        parentWidth,
        parentHeight
      );

      renderLinks(ctx, links, nodes, performance.now());
      renderNodes(ctx, nodes, hoveredNode, selectedNode, activeCategory, searchTerm);

      ctx.restore();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [nodes, links, hoveredNode, selectedNode, activeCategory, searchTerm]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = nodes.find(n => Math.hypot((n.x || 0) - x, (n.y || 0) - y) <= (n.radius || 20));
    if (hit) {
      draggingNodeRef.current = hit;
      setSelectedNode(hit);
      if (onNodeSelect) onNodeSelect(hit);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggingNodeRef.current) {
      draggingNodeRef.current.x = x;
      draggingNodeRef.current.y = y;
      draggingNodeRef.current.vx = 0;
      draggingNodeRef.current.vy = 0;
    } else {
      const hit = nodes.find(n => Math.hypot((n.x || 0) - x, (n.y || 0) - y) <= (n.radius || 20));
      setHoveredNode(hit || null);
    }
  };

  const handleMouseUp = () => {
    draggingNodeRef.current = null;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['all', 'fao', 'soil', 'nasa', 'farmer', 'rule'].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-lg font-semibold uppercase text-xxs transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search RAG memory..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs w-44 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-950 shadow-inner">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-[340px] block cursor-grab active:cursor-grabbing"
        />

        {(selectedNode || hoveredNode) && (
          <div className="absolute top-3 left-3 bg-gray-900/90 border border-white/10 backdrop-blur-md p-3.5 rounded-xl shadow-xl text-xs text-white max-w-sm pointer-events-none animate-in fade-in">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-bold text-gray-100">
                {(selectedNode || hoveredNode)?.label}
              </span>
              <span
                style={{
                  backgroundColor: `${CATEGORY_COLORS[(selectedNode || hoveredNode)!.category]}25`,
                  color: CATEGORY_COLORS[(selectedNode || hoveredNode)!.category],
                }}
                className="px-2 py-0.5 rounded text-xxs font-mono uppercase font-bold"
              >
                {(selectedNode || hoveredNode)?.category}
              </span>
            </div>
            <p className="text-xxs text-gray-300 leading-relaxed line-clamp-3">
              {(selectedNode || hoveredNode)?.snippet}
            </p>
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xxs font-mono text-gray-400">
              <span>Vector Similarity:</span>
              <span className="text-emerald-400 font-bold">
                {(((selectedNode || hoveredNode)?.score || 0.85) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/10 text-xxs font-mono text-gray-400 pointer-events-none">
          Physics Force Directed • Drag nodes to reposition
        </div>
      </div>
    </div>
  );
};

export default RagKnowledgeGraphCanvas;
