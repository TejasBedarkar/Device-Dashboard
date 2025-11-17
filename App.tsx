import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AppState, LaptopSpecs } from './types';
import { GEMINI_MODEL, MOCK_SCAN_DURATION_MS, SYSTEM_INSTRUCTION } from './constants';
import { base64ToUint8Array, createAudioBlob, decodeAudioData } from './services/audioUtils';
import Visualizer from './components/Visualizer';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(process.env.API_KEY || '');
  const [specs, setSpecs] = useState<LaptopSpecs | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState<boolean>(false);
  const [aiCaption, setAiCaption] = useState<string>("Click the microphone to ask about specs, price, battery, or weight");

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  // Hardware Discovery
  const discoverHardware = (): LaptopSpecs => {
    let gpuRenderer = 'Integrated Graphics';
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuRenderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
      }
    } catch (e) {}

    gpuRenderer = gpuRenderer.replace(/angle \((.+)\)/i, '$1').replace(/direct3d11 vs_5_0 ps_5_0/i, '');

    const now = new Date();
    const platform = navigator.platform;
    
    let estimatedWeight = "Unknown";
    let estimatedPrice = "Unknown";
    let estimatedBattery = "Unknown";
    let modelGuess = "Generic PC";

    if (platform.includes('Mac')) {
        modelGuess = "MacBook Pro / Air";
        estimatedWeight = "1.24 kg - 1.6 kg";
        estimatedPrice = "$1299 - $2499";
        estimatedBattery = "58.2 Wh Li-Poly";
    } else if (gpuRenderer.includes('NVIDIA') || gpuRenderer.includes('Radeon')) {
        modelGuess = "Gaming Laptop";
        estimatedWeight = "2.1 kg - 2.5 kg";
        estimatedPrice = "$1100 - $3000";
        estimatedBattery = "90 Wh (4-Cell)";
    } else {
        modelGuess = "Business Laptop";
        estimatedWeight = "1.3 kg - 1.5 kg";
        estimatedPrice = "$600 - $1200";
        estimatedBattery = "45 Wh Li-ion";
    }

    return {
      modelName: modelGuess,
      os: navigator.userAgent.includes('Win') ? 'Windows' : (navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux'),
      processor: `${navigator.hardwareConcurrency} Cores`,
      ram: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB+` : '8GB (Est)',
      gpu: gpuRenderer,
      resolution: `${window.screen.width}x${window.screen.height}`,
      browser: 'Chrome / Blink',
      weight: estimatedWeight,
      price: estimatedPrice,
      battery: estimatedBattery,
      timestamp: now.toLocaleString(),
    };
  };

  const startSystem = async () => {
    if (!apiKey) {
      setErrorMsg("API Key is missing.");
      return;
    }
    setAppState(AppState.INITIALIZING);
    setAiCaption("Initializing secure connection...");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const audioCtxInput = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const audioCtxOutput = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = audioCtxInput;
      outputAudioContextRef.current = audioCtxOutput;

      const analyserIn = audioCtxInput.createAnalyser();
      analyserIn.fftSize = 256;
      inputAnalyserRef.current = analyserIn;

      const analyserOut = audioCtxOutput.createAnalyser();
      analyserOut.fftSize = 256;
      outputAnalyserRef.current = analyserOut;

      const ai = new GoogleGenAI({ apiKey });
      const sessionPromise = ai.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
        callbacks: {
          onopen: () => {
            const source = audioCtxInput.createMediaStreamSource(stream);
            const processor = audioCtxInput.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: createAudioBlob(inputData) }));
            };
            source.connect(analyserIn);
            analyserIn.connect(processor);
            processor.connect(audioCtxInput.destination);

            startVideoStreaming();
            setAppState(AppState.SCANNING);
            setAiCaption("Scanning hardware...");
            
            setTimeout(() => {
              const detectedSpecs = discoverHardware();
              setSpecs(detectedSpecs);
              setAppState(AppState.DASHBOARD);
              setIsAiPanelOpen(true);
              setAiCaption("Scan complete. AI is ready.");

              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({
                    content: {
                        parts: [{
                            text: `SYSTEM SCAN COMPLETE. Detected Specs: ${JSON.stringify(detectedSpecs)}. Explain these to the user now.`
                        }]
                    }
                });
              });
            }, MOCK_SCAN_DURATION_MS);
          },
          onmessage: async (msg: LiveServerMessage) => {
             const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio) {
               const audioData = base64ToUint8Array(base64Audio);
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtxOutput.currentTime);
               const audioBuffer = await decodeAudioData(audioData, audioCtxOutput, 24000, 1);
               const source = audioCtxOutput.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(analyserOut);
               analyserOut.connect(audioCtxOutput.destination);
               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
             }
          },
          onclose: () => setAppState(AppState.IDLE),
          onerror: (err) => {
            setAppState(AppState.ERROR);
            setErrorMsg("Connection Error");
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err) {
      setAppState(AppState.ERROR);
      setErrorMsg("Camera/Microphone access required.");
    }
  };

  const startVideoStreaming = () => {
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    videoIntervalRef.current = window.setInterval(() => {
      if (!videoRef.current || !canvasRef.current || !sessionPromiseRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx && video.videoWidth > 0) {
        canvas.width = video.videoWidth * 0.25;
        canvas.height = video.videoHeight * 0.25;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        sessionPromiseRef.current.then(session => 
          session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64Data } })
        );
      }
    }, 1000);
  };

  const sendTextPrompt = (text: string) => {
      sessionPromiseRef.current?.then(session => {
          session.sendRealtimeInput({ content: { parts: [{ text }] } });
          setAiCaption(`Asking about: ${text}...`);
      });
  };

  return (
    <>
      {/* Background Elements */}
      <div className="bg-gradient"></div>
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>
      <div className="grid-overlay"></div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header>
        <div className="container">
            <nav className="glass">
                <div className="logo">
                    <div className="logo-icon">
                        <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                        </svg>
                    </div>
                    <span>TechSpecs Pro</span>
                </div>
            </nav>
        </div>
      </header>

      {/* Main Container */}
      <div className="container" style={{ paddingBottom: '150px' }}>
        <section className="dashboard-header glass">
            {(appState === AppState.DASHBOARD || appState === AppState.ACTIVE || appState === AppState.SCANNING) && (
                <div className="stats-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    Live Specifications
                </div>
            )}
            <h1>Device Dashboard</h1>
            <p>Real-time hardware specifications with intelligent voice assistant integration</p>
        </section>

        {/* Start Screen */}
        {appState === AppState.IDLE && (
             <div className="start-screen">
                <div className="glass start-card text-center">
                    {!process.env.API_KEY && (
                        <input 
                            type="password" 
                            value={apiKey} 
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="Enter Gemini API Key"
                            className="api-input"
                        />
                    )}
                    <button 
                        onClick={startSystem}
                        className="ai-btn primary"
                        style={{ padding: '18px', fontSize: '16px' }}
                    >
                        INITIALIZE SYSTEM
                    </button>
                </div>
             </div>
        )}

        {/* Error State */}
        {appState === AppState.ERROR && (
            <div className="start-screen">
                <div className="glass start-card text-center" style={{ borderColor: 'rgba(239, 68, 68, 0.5)' }}>
                    <h3 style={{ color: '#fca5a5', fontSize: '20px', marginBottom: '8px' }}>System Error</h3>
                    <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px' }}>{errorMsg}</p>
                    <button onClick={() => window.location.reload()} className="ai-btn">Reboot System</button>
                </div>
            </div>
        )}

        {/* Scanning Indicator */}
        {appState === AppState.SCANNING && (
            <div className="specs-grid">
                <div className="spec-card glass text-center" style={{ animation: 'pulse 1.5s infinite' }}>
                    <h3>Scanning Hardware...</h3>
                </div>
            </div>
        )}

        {/* Dashboard Grid */}
        {(appState === AppState.DASHBOARD || appState === AppState.ACTIVE) && (
            <Dashboard specs={specs} />
        )}
      </div>

      {/* AI Voice Assistant Popup */}
      {(appState === AppState.DASHBOARD || appState === AppState.ACTIVE || appState === AppState.SCANNING) && (
          <div className="ai-assistant">
            <button className="ai-toggle" onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}>
                {isAiPanelOpen ? (
                     <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                )}
            </button>
            
            <div className={`ai-panel glass ${isAiPanelOpen ? 'active' : ''}`}>
                <div className="ai-header">
                    <div className="ai-avatar">
                        <video 
                            ref={videoRef} 
                            style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                opacity: 0.7
                            }} 
                            muted 
                            playsInline 
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                    </div>
                    <div className="ai-info">
                        <h3>TechSpecs AI</h3>
                        <div className="ai-status">
                            <div className="ai-status-dot"></div>
                            <span>Online</span>
                        </div>
                    </div>
                </div>
                
                <div className="ai-body">
                    <div className="ai-message">
                        {aiCaption}
                    </div>
                    
                    <div className="ai-controls">
                        <button className="ai-btn" onClick={() => sendTextPrompt("Explain the specifications briefly.")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                            </svg>
                            Specs
                        </button>
                        <button className="ai-btn" onClick={() => sendTextPrompt("What is the estimated market price for this laptop?")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                            </svg>
                            Price
                        </button>
                    </div>
                    
                    <div className={`ai-microphone ${appState === AppState.ACTIVE || appState === AppState.DASHBOARD ? 'active' : ''}`}>
                        {/* Visualizer Layer */}
                        {outputAnalyserRef.current && (
                            <Visualizer analyser={outputAnalyserRef.current} isActive={true} accentColor="#ffffff" />
                        )}
                        {/* Icon Layer */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={{ position: 'relative', zIndex: 10 }}>
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                        </svg>
                    </div>
                    
                    <div className={`ai-captions ${appState === AppState.ACTIVE || appState === AppState.DASHBOARD ? 'active' : ''}`}>
                         Listening...
                    </div>
                </div>
                
                <div className="ai-footer">
                    Voice commands: "specs", "price", "battery", "weight"
                </div>
            </div>
          </div>
      )}

      {/* Footer */}
      <footer className="glass">
        <div className="container">
            <div className="footer-links">
                <a href="#">About</a>
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
                <a href="#">Support</a>
                <a href="#">Documentation</a>
            </div>
            <div className="copyright">
                © 2025 TechSpecs Pro. Powered by next-generation web technologies.
            </div>
        </div>
      </footer>
    </>
  );
};

export default App;