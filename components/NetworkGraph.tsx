import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Agent, AgentPacket, OpCode } from '../types';
import { Activity, Code2, Network } from 'lucide-react';

interface NetworkGraphProps {
  agents: Agent[];
  objective: string;
  packets: AgentPacket[];
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ agents, objective, packets }) => {
  const [mode, setMode] = useState<'TOPO' | 'RAW'>('TOPO');
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use refs for dynamic data access within the animation loop
  const packetsRef = useRef(packets);
  useEffect(() => {
    packetsRef.current = packets;
  }, [packets]);

  const agentsRef = useRef(agents);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  // --- MODE A: MATRIX RAIN (RAW) ---
  useEffect(() => {
    if (mode !== 'RAW' || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;

    if (!ctx) return;

    const fontSize = 14;
    let drops: number[] = [];
    let intervalId: any;

    const handleResize = () => {
        const { clientWidth, clientHeight } = container;
        if (clientWidth === 0 || clientHeight === 0) return;
        
        // Reset canvas dimensions to match container
        canvas.width = clientWidth;
        canvas.height = clientHeight;

        // Recalculate columns based on new width
        const columns = Math.ceil(canvas.width / fontSize);
        
        // Initialize drops if empty, or resize array
        if (drops.length === 0) {
            drops = new Array(columns).fill(1).map(() => Math.floor(Math.random() * -100));
        } else if (columns > drops.length) {
            // Add new drops for wider screen
            const newDrops = new Array(columns - drops.length).fill(1).map(() => Math.floor(Math.random() * -100));
            drops = [...drops, ...newDrops];
        } else if (columns < drops.length) {
            // Trim drops for narrower screen
            drops = drops.slice(0, columns);
        }
    };

    // Initial resize
    handleResize();

    // Resize Observer for dynamic layout changes
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const draw = () => {
      // Semi-transparent black for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0F0'; // Matrix Green
      ctx.font = `${fontSize}px monospace`;
      
      const currentAgents = agentsRef.current;
      const isSystemActive = currentAgents.some(a => a.status === OpCode.INITIALIZE || a.status === OpCode.EXECUTING);
      
      let binaryPool = "";
      
      if (isSystemActive) {
          const currentPackets = packetsRef.current;
          if (currentPackets.length > 0) {
              const slice = currentPackets.slice(-15).reverse();
              slice.forEach(p => {
                 const idBin = p.agentId.toString(2);
                 const opBin = p.opCode.toString(2);
                 let payloadBin = "";
                 for(let c = 0; c < Math.min(p.payload.length, 5); c++) {
                     payloadBin += p.payload.charCodeAt(c).toString(2);
                 }
                 binaryPool += idBin + opBin + payloadBin;
              });
          }
      } else {
          binaryPool = "0"; 
      }

      if (binaryPool.length === 0) binaryPool = "10";

      for (let i = 0; i < drops.length; i++) {
        const charIndex = (i * 13 + Math.abs(Math.floor(drops[i]))) % binaryPool.length;
        const text = binaryPool[charIndex];
        
        const highlightChance = isSystemActive ? 0.95 : 0.9995;
        const respawnThreshold = isSystemActive ? 0.975 : 0.9995;

        ctx.fillStyle = Math.random() > highlightChance ? '#CFFFDC' : '#00FF41';
        
        if (drops[i] * fontSize > 0) {
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        }

        if (drops[i] * fontSize > canvas.height && Math.random() > respawnThreshold) {
          drops[i] = 0;
        }

        drops[i]++;
      }
    };

    intervalId = setInterval(draw, 33);

    return () => {
        clearInterval(intervalId);
        resizeObserver.disconnect();
    };
  }, [mode]); 

  // --- MODE B: D3 TOPOLOGY (TOPO) ---
  useEffect(() => {
    if (mode !== 'TOPO' || !svgRef.current || !containerRef.current || agents.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("max-width", "100%")
      .style("height", "auto");

    svg.append("defs").append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 18) 
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#333");

    const nodes = [
      { id: 'ROOT', group: 0, status: OpCode.EXECUTING, role: 'ARCHITECT' },
      ...agents.map(a => ({ 
        id: a.pid.toString(), 
        group: 1, 
        status: a.status, 
        role: a.role,
        parentId: a.parentId
      }))
    ];

    const links = agents.map(a => ({ 
      source: a.parentId ? a.parentId.toString() : 'ROOT', 
      target: a.pid.toString() 
    }));

    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(60))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(20));

    const link = svg.append("g")
      .attr("stroke", "#333")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g");

    node.append("circle")
      .attr("r", (d) => d.group === 0 ? 10 : 6)
      .attr("fill", (d) => {
        if (d.group === 0) return "#fff";
        if (d.status === OpCode.ERROR) return "#ef4444";
        if (d.status === OpCode.TERMINAL) return "#6b7280";
        return "#22c55e";
      })
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5);

    node.append("text")
      .text(d => d.group === 0 ? "ROOT" : `${d.id}`)
      .attr("x", 12)
      .attr("y", 4)
      .attr("font-family", "monospace")
      .attr("font-size", "10px")
      .attr("fill", "#666");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [agents, objective, mode]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0a0a0a] relative overflow-hidden rounded-md border border-gray-800 flex flex-col group">
        {/* Floating Toggle Controls - Discreet */}
        <div className="absolute top-3 right-3 z-20 pointer-events-auto">
            <div className="flex bg-black/80 backdrop-blur-md rounded-lg p-0.5 border border-gray-800/50 shadow-sm opacity-60 hover:opacity-100 transition-opacity duration-200">
                <button 
                    onClick={() => setMode('TOPO')}
                    className={`p-1.5 px-2.5 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-all ${mode === 'TOPO' ? 'bg-gray-800 text-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                   <Network size={12} /> <span className="hidden sm:inline">TOPO</span>
                </button>
                <button 
                    onClick={() => setMode('RAW')}
                    className={`p-1.5 px-2.5 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-all ${mode === 'RAW' ? 'bg-green-900/20 text-green-400 border border-green-900/30 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                   <Code2 size={12} /> <span className="hidden sm:inline">RAW</span>
                </button>
            </div>
        </div>
        
        {/* Watermark Label */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none opacity-30 text-[10px] font-mono tracking-widest text-gray-600 select-none">
            VISUALIZATION_SUBSYSTEM
        </div>

      <div className="flex-1 relative w-full h-full">
         {mode === 'TOPO' && <svg ref={svgRef} className="w-full h-full absolute inset-0" />}
         {mode === 'RAW' && <canvas ref={canvasRef} className="w-full h-full absolute inset-0 opacity-80" />}
      </div>
    </div>
  );
};

export default NetworkGraph;