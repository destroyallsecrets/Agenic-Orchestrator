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
        case OpCode.INITIALIZE: return <Terminal size={16} className="animate-pulse" />;
        case OpCode.EXECUTING: return <Cpu size={16} className="animate-spin-slow" />;
        case OpCode.ERROR: return <ShieldAlert size={16} />;
        case OpCode.TERMINAL: return <CheckCircle2 size={16} />;
    }
  };

  const statusStyle = getStatusColor(agent.status);

  return (
    <div className={`border p-4 rounded-sm font-mono text-sm flex flex-col gap-3 ${statusStyle} transition-all duration-300 min-h-[160px] shadow-sm`}>
      <div className="flex justify-between items-center border-b border-inherit pb-2">
        <div className="flex items-center gap-2 font-bold text-sm md:text-base">
           {getIcon(agent.status)}
           <span>PID:{agent.pid}</span>
        </div>
        <div className="text-xs uppercase opacity-80 font-semibold tracking-wider">
            {agent.tier}
        </div>
      </div>
      
      <div className="font-bold text-base md:text-lg truncate tracking-tight" title={agent.role}>
        {agent.role}
      </div>

      <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
        <div 
            className={`h-full ${agent.status === OpCode.TERMINAL ? 'bg-gray-500' : 'bg-green-500'} transition-all duration-500`} 
            style={{ width: `${agent.progress}%` }}
        />
      </div>

      <div className="flex-1 bg-black/40 p-3 rounded overflow-hidden flex flex-col justify-end min-h-[70px]">
        <div className="space-y-1.5">
            {agent.logs.slice(-3).map((log, i) => (
                <div key={i} className="opacity-90 text-xs break-words leading-tight font-mono text-gray-300">
                    <span className="text-gray-500 mr-2">{">"}</span>{log}
                </div>
            ))}
        </div>
      </div>

      <div className="text-xs flex justify-between items-center pt-1 opacity-70 font-medium text-gray-400">
        <span>MEM: {Math.floor(Math.random() * 128 + 64)}MB</span>
        <span>CPU: {agent.status === OpCode.TERMINAL ? 0 : Math.floor(Math.random() * 80 + 10)}%</span>
      </div>
    </div>
  );
};

export default AgentCard;