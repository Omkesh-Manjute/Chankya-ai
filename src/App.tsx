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
  Trophy,
  BookOpen,
  Sun,
  Moon,
  User,
  Bot
} from 'lucide-react';
import ai, { geminiModel, ttsModel, Modality, Type } from './lib/gemini';
import { Message, DebateSession } from './types';
import Markdown from 'react-markdown';

const MAX_TURNS = 6;

const EXPLAINER_ARCHETYPES = [
  { id: 'paaro', name: 'Paaro (The Explainer)', description: 'Calm, intelligent, and friendly teacher. Hinglish expertise.' },
  { id: 'teacher', name: 'Patient Teacher', description: 'Simple, clear, and encouraging.' },
  { id: 'philosopher', name: 'Calm Philosopher', description: 'Deep, reflective, and balanced.' }
];

const CHALLENGER_ARCHETYPES = [
  { id: 'vinod', name: 'Vinod (The Challenger)', description: 'Aggressive, logical, and slightly sarcastic. Sharp thinker.' },
  { id: 'critic', name: 'Sarcastic Critic', description: 'Witty, sharp, and slightly mocking.' },
  { id: 'debater', name: 'Aggressive Debater', description: 'Forceful, direct, and relentless.' }
];

const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'hi', name: 'Hindi' },
  { id: 'hinglish', name: 'Hinglish (Hindi + English)' },
  { id: 'mr', name: 'Marathi' },
  { id: 'gu', name: 'Gujarati' }
];

export default function App() {
  const [topic, setTopic] = useState('');
  const [explainerArchetype, setExplainerArchetype] = useState('paaro');
  const [challengerArchetype, setChallengerArchetype] = useState('vinod');
  const [language, setLanguage] = useState('hinglish');
  const [explainerGender, setExplainerGender] = useState<'male' | 'female'>('female');
  const [challengerGender, setChallengerGender] = useState<'male' | 'female'>('male');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
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
  const [currentlySpeakingMessageId, setCurrentlySpeakingMessageId] = useState<string | null>(null);
  const [revealedScoreIds, setRevealedScoreIds] = useState<Set<string>>(new Set());
  const [isVoiceControlActive, setIsVoiceControlActive] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replaySession, setReplaySession] = useState<DebateSession | null>(null);
  const [showCustomArchetypeModal, setShowCustomArchetypeModal] = useState<'explainer' | 'challenger' | null>(null);
  const [customArchetypes, setCustomArchetypes] = useState<{
    explainer: { name: string; description: string; traits: string; style: string; domain: string } | null;
    challenger: { name: string; description: string; traits: string; style: string; domain: string } | null;
  }>({ explainer: null, challenger: null });
  const [tempCustomArchetype, setTempCustomArchetype] = useState({
    name: '',
    description: '',
    traits: '',
    style: '',
    domain: ''
  });
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

  const getScoreReceived = (msg: Message, currentSession: DebateSession) => {
    const msgIndex = currentSession.messages.findIndex(m => m.id === msg.id);
    if (msgIndex === -1) return null;
    
    // The score for this message is in the NEXT message from the opponent,
    // OR it might be in a special 'evaluation' message at the end.
    const nextMsg = currentSession.messages[msgIndex + 1];
    if (nextMsg && nextMsg.score !== undefined && nextMsg.score > 0) {
      if (nextMsg.role !== msg.role || nextMsg.role === 'user') { // User or opponent can score
        return {
          score: nextMsg.score,
          reason: nextMsg.scoreReason
        };
      }
    }
    return null;
  };

  const StrengthMeter = ({ score, reason, theme, isRevealed }: { score: number, reason?: string, theme: string, isRevealed: boolean }) => {
    const bars = Array.from({ length: 10 }, (_, i) => i + 1);
    
    if (!isRevealed) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative flex flex-col gap-1.5 mt-3 pt-3 border-t border-black/5 dark:border-white/5"
      >
        <div className="flex items-center gap-2">
          <span className={`text-[8px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Argument Strength</span>
          <div className="flex gap-0.5">
            {bars.map((b) => (
              <motion.div 
                key={b}
                initial={{ scaleY: 0.5, opacity: 0 }}
                animate={{ 
                  scaleY: b <= score ? 1 : 0.6, 
                  opacity: 1,
                  backgroundColor: b <= score ? (score <= 3 ? '#ef4444' : score <= 6 ? '#eab308' : '#22c55e') : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                }}
                className="w-1.5 h-3 rounded-sm"
              />
            ))}
          </div>
          <span className={`text-[10px] font-bold font-mono ${score > 7 ? 'text-green-500' : score > 4 ? 'text-yellow-500' : 'text-red-500'}`}>
            {score}/10
          </span>
        </div>
        {reason && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            whileHover={{ opacity: 1, height: 'auto' }}
            className={`text-[9px] font-medium leading-tight overflow-hidden transition-all duration-300 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}
          >
            <Quote className="w-2 h-2 inline-block mr-1 opacity-50" />
            {reason}
          </motion.div>
        )}
      </motion.div>
    );
  };

  const WordHighlighter = ({ text, isSpeaking, theme }: { text: string, isSpeaking: boolean, theme: string }) => {
    const words = text.split(' ');
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
      if (isSpeaking) {
        // Estimate 3.5 words per second (approx 210 wpm)
        const msPerWord = 280; 
        let current = 0;
        const interval = setInterval(() => {
          setActiveIndex(current);
          current++;
          if (current >= words.length) clearInterval(interval);
        }, msPerWord);
        return () => clearInterval(interval);
      } else {
        setActiveIndex(-1);
      }
    }, [isSpeaking, words.length]);

    return (
      <p className={`text-sm font-medium leading-relaxed transition-all duration-500 ${isSpeaking ? 'scale-[1.02] origin-left' : ''} ${theme === 'dark' ? 'text-white/70' : 'text-slate-700'}`}>
        {words.map((word, i) => (
          <span 
            key={i} 
            className={`transition-all duration-300 rounded-sm px-0.5 -mx-0.5 ${i <= activeIndex && isSpeaking ? 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.4)]' : ''}`}
          >
            {word}{' '}
          </span>
        ))}
      </p>
    );
  };

  const AgentAvatar = ({ role, isSpeaking, isTyping, theme }: { role: 'explainer' | 'challenger', isSpeaking: boolean, isTyping: boolean, theme: string }) => {
    const color = role === 'explainer' ? 'blue' : 'purple';
    
    return (
      <div className="relative group">
        <AnimatePresence>
          {(isSpeaking || isTyping) && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1.2, 1.4, 1.2], opacity: [0.1, 0.2, 0.1] }}
              exit={{ scale: 1.8, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className={`absolute inset-0 bg-${color}-500 rounded-full blur-3xl`}
            />
          )}
        </AnimatePresence>
        
        {/* Glow Ring */}
        <motion.div 
          animate={isSpeaking ? { scale: [1, 1.05, 1], borderColor: role === 'explainer' ? ['rgba(59,130,246,0.2)', 'rgba(59,130,246,0.5)', 'rgba(59,130,246,0.2)'] : ['rgba(168,85,247,0.2)', 'rgba(168,85,247,0.5)', 'rgba(168,85,247,0.2)'] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className={`w-40 h-40 rounded-full border-2 flex items-center justify-center relative z-10 transition-all duration-500 ${
            isSpeaking || isTyping 
              ? role === 'explainer' ? 'border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]'
              : 'border-transparent'
          }`}
        >
          <div className={`w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-700 relative z-10 overflow-hidden ${
            isSpeaking || isTyping
              ? `bg-${color}-500 text-black`
              : theme === 'dark'
                ? 'bg-white/[0.03] text-white/20 border border-white/5'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}>
            {role === 'explainer' ? <Bot className="w-16 h-16" /> : <User className="w-16 h-16" />}
            
            {/* Talking Animation (Mouth) */}
            <div className="h-4 flex items-center justify-center gap-0.5 mt-2">
              {isSpeaking ? (
                [...Array(3)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: [2, 10, 2] }}
                    transition={{ repeat: Infinity, duration: 0.15, delay: i * 0.05 }}
                    className={`w-1.5 rounded-full ${isSpeaking ? 'bg-black' : (theme === 'dark' ? 'bg-white/20' : 'bg-slate-400')}`}
                  />
                ))
              ) : (
                <motion.div 
                  animate={isTyping ? { width: [4, 12, 4] } : {}}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className={`h-0.5 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-300'}`} 
                  style={{ width: isTyping ? '12px' : '16px' }}
                />
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

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
    const scroll = () => {
      if (explainerScrollRef.current) {
        explainerScrollRef.current.scrollTo({
          top: explainerScrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
      if (challengerScrollRef.current) {
        challengerScrollRef.current.scrollTo({
          top: challengerScrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    };
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      scroll();
      // Second pass for dynamic content height changes
      setTimeout(scroll, 100);
    });
  }, [session.messages, isTyping, currentlySpeakingMessageId]);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playPCM = (base64Data: string, role: 'explainer' | 'challenger' | 'moderator') => {
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
        setSpeakingAgent(role === 'moderator' ? 'explainer' : role);
        
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

  const speak = async (text: string, role: 'explainer' | 'challenger' | 'moderator', messageId: string) => {
    if (!isVoiceEnabled) {
      setRevealedScoreIds(prev => new Set(prev).add(messageId));
      return;
    }

    try {
      setCurrentlySpeakingMessageId(messageId);
      const languageName = LANGUAGES.find(l => l.id === session.language)?.name || 'English';
      
      let voiceName = 'Zephyr';
      if (role === 'explainer') {
        voiceName = explainerGender === 'female' ? 'Aoede' : 'Iapetus';
      } else if (role === 'challenger') {
        voiceName = challengerGender === 'female' ? 'Kore' : 'Fenrir';
      } else if (role === 'moderator') {
        voiceName = 'Zephyr';
      }

      const response = await ai.models.generateContent({
        model: ttsModel,
        contents: [{ parts: [{ text: `Say this naturally in ${languageName} with emotion and appropriate pauses (...): ${text}` }] }],
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
      
      // Reveal score after speaking
      setRevealedScoreIds(prev => new Set(prev).add(messageId));
      setCurrentlySpeakingMessageId(null);
    } catch (error) {
      console.error("TTS Error:", error);
      setRevealedScoreIds(prev => new Set(prev).add(messageId));
      setCurrentlySpeakingMessageId(null);
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
    const sessionMaxTurns = currentSession.maxTurns || MAX_TURNS;

    // 1. MODERATOR INTRO (Nova)
    if (activeSession.messages.length === 1) { // Only if it's the very start
      setIsTyping('explainer'); // Placeholder
      const introPrompt = `You are Nova, the Moderator. Start a futurist AI debate on the topic: "${activeSession.topic}". 
      Introduce Paaro (The Explainer: calm, intelligent, Hinglish) and Vinod (The Challenger: aggressive, logical).
      Keep it short, professional, and exciting. Language: ${LANGUAGES.find(l => l.id === activeSession.language)?.name}.`;
      
      const introResult = await ai.models.generateContent({
        model: geminiModel,
        contents: introPrompt,
        config: { temperature: 0.7 }
      });
      const introText = introResult.text || "Welcome to the Chanakya AI Stage.";
      const introMsg: Message = {
        id: `moderator-intro-${Date.now()}`,
        role: 'user', // UI shows user/system as neutral
        content: `[Moderator Nova]: ${introText}`,
        timestamp: Date.now()
      };
      activeSession = { ...activeSession, messages: [...activeSession.messages, introMsg] };
      setSession(activeSession);
      setIsTyping(null);
      await speak(introText, 'moderator', introMsg.id);
    }

    const startTurn = Math.floor(activeSession.currentTurn / 2);
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
        };
        
        // Update total score and reveal immediately after generation
        setSession(prev => ({
          ...prev,
          messages: activeSession.messages,
          currentTurn: activeSession.currentTurn,
          totalChallengerScore: prev.totalChallengerScore + (explainerData.score || 0)
        }));
        
        // If there was a previous message (challenger's), reveal its score now
        if (activeSession.messages.length > 2) {
          const prevMsg = activeSession.messages[activeSession.messages.length - 2];
          setRevealedScoreIds(prev => new Set(prev).add(prevMsg.id));
        }

        setIsTyping(null);
        
        if (!skipTurnRef.current) {
          await speak(explainerData.content, 'explainer', explainerMsg.id);
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
        };
        
        // Update total score and reveal immediately after generation
        setSession(prev => ({
          ...prev,
          messages: activeSession.messages,
          currentTurn: activeSession.currentTurn,
          totalExplainerScore: prev.totalExplainerScore + (challengerData.score || 0)
        }));

        // Reveal the explainer's previous message score
        const prevMsg = activeSession.messages[activeSession.messages.length - 2];
        if (prevMsg) {
          setRevealedScoreIds(prev => new Set(prev).add(prevMsg.id));
        }

        setIsTyping(null);
        
        if (!skipTurnRef.current) {
          await speak(challengerData.content, 'challenger', challengerMsg.id);
        }
        skipTurnRef.current = false;
      }
    }

    // Final Evaluation Step: Score the very last message
    setIsTyping(activeSession.messages[activeSession.messages.length - 1].role === 'explainer' ? 'challenger' : 'explainer');
    try {
      const lastMsg = activeSession.messages[activeSession.messages.length - 1];
      const evaluatorRole = lastMsg.role === 'explainer' ? 'challenger' : 'explainer';
      const judgeName = evaluatorRole === 'challenger' ? 'Vinod' : 'Paaro';
      const prompt = `You are ${judgeName}, acting as the final judge. Evaluate the final point made by the ${lastMsg.role}: "${lastMsg.content}".
      Assign a score (1-10) and a brief reason. Return JSON only.`;
      
      const result = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER },
              scoreReason: { type: Type.STRING }
            },
            required: ["score", "scoreReason"]
          }
        }
      });
      
      const evalData = JSON.parse(result.text || "{}");
      const evalMsg: Message = {
        id: `final-eval-${Date.now()}`,
        role: evaluatorRole,
        content: `Final Assessment: ${evalData.scoreReason}`,
        score: evalData.score,
        scoreReason: evalData.scoreReason,
        timestamp: Date.now()
      };
      
      activeSession = {
        ...activeSession,
        messages: [...activeSession.messages, evalMsg],
        totalExplainerScore: evaluatorRole === 'challenger' ? activeSession.totalExplainerScore + (evalData.score || 0) : activeSession.totalExplainerScore,
        totalChallengerScore: evaluatorRole === 'explainer' ? activeSession.totalChallengerScore + (evalData.score || 0) : activeSession.totalChallengerScore
      };
      setSession(activeSession);
      setRevealedScoreIds(prev => new Set(prev).add(lastMsg.id));
    } catch (e) {
      console.error("Final evaluation failed", e);
    }
    setIsTyping(null);

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

    const prompt = `Topic: ${finalSession.topic}\n\nDebate History:\n${historyText}\n\nYou are Nova, the smart Moderator and Host. Provide a neutral, professional summary of the key arguments from Paaro (Explainer) and Vinod (Challenger). State the overall outcome. Use bullet points. Keep it professional and insightful. The summary MUST be in ${languageName}. Output as Moderator Nova speaking to the audience.`;

    try {
      const result = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config: {
          systemInstruction: `You are Nova, a neutral and smart debate host. Provide a professional, structured summary of the debate in ${languageName}.`,
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
    const customArchetype = role === 'explainer' ? customArchetypes.explainer : customArchetypes.challenger;
    const languageName = LANGUAGES.find(l => l.id === currentSession.language)?.name || 'English';

    let systemPrompt = role === 'explainer' 
      ? `You are Paaro, the helpful AI teacher. You are calm, intelligent, and friendly. Explain concepts in simple Hinglish (Hindi + English mix). Always try to simplify and help beginners. Keep it concise, fast-paced, and strictly in ${languageName === 'Hinglish (Hindi + English)' ? 'Hinglish' : languageName}.
         If you are responding to Vinod, address his points calmly. 
         Additionally, evaluate the previous message from Vinod and assign a score (1-10).`
      : `You are Vinod, a critical thinker and challenger. You are aggressive, logical, and slightly sarcastic. You use sharp logic to challenge ideas. Keep it fast, energetic, and strictly in ${languageName === 'Hinglish (Hindi + English)' ? 'Hinglish' : languageName}.
         Challenge Paaro to be more precise and point out gaps.
         Additionally, evaluate the previous message from Paaro and assign a score (1-10).`;

    if (languageName === 'Hinglish (Hindi + English)') {
      systemPrompt += `\n\nSTYLE NOTE: Use a natural mix of Hindi and English. Use expressive dialogue with natural pauses (...) and emotional emphasis.`;
    }

    if (archetypeId === 'custom' && customArchetype) {
      systemPrompt += `\n\nYour CUSTOM personality archetype is: "${customArchetype.name}". 
         Description: ${customArchetype.description}
         Specific Traits: ${customArchetype.traits}
         Speaking Style: ${customArchetype.style}
         Knowledge Domain: ${customArchetype.domain}
         Ensure your tone, vocabulary, and argumentation style strictly follow this custom archetype.`;
    } else if (archetype) {
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

  const startReplay = (sessionToReplay: DebateSession) => {
    setIsReplaying(true);
    setReplayIndex(0);
    setReplaySession(sessionToReplay);
    setSession({
      ...sessionToReplay,
      messages: [],
      status: 'running',
      currentTurn: 0,
      totalExplainerScore: 0,
      totalChallengerScore: 0,
    });
  };

  const nextReplayStep = async () => {
    if (!replaySession || replayIndex >= replaySession.messages.length) {
      setIsReplaying(false);
      setSession(prev => ({ ...prev, status: 'completed' }));
      return;
    }

    const nextMsg = replaySession.messages[replayIndex];
    
    // Skip user messages (the topic) in the step-by-step replay if it's the first one
    if (nextMsg.role === 'user' && replayIndex === 0) {
      setSession(prev => ({
        ...prev,
        messages: [nextMsg]
      }));
      setReplayIndex(prev => prev + 1);
      return;
    }

    if (nextMsg.role === 'explainer' || nextMsg.role === 'challenger') {
      setIsTyping(nextMsg.role);
      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsTyping(null);
      
      setSession(prev => {
        const newExplainerScore = nextMsg.role === 'challenger' ? prev.totalExplainerScore + (nextMsg.score || 0) : prev.totalExplainerScore;
        const newChallengerScore = nextMsg.role === 'explainer' ? prev.totalChallengerScore + (nextMsg.score || 0) : prev.totalChallengerScore;
        
        return {
          ...prev,
          messages: [...prev.messages, nextMsg],
          currentTurn: prev.currentTurn + 1,
          totalExplainerScore: newExplainerScore,
          totalChallengerScore: newChallengerScore,
        };
      });

      await speak(nextMsg.content, nextMsg.role, nextMsg.id);
    }

    setReplayIndex(prev => prev + 1);
    
    if (replayIndex + 1 >= replaySession.messages.length) {
      setTimeout(() => {
        setIsReplaying(false);
        setSession(prev => ({ ...prev, status: 'completed' }));
      }, 1000);
    }
  };

  const lastMessage = session.messages.length > 0 ? session.messages[session.messages.length - 1] : null;

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020202] text-white' : 'bg-slate-50 text-slate-900'} font-sans selection:bg-orange-500/30 overflow-hidden`}>
      {/* Header */}
      <header className={`fixed top-0 w-full z-50 transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020202]/80 border-white/5' : 'bg-white/80 border-slate-200'} backdrop-blur-xl border-b px-6 py-4 flex justify-between items-center`}>
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
          <a 
            href="https://blog.chanakya.ai" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 active:scale-95 rounded-xl transition-all duration-300 text-white/60 hover:text-white group"
            title="Read our Blog"
          >
            <BookOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Blog</span>
          </a>
          <button 
            onClick={toggleTheme}
            className={`p-2 rounded-xl transition-all duration-300 active:scale-90 ${theme === 'dark' ? 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10' : 'bg-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-300'}`}
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
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
            <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.08),transparent_70%)]' : 'bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.15),transparent_70%)]'} blur-3xl -z-10`} />
            
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
                className={`text-4xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] uppercase mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
              >
                Dual Agent <br />
                <span className="text-orange-500">Live Stage</span>
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`text-lg md:text-xl max-w-xl mx-auto font-medium tracking-tight ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}
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
                className={`relative w-full border rounded-[28px] px-8 py-6 text-xl focus:outline-none focus:border-orange-500/50 transition-all shadow-2xl backdrop-blur-sm ${
                  theme === 'dark' 
                    ? 'bg-white/[0.03] border-white/10 text-white placeholder:text-white/10' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-300'
                }`}
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
                          : theme === 'dark' 
                            ? 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-sm">{a.name}</div>
                      <div className="text-[10px] opacity-60">{a.description}</div>
                    </button>
                  ))}
                  <div
                    onClick={() => {
                      setExplainerArchetype('custom');
                      if (!customArchetypes.explainer) {
                        setTempCustomArchetype({ name: '', description: '', traits: '', style: '', domain: '' });
                        setShowCustomArchetypeModal('explainer');
                      }
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden cursor-pointer ${
                      explainerArchetype === 'custom' 
                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                        : theme === 'dark' 
                          ? 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-sm">{customArchetypes.explainer?.name || 'Custom Archetype'}</div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempCustomArchetype(customArchetypes.explainer || { name: '', description: '', traits: '', style: '', domain: '' });
                          setShowCustomArchetypeModal('explainer');
                        }}
                        className="p-1 hover:bg-blue-500/20 rounded-lg transition-colors"
                      >
                        <RefreshCcw className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[10px] opacity-60">{customArchetypes.explainer?.description || 'Define your own agent traits and style.'}</div>
                  </div>
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
                          : theme === 'dark'
                            ? 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-sm">{a.name}</div>
                      <div className="text-[10px] opacity-60">{a.description}</div>
                    </button>
                  ))}
                  <div
                    onClick={() => {
                      setChallengerArchetype('custom');
                      if (!customArchetypes.challenger) {
                        setTempCustomArchetype({ name: '', description: '', traits: '', style: '', domain: '' });
                        setShowCustomArchetypeModal('challenger');
                      }
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden cursor-pointer ${
                      challengerArchetype === 'custom' 
                        ? 'bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
                        : theme === 'dark'
                          ? 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-sm">{customArchetypes.challenger?.name || 'Custom Archetype'}</div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempCustomArchetype(customArchetypes.challenger || { name: '', description: '', traits: '', style: '', domain: '' });
                          setShowCustomArchetypeModal('challenger');
                        }}
                        className="p-1 hover:bg-purple-500/20 rounded-lg transition-colors"
                      >
                        <RefreshCcw className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[10px] opacity-60">{customArchetypes.challenger?.description || 'Define your own agent traits and style.'}</div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className={`border p-6 rounded-[32px] backdrop-blur-sm transition-colors duration-500 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-[10px] font-black uppercase tracking-[0.3em] ml-2 ${theme === 'dark' ? 'text-orange-500/60' : 'text-orange-600/60'}`}>Debate Length</span>
                  <span className="text-xl font-black text-orange-500">{maxTurns} Turns</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="20" 
                  step="2"
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(parseInt(e.target.value))}
                  className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-orange-500 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-200'}`}
                />
                <div className="flex justify-between mt-2 px-1">
                  <span className={`text-[9px] font-bold uppercase ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>Quick</span>
                  <span className={`text-[9px] font-bold uppercase ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>Deep Dive</span>
                </div>
              </div>

              <div className={`border p-6 rounded-[32px] backdrop-blur-sm transition-colors duration-500 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                <span className={`text-[10px] font-black uppercase tracking-[0.3em] block mb-4 ml-2 ${theme === 'dark' ? 'text-orange-500/60' : 'text-orange-600/60'}`}>Debate Language</span>
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLanguage(l.id)}
                      className={`py-3 rounded-2xl border font-bold text-xs transition-all duration-300 ${
                        language === l.id 
                          ? 'bg-orange-500 text-black border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.2)]' 
                          : theme === 'dark'
                            ? 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Gender Controls */}
              <div className={`border p-6 rounded-[32px] backdrop-blur-sm transition-colors duration-500 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                <span className={`text-[10px] font-black uppercase tracking-[0.3em] block mb-4 ml-2 ${theme === 'dark' ? 'text-blue-500/60' : 'text-blue-600/60'}`}>Paaro Voice</span>
                <div className={`flex p-1 rounded-2xl gap-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                  <button 
                    onClick={() => setExplainerGender('male')}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${explainerGender === 'male' ? 'bg-blue-500 text-black shadow-lg shadow-blue-500/20' : theme === 'dark' ? 'text-white/40 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-200'}`}
                  >Male</button>
                  <button 
                    onClick={() => setExplainerGender('female')}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${explainerGender === 'female' ? 'bg-blue-500 text-black shadow-lg shadow-blue-500/20' : theme === 'dark' ? 'text-white/40 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-200'}`}
                  >Female</button>
                </div>
              </div>

              <div className={`border p-6 rounded-[32px] backdrop-blur-sm transition-colors duration-500 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                <span className={`text-[10px] font-black uppercase tracking-[0.3em] block mb-4 ml-2 ${theme === 'dark' ? 'text-purple-500/60' : 'text-purple-600/60'}`}>Vinod Voice</span>
                <div className={`flex p-1 rounded-2xl gap-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                  <button 
                    onClick={() => setChallengerGender('male')}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${challengerGender === 'male' ? 'bg-purple-500 text-black shadow-lg shadow-purple-500/20' : theme === 'dark' ? 'text-white/40 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-200'}`}
                  >Male</button>
                  <button 
                    onClick={() => setChallengerGender('female')}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${challengerGender === 'female' ? 'bg-purple-500 text-black shadow-lg shadow-purple-500/20' : theme === 'dark' ? 'text-white/40 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-200'}`}
                  >Female</button>
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
                <div className={`flex items-center gap-3 text-xs font-black uppercase tracking-[0.3em] justify-center ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>
                  <History className="w-4 h-4" />
                  Past Sessions
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {history.map((h, i) => (
                    <div 
                      key={i}
                      className={`group relative border rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left shadow-lg hover:shadow-orange-500/5 ${
                        theme === 'dark' 
                          ? 'bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10' 
                          : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                      onClick={() => {
                        setSession(h);
                        setTopic('');
                      }}
                    >
                      <span className={`block truncate font-bold transition-colors ${theme === 'dark' ? 'text-white/80 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{h.topic}</span>
                      <div className="flex justify-between items-center mt-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-black tracking-widest ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>
                            {h.messages.length} Turns
                          </span>
                          {h.summary && (
                            <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-blue-500/20">
                              Summary
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              startReplay(h);
                            }}
                            className={`opacity-0 group-hover:opacity-100 p-1 transition-all ${theme === 'dark' ? 'hover:text-orange-400 text-white/40' : 'hover:text-orange-600 text-slate-400'}`}
                            title="Replay Debate"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          {h.summary && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSession(h);
                                setShowSummary(true);
                              }}
                              className={`opacity-0 group-hover:opacity-100 p-1 transition-all ${theme === 'dark' ? 'hover:text-blue-400 text-white/40' : 'hover:text-blue-600 text-slate-400'}`}
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
                            className={`opacity-0 group-hover:opacity-100 p-1 transition-all ${theme === 'dark' ? 'hover:text-red-500 text-white/40' : 'hover:text-red-500 text-slate-400'}`}
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
            <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-6 gap-6">
              
              {/* Moderator Banner (Nova) */}
              <AnimatePresence>
                {session.messages.some(m => m.content.startsWith('[Moderator Nova]')) && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className={`p-4 rounded-[24px] border border-orange-500/20 bg-orange-500/5 backdrop-blur-md flex items-center gap-4 mb-2 shadow-[0_0_40px_rgba(249,115,22,0.05)]`}
                  >
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/40 shrink-0">
                      <Mic2 className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 mb-1">Moderator Nova</div>
                      <div className={`text-sm font-medium leading-relaxed ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>
                        {session.messages.filter(m => m.content.startsWith('[Moderator Nova]')).pop()?.content.replace('[Moderator Nova]: ', '')}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              {/* Explainer Card */}
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                animate={{ 
                  opacity: (speakingAgent === 'challenger' || isTyping === 'challenger') ? 0.4 : 1,
                  x: 0,
                  scale: speakingAgent === 'explainer' || isTyping === 'explainer' ? 1.02 : 1,
                  y: [0, -4, 0]
                }}
                whileHover={{ scale: 1.03, y: -8 }}
                transition={{ 
                  opacity: { duration: 0.6 },
                  x: { duration: 0.6 },
                  scale: { duration: 0.4 },
                  y: { repeat: Infinity, duration: 4, ease: "easeInOut" }
                }}
                className={`relative flex flex-col items-center justify-center rounded-[32px] border transition-all duration-700 overflow-hidden ${
                  speakingAgent === 'explainer' || isTyping === 'explainer'
                    ? 'bg-blue-500/[0.03] border-blue-500/30 shadow-[0_0_80px_rgba(59,130,246,0.15)]'
                    : theme === 'dark'
                      ? 'bg-white/[0.02] border-white/5'
                      : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="absolute top-6 left-8 flex flex-col">
                  <span className={`text-[9px] font-black uppercase tracking-[0.4em] mb-1 ${theme === 'dark' ? 'text-blue-500/50' : 'text-blue-600/60'}`}>
                    {EXPLAINER_ARCHETYPES.find(a => a.id === session.explainerArchetype)?.name || 'Module 01'}
                  </span>
                  <h3 className={`text-2xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white/90' : 'text-slate-900'}`}>
                    {session.explainerArchetype === 'paaro' ? 'Paaro' : 'Explainer'}
                  </h3>
                </div>
                
                <div className="absolute top-6 right-8 text-right">
                  <span className={`text-[9px] font-black uppercase tracking-[0.4em] mb-1 block ${theme === 'dark' ? 'text-white/10' : 'text-slate-300'}`}>Score</span>
                  <span className={`text-3xl font-black font-mono ${theme === 'dark' ? 'text-blue-400/80' : 'text-blue-600'}`}>{session.totalExplainerScore}</span>
                </div>

                <AgentAvatar 
                  role="explainer" 
                  isSpeaking={speakingAgent === 'explainer'} 
                  isTyping={isTyping === 'explainer'} 
                  theme={theme} 
                />

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
                  y: [0, -4, 0]
                }}
                whileHover={{ scale: 1.03, y: -8 }}
                transition={{ 
                  opacity: { duration: 0.6 },
                  x: { duration: 0.6 },
                  scale: { duration: 0.4 },
                  y: { repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.5 }
                }}
                className={`relative flex flex-col items-center justify-center rounded-[32px] border transition-all duration-700 overflow-hidden ${
                  speakingAgent === 'challenger' || isTyping === 'challenger'
                    ? 'bg-purple-500/[0.03] border-purple-500/30 shadow-[0_0_80px_rgba(168,85,247,0.15)]'
                    : theme === 'dark'
                      ? 'bg-white/[0.02] border-white/5'
                      : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="absolute top-6 left-8 flex flex-col">
                  <span className={`text-[9px] font-black uppercase tracking-[0.4em] mb-1 ${theme === 'dark' ? 'text-purple-500/50' : 'text-purple-600/60'}`}>
                    {CHALLENGER_ARCHETYPES.find(a => a.id === session.challengerArchetype)?.name || 'Module 02'}
                  </span>
                  <h3 className={`text-2xl font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-white/90' : 'text-slate-900'}`}>
                    {session.challengerArchetype === 'vinod' ? 'Vinod' : 'Challenger'}
                  </h3>
                </div>

                <div className="absolute top-6 right-8 text-right">
                  <span className={`text-[9px] font-black uppercase tracking-[0.4em] mb-1 block ${theme === 'dark' ? 'text-white/10' : 'text-slate-300'}`}>Score</span>
                  <span className={`text-3xl font-black font-mono ${theme === 'dark' ? 'text-purple-400/80' : 'text-purple-600'}`}>{session.totalChallengerScore}</span>
                </div>

                <AgentAvatar 
                  role="challenger" 
                  isSpeaking={speakingAgent === 'challenger'} 
                  isTyping={isTyping === 'challenger'} 
                  theme={theme} 
                />

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
          </div>

            {/* Live Transcript Panel */}
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className={`h-64 border-t p-6 relative backdrop-blur-sm transition-colors duration-500 ${theme === 'dark' ? 'bg-white/[0.01] border-white/5' : 'bg-white border-slate-200'}`}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-black px-5 py-1.5 rounded-full font-black text-[10px] uppercase tracking-[0.3em] shadow-xl border border-orange-400/50">
                Live Feed
              </div>
              
              <div className="h-full grid grid-cols-2 gap-8 overflow-hidden">
                {/* Explainer Column */}
                <div className="flex flex-col h-full">
                  <div className={`flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-blue-400/60' : 'text-blue-600/60'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Explainer Log
                  </div>
                  <div 
                    ref={explainerScrollRef}
                    className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide"
                  >
                    <AnimatePresence mode="popLayout">
                      {session.messages.filter(m => m.role === 'explainer').map((msg) => {
                        const scoreInfo = getScoreReceived(msg, session);
                        const nextMsg = session.messages[session.messages.indexOf(msg) + 1];
                        const isRevealed = nextMsg ? revealedScoreIds.has(nextMsg.id) : false;
                        
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                            whileHover={{ x: 5, scale: 1.01 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className={`border p-4 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md ${theme === 'dark' ? 'bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/10' : 'bg-blue-50 border-blue-100 hover:bg-blue-100/50'} ${currentlySpeakingMessageId === msg.id ? 'ring-2 ring-yellow-400/50' : ''}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>Turn {session.messages.indexOf(msg)}</span>
                            </div>
                            <WordHighlighter text={msg.content} isSpeaking={currentlySpeakingMessageId === msg.id} theme={theme} />
                            {scoreInfo && (
                              <StrengthMeter score={scoreInfo.score || 0} reason={scoreInfo.reason} theme={theme} isRevealed={isRevealed} />
                            )}
                          </motion.div>
                        );
                      })}
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
                  <div className={`flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-purple-400/60' : 'text-purple-600/60'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    Challenger Log
                  </div>
                  <div 
                    ref={challengerScrollRef}
                    className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide"
                  >
                    <AnimatePresence mode="popLayout">
                      {session.messages.filter(m => m.role === 'challenger').map((msg) => {
                        const scoreInfo = getScoreReceived(msg, session);
                        const nextMsg = session.messages[session.messages.indexOf(msg) + 1];
                        const isRevealed = nextMsg ? revealedScoreIds.has(nextMsg.id) : false;

                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                            whileHover={{ x: -5, scale: 1.01 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className={`border p-4 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md ${theme === 'dark' ? 'bg-purple-500/5 border-purple-500/10 hover:bg-purple-500/10' : 'bg-purple-50 border-purple-100 hover:bg-purple-100/50'} ${currentlySpeakingMessageId === msg.id ? 'ring-2 ring-yellow-400/50' : ''}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>Turn {session.messages.indexOf(msg)}</span>
                            </div>
                            <WordHighlighter text={msg.content} isSpeaking={currentlySpeakingMessageId === msg.id} theme={theme} />
                            {scoreInfo && (
                              <StrengthMeter score={scoreInfo.score || 0} reason={scoreInfo.reason} theme={theme} isRevealed={isRevealed} />
                            )}
                          </motion.div>
                        );
                      })}
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
                    {isReplaying ? (
                      <button 
                        onClick={nextReplayStep}
                        className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-black rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg active:scale-95"
                      >
                        <ChevronRight className="w-4 h-4" />
                        Next Step
                      </button>
                    ) : (
                      <>
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
                      </>
                    )}
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
            <div className={`backdrop-blur-2xl border px-10 py-3 rounded-full shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200'}`}>
              <span className={`text-[9px] font-black uppercase tracking-[0.5em] block text-center mb-1 ${theme === 'dark' ? 'text-orange-500/60' : 'text-orange-600/60'}`}>Session Subject</span>
              <h2 className={`text-lg font-black uppercase tracking-tight text-center ${theme === 'dark' ? 'text-white/90' : 'text-slate-900'}`}>{session.topic}</h2>
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
      <footer className={`border-t backdrop-blur-xl py-8 px-6 mt-auto transition-colors duration-500 ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-orange-500" />
              <span className={`text-sm font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Chanakya AI</span>
            </div>
            <p className={`text-[10px] font-medium uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>© 2026 Chanakya AI. All rights reserved.</p>
          </div>

          <div className="flex items-center gap-8">
            <button 
              onClick={() => setShowTerms(true)}
              className={`text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all duration-300 ${theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
            >
              Terms & Conditions
            </button>
            <div className={`flex items-center gap-4 border-l pl-8 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <a href="#" className={`active:scale-90 transition-all duration-300 hover:scale-110 ${theme === 'dark' ? 'text-white/40 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600'}`}><Twitter className="w-4 h-4" /></a>
              <a href="#" className={`active:scale-90 transition-all duration-300 hover:scale-110 ${theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}><Github className="w-4 h-4" /></a>
              <a href="#" className={`active:scale-90 transition-all duration-300 hover:scale-110 ${theme === 'dark' ? 'text-white/40 hover:text-blue-600' : 'text-slate-400 hover:text-blue-800'}`}><Linkedin className="w-4 h-4" /></a>
              <a href="#" className={`active:scale-90 transition-all duration-300 hover:scale-110 ${theme === 'dark' ? 'text-white/40 hover:text-pink-500' : 'text-slate-400 hover:text-pink-600'}`}><Instagram className="w-4 h-4" /></a>
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
              className={`relative w-full max-w-2xl border rounded-[32px] overflow-hidden shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-slate-200'}`}
            >
              <div className={`p-8 border-b flex justify-between items-center transition-colors duration-500 ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                    <Trophy className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Debate Summary</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Session Analysis</p>
                  </div>
                </div>
                <button onClick={() => setShowSummary(false)} className={`p-2 rounded-full transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-white/40 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}>
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
                  <div className={`prose prose-sm max-w-none ${theme === 'dark' ? 'prose-invert' : 'prose-slate'}`}>
                    <div className={`border rounded-2xl p-6 mb-6 transition-colors duration-500 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <span className={`text-[10px] font-black uppercase tracking-[0.3em] block mb-4 ${theme === 'dark' ? 'text-orange-500/60' : 'text-orange-600/60'}`}>Topic</span>
                      <h4 className={`text-lg font-bold ${theme === 'dark' ? 'text-white/90' : 'text-slate-800'}`}>{session.topic}</h4>
                    </div>
                    <div className={`font-medium leading-relaxed ${theme === 'dark' ? 'text-white/70' : 'text-slate-600'}`}>
                      <Markdown>{session.summary}</Markdown>
                    </div>
                  </div>
                ) : (
                  <div className={`text-center py-20 uppercase font-black tracking-widest text-xs ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`}>
                    No summary available for this session.
                  </div>
                )}
              </div>

              <div className={`p-8 border-t flex gap-4 transition-colors duration-500 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <button 
                  onClick={() => setShowSummary(false)}
                  className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
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

      {/* Custom Archetype Modal */}
      <AnimatePresence>
        {showCustomArchetypeModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomArchetypeModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={`relative w-full max-w-xl border rounded-[32px] overflow-hidden shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-slate-200'}`}
            >
              <div className={`p-8 border-b flex justify-between items-center transition-colors duration-500 ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${showCustomArchetypeModal === 'explainer' ? 'bg-blue-500 text-black' : 'bg-purple-500 text-black'}`}>
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Custom {showCustomArchetypeModal === 'explainer' ? 'Explainer' : 'Challenger'}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Define Agent DNA</p>
                  </div>
                </div>
                <button onClick={() => setShowCustomArchetypeModal(null)} className={`p-2 rounded-full transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-white/40 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Archetype Name</label>
                  <input 
                    type="text"
                    value={tempCustomArchetype.name}
                    onChange={(e) => setTempCustomArchetype(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Grumpy Professor"
                    className={`w-full px-5 py-3 rounded-2xl border transition-all focus:outline-none focus:border-orange-500/50 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Short Description</label>
                  <input 
                    type="text"
                    value={tempCustomArchetype.description}
                    onChange={(e) => setTempCustomArchetype(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g. Highly critical and values precision above all."
                    className={`w-full px-5 py-3 rounded-2xl border transition-all focus:outline-none focus:border-orange-500/50 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Key Traits</label>
                    <textarea 
                      value={tempCustomArchetype.traits}
                      onChange={(e) => setTempCustomArchetype(prev => ({ ...prev, traits: e.target.value }))}
                      placeholder="e.g. Impatient, brilliant, uses analogies"
                      className={`w-full px-5 py-3 rounded-2xl border transition-all focus:outline-none focus:border-orange-500/50 h-24 resize-none ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Speaking Style</label>
                    <textarea 
                      value={tempCustomArchetype.style}
                      onChange={(e) => setTempCustomArchetype(prev => ({ ...prev, style: e.target.value }))}
                      placeholder="e.g. Academic, dry humor, very formal"
                      className={`w-full px-5 py-3 rounded-2xl border transition-all focus:outline-none focus:border-orange-500/50 h-24 resize-none ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Knowledge Domain</label>
                  <input 
                    type="text"
                    value={tempCustomArchetype.domain}
                    onChange={(e) => setTempCustomArchetype(prev => ({ ...prev, domain: e.target.value }))}
                    placeholder="e.g. Quantum Physics, Renaissance Art"
                    className={`w-full px-5 py-3 rounded-2xl border transition-all focus:outline-none focus:border-orange-500/50 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  />
                </div>
              </div>

              <div className={`p-8 border-t flex gap-4 transition-colors duration-500 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <button 
                  onClick={() => setShowCustomArchetypeModal(null)}
                  className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (showCustomArchetypeModal) {
                      setCustomArchetypes(prev => ({
                        ...prev,
                        [showCustomArchetypeModal]: { ...tempCustomArchetype }
                      }));
                      setShowCustomArchetypeModal(null);
                    }
                  }}
                  disabled={!tempCustomArchetype.name || !tempCustomArchetype.description}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 active:scale-[0.98] text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-orange-500/20"
                >
                  Save Archetype
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
              className={`relative w-full max-w-2xl border rounded-[32px] overflow-hidden shadow-2xl transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-slate-200'}`}
            >
              <div className={`p-8 border-b flex justify-between items-center transition-colors duration-500 ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                <h3 className={`text-xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Terms & Conditions</h3>
                <button onClick={() => setShowTerms(false)} className={`p-2 rounded-full transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-white/40 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className={`p-8 max-h-[60vh] overflow-y-auto space-y-6 font-medium leading-relaxed transition-colors duration-500 ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>
                <section>
                  <h4 className={`font-black uppercase tracking-widest text-xs mb-2 ${theme === 'dark' ? 'text-orange-500' : 'text-orange-600'}`}>1. Acceptance of Terms</h4>
                  <p>By using Chanakya AI, you agree to be bound by these Terms and Conditions. Our platform uses advanced AI models to simulate debates and educational content.</p>
                </section>
                <section>
                  <h4 className={`font-black uppercase tracking-widest text-xs mb-2 ${theme === 'dark' ? 'text-orange-500' : 'text-orange-600'}`}>2. AI Content Disclaimer</h4>
                  <p>Content generated by Chanakya AI is for educational and entertainment purposes only. While we strive for accuracy, AI models may produce incorrect or biased information.</p>
                </section>
                <section>
                  <h4 className={`font-black uppercase tracking-widest text-xs mb-2 ${theme === 'dark' ? 'text-orange-500' : 'text-orange-600'}`}>3. User Conduct</h4>
                  <p>Users are expected to interact with the platform in a respectful manner. Any abuse of the voice command system or AI agents is strictly prohibited.</p>
                </section>
                <section>
                  <h4 className={`font-black uppercase tracking-widest text-xs mb-2 ${theme === 'dark' ? 'text-orange-500' : 'text-orange-600'}`}>4. Privacy</h4>
                  <p>We value your privacy. Your debate history is stored locally on your device and is not shared with third parties, except for the necessary data sent to AI models for processing.</p>
                </section>
              </div>
              <div className={`p-8 border-t transition-colors duration-500 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
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
