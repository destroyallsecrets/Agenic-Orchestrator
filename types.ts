export enum OpCode {
  INITIALIZE = 0x1, // 0001
  EXECUTING = 0x2,  // 0010
  ERROR = 0x4,      // 0100
  TERMINAL = 0x8    // 1000
}

export interface AgentPacket {
  syncByte: number;
  agentId: number;
  opCode: OpCode;
  payload: string; // Hex representation for visualization
  timestamp: number;
}

export interface Agent {
  pid: number;
  role: string;
  status: OpCode;
  tier: 'FLASH' | 'PRO';
  logs: string[];
  parentId: number | null;
}

export interface SystemState {
  objective: string;
  activeNodes: Agent[];
  busBuffer: AgentPacket[];
  isBootstrapping: boolean;
}

export const PACKET_HEADER_SIZE = 8; // 4 Sync + 4 AgentID
