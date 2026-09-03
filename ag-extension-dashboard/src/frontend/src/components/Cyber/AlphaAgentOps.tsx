import React, { useEffect, useRef } from 'react';
import { AgentOpsView } from './alpha/AgentOpsView';
import {
  useAgentOpsController,
  type AgentData,
} from './alpha/useAgentOpsController';

interface TopologyNode {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  status: string;
}

const NODE_COLORS = ['#10b981', '#06b6d4', '#ec4899', '#f59e0b', '#8b5cf6', '#22d3ee'];

function buildTopology(fleet: AgentData[]): { nodes: TopologyNode[]; links: Array<{ from: string; to: string }> } {
  if (fleet.length === 0) return { nodes: [], links: [] };
  const [hub, ...spokes] = fleet;
  const nodes: TopologyNode[] = [{ id: hub.id, name: hub.name, x: 0.5, y: 0.5, color: NODE_COLORS[0], status: hub.status }];
  spokes.forEach((agent, index) => {
    const angle = (index / Math.max(spokes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    nodes.push({
      id: agent.id,
      name: agent.name,
      x: 0.5 + Math.cos(angle) * 0.32,
      y: 0.5 + Math.sin(angle) * 0.32,
      color: NODE_COLORS[(index + 1) % NODE_COLORS.length],
      status: agent.status,
    });
  });
  return { nodes, links: spokes.map(agent => ({ from: hub.id, to: agent.id })) };
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawLinks(ctx: CanvasRenderingContext2D, width: number, height: number, packetT: number, nodes: TopologyNode[], links: Array<{ from: string; to: string }>): void {
  links.forEach(link => {
    const from = nodes.find(node => node.id === link.from);
    const to = nodes.find(node => node.id === link.to);
    if (!from || !to) return;
    const x1 = from.x * width;
    const y1 = from.y * height;
    const x2 = to.x * width;
    const y2 = to.y * height;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    const progress = (packetT + from.x * 3) % 1;
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawNodes(ctx: CanvasRenderingContext2D, width: number, height: number, activeAgent: string, nodes: TopologyNode[]): void {
  nodes.forEach(node => {
    const x = node.x * width;
    const y = node.y * height;
    const selected = activeAgent === node.id;
    if (selected) {
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = selected ? node.color : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = selected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(node.name, x, y + 28);
  });
}

export const MultiAgentTopologyCanvas: React.FC<{
  activeAgent: string;
  fleet: AgentData[];
  onSelectAgent: (id: string) => void;
}> = ({ activeAgent, fleet, onSelectAgent }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { nodes, links } = React.useMemo(() => buildTopology(fleet), [fleet]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let animationFrame = 0;
    let packetT = 0;
    const render = () => {
      const width = (canvas.width = canvas.parentElement?.clientWidth || 600);
      const height = (canvas.height = canvas.parentElement?.clientHeight || 280);
      context.clearRect(0, 0, width, height);
      drawGrid(context, width, height);
      drawLinks(context, width, height, packetT, nodes, links);
      drawNodes(context, width, height, activeAgent, nodes);
      packetT = (packetT + 0.008) % 1;
      animationFrame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [activeAgent, links, nodes]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / rect.width;
    const clickY = (event.clientY - rect.top) / rect.height;
    const nearest = nodes.reduce<TopologyNode | null>((current, node) => {
      if (!current) return node;
      const currentDistance = Math.hypot(current.x - clickX, current.y - clickY);
      const nodeDistance = Math.hypot(node.x - clickX, node.y - clickY);
      return nodeDistance < currentDistance ? node : current;
    }, null);
    if (nearest && Math.hypot(nearest.x - clickX, nearest.y - clickY) < 0.15) onSelectAgent(nearest.id);
  };

  return (
    <div className="w-full h-64 rounded-xl bg-slate-950/80 border border-white/10 relative overflow-hidden">
      <canvas ref={canvasRef} onClick={handleClick} className="w-full h-full cursor-pointer" />
      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>{nodes.length > 0 ? `${nodes.length} REGISTERED AGENT${nodes.length === 1 ? '' : 'S'}` : 'NO AGENTS REGISTERED'}</span>
      </div>
      {nodes.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white/40">Agent registry unavailable</div>}
    </div>
  );
};

const AlphaAgentOps: React.FC = () => {
  const controller = useAgentOpsController();
  return <AgentOpsView {...controller} topology={<MultiAgentTopologyCanvas activeAgent={controller.activeAgent} fleet={controller.fleet} onSelectAgent={controller.setActiveAgent} />} />;
};

export default AlphaAgentOps;
