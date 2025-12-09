
import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Settings, Monitor, Database, Camera, Users, Terminal, Cpu, Volume2, X, Upload, Box, Activity, Mic } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ANIMATION_LIBRARY, ANIMATION_NAMES } from './animations';
import { speakerModule, VocalMetaDataObject } from './speakerModule';
import {
  BoneAnimationController,
  BONE_ANIMATION_LIBRARY,
  AnimationContext,
} from './src/anim_engine';

import { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements { }
  }
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    boneControllerActive: boolean;
  }
}


// --- CONFIGURATION ---

interface ModelConfig {
  general: string;
  vision: string;
  creativity: string;
  adult: string;
  uncensored: string;
  ollamaUrl: string;
  ttsBackend: 'browser' | 'kokoro';
  kokoroUrl: string;
}

const DEFAULT_CONFIG: ModelConfig = {
  general: import.meta.env.VITE_OLLAMA_MODEL_GENERAL || 'granite4:latest',
  vision: import.meta.env.VITE_OLLAMA_MODEL_VISION || 'granite4:latest',
  creativity: import.meta.env.VITE_OLLAMA_MODEL_CREATIVITY || 'granite4:latest',
  adult: import.meta.env.VITE_OLLAMA_MODEL_ADULT || 'granite4:latest',
  uncensored: import.meta.env.VITE_OLLAMA_MODEL_UNCENSORED || 'granite4:latest',
  ollamaUrl: import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434',
  ttsBackend: (import.meta.env.VITE_TTS_BACKEND as 'browser' | 'kokoro') || 'kokoro',
  kokoroUrl: import.meta.env.VITE_KOKORO_URL || 'http://127.0.0.1:7860/gradio_api/api/predict',
};

// --- 3D AVATAR COMPONENTS ---

interface ModelViewerProps {
  url: string;
  isSpeaking: boolean;
  animationName: string;
  labanState: VocalMetaDataObject['laban_mapping'] | null;
}

const ModelViewer = ({
  url,
  isSpeaking,
  animationName,
  labanState,
}: ModelViewerProps) => {
  console.log("Rendering ModelViewer...");
  const gltf = useGLTF(url);
  const { scene, animations, nodes } = gltf;
  const modelRef = useRef<THREE.Group>(null);

  // Clone scene to avoid re-mounting issues if url changes slightly
  const clone = React.useMemo(() => {
    console.log("Cloning scene...", scene ? "Scene exists" : "Scene missing");
    return scene ? scene.clone() : null;
  }, [scene]);

  // NEW: Bone animation controller
  const boneController = useRef<BoneAnimationController | null>(null);
  // NEW: Animation Mixer for GLTF animations
  const mixer = useRef<THREE.AnimationMixer | null>(null);

  // Initialize bone controller
  useEffect(() => {
    if (clone) {
      console.log("Initializing BoneAnimationController...");
      boneController.current = new BoneAnimationController(clone);
      window.boneControllerActive = true;

      // Force cache rebuild to ensure all bones are found
      boneController.current.rebuildCache();

      // Register default animations
      boneController.current.registerAnimation(
        'jaw_talking',
        'bip001-head', // Using head as proxy for jaw if jaw is missing, or try 'bip001-head'
        BONE_ANIMATION_LIBRARY['Jaw_Talk']
      );

      boneController.current.registerAnimation(
        'head_breathing',
        'bip001-head',
        BONE_ANIMATION_LIBRARY['Head_Breathing']
      );

      boneController.current.registerAnimation(
        'spine_breathe',
        'bip001-spine',
        BONE_ANIMATION_LIBRARY['Spine_Breathe']
      );
    }

    return () => {
      boneController.current?.clearAll();
    };
  }, [clone]);

  // Initialize AnimationMixer
  useEffect(() => {
    if (clone) {
      // Auto-target the real bone root as requested
      const armature = clone.getObjectByProperty('type', 'Bone');
      mixer.current = new THREE.AnimationMixer(armature || clone);
    }
    return () => {
      mixer.current?.stopAllAction();
      mixer.current = null;
    };
  }, [clone]);

  // Handle Animation Playback
  useEffect(() => {
    if (mixer.current && animations.length > 0 && animationName) {
      const clip = animations.find(a => a.name === animationName);
      if (clip) {
        mixer.current.stopAllAction();
        const action = mixer.current.clipAction(clip);
        if (action) {
          action.reset().fadeIn(0.5).play();
        }
      }
    }
  }, [animationName, animations, clone]); // Re-run if animation changes or model reloads

  useFrame((state, delta) => {
    if (!modelRef.current) return;
    const t = state.clock.getElapsedTime();

    // Update Mixer
    if (mixer.current) {
      mixer.current.update(delta);
    }

    // LABAN INFLUENCE CALCULATORS
    // Weight (Light vs Strong) -> Amplitude of movement
    const weightFactor = labanState?.weight === 'strong' ? 1.5 : 0.8;

    // Time (Sudden vs Sustained) -> Speed of movement (jitter)
    const timeFactor = labanState?.time === 'sudden' ? 2.0 : 0.5;

    // Apply specific procedural animation or default
    if (animationName && ANIMATION_LIBRARY[animationName]) {
      ANIMATION_LIBRARY[animationName](modelRef.current, t * timeFactor, delta);
    } else {
      // Idle Animation (Breathing/Floating)
      // Laban Influence: "Strong" weight makes the idle float deeper
      modelRef.current.position.y = -1 + Math.sin(t * 1) * 0.05 * weightFactor;
      modelRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;
    }

    // NEW: BONE-LEVEL ANIMATION
    if (boneController.current) {
      const context: AnimationContext = {
        isSpeaking,
        labanWeight: labanState?.weight,
        labanTime: labanState?.time,
        emotionIntensity: weightFactor
      };

      boneController.current.update(t, delta, context);
    }

    // Optional: Manual bone animations for specific scenarios
    if (isSpeaking && boneController.current) {
      const jaw = boneController.current.getBoneFinder().findByPatterns('jaw', 'mouth', 'chin');
      if (jaw) {
        // Additional speaking animation
        jaw.rotation.x = Math.sin(t * 15) * 0.12;
      }
    }

    // Overlay Speaking Vibration if speaking
    if (isSpeaking) {
      const speechIntensity = Math.sin(t * 20) * 0.02 * weightFactor;
      modelRef.current.position.y += speechIntensity;
      modelRef.current.rotation.x += speechIntensity * 2;
    }
  });

  return (
    <>
      <primitive object={clone} ref={modelRef} scale={1.5} position={[0, -1, 0]} />
    </>
  );
};

const FallbackAvatar = () => (
  <mesh position={[0, 0, 0]}>
    <icosahedronGeometry args={[1, 1]} />
    <meshStandardMaterial color="#00ff41" wireframe />
  </mesh>
);

const Avatar3D = ({
  modelUrl,
  isSpeaking,
  animationName,
  labanState,
}: {
  modelUrl: string | null;
  isSpeaking: boolean;
  animationName: string;
  labanState: VocalMetaDataObject['laban_mapping'] | null;
}) => {
  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [0, 1.5, 4], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <spotLight position={[-5, 5, 0]} intensity={0.5} color="#00ff41" />

        <Suspense fallback={<FallbackAvatar />}>
          {modelUrl ? (
            <ModelViewer
              url={modelUrl}
              isSpeaking={isSpeaking}
              animationName={animationName}
              labanState={labanState}
            />
          ) : (
            <FallbackAvatar />
          )}
        </Suspense>

        <ContactShadows opacity={0.5} scale={10} blur={2.5} far={4} />
        <OrbitControls enableZoom={true} enablePan={true} minPolarAngle={Math.PI / 2.5} maxPolarAngle={Math.PI / 1.5} />
        <Environment preset="city" />
      </Canvas>

      {!modelUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 border border-green-500 p-4 rounded text-center backdrop-blur">
            <Box className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="text-xs">NO MODEL LOADED</p>
            <p className="text-[10px] opacity-70 mt-1">Go to Settings to load .GLB</p>
          </div>
        </div>
      )}
    </div>
  );
};

// --- APP COMPONENT ---

interface ChatMessage {
  role: 'user' | 'lexi';
  content: string;
  type?: 'text' | 'audio';
  speaker?: string;
  metadata?: VocalMetaDataObject | null;
}

const App = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'lexi', content: "Systems Online. Initializing Lexi OS v4.0..." }
  ]);
  const [input, setInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [config, setConfig] = useState<ModelConfig>(DEFAULT_CONFIG);
  const [diarizationMode, setDiarizationMode] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>("/stellar_blade_-_lily_stargazer_coat.glb");
  const [currentVocalData, setCurrentVocalData] = useState<VocalMetaDataObject | null>(null);
  const [tools, setTools] = useState<any[]>([]); // MCP Tools state

  // New State for Animation selection
  const [currentAnimation, setCurrentAnimation] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(isSpeaking);
  const isListeningRef = useRef(false);

  // --- DYNAMIC CONFIG LOADING ---
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/config');
        if (res.ok) {
          const serverConfig = await res.json();
          console.log("Loaded dynamic config:", serverConfig);
          setConfig(prev => ({ ...prev, ...serverConfig }));
        }
      } catch (e) {
        console.error("Failed to load dynamic config:", e);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    console.log("isSpeaking changed:", isSpeaking);
    isSpeakingRef.current = isSpeaking;
    if (recognitionRef.current) {
      if (isSpeaking) {
        // Abort immediately to discard any TTS audio being picked up
        try {
          console.log("Aborting recognition due to speech");
          recognitionRef.current.abort();
        } catch (e) { }
      } else {
        // Only start if not already listening
        if (!isListeningRef.current) {
          try {
            console.log("Starting recognition (silence detected)");
            recognitionRef.current.start();
          } catch (e) { }
        }
      }
    }
  }, [isSpeaking]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  // --- AUDIO LISTENING (REAL-TIME ANALYSIS) ---
  useEffect(() => {
    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);

        source.connect(processor);
        processor.connect(audioContextRef.current.destination);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const meta = speakerModule.processAudioFrame(inputData);
          if (meta) {
            setCurrentVocalData(meta);
          } else {
            // Reset if silence
            if (Math.random() > 0.9) setCurrentVocalData(null);
          }
        };
      } catch (e) { console.log("Mic not active yet"); }
    };
    // Initialize interaction
    window.addEventListener('click', () => {
      if (!audioContextRef.current) initAudio();
    }, { once: true });

    return () => {
      audioContextRef.current?.close();
    }
  }, []);

  // --- SPEECH RECOGNITION (STT) ---
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) return;

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      console.log("Recognition STARTED");
      isListeningRef.current = true;
    };

    recognition.onresult = (event: any) => {
      if (isSpeakingRef.current) {
        console.log("Ignored result (speaking)");
        return;
      }

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        console.log("Transcript:", transcript, "Final:", event.results[i].isFinal);
        if (event.results[i].isFinal) {
          handleSend(transcript);
        } else {
          setInput(transcript);
        }
      }
    };

    recognition.onend = () => {
      console.log("Recognition ENDED");
      isListeningRef.current = false;
      // Auto-restart only if not speaking
      if (!isSpeakingRef.current) {
        try {
          console.log("Auto-restarting recognition");
          recognition.start();
        } catch (e) { }
      }
    };

    // Start listening on first interaction
    const startSTT = () => {
      if (!isListeningRef.current && !isSpeakingRef.current) {
        try { recognition.start(); } catch (e) { }
      }
    };
    window.addEventListener('click', startSTT, { once: true });

    return () => {
      recognition.abort();
    };
  }, []);

  // --- MCP TOOLS FETCH ---
  useEffect(() => {
    fetch('http://localhost:3001/mcp/tools')
      .then(res => res.json())
      .then(data => {
        console.log("Loaded MCP Tools:", data);
        setTools(data);
      })
      .catch(e => console.error("Failed to load MCP tools:", e));
  }, []);

  // --- MODEL ROUTING ---
  const routeIntent = (text: string, hasImage: boolean) => {
    if (hasImage) return config.vision;
    if (text.includes("generate") || text.includes("story") || text.includes("poem")) return config.creativity;
    if (text.includes("NSFW") || text.includes("explicit")) return config.adult;
    return config.general;
  };

  // --- TTS LOGIC ---
  const speakWithKokoro = async (text: string) => {
    try {
      const response = await fetch(config.kokoroUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [text, "af_heart", 1.0] // Voice: US Heart
        })
      });
      const json = await response.json();
      if (json.data && json.data[0]) {
        const audioSrc = json.data[0].url || json.data[0];
        const audio = new Audio(audioSrc);
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => setIsSpeaking(false);
        audio.play();
      }
    } catch (e) {
      console.error("Kokoro TTS Failed:", e);
      setIsSpeaking(false);
    }
  };

  const speak = (text: string) => {
    if (config.ttsBackend === 'kokoro') {
      speakWithKokoro(text);
    } else {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.onstart = () => setIsSpeaking(true);
      u.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(u);
    }
  };

  // --- CHAT LOGIC ---
  const handleSend = async (text: string = input, imageBase64?: string) => {
    if (!text.trim() && !imageBase64) return;

    // ATTACH VOCAL METADATA IF AVAILABLE
    const meta = currentVocalData;

    setMessages(prev => [...prev, {
      role: 'user',
      content: text + (imageBase64 ? " [Image Attached]" : ""),
      speaker: meta ? meta.speaker : 'User',
      metadata: meta
    }]);

    setInput("");
    setIsSpeaking(true);

    try {
      const model = routeIntent(text, !!imageBase64);
      // Append context about speaker mood if available
      let systemPrompt = "You are Lexi.";
      if (meta) {
        systemPrompt += ` User is ${meta.emotion} with ${meta.urgency_level} urgency.`;
      }

      const payload: any = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text, images: imageBase64 ? [imageBase64] : undefined }
        ],
        stream: false, // Disable streaming for tool calling simplicity initially
        tools: tools.length > 0 ? tools : undefined
      };

      const response = await fetch(`${config.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await response.json();

      // Handle Tool Calls
      if (json.message?.tool_calls) {
        const toolCalls = json.message.tool_calls;
        setMessages(prev => [...prev, { role: 'lexi', content: "Executing tools..." }]);

        for (const call of toolCalls) {
          const toolName = call.function.name;
          const toolArgs = call.function.arguments;

          // Find which server this tool belongs to
          const toolDef = tools.find(t => t.function.name === toolName);
          if (!toolDef) continue;

          try {
            const toolRes = await fetch('http://localhost:3001/mcp/call', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                server: toolDef.server,
                name: toolName,
                arguments: toolArgs
              })
            });
            const toolResult = await toolRes.json();

            // Feed result back to Ollama
            const followUpPayload = {
              model: model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text },
                json.message, // Original assistant message with tool calls
                { role: 'tool', content: JSON.stringify(toolResult) }
              ],
              stream: false
            };

            const followUpRes = await fetch(`${config.ollamaUrl}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(followUpPayload)
            });

            const followUpJson = await followUpRes.json();
            if (followUpJson.message?.content) {
              setMessages(prev => [...prev, { role: 'lexi', content: followUpJson.message.content }]);
              speak(followUpJson.message.content);
            }

          } catch (e) {
            console.error("Tool execution failed", e);
            setMessages(prev => [...prev, { role: 'lexi', content: `Error executing ${toolName}` }]);
          }
        }
        setIsSpeaking(false);
        return; // Exit as we handled the response via tool loop
      }

      // Normal Response (No Tools)
      if (json.message?.content) {
        setMessages(prev => [...prev, { role: 'lexi', content: json.message.content }]);
        speak(json.message.content);
      }
      setIsSpeaking(false);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'lexi', content: "Error connecting to Neural Backend." }]);
      setIsSpeaking(false);
    }
  };

  // --- VISION & TOOLS ---
  const handleCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
      stream.getTracks().forEach(t => t.stop());
      handleSend("Describe what you see.", base64);
    } catch (e) { alert("Camera access denied"); }
  };

  const handleScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
      stream.getTracks().forEach(t => t.stop());
      handleSend("Analyze this screen.", base64);
    } catch (e) { alert("Screen access denied"); }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setAvatarUrl(url);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-black text-green-500 font-mono relative">
      {/* TOOLBAR */}
      <div className="h-14 border-b border-green-900 flex items-center justify-between px-4 bg-gray-900/50 backdrop-blur">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 animate-pulse" />
          <span className="font-bold tracking-widest text-lg">LEXI_OS v4.0</span>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setDiarizationMode(!diarizationMode)} className={`p-2 rounded hover:bg-green-900/50 ${diarizationMode ? 'text-green-400 bg-green-900/30' : 'opacity-50'}`} title="Speaker Diarization Mode">
            <Users className="w-5 h-5" />
          </button>
          <button onClick={handleCamera} className="p-2 rounded hover:bg-green-900/50 opacity-70 hover:opacity-100" title="Vision: Camera">
            <Camera className="w-5 h-5" />
          </button>
          <button onClick={handleScreen} className="p-2 rounded hover:bg-green-900/50 opacity-70 hover:opacity-100" title="Vision: Screen">
            <Monitor className="w-5 h-5" />
          </button>
          <button className="p-2 rounded hover:bg-green-900/50 opacity-70 hover:opacity-100" title="RAG Database">
            <Database className="w-5 h-5" />
          </button>
          <label className="p-2 rounded hover:bg-green-900/50 opacity-70 hover:opacity-100 cursor-pointer">
            <Upload className="w-5 h-5" />
            <input type="file" accept=".glb,.gltf" onChange={handleAvatarUpload} className="hidden" />
          </label>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: 3D AVATAR */}
        <div className="w-1/2 relative border-r border-green-900 bg-gradient-to-b from-black to-gray-900">
          <Avatar3D
            modelUrl={avatarUrl}
            isSpeaking={isSpeaking}
            animationName={currentAnimation}
            labanState={currentVocalData?.laban_mapping || null}
          />

          <div className="absolute bottom-10 left-0 w-full text-center pointer-events-none">
            <div className="inline-block border border-green-800 px-4 py-2 bg-black/50 rounded backdrop-blur">
              <div className="text-xs text-green-600 mb-1">STATUS</div>
              <div className="flex items-center gap-2 justify-center">
                <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-400 animate-ping' : 'bg-green-800'}`}></div>
                <span className="font-bold">{isSpeaking ? 'SPEAKING' : 'LISTENING'}</span>
              </div>
              {currentVocalData && (
                <div className="text-[9px] mt-1 text-yellow-500 uppercase">
                  {currentVocalData.emotion} | {currentVocalData.laban_mapping.weight}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: CHAT */}
        <div className="w-1/2 flex flex-col bg-black/90 relative">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded border ${m.role === 'user' ? 'border-green-800 bg-green-900/10' : 'border-green-600 bg-green-900/20'}`}>
                  <div className="text-[10px] opacity-50 mb-1 flex justify-between items-center gap-2">
                    <span className="font-bold">{m.role.toUpperCase()}</span>
                    {m.metadata && (
                      <span className="text-[9px] bg-green-900 px-1 rounded text-green-200">
                        {m.metadata.speaker} | {m.metadata.emotion} | {m.metadata.urgency_level}
                      </span>
                    )}
                    {!m.metadata && m.speaker && <span className="text-yellow-500">[{m.speaker}]</span>}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed text-sm">
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div className="p-4 border-t border-green-900 bg-gray-900/50">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-black border border-green-700 p-3 text-green-400 focus:outline-none focus:border-green-400 transition-colors rounded"
                placeholder={diarizationMode ? "Diarization Active..." : "Enter command..."}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={diarizationMode}
              />
              <button onClick={() => handleSend()} className="px-6 bg-green-700 text-black font-bold hover:bg-green-600 rounded">
                SEND
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
