import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Agent, AgentPacket, OpCode } from './types';
import { SYNC_BYTE_HIGH, SYNC_BYTE_LOW, MODEL_TIERS } from './constants';
import * as GeminiService from './services/geminiService';
import BinaryMonitor from './components/BinaryMonitor';
import NetworkGraph from './components/NetworkGraph';
import AgentCard from './components/AgentCard';
import { Play, Square, Activity, Cpu, Layers, Network, LayoutGrid, Terminal } from 'lucide-react';

const App: React.FC = () => {
  const [objective, setObjective] = useState<string>("Build a scalable e-commerce backend with microservices");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [packets, setPackets] = useState<AgentPacket[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [mobileTab, setMobileTab] = useState<'VISUAL' | 'AGENTS' | 'TERMINAL'>('AGENTS');
  
  // Refs for simulation intervals
  const simulationRef = useRef<number | null>(null);

  // --- Binary Bus Simulation ---
  const pushPacket = useCallback((pid: number, op: OpCode, payload: string) => {
    const isError = op === OpCode.ERROR;
    const sync = isError ? SYNC_BYTE_HIGH : SYNC_BYTE_LOW;
    
    const newPacket: AgentPacket = {
      syncByte: sync,
      agentId: pid,
      opCode: op,
      payload: payload,
      timestamp: Date.now() / 1000
    };

    setPackets(prev => [...prev.slice(-100), newPacket]); // Keep last 100 packets
  }, []);

  // --- Recursive Spawning Logic ---
  const spawnSubAgent = async (parentAgent: Agent) => {
    try {
        pushPacket(parentAgent.pid, OpCode.EXECUTING, "REQ_SUB_AGENT_PROVISION");
        
        const subAgentDef = await GeminiService.proposeSubAgent(parentAgent.role, "High load detected in subsystem");
        
        // Generate a new PID
        const newPid = Math.floor(Math.random() * 8000) + 2000;
        
        // Simulate CLI Command Execution described in spec
        const spawnCommand = `gemini --agent --model "${subAgentDef.tier === 'PRO' ? MODEL_TIERS.PRO : MODEL_TIERS.FLASH}" --prompt "Init ${subAgentDef.role}"`;
        pushPacket(0, OpCode.EXECUTING, `EXEC: ${spawnCommand.substring(0, 30)}...`);

        const newAgent: Agent = {
            pid: newPid,
            role: subAgentDef.role,
            status: OpCode.INITIALIZE,
            tier: subAgentDef.tier,
            logs: [`Forked from PID:${parentAgent.pid}`, `> ${spawnCommand}`],
            parentId: parentAgent.pid,
            progress: 0
        };

        setAgents(prev => [...prev, newAgent]);
        pushPacket(0, OpCode.INITIALIZE, `FORK_SUCCESS_PID_${newPid}`);
        pushPacket(newPid, OpCode.INITIALIZE, "CHILD_PROCESS_INIT");

    } catch (e) {
        pushPacket(parentAgent.pid, OpCode.ERROR, "FORK_FAILED");
    }
  };

  // --- Core Lifecycle Logic ---
  const handleBootstrap = async () => {
    if (!objective.trim()) return;
    
    setIsRunning(true);
    setIsProvisioning(true);
    setAgents([]);
    setPackets([]);
    
    // 1. Root Architect Init Packet
    pushPacket(0, OpCode.INITIALIZE, "BOOTSTRAP_SEQUENCE_INIT");
    // Simulate initializing Global State Registry state.json
    pushPacket(0, OpCode.EXECUTING, `INIT_STATE_REGISTRY {"goal": "${objective.substring(0, 10)}..."}`);

    try {
      // 2. Call Gemini for Decomposition
      const proposedAgents = await GeminiService.decomposeObjective(objective);
      
      const newAgents: Agent[] = proposedAgents.map((pa, idx) => ({
        pid: 1000 + idx + 1,
        role: pa.role,
        status: OpCode.INITIALIZE,
        tier: pa.tier,
        logs: [`Spawned by Root Architect`, `> gemini --agent --model "${pa.tier}"`],
        parentId: 0,
        progress: 0
      }));

      // Staggered Spawning
      for (const agent of newAgents) {
        await new Promise(r => setTimeout(r, 600)); // Visual delay
        setAgents(prev => [...prev, agent]);
        pushPacket(agent.pid, OpCode.INITIALIZE, `SPAWN_ROLE_${agent.role.replace(/\s/g, '_').toUpperCase()}`);
      }
      
    } catch (e) {
      pushPacket(0, OpCode.ERROR, "ARCHITECT_FAILURE");
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    if (simulationRef.current) clearInterval(simulationRef.current);
    
    // Send Kill Signals
    agents.forEach(a => {
        if (a.status !== OpCode.TERMINAL) {
            pushPacket(a.pid, OpCode.TERMINAL, "SIGKILL_RECEIVED");
        }
    });
    
    setAgents(prev => prev.map(a => ({ ...a, status: OpCode.TERMINAL })));
  };

  // --- Simulation Loop ---
  useEffect(() => {
    if (isRunning && !isProvisioning) {
      simulationRef.current = window.setInterval(async () => {
        let agentToSpawn: Agent | null = null;

        setAgents(currentAgents => {
          return currentAgents.map(agent => {
            if (agent.status === OpCode.TERMINAL || agent.status === OpCode.ERROR) return agent;

            const roll = Math.random();
            let newStatus = agent.status;
            let newLog = "";
            let newProgress = agent.progress;

            if (agent.status === OpCode.INITIALIZE && roll > 0.7) {
              newStatus = OpCode.EXECUTING;
              newLog = "Initialization complete. Entering loop.";
              pushPacket(agent.pid, OpCode.EXECUTING, "STATE_TRANSITION_EXEC");
            } else if (agent.status === OpCode.EXECUTING) {
                // Normal Execution
                if (roll > 0.8) {
                    pushPacket(agent.pid, OpCode.EXECUTING, Math.random().toString(16).substring(2, 10));
                }
                
                const progressIncrement = Math.random() * 2.5; 
                newProgress = Math.min(agent.progress + progressIncrement, 100);

                if (newProgress >= 100) {
                   newStatus = OpCode.TERMINAL;
                   newLog = "Definition of Done reached. exit 0";
                   pushPacket(agent.pid, OpCode.TERMINAL, "TASK_COMPLETE_EXIT_0");
                   pushPacket(0, OpCode.EXECUTING, `UPDATE_STATE_JSON {"done": ${agent.pid}}`);
                } else {
                   if (agent.tier === 'PRO' && roll > 0.99 && currentAgents.length < 12) {
                       agentToSpawn = agent; 
                   }
                }
            } 
            
            if (roll < 0.005 && newStatus !== OpCode.TERMINAL) {
                newStatus = OpCode.ERROR;
                newLog = "CRITICAL: Stack overflow exception.";
                pushPacket(agent.pid, OpCode.ERROR, "EXCEPTION_THROWN");
            }

            if (newLog) {
              return { ...agent, status: newStatus, progress: newProgress, logs: [...agent.logs, newLog] };
            }
            return { ...agent, status: newStatus, progress: newProgress };
          });
        });

        if (agentToSpawn) {
            // @ts-ignore
            await spawnSubAgent(agentToSpawn); 
        }

      }, 1000);
    }

    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current);
    };
  }, [isRunning, isProvisioning, pushPacket]);


  // --- Gemini Log Enrichment Effect ---
  useEffect(() => {
    if (!isRunning) return;
    const logInterval = window.setInterval(async () => {
        const activeAgents = agents.filter(a => a.status === OpCode.EXECUTING);
        if (activeAgents.length === 0) return;

        const randomAgent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
        try {
            const log = await GeminiService.generateAgentLog(randomAgent.role, "Analyzing dependency graph");
            setAgents(prev => prev.map(a => a.pid === randomAgent.pid ? { ...a, logs: [...a.logs, log] } : a));
            pushPacket(randomAgent.pid, OpCode.EXECUTING, `LOG_STREAM_${log.length}B`);
        } catch(e) { /* silent */ }
    }, 4000);
    return () => clearInterval(logInterval);
  }, [isRunning, agents]);

  // Helper Component for Resource Stats
  const ResourcePanel = ({ compact = false }: { compact?: boolean }) => {
    if (compact) {
        return (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-mono text-gray-400">
                {/* Col 1: Root */}
                <div className="flex flex-col justify-center gap-1">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">ROOT</span>
                        <span className="text-blue-400 bg-blue-900/10 px-1 rounded-sm text-[9px]">{MODEL_TIERS.PRO.split('-')[2].toUpperCase()}</span> 
                    </div>
                    <div className="w-full bg-gray-800 h-1 rounded overflow-hidden">
                        <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: isRunning ? '65%' : '5%' }}></div>
                    </div>
                </div>

                {/* Col 2: Agents */}
                <div className="flex flex-col justify-center gap-1">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">POOL</span>
                        <span className="text-yellow-400 bg-yellow-900/10 px-1 rounded-sm text-[9px]">{MODEL_TIERS.FLASH.split('-')[2].toUpperCase()}</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1 rounded overflow-hidden">
                        <div className="bg-yellow-600 h-full transition-all duration-300" style={{ width: `${Math.min((agents.length / 12) * 100, 100)}%` }}></div>
                    </div>
                </div>
                
                {/* Full Width Stats - Simplified */}
                <div className="col-span-2 flex justify-between items-center border-t border-gray-800/50 pt-1.5 mt-0.5">
                    <div className="flex gap-2">
                         <span>PID_COUNT: <span className="text-white font-bold">{agents.length}</span></span>
                    </div>
                    <div className="flex gap-1 items-center">
                        <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
                        <span>{isRunning ? 'RUNNING' : 'STOPPED'}</span>
                    </div>
                </div>
            </div>
        );
    }

    // Default / Desktop View
    return (
        <div className="space-y-3 text-xs font-mono text-gray-400">
            <div className="flex justify-between items-center">
                <span>ROOT_ARCHITECT</span>
                <span className="text-blue-400 bg-blue-900/20 px-1 rounded">{MODEL_TIERS.PRO}</span>
            </div>
            <div className="w-full bg-gray-800 h-2 rounded overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: isRunning ? '65%' : '5%' }}></div>
            </div>
            
            <div className="flex justify-between items-center mt-2">
                <span>SUB_AGENTS_POOL</span>
                <span className="text-yellow-400 bg-yellow-900/20 px-1 rounded">{MODEL_TIERS.FLASH}</span>
            </div>
                <div className="w-full bg-gray-800 h-2 rounded overflow-hidden">
                <div className="bg-yellow-600 h-full transition-all duration-300" style={{ width: `${(agents.length / 12) * 100}%` }}></div>
            </div>

            <div className="flex justify-between mt-4 border-t border-gray-800 pt-3">
                <span>ACTIVE PIDs</span>
                <span className="text-white font-bold text-sm">{agents.length}</span>
            </div>
        </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#050505] text-[#e5e5e5] overflow-hidden font-sans">
      
      {/* RESPONSIVE HEADER */}
      <header className="border-b border-gray-800 bg-[#0a0a0a] p-4 flex flex-col md:flex-row md:h-16 md:items-center justify-between gap-4 shrink-0 z-10 shadow-md">
        <div className="flex justify-between items-center w-full md:w-auto">
            <div className="flex items-center gap-3">
                <Activity className="text-green-500 w-6 h-6" />
                <h1 className="font-bold tracking-widest text-lg md:text-xl">
                    AGENTIC<span className="text-gray-600">ORCHESTRATOR</span>
                </h1>
            </div>
            {/* Mobile Status Indicator */}
            <div className="md:hidden text-xs text-gray-500 font-mono border border-gray-800 px-2 py-1 rounded">
                {isRunning ? (isProvisioning ? "PROV..." : "ACTIVE") : "IDLE"}
            </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:flex-1 md:max-w-3xl md:mx-12">
           <div className="relative flex-1 group">
             <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <span className="text-green-600 font-bold text-lg">{">"}</span>
             </div>
             <input 
                type="text" 
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                disabled={isRunning}
                className="w-full bg-black border border-gray-700 rounded-sm py-3 pl-8 pr-4 text-base focus:outline-none focus:border-green-600 transition-colors disabled:opacity-50 font-mono shadow-inner"
                placeholder="DEFINE OBJECTIVE..."
             />
           </div>
           
           {!isRunning ? (
             <button 
                onClick={handleBootstrap}
                className="bg-green-700 hover:bg-green-600 text-white px-6 py-3 text-sm font-bold rounded-sm flex items-center justify-center gap-2 transition-colors uppercase whitespace-nowrap shadow-lg active:scale-95"
             >
                <Play size={18} fill="currentColor" /> <span>Bootstrap</span>
             </button>
           ) : (
             <button 
                onClick={handleStop}
                className="bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 px-6 py-3 text-sm font-bold rounded-sm flex items-center justify-center gap-2 transition-colors uppercase whitespace-nowrap shadow-lg active:scale-95"
             >
                <Square size={18} fill="currentColor" /> <span>SigKill</span>
             </button>
           )}
        </div>

        <div className="hidden md:flex text-xs text-gray-500 font-mono flex-col items-end">
          <div>ROOT_PID: 0000</div>
          <div>STATUS: {isRunning ? (isProvisioning ? "PROVISIONING" : "ACTIVE") : "IDLE"}</div>
        </div>
      </header>

      {/* --- DESKTOP LAYOUT (Hidden on mobile) --- */}
      <div className="hidden md:flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 flex overflow-hidden">
            {/* LEFT PANEL */}
            <div className="w-1/3 border-r border-gray-800 flex flex-col">
              <div className="flex-1 relative">
                 <NetworkGraph agents={agents} objective={objective} packets={packets} />
              </div>
              <div className="h-1/3 border-t border-gray-800 p-6 bg-[#080808]">
                 <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase flex items-center gap-2">
                    <Cpu size={16}/> Control Plane Resources
                 </h3>
                 <ResourcePanel />
              </div>
            </div>

            {/* RIGHT PANEL: AGENT GRID */}
            <div className="flex-1 bg-[#050505] p-6 overflow-y-auto">
              {agents.length === 0 && !isProvisioning && (
                 <div className="h-full flex flex-col items-center justify-center text-gray-700 gap-4">
                    <div className="w-16 h-16 border-2 border-dashed border-gray-800 rounded-full flex items-center justify-center">
                        <Layers />
                    </div>
                    <p className="font-mono text-sm">System Idle. Awaiting Objective.</p>
                 </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {agents.map(agent => (
                    <AgentCard key={agent.pid} agent={agent} />
                ))}
                {isProvisioning && (
                    <div className="border border-gray-800 border-dashed p-4 rounded-sm flex items-center justify-center text-gray-600 animate-pulse text-xs font-mono">
                        [PROVISIONING_NODE...]
                    </div>
                )}
              </div>
            </div>
          </main>

          {/* BOTTOM PANEL: BINARY MONITOR */}
          <footer className="h-48 shrink-0">
             <BinaryMonitor packets={packets} />
          </footer>
      </div>

      {/* --- MOBILE LAYOUT (Visible on Mobile) --- */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-hidden relative bg-[#050505]">
            
            {/* TAB 1: VISUALS */}
            {mobileTab === 'VISUAL' && (
                <div className="h-full flex flex-col">
                    <div className="flex-1 relative border-b border-gray-800 min-h-0">
                        <NetworkGraph agents={agents} objective={objective} packets={packets} />
                    </div>
                    <div className="shrink-0 p-3 bg-[#080808] border-t border-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.5)] z-10">
                        {/* Compact Resource Panel */}
                         <ResourcePanel compact={true} />
                    </div>
                </div>
            )}
            
            {/* TAB 2: AGENTS */}
            {mobileTab === 'AGENTS' && (
                <div className="h-full overflow-y-auto p-4">
                     {agents.length === 0 && !isProvisioning ? (
                         <div className="h-full flex flex-col items-center justify-center text-gray-800 gap-2">
                            <Layers className="opacity-50" size={32} />
                            <p className="font-mono text-sm">No active agents</p>
                         </div>
                     ) : (
                         <div className="space-y-4 pb-4">
                            {agents.map(agent => (
                                <AgentCard key={agent.pid} agent={agent} />
                            ))}
                            {isProvisioning && (
                                <div className="border border-gray-800 border-dashed p-6 rounded-sm text-center text-gray-500 animate-pulse text-sm font-mono">
                                    [PROVISIONING...]
                                </div>
                            )}
                         </div>
                     )}
                </div>
            )}

            {/* TAB 3: TERMINAL */}
            {mobileTab === 'TERMINAL' && (
                <div className="h-full flex flex-col">
                    <BinaryMonitor packets={packets} />
                </div>
            )}
        </div>

        {/* BOTTOM NAV BAR */}
        <nav className="h-20 bg-[#0a0a0a] border-t border-gray-800 flex items-center justify-around shrink-0 pb-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] z-20">
             <button 
                onClick={() => setMobileTab('VISUAL')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${mobileTab === 'VISUAL' ? 'text-green-500 bg-green-900/10' : 'text-gray-500 hover:text-gray-300'}`}
             >
                <Network size={24} />
                <span className="text-xs font-bold tracking-wider">NEURAL</span>
             </button>

             <button 
                onClick={() => setMobileTab('AGENTS')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${mobileTab === 'AGENTS' ? 'text-green-500 bg-green-900/10' : 'text-gray-500 hover:text-gray-300'}`}
             >
                <LayoutGrid size={24} />
                <span className="text-xs font-bold tracking-wider">GRID</span>
             </button>

             <button 
                onClick={() => setMobileTab('TERMINAL')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${mobileTab === 'TERMINAL' ? 'text-green-500 bg-green-900/10' : 'text-gray-500 hover:text-gray-300'}`}
             >
                <Terminal size={24} />
                <span className="text-xs font-bold tracking-wider">TERM</span>
             </button>
        </nav>
      </div>

    </div>
  );
};

export default App;