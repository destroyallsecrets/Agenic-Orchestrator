import React, { useEffect, useRef, useState } from 'react';
import { AgentPacket, OpCode } from '../types';
import { SYNC_BYTE_HIGH } from '../constants';
import { FileCode, FileText } from 'lucide-react';

interface BinaryMonitorProps {
  packets: AgentPacket[];
}

const BinaryMonitor: React.FC<BinaryMonitorProps> = ({ packets }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState<'HEX' | 'ASCII'>('HEX');

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [packets, autoScroll]);

  // Helper to format binary string
  const toBinaryString = (num: number, padding: number) => {
    return num.toString(2).padStart(padding, '0');
  };

  // Helper to convert ASCII to Hex string
  const toHexString = (str: string) => {
    return str.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ').toUpperCase();
  };

  return (
    <div className="flex flex-col h-full bg-black border-t-2 border-green-900 font-mono text-xs">
      <div className="flex justify-between items-center px-3 py-2 bg-green-900/20 border-b border-green-900/50">
        <span className="text-green-500 font-bold uppercase tracking-widest text-xs truncate mr-2">
          /tmp/agent_bus.sock [READ_ONLY]
        </span>
        <div className="flex items-center gap-4 shrink-0">
          <button 
            onClick={() => setViewMode(prev => prev === 'HEX' ? 'ASCII' : 'HEX')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-sm bg-green-900/30 text-xs text-green-400 hover:text-green-200 hover:bg-green-900/50 transition-all border border-green-900/50"
            title="Toggle Payload Encoding"
          >
             {viewMode === 'HEX' ? <FileCode size={12} /> : <FileText size={12} />}
             <span>{viewMode}</span>
          </button>
          
          <div className="hidden sm:flex gap-2 text-[10px]">
            <span className="flex items-center gap-1 text-red-500">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div> SYNC_HIGH
            </span>
            <span className="flex items-center gap-1 text-green-500">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div> SYNC_LOW
            </span>
          </div>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
        onScroll={(e) => {
          const target = e.currentTarget;
          const isBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 5;
          setAutoScroll(isBottom);
        }}
      >
        {packets.length === 0 && (
          <div className="text-gray-600 italic p-2">Waiting for bus traffic...</div>
        )}
        {packets.map((packet, idx) => {
          const isHigh = packet.syncByte === SYNC_BYTE_HIGH;
          const isError = packet.opCode === OpCode.ERROR;
          
          return (
            <div key={`${packet.timestamp}-${idx}`} className="flex gap-2 sm:gap-4 opacity-90 hover:opacity-100 transition-opacity text-xs py-0.5">
              <span className="text-gray-500 w-16 sm:w-24 shrink-0 hidden sm:block">
                {packet.timestamp.toFixed(4).slice(-8)}
              </span>
              <span className={`w-28 sm:w-32 shrink-0 ${isHigh || isError ? 'text-red-500 font-bold' : 'text-green-600'}`}>
                {toBinaryString(packet.syncByte, 8)} {toBinaryString(packet.agentId, 4)}
              </span>
              <span className="text-blue-400 w-12 sm:w-16 shrink-0 hidden xs:block">
                {toBinaryString(packet.opCode, 4)}
              </span>
              <span className="text-gray-300 break-all flex-1 font-medium">
                {viewMode === 'HEX' ? toHexString(packet.payload) : packet.payload} 
                <span className="text-gray-600 ml-2 text-[10px] select-none hidden sm:inline">CRC:{Math.floor(Math.random() * 255).toString(16).toUpperCase()}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BinaryMonitor;