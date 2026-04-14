export interface Message {
  id: string;
  role: 'explainer' | 'challenger' | 'user';
  content: string;
  timestamp: number;
  score?: number; // Score given to the PREVIOUS message
  scoreReason?: string;
}

export interface DebateSession {
  topic: string;
  messages: Message[];
  status: 'idle' | 'running' | 'completed';
  currentTurn: number;
  totalExplainerScore: number;
  totalChallengerScore: number;
  explainerArchetype?: string;
  challengerArchetype?: string;
  maxTurns?: number;
  summary?: string;
  language?: string;
}
