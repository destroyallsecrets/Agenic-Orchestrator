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
  
  // Use a ref for packets to access the latest data in the animation loop 
  // without re-triggering the useEffect hook and resetting the canvas state.
  const packetsRef = useRef(packets);
  useEffect(() => {
    packetsRef.current = packets;
  }, [packets]);

  // --- MODE A: MATRIX RAIN (RAW) ---
  useEffect(() => {
    if (mode !== 'RAW' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize
    canvas.width = canvas.parentElement?.clientWidth || 300;
    canvas.height = canvas.parentElement?.clientHeight || 300;

    const fontSize = 14;
    const columns = Math.ceil(canvas.width / fontSize);
    const drops: number[] = new Array(columns).fill(1);
    
    // Initialize drops with random starting positions to avoid "wall of text" effect on load
    for (let i = 0; i < columns; i++) {
        drops[i] = Math.floor(Math.random() * -100);
    }

    const draw = () => {
      // Semi-transparent black for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0F0'; // Matrix Green
      ctx.font = `${fontSize}px monospace`;
      
      // Construct binary pool from latest packets to reflect real-time activity
      const currentPackets = packetsRef.current;
      const isIdle = currentPackets.length === 0;
      let binaryPool = "";
      
      if (!isIdle) {
          // Take the last 10 packets to generate the stream data
          const slice = currentPackets.slice(-10).reverse();
          slice.forEach(p => {
             // Convert metadata to binary
             const idBin = p.agentId.toString(2);
             const opBin = p.opCode.toString(2);
             // Simple payload hashing to binary
             let payloadBin = "";
             for(let c = 0; c < Math.min(p.payload.length, 5); c++) {
                 payloadBin += p.payload.charCodeAt(c).toString(2);
             }
             binaryPool += idBin + opBin + payloadBin;
          });
      } else {
          // Idle state binary - minimized to reduce visual noise
          binaryPool = "0"; 
      }

      for (let i = 0; i < drops.length; i++) {
        // Deterministically pick a bit from the pool based on column and current drop height
        // This ensures the "rain" looks like the data flowing down
        const charIndex = (i * 13 + Math.abs(Math.floor(drops[i]))) % binaryPool.length;
        const text = binaryPool[charIndex] === '0' ? '0' : '1';
        
        // Randomly highlight some chars brighter
        // If system is idle (packets empty), reduce brightness frequency significantly
        const highlightChance = isIdle ? 0.9995 : 0.95;
        ctx.fillStyle = Math.random() > highlightChance ? '#CFFFDC' : '#00FF41';
        
        // Only draw if drop is on screen
        if (drops[i] * fontSize > 0) {
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        }

        // Reset drop to top randomly
        // Significantly reduce rain density when idle (0.05% respawn vs 2.5%)
        const respawnThreshold = isIdle ? 0.9995 : 0.975;

        if (drops[i] * fontSize > canvas.height && Math.random() > respawnThreshold) {
          drops[i] = 0;
        }

        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);
    return () => clearInterval(interval);

  }, [mode]); // Only re-init when switching modes, not when packets change

  // --- MODE B: D3 TOPOLOGY (TOPO) ---
  useEffect(() => {
    if (mode !== 'TOPO' || !svgRef.current || agents.length === 0) return;

    const width = svgRef.current.parentElement?.clientWidth || 300;
    const height = svgRef.current.parentElement?.clientHeight || 300;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("max-width", "100%")
      .style("height", "auto");

    // Define Arrowhead Marker
    svg.append("defs").append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 18) // Adjusted for node radius (6 + padding)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#333");

    // Nodes: Root + Agents
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

    // Links: Parent -> Child
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
      .attr("marker-end", "url(#arrow)"); // Attach marker

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g");

    // Node Circles
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

    // Labels
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
    <div className="w-full h-full bg-[#0a0a0a] relative overflow-hidden rounded-md border border-gray-800 flex flex-col">
        {/* Header / Toggle */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-2 bg-black/40 backdrop-blur-sm pointer-events-none">
            <span className="text-[10px] text-gray-500 font-bold tracking-widest pl-2">
                VISUALIZATION SUBSYSTEM
            </span>
            <div className="flex bg-[#111] rounded-sm p-0.5 pointer-events-auto">
                <button 
                    onClick={() => setMode('TOPO')}
                    className={`p-1 px-2 rounded-sm text-[10px] font-bold flex items-center gap-1 transition-colors ${mode === 'TOPO' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                   <Network size={10} /> TOPO
                </button>
                <button 
                    onClick={() => setMode('RAW')}
                    className={`p-1 px-2 rounded-sm text-[10px] font-bold flex items-center gap-1 transition-colors ${mode === 'RAW' ? 'bg-green-900/30 text-green-400 shadow-sm border border-green-900/50' : 'text-gray-500 hover:text-gray-300'}`}
                >
                   <Code2 size={10} /> RAW
                </button>
            </div>
        </div>

      <div className="flex-1 relative w-full h-full">
         {mode === 'TOPO' && <svg ref={svgRef} className="w-full h-full absolute inset-0" />}
         {mode === 'RAW' && <canvas ref={canvasRef} className="w-full h-full absolute inset-0 opacity-80" />}
      </div>
    </div>
  );
};

export default NetworkGraph;