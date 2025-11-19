import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AppState, LaptopSpecs, FullLaptopSpecs } from './types';
import { GEMINI_MODEL, MOCK_SCAN_DURATION_MS, getBasicSystemInstruction } from './constants';
import { base64ToUint8Array, createAudioBlob, decodeAudioData } from './services/audioUtils';
import Visualizer from './components/Visualizer';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(process.env.API_KEY || '');
  const [specs, setSpecs] = useState<LaptopSpecs | null>(null);
  const [fullSpecs, setFullSpecs] = useState<FullLaptopSpecs | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState<boolean>(false);
  const [aiCaption, setAiCaption] = useState<string>("Click the microphone to ask about specs, price, battery, or weight");
  const [specsLoaded, setSpecsLoaded] = useState<boolean>(false);

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

  // Load laptop specs from JSON file
  const loadLaptopSpecs = async (): Promise<FullLaptopSpecs | null> => {
    try {
      const response = await fetch('/laptop_full_specs.json');
      if (!response.ok) {
        console.error('❌ Specs file not found. Run: npm run scan');
        return null;
      }
      
      const data: FullLaptopSpecs = await response.json();
      console.log('✅ Loaded specs from JSON:', data);
      
      setFullSpecs(data);
      
      // Convert to LaptopSpecs format for dashboard
      const displaySpecs: LaptopSpecs = {
        modelName: data.specifications?.laptop_model || data.from_scan?.model || 'Unknown',
        os: data.specifications?.os || data.from_scan?.os || 'Unknown',
        processor: data.specifications?.cpu || data.from_scan?.cpu || 'Unknown',
        ram: data.specifications?.ram_options || data.from_scan?.ram || 'Unknown',
        gpu: data.specifications?.gpu || data.from_scan?.gpu || 'Unknown',
        resolution: data.specifications?.display || 'Unknown',
        browser: 'Chrome / Blink',
        battery: data.specifications?.battery || 'Unknown',
        weight: data.specifications?.weight || 'Unknown',
        price: data.specifications?.typical_price_range || 'Unknown',
        timestamp: data.timestamp || new Date().toLocaleString()
      };
      
      setSpecs(displaySpecs);
      setSpecsLoaded(true);
      return data;
    } catch (error) {
      console.error('❌ Error loading specs:', error);
      return null;
    }
  };

  // Create dynamic system instruction from loaded JSON data
  const createDynamicSystemInstruction = (specsData: FullLaptopSpecs | null): string => {
    if (!specsData || !specsData.specifications) {
      console.warn('⚠️ No specs data, using basic instruction');
      return getBasicSystemInstruction();
    }

    const specs = specsData.specifications;
    const scanData = specsData.from_scan;

    console.log('🤖 Creating system instruction for:', specs.laptop_model);

    return `You are an advanced AI assistant for THIS SPECIFIC LAPTOP that you are running on.

=== LAPTOP IDENTIFICATION ===
Brand: ${specs.brand || 'Unknown'}
Model: ${specs.laptop_model || 'Unknown'}
Series: ${specs.series || 'N/A'}
Release Year: ${specs.release_year || 'N/A'}

=== HARDWARE SPECIFICATIONS ===
Processor (CPU): ${specs.cpu || 'Unknown'}
Graphics (GPU): ${specs.gpu || 'Unknown'}
RAM: ${specs.ram_options || 'Unknown'}
Maximum RAM Supported: ${specs.max_ram_supported || 'Unknown'}
Storage: ${specs.storage_options || 'Unknown'}

=== DISPLAY ===
${specs.display || 'Unknown'}

=== BATTERY & POWER ===
Battery: ${specs.battery || 'Unknown'}

=== PHYSICAL SPECIFICATIONS ===
Weight: ${specs.weight || 'Unknown'}
Dimensions: ${specs.dimensions || 'Unknown'}

=== CONNECTIVITY & PORTS ===
Ports: ${specs.ports || 'Unknown'}
Connectivity: ${specs.connectivity || 'Unknown'}
Webcam: ${specs.webcam || 'Unknown'}

=== BUILD & DESIGN ===
Keyboard: ${specs.keyboard || 'Unknown'}
Build Quality: ${specs.build_quality || 'Unknown'}
Operating System: ${specs.os || 'Unknown'}

=== PRICING ===
Typical Price Range: ${specs.typical_price_range || 'Unknown'}

=== CURRENT SYSTEM DETECTION ===
Detected CPU: ${scanData?.cpu || 'N/A'}
Detected RAM: ${scanData?.ram || 'N/A'}
Detected GPU: ${scanData?.gpu || 'N/A'}
Manufacturer: ${scanData?.manufacturer || 'N/A'}

=== YOUR ROLE & BEHAVIOR ===

1. INTRODUCTION (When session starts):
   - Greet briefly: "System initialized. Analyzing your ${specs.brand || ''} ${specs.laptop_model || 'laptop'}..."
   - Then IMMEDIATELY provide a natural summary:
     * "This is a ${specs.brand || ''} ${specs.laptop_model || 'laptop'} from ${specs.release_year || 'recent years'}"
     * "Powered by ${specs.cpu || 'a modern processor'}"
     * "With ${specs.gpu || 'integrated graphics'}"
     * "Featuring ${specs.ram_options || 'sufficient RAM'}"
     * Mention display: "${specs.display || 'a quality display'}"
   - End with: "Your system is ready. What would you like to know?"

2. ANSWERING QUESTIONS:
   - ALWAYS use ONLY the specifications provided above
   - NEVER invent or guess specifications
   - If asked about something not in the specs, say: "I don't have that specific detail in my database"
   - Be enthusiastic about the laptop's strengths
   - Be honest about limitations
   - Keep responses concise (2-3 sentences) unless asked for details

3. SPECIFIC QUERIES:
   - Price: State "${specs.typical_price_range || 'varies by configuration'}" and note it depends on region/configuration
   - Gaming: Base answer on GPU (${specs.gpu}) and CPU (${specs.cpu})
   - Battery Life: Reference "${specs.battery || 'battery capacity'}"
   - Weight/Portability: Use "${specs.weight || 'weight information'}"
   - Upgrades: Mention "Max RAM: ${specs.max_ram_supported || 'check specifications'}"
   - Comparisons: Use the specs to compare fairly

4. TONE & STYLE:
   - Professional yet friendly (like JARVIS or Cortana)
   - Tech-savvy but not overwhelming with jargon
   - Confident when you know the specs
   - Honest when you don't have information
   - Natural conversational style, not robotic

5. CRITICAL RULES:
   - This is a ${specs.brand || ''} ${specs.laptop_model || 'laptop'} - NEVER call it by a different name
   - Use EXACT specifications from above
   - Don't make up features not listed
   - Stay in character as the laptop's AI assistant

Remember: You are specifically the AI assistant for THIS ${specs.brand || ''} ${specs.laptop_model || 'laptop'}, not a general assistant.`;
  };

  // Fallback: Hardware Discovery (if file not found)
  const discoverHardware = (): LaptopSpecs => {
    console.warn('⚠️ Using fallback browser detection');
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
      // CRITICAL: Load specs FIRST before anything else
      console.log('📡 Loading laptop specifications...');
      const loadedSpecs = await loadLaptopSpecs();
      
      if (loadedSpecs) {
        console.log('✅ Specs loaded successfully:', loadedSpecs.specifications?.laptop_model);
      } else {
        console.warn('⚠️ Could not load specs, using fallback');
      }

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

      // Create dynamic instruction from loaded specs
      const dynamicInstruction = createDynamicSystemInstruction(loadedSpecs);
      console.log('🤖 System instruction created with actual specs');

      const ai = new GoogleGenAI({ apiKey });
      const sessionPromise = ai.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: dynamicInstruction, // ← DYNAMIC instruction with JSON data
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
        callbacks: {
          onopen: async () => {
            console.log('🔗 Gemini session connected');
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
            
            setTimeout(async () => {
              // Use fallback only if specs weren't loaded
              if (!loadedSpecs && !specs) {
                console.warn('⚠️ Using fallback browser detection');
                const detectedSpecs = discoverHardware();
                setSpecs(detectedSpecs);
              }
              
              setAppState(AppState.DASHBOARD);
              setIsAiPanelOpen(true);
              setAiCaption("Scan complete. AI is ready.");

              // Trigger AI introduction
              sessionPromiseRef.current?.then((session) => {
                console.log('🎤 Triggering AI introduction');
                session.sendRealtimeInput({
                    content: {
                        parts: [{
                            text: `SYSTEM SCAN COMPLETE. Begin your introduction now. Introduce the laptop using the specifications in your system instruction.`
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
          onclose: () => {
            console.log('🔌 Gemini session closed');
            setAppState(AppState.IDLE);
          },
          onerror: (err) => {
            console.error('❌ Gemini error:', err);
            setAppState(AppState.ERROR);
            setErrorMsg("Connection Error");
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err) {
      console.error('❌ System error:', err);
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
          console.log('💬 Sending prompt:', text);
          session.sendRealtimeInput({ content: { parts: [{ text }] } });
          setAiCaption(`Processing: ${text.substring(0, 50)}...`);
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
                    {specsLoaded && <span style={{ marginLeft: '8px', color: '#4ade80' }}>✓ JSON Loaded</span>}
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
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '16px' }}>
                        ⚠️ Important: Run <code style={{background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px'}}>npm run scan</code> first!
                    </p>
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
                    {specsLoaded && <p style={{ color: '#4ade80', marginTop: '8px' }}>✓ Specifications loaded from JSON</p>}
                </div>
            </div>
        )}

        {/* Dashboard Grid */}
        {(appState === AppState.DASHBOARD || appState === AppState.ACTIVE) && (
            <Dashboard specs={specs} fullSpecs={fullSpecs} />
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
                        <button className="ai-btn" onClick={() => sendTextPrompt("Give me a brief overview of all the key specifications of this laptop.")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                            </svg>
                            Overview
                        </button>
                        <button className="ai-btn" onClick={() => sendTextPrompt("What is the typical market price for this laptop?")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                            </svg>
                            Price
                        </button>
                        <button className="ai-btn" onClick={() => sendTextPrompt("Tell me about the battery life and capacity of this laptop.")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/>
                            </svg>
                            Battery
                        </button>
                        <button className="ai-btn" onClick={() => sendTextPrompt("How much does this laptop weigh?")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
                            </svg>
                            Weight
                        </button>
                    </div>
                    
                    <div className="ai-controls" style={{ marginTop: '8px' }}>
                        <button className="ai-btn" onClick={() => sendTextPrompt("Is this laptop good for gaming? Analyze based on the GPU and CPU.")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21.58 16.09l-1.09-7.66C20.21 6.46 18.52 5 16.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                            </svg>
                            Gaming
                        </button>
                        <button className="ai-btn" onClick={() => sendTextPrompt("What ports and connectivity options does this laptop have?")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
                            </svg>
                            Ports
                        </button>
                        <button className="ai-btn" onClick={() => sendTextPrompt("Compare this laptop to similar models in the same price range.")}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                            </svg>
                            Compare
                        </button>
                    </div>
                    
                    <div className={`ai-microphone ${appState === AppState.ACTIVE || appState === AppState.DASHBOARD ? 'active' : ''}`}>
                        {outputAnalyserRef.current && (
                            <Visualizer analyser={outputAnalyserRef.current} isActive={true} accentColor="#ffffff" />
                        )}
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
                    {fullSpecs?.specifications ? (
                        <span>💡 Ask me anything about your <strong>{fullSpecs.specifications.brand} {fullSpecs.specifications.laptop_model}</strong></span>
                    ) : (
                        <span>Voice commands: "specs", "price", "battery", "weight", "gaming"</span>
                    )}
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