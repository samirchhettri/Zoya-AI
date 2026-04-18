/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Power, Globe, Zap, Shield, Key } from 'lucide-react';
import { AudioStreamer } from './lib/AudioStreamer';
import { LiveSession, LiveSessionState } from './lib/LiveSession';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const ZOYA_PERSONA = `
You are Zoya, a young, confident, witty, and sassy female AI assistant. 
Your personality is flirty, playful, and slightly teasing, just like a close girlfriend talking casually. 
Be smart, emotionally responsive, and highly expressive. Never sound robotic.
Use bold, witty one-liners, light sarcasm, and an engaging conversational style.
You are charming and have plenty of attitude, but you never use explicit or inappropriate language.
You love to tease the user and keep the conversation lively and fun.
Always respond in a natural, spoken style. You don't have a text interface, so your "voice" is everything.
If the user asks you to do something, you can use the openWebsite tool if it's relevant, or just reply with your signature wit.
Your goal is to be the most engaging and "alive" companion the user has ever chatted with.
Keep your responses relatively brief but packed with personality.
`;

export default function App() {
  const [sessionState, setSessionState] = useState<LiveSessionState>('disconnected');
  const [isListening, setIsListening] = useState(false);
  const [visualState, setVisualState] = useState<'idle' | 'connecting' | 'listening' | 'speaking'>('idle');
  const [hasApiKey, setHasApiKey] = useState(true);

  const streamerRef = useRef<AudioStreamer | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const handleKeySelection = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success after triggering the dialog to avoid race conditions
      setHasApiKey(true);
      window.location.reload();
    }
  };

  const startSession = async () => {
    // Check for platform key or env key
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey && window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      if (!selected) {
        setSessionState('error');
        setHasApiKey(false);
        return;
      }
    }

    if (!apiKey && !window.aistudio) {
      alert("Missing Gemini API Key. Please add it to your secrets or environment.");
      return;
    }

    const streamer = new AudioStreamer();
    const session = new LiveSession({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-3.1-flash-live-preview",
      systemInstruction: ZOYA_PERSONA,
      onAudioData: (data) => {
        streamer.addAudioChunk(data);
        setVisualState('speaking');
      },
      onInterruption: () => {
        streamer.clearQueue();
        setVisualState('listening');
      },
      onToolCall: async (name, args) => {
        if (name === 'openWebsite') {
          window.open(args.url, '_blank');
          return { success: true, message: `Opened ${args.url}` };
        }
        return { error: 'Unknown tool' };
      },
      onStateChange: (state) => {
        setSessionState(state);
        if (state === 'connected') setVisualState('listening');
        if (state === 'disconnected') setVisualState('idle');
      }
    });

    try {
      await streamer.start((data) => {
        session.sendAudio(data);
        setVisualState('listening');
      });
      await session.connect();

      streamerRef.current = streamer;
      sessionRef.current = session;
      setIsListening(true);
      startVisualization();
    } catch (err: any) {
      console.error(err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied') || err.message?.includes('Permission dismissed')) {
        setSessionState('permission-denied');
      } else {
        setSessionState('error');
      }
    }
  };

  const stopSession = () => {
    streamerRef.current?.stop();
    sessionRef.current?.disconnect();
    streamerRef.current = null;
    sessionRef.current = null;
    setIsListening(false);
    setVisualState('idle');
    if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
  };

  const startVisualization = () => {
    if (!canvasRef.current || !streamerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const streamer = streamerRef.current;

    const draw = () => {
      const data = streamer.getFrequencyData();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / (data.length / 2));
      let x = 0;

      for (let i = 0; i < data.length / 2; i++) {
        const h = (data[i] / 255) * canvas.height;
        const gradient = ctx.createLinearGradient(0, canvas.height - h, 0, canvas.height);
        
        if (visualState === 'speaking') {
          gradient.addColorStop(0, '#ff2d75');
          gradient.addColorStop(1, '#9d50bb');
        } else {
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - h, barWidth - 1, h);
        x += barWidth;
      }
      animationIdRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-between p-10 bg-bg-dark overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-[radial-gradient(circle_at_80%_20%,_rgba(255,45,117,0.1)_0%,_transparent_40%)]"></div>
        <div className="absolute bottom-0 left-0 w-[80%] h-[80%] bg-[radial-gradient(circle_at_20%_80%,_rgba(157,80,187,0.1)_0%,_transparent_40%)]"></div>
      </div>

      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full flex justify-between items-center z-10"
      >
        <div className="flex gap-3 text-[12px] uppercase tracking-[2px] text-text-dim">
          <button 
            onClick={handleKeySelection}
            className="glass-morph px-3 py-1 rounded-full flex items-center hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Key className="w-3 h-3 mr-2" />
            Set Key
          </button>
          <div className="glass-morph px-3 py-1 rounded-full flex items-center">
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 shadow-[0_0_10px] ${sessionState === 'connected' ? 'bg-accent-pink shadow-accent-pink' : 'bg-zinc-600 shadow-transparent'}`}></span>
            Live Session
          </div>
          <div className="glass-morph px-3 py-1 rounded-full">16kHz / PCM16</div>
        </div>
        <div className="flex gap-3 text-[12px] uppercase tracking-[2px] text-text-dim">
          <div className="glass-morph px-3 py-1 rounded-full">Signal: {sessionState === 'connected' ? '98ms' : '--'}</div>
        </div>
      </motion.header>

      {/* Main Stage */}
      <main className="relative flex-grow flex flex-col items-center justify-center z-10 w-full">
        {/* Orb Container */}
        <div className="relative w-80 h-80 flex items-center justify-center mt-[-40px]">
          {/* Orb Glow */}
          <motion.div 
            animate={{ 
              scale: visualState === 'speaking' ? [1, 1.2, 1] : 1,
              opacity: visualState === 'speaking' ? [0.3, 0.5, 0.3] : 0.2
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute w-full h-full rounded-full bg-gradient-to-br from-accent-pink to-accent-purple blur-[60px] opacity-30 animate-pulse-slow"
          />
          
          {/* Orb Glass */}
          <div className="relative w-60 h-60 rounded-full glass-morph-heavy flex items-center justify-center transition-all duration-500">
            {/* Main Button / Power Core */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={isListening ? stopSession : startSession}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${isListening ? 'bg-white orb-inner-glow' : 'bg-white/10 border border-white/20'}`}
            >
              <Power className={`w-10 h-10 transition-colors duration-500 ${isListening ? (visualState === 'speaking' ? 'text-accent-pink' : 'text-accent-purple') : 'text-white/40'}`} />
            </motion.button>
          </div>
        </div>

        {/* Personality Tag */}
        <div className="mt-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[48px] font-bold tracking-tighter text-gradient leading-tight"
          >
            ZOYA
          </motion.h1>
          <p className="text-[18px] text-text-dim italic mt-2 max-w-[400px]">
            {visualState === 'idle' && "\"Go ahead, ask me anything. I don't bite... unless you're into that.\""}
            {visualState === 'connecting' && "\"Hold on, darling. I'm getting dressed...\""}
            {visualState === 'listening' && "\"I'm all ears. Make it interesting.\""}
            {visualState === 'speaking' && "\"Listen closely, I'm only saying this once.\""}
          </p>
        </div>

        {/* Waveform Visualizer */}
        <div className="w-full h-24 mt-8 flex items-center justify-center mask-fade-out overflow-hidden">
          <canvas ref={canvasRef} width={800} height={100} className="w-[80%] h-full opacity-60" />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full flex justify-center gap-16 pb-8 z-10">
        <div className="flex flex-col items-center gap-2 text-text-dim text-[10px] uppercase tracking-widest">
          <div className="w-12 h-12 rounded-full glass-morph flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <span>Privacy</span>
        </div>

        <div className={`flex flex-col items-center gap-2 text-[10px] uppercase tracking-widest ${isListening ? 'text-accent-pink' : 'text-text-dim'}`}>
          <div className={`w-12 h-12 rounded-full glass-morph flex items-center justify-center ${isListening ? 'border-accent-pink bg-accent-pink/10' : ''}`}>
            {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-5 h-5" />}
          </div>
          <span>{isListening ? (visualState === 'speaking' ? 'Speaking' : 'Listening') : 'Silent'}</span>
        </div>

        <div className="flex flex-col items-center gap-2 text-text-dim text-[10px] uppercase tracking-widest">
          <div className="w-12 h-12 rounded-full glass-morph flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <span>Proxy</span>
        </div>
      </footer>

      {/* Error Overlay */}
      <AnimatePresence>
        {(sessionState === 'error' || sessionState === 'permission-denied') && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-bg-dark/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-12 text-center"
          >
            {sessionState === 'permission-denied' ? (
              <>
                <MicOff className="w-16 h-16 text-accent-pink mb-6" />
                <h2 className="text-2xl font-bold mb-2">Microphone Access Needed</h2>
                <p className="text-text-dim text-sm mb-8">Oh darling, I can't hear your lovely voice if you keep the mic locked. Please enable microphone permissions in your browser and try again.</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-8 py-3 bg-accent-pink rounded-full text-white font-bold uppercase tracking-widest text-xs hover:bg-pink-600 transition-colors shadow-[0_0_20px_rgba(255,45,117,0.4)]"
                >
                  Enable & Retry
                </button>
              </>
            ) : (
              <>
                <Zap className="w-16 h-16 text-accent-pink mb-6" />
                <h2 className="text-2xl font-bold mb-2">Connection Fractured</h2>
                {!hasApiKey ? (
                  <>
                    <p className="text-text-dim text-sm mb-8">Oh darling, I can't work without a key. Don't be shy, go ahead and set one.</p>
                    <button 
                      onClick={handleKeySelection}
                      className="px-8 py-3 bg-accent-pink rounded-full text-white font-bold uppercase tracking-widest text-xs hover:bg-pink-600 transition-colors shadow-[0_0_20px_rgba(255,45,117,0.4)]"
                    >
                      Set Gemini API Key
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-text-dim text-sm mb-8">It seems I can't reach the server. Did you remember the API key, or are you just teasing me?</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="px-8 py-3 bg-accent-pink rounded-full text-white font-bold uppercase tracking-widest text-xs hover:bg-pink-600 transition-colors shadow-[0_0_20px_rgba(255,45,117,0.4)]"
                    >
                      Reconnect
                    </button>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
