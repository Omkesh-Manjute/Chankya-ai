import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Sparkles, 
  ShieldAlert, 
  RefreshCcw, 
  BrainCircuit, 
  ChevronRight,
  Loader2,
  History,
  Trash2,
  Pause,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
  Mic2,
  MicOff,
  Quote,
  Twitter,
  Github,
  Linkedin,
  Instagram,
  Home,
  ExternalLink,
  X,
  FileText,
  Trophy
} from 'lucide-react';
import ai, { geminiModel, ttsModel, Modality, Type } from './lib/gemini';
import { Message, DebateSession } from './types';
import Markdown from 'react-markdown';

const MAX_TURNS = 6;

const EXPLAINER_ARCHETYPES = [
  { id: 'teacher', name: 'Patient Teacher', description: 'Simple, clear, and encouraging.' },
  { id: 'philosopher', name: 'Calm Philosopher', description: 'Deep, reflective, and balanced.' },
  { id: 'expert', name: 'Enthusiastic Expert', description: 'Fast-paced, technical, and passionate.' }
];

const CHALLENGER_ARCHETYPES = [
  { id: 'critic', name: 'Sarcastic Critic', description: 'Witty, sharp, and slightly mocking.' },
  { id: 'debater', name: 'Aggressive Debater', description: 'Forceful, direct, and relentless.' },
  { id: 'skeptic', name: 'Logical Skeptic', description: 'Evidence-based, cold, and precise.' }
];

const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'hi', name: 'Hindi' },
  { id: 'mr', name: 'Marathi' },
  { id: 'gu', name: 'Gujarati' }
];

export default function App() {
  const [topic, setTopic] = useState('');
  const [explainerArchetype, setExplainerArchetype] = useState(EXPLAINER_ARCHETYPES[0].id);
  const [challengerArchetype, setChallengerArchetype] = useState(CHALLENGER_ARCHETYPES[0].id);
  const [language, setLanguage] = useState(LANGUAGES[0].id);
  const [maxTurns, setMaxTurns] = useState(MAX_TURNS);
  const [session, setSession] = useState<DebateSession>({
    topic: '',
    messages: [],
    status: 'idle',
    currentTurn: 0,
    totalExplainerScore: 0,
    totalChallengerScore: 0,
  });
  const [history, setHistory] = useState<DebateSession[]>([]);
  const [activeSessionToResume, setActiveSessionToResume] = useState<DebateSession | null>(null);
  const [isTyping, setIsTyping] = useState<'explainer' | 'challenger' | null>(null);
  const [speakingAgent, setSpeakingAgent] = useState<'explainer' | 'challenger' | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isVoiceControlActive, setIsVoiceControlActive] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [lastVoiceCommand, setLastVoiceCommand] = useState<string | null>(null);
  const [isProcessingVoiceCommand, setIsProcessingVoiceCommand] = useState(false);
  const [voiceCommandSuccess, setVoiceCommandSuccess] = useState(false);
  const [activeVoiceAction, setActiveVoiceAction] = useState<string | null>(null);
  const [pendingInstruction, setPendingInstruction] = useState<string | null>(null);
  const skipTurnRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const explainerScrollRef = useRef<HTMLDivElement>(null);
  const challengerScrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Load history and active session from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('chanakya_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const savedActive = localStorage.getItem('chanakya_active_session');
    if (savedActive) {
      try {
        const parsed = JSON.parse(savedActive);
        if (parsed.status === 'running') {
          setActiveSessionToResume(parsed);
        }
      } catch (e) {
        console.error("Failed to parse active session", e);
      }
    }
  }, []);

  // Save history and active session to localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('chanakya_history', JSON.stringify(history));
    }
  }, [history]);

  useEffect(() => {
    if (session.status === 'running') {
      localStorage.setItem('chanakya_active_session', JSON.stringify(session));
    } else if (session.status === 'completed' || session.status === 'idle') {
      localStorage.removeItem('chanakya_active_session');
    }
  }, [session]);

  useEffect(() => {
    if (explainerScrollRef.current) {
      explainerScrollRef.current.scrollTop = explainerScrollRef.current.scrollHeight;
    }
    if (challengerScrollRef.current) {
      challengerScrollRef.current.scrollTop = challengerScrollRef.current.scrollHeight;
    }
  }, [session.messages, isTyping]);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playPCM = (base64Data: string, role: 'explainer' | 'challenger') => {
    return new Promise<void>((resolve) => {
      try {
        initAudioContext();
        const audioCtx = audioContextRef.current!;
        
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const pcmData = new Int16Array(bytes.buffer);
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 32768;
        }

        const buffer = audioCtx.createBuffer(1, floatData.length, 24000);
        buffer.getChannelData(0).set(floatData);
        
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        
        currentAudioSourceRef.current = source;
        setSpeakingAgent(role);
        
        source.onended = () => {
          setSpeakingAgent(null);
          currentAudioSourceRef.current = null;
          resolve();
        };
        
        source.start();
      } catch (error) {
        console.error("Audio Playback Error:", error);
        setSpeakingAgent(null);
        currentAudioSourceRef.current = null;
        resolve();
      }
    });
  };

  const speak = async (text: string, role: 'explainer' | 'challenger') => {
    if (!isVoiceEnabled) return;

    try {
      const languageName = LANGUAGES.find(l => l.id === session.language)?.name || 'English';
      const voiceName = role === 'explainer' ? 'Kore' : 'Zephyr';
      const response = await ai.models.generateContent({
        model: ttsModel,
        contents: [{ parts: [{ text: `Say this clearly in ${languageName} as a ${role}: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        await playPCM(base64Audio, role);
      }
    } catch (error) {
      console.error("TTS Error:", error);
    }
  };

  const startDebate = async () => {
    if (!topic.trim()) return;
    initAudioContext();

    const newSession: DebateSession = {
      topic: topic,
      messages: [{
        id: Date.now().toString(),
        role: 'user',
        content: topic,
        timestamp: Date.now()
      }],
      status: 'running',
      currentTurn: 0,
      totalExplainerScore: 0,
      totalChallengerScore: 0,
      explainerArchetype,
      challengerArchetype,
      maxTurns,
      language,
    };

    setSession(newSession);
    setTopic('');
    await runDebateLoop(newSession);
  };

  const waitIfPaused = async () => {
    while (isPaused) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const runDebateLoop = async (currentSession: DebateSession) => {
    let activeSession = { ...currentSession };
    const startTurn = Math.floor(activeSession.currentTurn / 2);
    const sessionMaxTurns = currentSession.maxTurns || MAX_TURNS;

    for (let turn = startTurn; turn < sessionMaxTurns; turn++) {
      // Explainer Turn
      if (activeSession.currentTurn % 2 === 0) {
        await waitIfPaused();
        if (skipTurnRef.current) { skipTurnRef.current = false; }

        setIsTyping('explainer');
        const explainerData = await getAIResponse('explainer', activeSession);
        const explainerMsg: Message = {
          id: `explainer-${Date.now()}`,
          role: 'explainer',
          content: explainerData.content,
          timestamp: Date.now(),
          score: explainerData.score,
          scoreReason: explainerData.scoreReason
        };
        activeSession = {
          ...activeSession,
          messages: [...activeSession.messages, explainerMsg],
          currentTurn: activeSession.currentTurn + 1,
          totalChallengerScore: activeSession.totalChallengerScore + (explainerData.score || 0)
        };
        setSession(activeSession);
        setIsTyping(null);
        
        if (!skipTurnRef.current) {
          await speak(explainerData.content, 'explainer');
        }
        skipTurnRef.current = false;
      }

      if (turn === sessionMaxTurns - 1 && activeSession.currentTurn % 2 === 0) break;

      // Challenger Turn
      if (activeSession.currentTurn % 2 !== 0) {
        await waitIfPaused();
        setIsTyping('challenger');
        const challengerData = await getAIResponse('challenger', activeSession);
        const challengerMsg: Message = {
          id: `challenger-${Date.now()}`,
          role: 'challenger',
          content: challengerData.content,
          timestamp: Date.now(),
          score: challengerData.score,
          scoreReason: challengerData.scoreReason
        };
        activeSession = {
          ...activeSession,
          messages: [...activeSession.messages, challengerMsg],
          currentTurn: activeSession.currentTurn + 1,
          totalExplainerScore: activeSession.totalExplainerScore + (challengerData.score || 0)
        };
        setSession(activeSession);
        setIsTyping(null);
        
        if (!skipTurnRef.current) {
          await speak(challengerData.content, 'challenger');
        }
        skipTurnRef.current = false;
      }
    }

    const finalSession = { ...activeSession, status: 'completed' as const };
    setSession(finalSession);
    setHistory(prev => [finalSession, ...prev].slice(0, 10));
    
    // Generate summary after a short delay to let the UI settle
    setTimeout(() => {
      generateDebateSummary(finalSession);
    }, 1000);
  };

  const generateDebateSummary = async (finalSession: DebateSession) => {
    setIsGeneratingSummary(true);
    setShowSummary(true);
    
    const languageName = LANGUAGES.find(l => l.id === finalSession.language)?.name || 'English';
    const historyText = finalSession.messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const prompt = `Topic: ${finalSession.topic}\n\nDebate History:\n${historyText}\n\nProvide a concise summary of the key arguments from both the Explainer and the Challenger. Then, state the overall outcome of the debate (who performed better or if it was a draw). Keep the summary professional, insightful, and formatted with clear sections for "Key Arguments" and "Overall Outcome". Use bullet points for arguments. The summary MUST be in ${languageName}.`;

    try {
      const result = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config: {
          systemInstruction: `You are a professional debate judge and summarizer. Provide a structured, concise summary of the debate in ${languageName}.`,
          temperature: 0.5,
        }
      });

      const summary = result.text || "";
      const sessionWithSummary = { ...finalSession, summary };
      setSession(sessionWithSummary);
      
      // Update history with summary
      setHistory(prev => prev.map(s => 
        s.topic === finalSession.topic && s.messages.length === finalSession.messages.length 
          ? sessionWithSummary 
          : s
      ));
      
      // Persist to local storage
      const updatedHistory = JSON.parse(localStorage.getItem('chanakya_history') || '[]');
      const newHistory = updatedHistory.map((s: DebateSession) => 
        s.topic === finalSession.topic && s.messages.length === finalSession.messages.length 
          ? sessionWithSummary 
          : s
      );
      localStorage.setItem('chanakya_history', JSON.stringify(newHistory));

    } catch (error) {
      console.error("Error generating summary:", error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const getAIResponse = async (role: 'explainer' | 'challenger', currentSession: DebateSession) => {
    const opponent = role === 'explainer' ? 'Challenger' : 'Explainer';
    const archetypeId = role === 'explainer' ? currentSession.explainerArchetype : currentSession.challengerArchetype;
    const archetype = (role === 'explainer' ? EXPLAINER_ARCHETYPES : CHALLENGER_ARCHETYPES).find(a => a.id === archetypeId);
    const languageName = LANGUAGES.find(l => l.id === currentSession.language)?.name || 'English';

    let systemPrompt = role === 'explainer' 
      ? `You are a helpful AI teacher. Explain the topic in a simple, beginner-friendly way. Keep it concise, fast-paced, and strictly in ${languageName}. If you are responding to a challenger, address their points and improve your explanation. 
         Additionally, you must evaluate the previous message from the ${opponent} and assign a score from 1 to 10 based on clarity, depth, and relevance.`
      : `You are a critical thinker and challenger. Ask insightful questions about the previous explanation. Point out potential gaps, edge cases, or complexities. Challenge the explainer to be more precise. Keep it concise, fast-paced, and strictly in ${languageName}.
         Additionally, you must evaluate the previous message from the ${opponent} and assign a score from 1 to 10 based on clarity, depth, and relevance.`;

    if (archetype) {
      systemPrompt += `\n\nYour specific personality archetype is: "${archetype.name}". ${archetype.description} Ensure your tone and argumentation style strictly follow this archetype.`;
    }

    if (pendingInstruction) {
      systemPrompt += `\n\nCRITICAL INSTRUCTION: ${pendingInstruction}`;
      setPendingInstruction(null); // Clear after use
    }

    const historyText = currentSession.messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    try {
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: `Topic: ${currentSession.topic}\n\nConversation History:\n${historyText}\n\nNow, as the ${role}, provide your next response.`,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING, description: "Your response message" },
              score: { type: Type.INTEGER, description: `Score for the previous ${opponent} message (1-10). If no previous ${opponent} message exists, use 0.` },
              scoreReason: { type: Type.STRING, description: "Brief reason for the score" }
            },
            required: ["content", "score", "scoreReason"]
          }
        }
      });
      
      const result = JSON.parse(response.text || "{}");
      return {
        content: result.content || "I'm sorry, I couldn't generate a response.",
        score: result.score || 0,
        scoreReason: result.scoreReason || ""
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      return {
        content: "An error occurred while connecting to the AI engine.",
        score: 0,
        scoreReason: ""
      };
    }
  };

  const togglePause = () => {
    if (!audioContextRef.current) return;
    if (isPaused) {
      audioContextRef.current.resume();
      setIsPaused(false);
    } else {
      audioContextRef.current.suspend();
      setIsPaused(true);
    }
  };

  const skipTurn = () => {
    skipTurnRef.current = true;
    if (currentAudioSourceRef.current) {
      currentAudioSourceRef.current.stop();
    }
  };

  const stopDebate = () => {
    if (currentAudioSourceRef.current) {
      currentAudioSourceRef.current.stop();
    }
    setIsPaused(false);
    setSession(prev => ({ ...prev, status: 'idle' }));
  };

  // Voice Command Logic
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isVoiceControlActive && session.status === 'running') {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      
      const langMap: Record<string, string> = {
        'en': 'en-US',
        'hi': 'hi-IN',
        'mr': 'mr-IN',
        'gu': 'gu-IN'
      };
      recognition.lang = langMap[session.language || 'en'] || 'en-US';

      recognition.onresult = (event: any) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase();
        console.log("Voice Command Detected:", command);
        setLastVoiceCommand(command);
        setIsProcessingVoiceCommand(true);
        setVoiceCommandSuccess(false);

        setTimeout(() => {
          let actionTriggered = null;
          const isPause = command.includes('pause') || command.includes('ruko') || command.includes('thamb') || command.includes('thobho') || command.includes('viraam');
          const isResume = command.includes('resume') || command.includes('play') || command.includes('continue') || command.includes('shuru') || command.includes('chalu');
          const isSkip = command.includes('skip') || command.includes('next') || command.includes('agla') || command.includes('pudhcha') || command.includes('aagal');
          const isStop = command.includes('stop') || command.includes('end') || command.includes('reset') || command.includes('band') || command.includes('khatam');

          if (isPause) {
            if (!isPaused) {
              togglePause();
              actionTriggered = 'pause';
            }
          } else if (isResume) {
            if (isPaused) {
              togglePause();
              actionTriggered = 'resume';
            }
          } else if (isSkip) {
            skipTurn();
            actionTriggered = 'skip';
          } else if (isStop) {
            stopDebate();
            actionTriggered = 'stop';
          } else if (command.includes('explain') || command.includes('detail') || command.includes('more')) {
            setPendingInstruction(`The user wants more detail: "${command}". Please provide a deeper, more comprehensive explanation in your next turn.`);
            actionTriggered = 'explain';
          } else if (command.includes('challenge') || command.includes('direct') || command.includes('tough')) {
            setPendingInstruction(`The user wants a tougher challenge: "${command}". Please be more direct and critical in your next turn.`);
            actionTriggered = 'challenge';
          }
          
          if (actionTriggered) {
            setActiveVoiceAction(actionTriggered);
            setVoiceCommandSuccess(true);
            setTimeout(() => setActiveVoiceAction(null), 2000);
          }
          
          setIsProcessingVoiceCommand(false);
          setTimeout(() => {
            setLastVoiceCommand(null);
            setVoiceCommandSuccess(false);
          }, 3000);
        }, 500);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === 'no-speech') {
          // Restart if it timed out
          try { recognition.start(); } catch (e) {}
        }
      };

      recognition.onend = () => {
        if (isVoiceControlActive && session.status === 'running') {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isVoiceControlActive, session.status, isPaused]);

  const resetSession = () => {
    if (currentAudioSourceRef.current) {
      currentAudioSourceRef.current.stop();
    }
    setIsPaused(false);
    setSession({
      topic: '',
      messages: [],
      status: 'idle',
      currentTurn: 0,
      totalExplainerScore: 0,
      totalChallengerScore: 0,
    });
  };

  const deleteHistoryItem = (index: number) => {
    const newHistory = [...history];
    newHistory.splice(index, 1);
    setHistory(newHistory);
    localStorage.setItem('chanakya_history', JSON.stringify(newHistory));
  };

  const lastMessage = session.messages.length > 0 ? session.messages[session.messages.length - 1] : null;

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-orange-500/30 overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#020202]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.2)]">
            <BrainCircuit className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-xl font-black tracking-tighter uppercase">CHANAKYA <span className="text-orange-500">AI</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={resetSession}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 active:scale-95 rounded-xl transition-all duration-300 text-white/60 hover:text-white group"
            title="Go to Home"
          >
            <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Home</span>
          </button>
          <button 
            onClick={() => {
              setIsVoiceEnabled(!isVoiceEnabled);
              initAudioContext();
            }}
            className={`p-2 rounded-xl transition-all duration-300 active:scale-90 ${isVoiceEnabled ? 'bg-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}
            title={isVoiceEnabled ? "Disable Voice" : "Enable Voice"}
          >
            {isVoiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          {session.status !== 'idle' && (
            <button 
              onClick={resetSession}
              className="p-2 bg-white/5 hover:bg-white/10 active:scale-90 rounded-xl transition-all duration-300 text-white/60 hover:text-white"
              title="Reset Session"
            >
              <RefreshCcw className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col transition-all duration-700 ease-in-out">
        {session.status === 'idle' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 px-4 relative pt-32 pb-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.08),transparent_70%)] blur-3xl -z-10" />
            
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center"
            >
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="text-4xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] uppercase mb-6"
              >
                Dual Agent <br />
                <span className="text-orange-500">Live Stage</span>
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="text-white/40 text-lg md:text-xl max-w-xl mx-auto font-medium tracking-tight"
              >
                Watch two specialized AI agents debate and challenge each other in a live voice-first experience.
              </motion.p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-orange-600/20 rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
              <input 
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startDebate()}
                placeholder="Enter a topic for the debate..."
                className="relative w-full bg-white/[0.03] border border-white/10 rounded-[28px] px-8 py-6 text-xl focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-white/10 shadow-2xl backdrop-blur-sm"
              />
              <button 
                onClick={startDebate}
                disabled={!topic.trim()}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-black p-4 rounded-2xl transition-all shadow-lg active:scale-90 hover:shadow-orange-500/20"
              >
                <Mic2 className="w-6 h-6" />
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/60 block ml-2">Explainer Archetype</span>
                <div className="grid grid-cols-1 gap-2">
                  {EXPLAINER_ARCHETYPES.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setExplainerArchetype(a.id)}
                      className={`p-4 rounded-2xl border text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                        explainerArchetype === a.id 
                          ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                          : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="font-bold text-sm">{a.name}</div>
                      <div className="text-[10px] opacity-60">{a.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-500/60 block ml-2">Challenger Archetype</span>
                <div className="grid grid-cols-1 gap-2">
                  {CHALLENGER_ARCHETYPES.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setChallengerArchetype(a.id)}
                      className={`p-4 rounded-2xl border text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                        challengerArchetype === a.id 
                          ? 'bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
                          : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="font-bold text-sm">{a.name}</div>
                      <div className="text-[10px] opacity-60">{a.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[32px] backdrop-blur-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500/60 ml-2">Debate Length</span>
                  <span className="text-xl font-black text-orange-500">{maxTurns} Turns</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="20" 
                  step="2"
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(parseInt(e.target.value))}
                  className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between mt-2 px-1">
                  <span className="text-[9px] font-bold text-white/20 uppercase">Quick</span>
                  <span className="text-[9px] font-bold text-white/20 uppercase">Deep Dive</span>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[32px] backdrop-blur-sm">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500/60 block mb-4 ml-2">Debate Language</span>
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLanguage(l.id)}
                      className={`py-3 rounded-2xl border font-bold text-xs transition-all duration-300 ${
                        language === l.id 
                          ? 'bg-orange-500 text-black border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.2)]' 
                          : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]'
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {activeSessionToResume && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="bg-white/[0.03] border border-white/10 p-6 rounded-[32px] max-w-md w-full backdrop-blur-sm flex flex-col items-center gap-4 hover:bg-white/[0.05] hover:border-white/20 transition-all duration-300 shadow-2xl"
              >
                <div className="text-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 block mb-1">Unfinished Session</span>
                  <h4 className="text-lg font-bold truncate max-w-[250px]">{activeSessionToResume.topic}</h4>
                </div>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => {
                      setSession(activeSessionToResume);
                      setActiveSessionToResume(null);
                      runDebateLoop(activeSessionToResume);
                    }}
                    className="flex-1 bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white py-3 rounded-2xl font-bold transition-all duration-300 shadow-lg"
                  >
                    Resume
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.removeItem('chanakya_active_session');
                      setActiveSessionToResume(null);
                    }}
                    className="p-3 hover:bg-red-500/20 active:scale-90 text-white/40 hover:text-red-500 rounded-2xl transition-all duration-300"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {history.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-4xl space-y-6"
              >
                <div className="flex items-center gap-3 text-white/20 text-xs font-black uppercase tracking-[0.3em] justify-center">
                  <History className="w-4 h-4" />
                  Past Sessions
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {history.map((h, i) => (
                    <div 
                      key={i}
                      className="group relative bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/[0.08] hover:border-white/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left shadow-lg hover:shadow-orange-500/5"
                      onClick={() => {
                        setSession(h);
                        setTopic('');
                      }}
                    >
                      <span className="block truncate font-bold text-white/80 group-hover:text-white transition-colors">{h.topic}</span>
                      <div className="flex justify-between items-center mt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/20 uppercase font-black tracking-widest">
                            {h.messages.length} Turns
                          </span>
                          {h.summary && (
                            <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-blue-500/20">
                              Summary
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {h.summary && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSession(h);
                                setShowSummary(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-blue-400 transition-all"
                              title="View Summary"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryItem(i);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                            title="Delete Session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col pt-20 relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.03),transparent_70%)] pointer-events-none" />
            
            {/* Stage Area */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 max-w-6xl mx-auto w-full">
              {/* Explainer Card */}
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                animate={{ 
                  opacity: (speakingAgent === 'challenger' || isTyping === 'challenger') ? 0.4 : 1,
                  x: 0,
                  scale: speakingAgent === 'explainer' || isTyping === 'explainer' ? 1.02 : 1,
                }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={`relative flex flex-col items-center justify-center rounded-[32px] border transition-all duration-700 overflow-hidden ${
                  speakingAgent === 'explainer' || isTyping === 'explainer'
                    ? 'bg-blue-500/[0.03] border-blue-500/30 shadow-[0_0_80px_rgba(59,130,246,0.1)]'
                    : 'bg-white/[0.02] border-white/5'
                }`}
              >
                <div className="absolute top-6 left-8 flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-500/50 mb-1">
                    {EXPLAINER_ARCHETYPES.find(a => a.id === session.explainerArchetype)?.name || 'Module 01'}
                  </span>
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-white/90">Explainer</h3>
                </div>
                
                <div className="absolute top-6 right-8 text-right">
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/10 mb-1 block">Score</span>
                  <span className="text-3xl font-black font-mono text-blue-400/80">{session.totalExplainerScore}</span>
                </div>

                <div className="relative">
                  <AnimatePresence>
                    {(speakingAgent === 'explainer' || isTyping === 'explainer') && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.4, opacity: 0.15 }}
                        exit={{ scale: 1.8, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeOut" }}
                        className="absolute inset-0 bg-blue-500 rounded-full blur-3xl"
                      />
                    )}
                  </AnimatePresence>
                  <div className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-700 relative z-10 ${
                    speakingAgent === 'explainer' || isTyping === 'explainer'
                      ? 'bg-blue-500 text-black shadow-[0_0_40px_rgba(59,130,246,0.4)]'
                      : 'bg-white/[0.03] text-blue-500/40 border border-white/5'
                  }`}>
                    <Sparkles className={`w-14 h-14 ${speakingAgent === 'explainer' ? 'animate-pulse' : ''}`} />
                  </div>
                </div>

                <div className="absolute bottom-10 px-8 text-center w-full">
                  <div className="flex gap-1.5 justify-center mb-4 h-6 items-center">
                    {speakingAgent === 'explainer' ? (
                      [...Array(8)].map((_, i) => (
                        <motion.div 
                          key={i}
                          animate={{ height: [4, 20, 4] }}
                          transition={{ repeat: Infinity, duration: 0.4, delay: i * 0.05 }}
                          className="w-1 bg-blue-400/60 rounded-full"
                        />
                      ))
                    ) : isTyping === 'explainer' ? (
                      <span className="text-[10px] font-black text-blue-400/60 animate-pulse uppercase tracking-[0.3em]">Processing...</span>
                    ) : (
                      <div className="w-12 h-0.5 bg-white/5 rounded-full" />
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Challenger Card */}
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ 
                  opacity: (speakingAgent === 'explainer' || isTyping === 'explainer') ? 0.4 : 1,
                  x: 0,
                  scale: speakingAgent === 'challenger' || isTyping === 'challenger' ? 1.02 : 1,
                }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={`relative flex flex-col items-center justify-center rounded-[32px] border transition-all duration-700 overflow-hidden ${
                  speakingAgent === 'challenger' || isTyping === 'challenger'
                    ? 'bg-purple-500/[0.03] border-purple-500/30 shadow-[0_0_80px_rgba(168,85,247,0.1)]'
                    : 'bg-white/[0.02] border-white/5'
                }`}
              >
                <div className="absolute top-6 left-8 flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-purple-500/50 mb-1">
                    {CHALLENGER_ARCHETYPES.find(a => a.id === session.challengerArchetype)?.name || 'Module 02'}
                  </span>
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-white/90">Challenger</h3>
                </div>

                <div className="absolute top-6 right-8 text-right">
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/10 mb-1 block">Score</span>
                  <span className="text-3xl font-black font-mono text-purple-400/80">{session.totalChallengerScore}</span>
                </div>

                <div className="relative">
                  <AnimatePresence>
                    {(speakingAgent === 'challenger' || isTyping === 'challenger') && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.4, opacity: 0.15 }}
                        exit={{ scale: 1.8, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeOut" }}
                        className="absolute inset-0 bg-purple-500 rounded-full blur-3xl"
                      />
                    )}
                  </AnimatePresence>
                  <div className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-700 relative z-10 ${
                    speakingAgent === 'challenger' || isTyping === 'challenger'
                      ? 'bg-purple-500 text-black shadow-[0_0_40px_rgba(168,85,247,0.4)]'
                      : 'bg-white/[0.03] text-purple-500/40 border border-white/5'
                  }`}>
                    <ShieldAlert className={`w-14 h-14 ${speakingAgent === 'challenger' ? 'animate-pulse' : ''}`} />
                  </div>
                </div>

                <div className="absolute bottom-10 px-8 text-center w-full">
                  <div className="flex gap-1.5 justify-center mb-4 h-6 items-center">
                    {speakingAgent === 'challenger' ? (
                      [...Array(8)].map((_, i) => (
                        <motion.div 
                          key={i}
                          animate={{ height: [4, 20, 4] }}
                          transition={{ repeat: Infinity, duration: 0.4, delay: i * 0.05 }}
                          className="w-1 bg-purple-400/60 rounded-full"
                        />
                      ))
                    ) : isTyping === 'challenger' ? (
                      <span className="text-[10px] font-black text-purple-400/60 animate-pulse uppercase tracking-[0.3em]">Processing...</span>
                    ) : (
                      <div className="w-12 h-0.5 bg-white/5 rounded-full" />
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Live Transcript Panel */}
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="h-64 bg-white/[0.01] border-t border-white/5 p-6 relative backdrop-blur-sm"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-black px-5 py-1.5 rounded-full font-black text-[10px] uppercase tracking-[0.3em] shadow-xl border border-orange-400/50">
                Live Feed
              </div>
              
              <div className="h-full grid grid-cols-2 gap-8 overflow-hidden">
                {/* Explainer Column */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-widest text-blue-400/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Explainer Log
                  </div>
                  <div 
                    ref={explainerScrollRef}
                    className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide"
                  >
                    <AnimatePresence mode="popLayout">
                      {session.messages.filter(m => m.role === 'explainer').map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 15, filter: 'blur(10px)' }}
                          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl hover:bg-blue-500/10 transition-colors duration-300"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Turn {session.messages.indexOf(msg)}</span>
                            {msg.score !== undefined && msg.score > 0 && (
                              <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded font-bold text-white/20">
                                S: {msg.score}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white/70 font-medium leading-relaxed">{msg.content}</p>
                        </motion.div>
                      ))}
                      {isTyping === 'explainer' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-1 p-2">
                          <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-1 bg-blue-400 rounded-full" />
                          <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-blue-400 rounded-full" />
                          <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-blue-400 rounded-full" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Challenger Column */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-widest text-purple-400/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    Challenger Log
                  </div>
                  <div 
                    ref={challengerScrollRef}
                    className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide"
                  >
                    <AnimatePresence mode="popLayout">
                      {session.messages.filter(m => m.role === 'challenger').map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 15, filter: 'blur(10px)' }}
                          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-2xl hover:bg-purple-500/10 transition-colors duration-300"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">Turn {session.messages.indexOf(msg)}</span>
                            {msg.score !== undefined && msg.score > 0 && (
                              <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded font-bold text-white/20">
                                S: {msg.score}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white/70 font-medium leading-relaxed">{msg.content}</p>
                        </motion.div>
                      ))}
                      {isTyping === 'challenger' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-1 p-2">
                          <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-1 bg-purple-400 rounded-full" />
                          <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-purple-400 rounded-full" />
                          <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-purple-400 rounded-full" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Session Footer */}
            <div className="bg-[#050505] border-t border-white/5 px-8 py-4 flex justify-between items-center">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5">
                    {[...Array(session.maxTurns || MAX_TURNS)].map((_, i) => (
                      <div 
                        key={i}
                        className={`w-10 h-1 rounded-full transition-all duration-1000 ease-in-out ${i < Math.floor(session.currentTurn / 2) ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)] scale-x-110' : 'bg-white/5'}`}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/10">
                    Phase {Math.floor(session.currentTurn / 2) + 1} / {session.maxTurns || MAX_TURNS}
                  </span>
                </div>

                {session.status === 'running' && (
                  <div className="flex items-center gap-2 border-l border-white/10 pl-8">
                    <button 
                      onClick={togglePause}
                      className={`p-2 rounded-xl transition-all duration-300 active:scale-90 ${
                        activeVoiceAction === 'pause' || activeVoiceAction === 'resume'
                          ? 'bg-orange-500 text-black scale-110 shadow-[0_0_20px_rgba(249,115,22,0.5)]' 
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                      title={isPaused ? "Resume Debate" : "Pause Debate"}
                    >
                      {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                    </button>
                    <button 
                      onClick={skipTurn}
                      className={`p-2 rounded-xl transition-all duration-300 active:scale-90 ${
                        activeVoiceAction === 'skip'
                          ? 'bg-orange-500 text-black scale-110 shadow-[0_0_20px_rgba(249,115,22,0.5)]' 
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                      title="Skip Turn"
                    >
                      <SkipForward className="w-5 h-5 fill-current" />
                    </button>
                    <button 
                      onClick={() => setIsVoiceControlActive(!isVoiceControlActive)}
                      className={`p-2 rounded-xl transition-all duration-300 active:scale-90 ${isVoiceControlActive ? 'bg-orange-500/20 text-orange-500' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                      title={isVoiceControlActive ? "Disable Voice Commands" : "Enable Voice Commands"}
                    >
                      {isVoiceControlActive ? <Mic2 className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
                    </button>
                  </div>
                )}
              </div>
              
              {session.status === 'completed' && (
                <div className="flex items-center gap-4">
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(59,130,246,0.3)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowSummary(true)}
                    className="bg-blue-500 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    View Summary
                  </motion.button>
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(249,115,22,0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={resetSession}
                    className="bg-orange-500 text-black px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg"
                  >
                    Start New Debate
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Active Topic Overlay */}
      {session.status !== 'idle' && (
        <>
          <motion.div 
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3"
          >
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 px-10 py-3 rounded-full shadow-2xl">
              <span className="text-[9px] font-black uppercase tracking-[0.5em] text-orange-500/60 block text-center mb-1">Session Subject</span>
              <h2 className="text-lg font-black uppercase tracking-tight text-center text-white/90">{session.topic}</h2>
            </div>

            <AnimatePresence>
              {lastVoiceCommand && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={`px-6 py-2 rounded-full shadow-2xl flex items-center gap-3 transition-all duration-500 ${
                      voiceCommandSuccess ? 'bg-green-500 text-black shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-orange-500 text-black shadow-[0_0_30px_rgba(249,115,22,0.3)]'
                    }`}
                  >
                  {isProcessingVoiceCommand ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : voiceCommandSuccess ? (
                    <Sparkles className="w-4 h-4" />
                  ) : (
                    <Mic2 className="w-4 h-4" />
                  )}
                  <span className="text-xs font-black uppercase tracking-widest">
                    {isProcessingVoiceCommand 
                      ? 'Processing Command...' 
                      : voiceCommandSuccess 
                        ? `Applied: ${lastVoiceCommand}` 
                        : `Command: ${lastVoiceCommand}`}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}

      {/* Global Footer */}
      <footer className="bg-black/40 border-t border-white/5 backdrop-blur-xl py-8 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-black uppercase tracking-widest text-white">Chanakya AI</span>
            </div>
            <p className="text-[10px] text-white/30 font-medium uppercase tracking-widest">© 2026 Chanakya AI. All rights reserved.</p>
          </div>

          <div className="flex items-center gap-8">
            <button 
              onClick={() => setShowTerms(true)}
              className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white active:scale-95 transition-all duration-300"
            >
              Terms & Conditions
            </button>
            <div className="flex items-center gap-4 border-l border-white/10 pl-8">
              <a href="#" className="text-white/40 hover:text-blue-400 active:scale-90 transition-all duration-300 hover:scale-110"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="text-white/40 hover:text-white active:scale-90 transition-all duration-300 hover:scale-110"><Github className="w-4 h-4" /></a>
              <a href="#" className="text-white/40 hover:text-blue-600 active:scale-90 transition-all duration-300 hover:scale-110"><Linkedin className="w-4 h-4" /></a>
              <a href="#" className="text-white/40 hover:text-pink-500 active:scale-90 transition-all duration-300 hover:scale-110"><Instagram className="w-4 h-4" /></a>
            </div>
          </div>
        </div>
      </footer>

      {/* Summary Modal */}
      <AnimatePresence>
        {showSummary && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSummary(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                    <Trophy className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-white">Debate Summary</h3>
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Session Analysis</p>
                  </div>
                </div>
                <button onClick={() => setShowSummary(false)} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 max-h-[60vh] overflow-y-auto">
                {isGeneratingSummary ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-500/60 animate-pulse">Analyzing Arguments...</p>
                  </div>
                ) : session.summary ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-6">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500/60 block mb-4">Topic</span>
                      <h4 className="text-lg font-bold text-white/90">{session.topic}</h4>
                    </div>
                    <div className="space-y-6 text-white/70 font-medium leading-relaxed">
                      <Markdown>{session.summary}</Markdown>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-white/20 uppercase font-black tracking-widest text-xs">
                    No summary available for this session.
                  </div>
                )}
              </div>

              <div className="p-8 bg-white/[0.02] border-t border-white/5 flex gap-4">
                <button 
                  onClick={() => setShowSummary(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                >
                  Close
                </button>
                <button 
                  onClick={resetSession}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-orange-500/20"
                >
                  Start New
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Terms Modal */}
      <AnimatePresence>
        {showTerms && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTerms(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Terms & Conditions</h3>
                <button onClick={() => setShowTerms(false)} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6 text-white/60 font-medium leading-relaxed">
                <section>
                  <h4 className="text-orange-500 font-black uppercase tracking-widest text-xs mb-2">1. Acceptance of Terms</h4>
                  <p>By using Chanakya AI, you agree to be bound by these Terms and Conditions. Our platform uses advanced AI models to simulate debates and educational content.</p>
                </section>
                <section>
                  <h4 className="text-orange-500 font-black uppercase tracking-widest text-xs mb-2">2. AI Content Disclaimer</h4>
                  <p>Content generated by Chanakya AI is for educational and entertainment purposes only. While we strive for accuracy, AI models may produce incorrect or biased information.</p>
                </section>
                <section>
                  <h4 className="text-orange-500 font-black uppercase tracking-widest text-xs mb-2">3. User Conduct</h4>
                  <p>Users are expected to interact with the platform in a respectful manner. Any abuse of the voice command system or AI agents is strictly prohibited.</p>
                </section>
                <section>
                  <h4 className="text-orange-500 font-black uppercase tracking-widest text-xs mb-2">4. Privacy</h4>
                  <p>We value your privacy. Your debate history is stored locally on your device and is not shared with third parties, except for the necessary data sent to AI models for processing.</p>
                </section>
              </div>
              <div className="p-8 bg-white/[0.02] border-t border-white/5">
                <button 
                  onClick={() => setShowTerms(false)}
                  className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-orange-500/20"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
