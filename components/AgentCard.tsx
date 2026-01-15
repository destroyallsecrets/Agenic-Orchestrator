import React from 'react';
import { Agent, OpCode } from '../types';
import { Terminal, ShieldAlert, Cpu, CheckCircle2 } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const getStatusColor = (status: OpCode) => {
    switch (status) {
      case OpCode.INITIALIZE: return 'text-yellow-500 border-yellow-900/30 bg-yellow-900/10';
      case OpCode.EXECUTING: return 'text-green-500 border-green-900/30 bg-green-900/10';
      case OpCode.ERROR: return 'text-red-500 border-red-900/30 bg-red-900/10';
      case OpCode.TERMINAL: return 'text-gray-500 border-gray-800 bg-gray-900/50';
      default: return 'text-gray-500';
    }
  };

  const getIcon = (status: OpCode) => {
    switch (status) {
        case OpCode.INITIALIZE: return <Terminal size={14} className="animate-pulse" />;
        case OpCode.EXECUTING: return <Cpu size={14} className="animate-spin-slow" />;
        case OpCode.ERROR: return <ShieldAlert size={14} />;
        case OpCode.TERMINAL: return <CheckCircle2 size={14} />;
    }
  };

  const statusStyle = getStatusColor(agent.status);

  return (
    <div className={`border p-3 rounded-sm font-mono text-xs flex flex-col gap-2 ${statusStyle} transition-all duration-300 min-h-[140px]`}>
      <div className="flex justify-between items-center border-b border-inherit pb-2">
        <div className="flex items-center gap-2 font-bold">
           {getIcon(agent.status)}
           <span>PID:{agent.pid}</span>
        </div>
        <div className="text-[10px] uppercase opacity-70">
            {agent.tier}
        </div>
      </div>
      
      <div className="font-semibold text-sm truncate" title={agent.role}>
        {agent.role}
      </div>

      <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
        <div 
            className={`h-full ${agent.status === OpCode.TERMINAL ? 'bg-gray-500' : 'bg-green-500'} transition-all duration-500`} 
            style={{ width: `${agent.progress}%` }}
        />
      </div>

      <div className="flex-1 bg-black/40 p-2 rounded overflow-hidden flex flex-col justify-end min-h-[60px]">
        <div className="space-y-1">
            {agent.logs.slice(-3).map((log, i) => (
                <div key={i} className="opacity-70 text-[10px] break-words leading-tight">
                    <span className="text-gray-500 mr-1">{">"}</span>{log}
                </div>
            ))}
        </div>
      </div>

      <div className="text-[10px] flex justify-between items-center pt-1 opacity-60">
        <span>MEM: {Math.floor(Math.random() * 128 + 64)}MB</span>
        <span>CPU: {agent.status === OpCode.TERMINAL ? 0 : Math.floor(Math.random() * 80 + 10)}%</span>
      </div>
    </div>
  );
};

export default AgentCard;