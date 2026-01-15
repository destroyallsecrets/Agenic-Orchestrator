import { GoogleGenAI, Type } from "@google/genai";
import { MODEL_TIERS } from "../constants";

// Initialize the client. The API_KEY is injected by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const decomposeObjective = async (objective: string): Promise<Array<{ role: string; description: string; tier: 'FLASH' | 'PRO' }>> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TIERS.PRO, // Using Pro for complex reasoning/architecture
      contents: `Act as the Root Architect. Analyze the following high-level technical objective and decompose it into 3-5 specialized sub-agent roles required to execute it. 
      Objective: "${objective}"
      
      Requirements:
      1. Assign 'FLASH' tier to roles requiring high-speed I/O (e.g., DevOps, Scanning).
      2. Assign 'PRO' tier to roles requiring complex reasoning (e.g., Security Audit, Architecture).
      
      Return JSON only.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            agents: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING, description: "Title of the agent (e.g., Backend Architect)" },
                  description: { type: Type.STRING, description: "Short description of responsibility" },
                  tier: { type: Type.STRING, enum: ["FLASH", "PRO"] }
                },
                required: ["role", "description", "tier"]
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{"agents": []}');
    return result.agents;
  } catch (error) {
    console.error("Agent Decomposition Error:", error);
    // Fallback if API fails or key is missing
    return [
      { role: "System Fallback Agent", description: "Manual override active", tier: "FLASH" },
      { role: "Error Handler", description: "Monitoring system instability", tier: "FLASH" }
    ];
  }
};

export const proposeSubAgent = async (parentRole: string, currentContext: string): Promise<{ role: string; tier: 'FLASH' | 'PRO' }> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TIERS.FLASH,
      contents: `You are the Root Architect. A parent agent "${parentRole}" is requesting additional resources.
      Current Context: "${currentContext}"
      
      Define a SINGLE specific sub-agent role to delegate a specific task to.
      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            role: { type: Type.STRING },
            tier: { type: Type.STRING, enum: ["FLASH", "PRO"] }
          },
          required: ["role", "tier"]
        }
      }
    });
    
    return JSON.parse(response.text || '{"role": "Sub-Process Node", "tier": "FLASH"}');
  } catch (e) {
    return { role: "Auxiliary Process", tier: "FLASH" };
  }
};

export const generateAgentLog = async (role: string, context: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TIERS.FLASH, // Using Flash for high-frequency updates
      contents: `You are a ${role}. The current context is "${context}". Generate a single short log line (max 15 words) looking like a system terminal output. Do not include timestamps.`,
      config: {
        maxOutputTokens: 50,
        temperature: 0.7
      }
    });
    return response.text?.trim() || `[${role}] System active.`;
  } catch (error) {
    return `[${role}] Heartbeat signal.`;
  }
};