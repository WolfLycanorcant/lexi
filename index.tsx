
import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Settings, Monitor, Database, Camera, Users, Terminal, Cpu, Volume2, X, Upload, Box, Activity, Mic } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ANIMATION_LIBRARY, ANIMATION_NAMES } from './animations';
import { speakerModule, VocalMetaDataObject } from './speakerModule';
import { BoneAnimationController } from './src/anim_engine/bone_system'; // Import BoneAnimationController
import { BONE_ANIMATION_LIBRARY, AnimationContext } from './src/anim_engine/bone_animations'; // Import bone animations

import { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements { }
  }
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
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

// Add to top of index.tsx
interface BoneInfo {
  name: string;
  uuid: string;
  meshName: string;
  index: number;
  hasParent: boolean;
  childCount: number;
}

interface SkinnedMeshInfo {
  name: string;
  uuid: string;
  boneCount: number;
  bones: BoneInfo[];
  hasAnimations: boolean;
}

interface SkeletonMetadata {
  skinnedMeshes: SkinnedMeshInfo[];
  allBones: BoneInfo[];
  uniqueBoneNames: string[];
  totalBones: number;
  totalMeshes: number;
  hasSkeletalData: boolean;
  animationClips: string[]; // Names of embedded animations
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
  onBonesDetected?: (metadata: SkeletonMetadata) => void;
  onBoneAnimationUpdate?: (boneName: string, transform: { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }) => void;
  showSkeletonHelper?: boolean;
  skeletonHelperColor?: string;
}

const ModelViewer = ({
  url,
  isSpeaking,
  animationName,
  labanState,
  onBonesDetected,
  onBoneAnimationUpdate,
  showSkeletonHelper = false,
  skeletonHelperColor = "#00ff41"
}: ModelViewerProps) => {
  const gltf = useGLTF(url);
  const { scene, animations, nodes } = gltf;
  const modelRef = useRef<THREE.Group>(null);

  // Clone scene to avoid re-mounting issues if url changes slightly
  const clone = React.useMemo(() => scene.clone(), [scene]);

  // NEW: Bone animation controller
  const boneController = useRef<BoneAnimationController | null>(null);
  const [boneData, setBoneData] = useState<SkeletonMetadata | null>(null);

  // Initialize bone controller
  useEffect(() => {
    if (clone) {
      boneController.current = new BoneAnimationController(clone);

      // Register default animations
      boneController.current.registerAnimation(
        'jaw_talking',
        'jaw',
        BONE_ANIMATION_LIBRARY['Jaw_Talk']
      );

      boneController.current.registerAnimation(
        'head_breathing',
        'head',
        BONE_ANIMATION_LIBRARY['Head_Breathing']
      );

      boneController.current.registerAnimation(
        'spine_breathe',
        'spine',
        BONE_ANIMATION_LIBRARY['Spine_Breathe']
      );
    }

    return () => {
      boneController.current?.clearAll();
    };
  }, [clone]);

  useFrame((state, delta) => {
    if (!modelRef.current) return;
    const t = state.clock.getElapsedTime();

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

  const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);

  // Add skeleton helper
  useEffect(() => {
    if (!modelRef.current || !showSkeletonHelper) {
      // Remove helper if it exists
      if (skeletonHelperRef.current) {
        modelRef.current?.remove(skeletonHelperRef.current);
        skeletonHelperRef.current.dispose();
        skeletonHelperRef.current = null;
      }
      return;
    }

    // Find first SkinnedMesh
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    modelRef.current.traverse(obj => {
      if (!skinnedMesh && obj.type === 'SkinnedMesh') {
        skinnedMesh = obj as THREE.SkinnedMesh;
      }
    });

    if (skinnedMesh) {
      // Create helper
      const helper = new THREE.SkeletonHelper(skinnedMesh);
      (helper.material as THREE.LineBasicMaterial).linewidth = 2; // Cast to LineBasicMaterial to access linewidth
      (helper.material as THREE.LineBasicMaterial).color.set(skeletonHelperColor); // Cast to LineBasicMaterial to access color

      modelRef.current.add(helper);
      skeletonHelperRef.current = helper;
    }

    return () => {
      if (skeletonHelperRef.current) {
        modelRef.current?.remove(skeletonHelperRef.current);
        skeletonHelperRef.current.dispose();
        skeletonHelperRef.current = null;
      }
    };
  }, [showSkeletonHelper, skeletonHelperColor, clone]); // Added clone to dependencies

  // Bone detection effect
  useEffect(() => {
    const skinnedMeshes: THREE.SkinnedMesh[] = [];
    const allBones: { name: string; uuid: string; meshName: string }[] = [];

    clone.traverse((object: THREE.Object3D) => {
      // Type guard: Check if object is a SkinnedMesh
      if (object.type === 'SkinnedMesh' && (object as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = object as THREE.SkinnedMesh;
        skinnedMeshes.push(mesh);

        // PART B: Extract skeleton data
        if (mesh.skeleton) {
          console.group(`SkinnedMesh: ${mesh.name || 'unnamed'} (UUID: ${mesh.uuid})`);

          // Log basic skeleton info
          console.log('Skeleton ID:', mesh.skeleton.uuid);
          console.log('Bone Count:', mesh.skeleton.bones.length);
          console.log('Has Bone Inverses:', mesh.skeleton.boneInverses.length > 0);
          console.log('Bind Matrix:', mesh.bindMatrix);
          console.log('Bind Matrix Inverse:', mesh.bindMatrixInverse);

          // PART C: Iterate through bones
          mesh.skeleton.bones.forEach((bone, index) => {
            // Log detailed bone information
            console.log(`\n  Bone[${index}]: ${bone.name || 'unnamed_bone_' + index}`);
            console.log(`    UUID: ${bone.uuid}`);
            console.log(`    Type: ${bone.type}`);
            console.log(`    Position: [${bone.position.x.toFixed(3)}, ${bone.position.y.toFixed(3)}, ${bone.position.z.toFixed(3)}]`);
            console.log(`    Rotation: [${bone.rotation.x.toFixed(3)}, ${bone.rotation.y.toFixed(3)}, ${bone.rotation.z.toFixed(3)}]`);
            console.log(`    Quaternion: [${bone.quaternion.x.toFixed(3)}, ${bone.quaternion.y.toFixed(3)}, ${bone.quaternion.z.toFixed(3)}, ${bone.quaternion.w.toFixed(3)}]`);
            console.log(`    Scale: [${bone.scale.x.toFixed(3)}, ${bone.scale.y.toFixed(3)}, ${bone.scale.z.toFixed(3)}]`);
            console.log(`    Parent: ${bone.parent ? bone.parent.name : 'null'}`);
            console.log(`    Children: ${bone.children.length}`);

            // Check if bone has inverse bind matrix
            if (mesh.skeleton.boneInverses[index]) {
              const inv = mesh.skeleton.boneInverses[index];
              console.log(`    Has Inverse Bind Matrix: true`);
              // Could log the matrix elements if needed
            }

            // Store bone data
            allBones.push({
              name: bone.name || `unnamed_bone_${index}`,
              uuid: bone.uuid,
              meshName: mesh.name || 'unnamed_mesh'
            });
          });

          console.groupEnd();
        } else {
          console.warn(`SkinnedMesh "${mesh.name}" has no skeleton!`);
        }
      }
    });

    // PART D: Analyze and summarize
    const uniqueBoneNames = [...new Set(allBones.map(b => b.name))];

    console.group('=== BONE DETECTION SUMMARY ===');
    console.log(`Total SkinnedMeshes: ${skinnedMeshes.length}`);
    console.log(`Total Bones (all meshes): ${allBones.length}`);
    console.log(`Unique Bone Names: ${uniqueBoneNames.length}`);
    console.log('Unique Names:', uniqueBoneNames);
    console.groupEnd();

    // PART E: Check for skinning attributes in geometry
    skinnedMeshes.forEach(mesh => {
      const geo = mesh.geometry;
      console.group(`Geometry Attributes for ${mesh.name}`);
      console.log('Has skinIndex:', geo.attributes.skinIndex !== undefined);
      console.log('Has skinWeight:', geo.attributes.skinWeight !== undefined);

      if (geo.attributes.skinIndex) {
        console.log('skinIndex itemSize:', geo.attributes.skinIndex.itemSize); // Usually 4
        console.log('skinIndex count:', geo.attributes.skinIndex.count);
      }

      if (geo.attributes.skinWeight) {
        console.log('skinWeight itemSize:', geo.attributes.skinWeight.itemSize); // Usually 4
        console.log('skinWeight count:', geo.attributes.skinWeight.count);
      }
      console.groupEnd();
    });

    // PART F: Store structured data for UI
    const allBonesArray: BoneInfo[] = []; // Explicitly define type
    skinnedMeshes.forEach(mesh => {
      mesh.skeleton?.bones.forEach((bone, idx) => {
        allBonesArray.push({
          name: bone.name || `unnamed_bone_${idx}`,
          uuid: bone.uuid,
          meshName: mesh.name || 'unnamed_mesh',
          index: idx,
          hasParent: bone.parent !== null && bone.parent.type === 'Bone',
          childCount: bone.children.filter(c => c.type === 'Bone').length
        });
      });
    });

    const uniqueNames = [...new Set(allBonesArray.map(b => b.name))];

    const metadata: SkeletonMetadata = {
      skinnedMeshes: skinnedMeshes.map(mesh => ({
        name: mesh.name || 'unnamed',
        uuid: mesh.uuid,
        boneCount: mesh.skeleton?.bones.length || 0,
        bones: (mesh.skeleton?.bones || []).map((bone, idx) => ({
          name: bone.name || `unnamed_bone_${idx}`,
          uuid: bone.uuid,
          meshName: mesh.name || 'unnamed_mesh',
          index: idx,
          hasParent: bone.parent !== null && bone.parent.type === 'Bone',
          childCount: bone.children.filter(c => c.type === 'Bone').length
        })),
        hasAnimations: animations.length > 0 // Use the 'animations' extracted from useGLTF
      })),
      allBones: allBonesArray,
      uniqueBoneNames: uniqueNames,
      totalBones: allBonesArray.length,
      totalMeshes: skinnedMeshes.length,
      hasSkeletalData: skinnedMeshes.length > 0,
      animationClips: animations.map(clip => clip.name) // Use the 'animations' extracted from useGLTF
    };

    setBoneData(metadata); // Update local state if needed elsewhere

    // PART G: Call optional callback for parent component
    if (onBonesDetected) {
      onBonesDetected(metadata);
    }

  }, [clone, onBonesDetected, animations]); // Depend on clone, onBonesDetected, and animations

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
  onBonesDetected,
  showSkeletonHelper,
  skeletonHelperColor
}: {
  modelUrl: string | null;
  isSpeaking: boolean;
  animationName: string;
  labanState: VocalMetaDataObject['laban_mapping'] | null;
  onBonesDetected?: (metadata: SkeletonMetadata) => void;
  showSkeletonHelper?: boolean;
  skeletonHelperColor?: string;
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
              onBonesDetected={onBonesDetected}
              showSkeletonHelper={showSkeletonHelper}
              skeletonHelperColor={skeletonHelperColor}
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

// --- SETTINGS MODAL ---

interface BoneHierarchyTreeProps {
  skeletonMetadata: SkeletonMetadata;
}

const BoneHierarchyTree: React.FC<BoneHierarchyTreeProps> = ({ skeletonMetadata }) => {
  // Build tree structure from flat bone list
  const buildTree = (bones: BoneInfo[]) => {
    // This is complex - would need parent references
    // Simplified version: just show grouped by mesh
    return skeletonMetadata.skinnedMeshes.map(mesh => (
      <details key={mesh.uuid} className="mb-2">
        <summary className="text-xs cursor-pointer hover:text-green-400">
          {mesh.name} ({mesh.boneCount} bones)
        </summary>
        <ul className="ml-4 mt-1 text-[10px] space-y-0.5 border-l border-green-800 pl-2">
          {mesh.bones.map(bone => (
            <li key={bone.uuid} className="hover:text-green-400 cursor-pointer">
              {bone.name}
              {bone.hasParent && <span className="opacity-50"> ↳</span>}
            </li>
          ))}
        </ul>
      </details>
    ));
  };

  return <div>{buildTree(skeletonMetadata.allBones)}</div>;
};

const SettingsModal = ({
  config,
  setConfig,
  onClose,
  onAvatarUpload,
  currentAnimation,
  setAnimation,
  skeletonMetadata,
  selectedBone,
  setSelectedBone,
  selectedMesh,
  setSelectedMesh,
  boneFilterQuery,
  setBoneFilterQuery,
  showBoneHierarchy,
  setShowBoneHierarchy,
  showSkeletonHelper,
  setShowSkeletonHelper,
  skeletonHelperColor,
  setSkeletonHelperColor
}: {
  config: ModelConfig,
  setConfig: (c: ModelConfig) => void,
  onClose: () => void,
  onAvatarUpload: (file: File) => void,
  currentAnimation: string,
  setAnimation: (name: string) => void,
  skeletonMetadata: SkeletonMetadata | null;
  selectedBone: string;
  setSelectedBone: (name: string) => void;
  selectedMesh: string;
  setSelectedMesh: (name: string) => void;
  boneFilterQuery: string;
  setBoneFilterQuery: (query: string) => void;
  showBoneHierarchy: boolean;
  setShowBoneHierarchy: (show: boolean) => void;
  showSkeletonHelper: boolean;
  setShowSkeletonHelper: (show: boolean) => void;
  skeletonHelperColor: string;
  setSkeletonHelperColor: (color: string) => void;
}) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [newSpeaker, setNewSpeaker] = useState("");
  const [speakers, setSpeakers] = useState(speakerModule.listSpeakers());
  const [mcpServers, setMcpServers] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const fetchModels = async (url: string) => {
    try {
      const response = await fetch(`${url}/api/tags`);
      const data = await response.json();
      if (data.models) {
        setAvailableModels(data.models.map((m: any) => m.name));
      }
    } catch (e) {
      console.error("Failed to fetch models:", e);
    }
  };

  useEffect(() => {
    fetchModels(localConfig.ollamaUrl);
  }, [localConfig.ollamaUrl]);

  useEffect(() => {
    fetch('http://localhost:3001/mcp/servers')
      .then(res => res.json())
      .then(data => setMcpServers(data))
      .catch(e => console.error("Failed to load MCP servers:", e));
  }, []);

  const handleSave = async () => {
    try {
      await fetch('http://localhost:3001/api/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localConfig)
      });
      setConfig(localConfig);
      onClose();
    } catch (e) {
      console.error("Failed to save config:", e);
      alert("Failed to save configuration to .env file");
    }
  };

  const testKokoro = async () => {
    setTestStatus('testing');
    try {
      const response = await fetch(localConfig.kokoroUrl.replace('/api/predict', ''), { method: 'GET' });
      setTestStatus('success');
    } catch (e) {
      console.error(e);
      setTestStatus('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAvatarUpload(e.target.files[0]);
    }
  };

  const handleEnroll = () => {
    if (newSpeaker) {
      speakerModule.enrollSpeaker(newSpeaker);
      setSpeakers(speakerModule.listSpeakers());
      setNewSpeaker("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-green-700 p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto glow-text">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Cpu /> SYSTEM CONFIGURATION</h2>
          <button onClick={onClose}><X /></button>
        </div>

        <div className="grid gap-4">

          {/* SPEAKER ID SECTION */}
          <div className="border border-green-900 p-4 rounded bg-black/30">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Mic /> SPEAKER RECOGNITION</h3>
            <div className="flex gap-2 mb-2">
              <input
                className="bg-black border border-green-800 p-2 rounded text-sm flex-1"
                placeholder="Enter Name (e.g. Wolf)"
                value={newSpeaker}
                onChange={e => setNewSpeaker(e.target.value)}
              />
              <button onClick={handleEnroll} className="bg-green-800 px-4 rounded font-bold text-xs hover:bg-green-700">ENROLL</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {speakers.map(s => (
                <span key={s}
                  className="px-2 py-1 bg-green-900/50 border border-green-600 rounded text-xs cursor-pointer hover:bg-green-700"
                  onClick={() => speakerModule.setCurrentSpeaker(s)}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* MCP SERVERS SECTION */}
          <div className="border border-green-900 p-4 rounded bg-black/30 mb-4">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Database /> MCP SERVERS</h3>
            <div className="flex flex-wrap gap-2">
              {mcpServers.length > 0 ? (
                mcpServers.map(s => (
                  <span key={s} className="px-2 py-1 bg-green-900/50 border border-green-600 rounded text-xs flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs opacity-50 italic">No active MCP servers detected.</span>
              )}
            </div>
          </div>

          {/* OLLAMA SECTION */}
          <div>
            <label className="block text-xs mb-1 opacity-70">OLLAMA BASE URL</label>
            <div className="flex gap-2">
              <input
                className="w-full bg-black border border-green-800 p-2 rounded text-green-400"
                value={localConfig.ollamaUrl}
                onChange={e => setLocalConfig({ ...localConfig, ollamaUrl: e.target.value })}
              />
              <button onClick={() => fetchModels(localConfig.ollamaUrl)} className="px-3 bg-green-900 border border-green-700 rounded hover:bg-green-800">
                <Activity size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'GENERAL MODEL', key: 'general' },
              { label: 'VISION MODEL', key: 'vision' },
              { label: 'CREATIVITY MODEL', key: 'creativity' },
              { label: 'ADULT MODEL', key: 'adult' },
              { label: 'UNCENSORED MODEL', key: 'uncensored' }
            ].map(({ label, key }) => (
              <div key={key} className={key === 'uncensored' ? 'col-span-2' : ''}>
                <label className="block text-xs mb-1 opacity-70">{label}</label>
                {availableModels.length > 0 ? (
                  <select
                    className="w-full bg-black border border-green-800 p-2 rounded text-green-400"
                    value={localConfig[key as keyof ModelConfig] as string}
                    onChange={e => setLocalConfig({ ...localConfig, [key]: e.target.value })}
                  >
                    <option value="" disabled>Select a model</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full bg-black border border-green-800 p-2 rounded"
                    value={localConfig[key as keyof ModelConfig] as string}
                    onChange={e => setLocalConfig({ ...localConfig, [key]: e.target.value })}
                    placeholder="Enter model name manually"
                  />
                )}
              </div>
            ))}
          </div>

          {/* AVATAR SECTION */}
          <div className="mt-4 border-t border-green-900 pt-4">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Box /> 3D AVATAR</h3>

            {/* Model Loader */}
            <div className="bg-black/30 p-4 rounded border border-green-900 mb-4">
              <label className="block text-xs mb-2 opacity-70">LOAD LOCAL .GLB MODEL</label>
              <div className="flex gap-2 items-center">
                <label className="flex items-center gap-2 cursor-pointer bg-green-900 hover:bg-green-800 px-4 py-2 rounded border border-green-600">
                  <Upload size={16} />
                  <span className="text-sm font-bold">Select .GLB File</span>
                  <input type="file" accept=".glb,.gltf" onChange={handleFileChange} className="hidden" />
                </label>
                <span className="text-xs text-gray-500 italic">
                  Select "stellar_blade_-_lily_stargazer_coat.glb"
                </span>
              </div>
            </div>

            {/* BONE DETECTION PANEL */}
            <div className="bg-black/30 p-4 rounded border border-green-900 mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs opacity-70 flex items-center gap-2">
                  <Box size={12} />
                  SKELETAL DATA
                </label>
                {skeletonMetadata?.hasSkeletalData && (
                  <span className="text-[10px] bg-green-900/50 px-2 py-0.5 rounded">
                    {skeletonMetadata.totalBones} bones in {skeletonMetadata.totalMeshes} mesh(es)
                  </span>
                )}
              </div>

              {!skeletonMetadata ? (
                <div className="text-xs text-gray-500 italic p-2 border border-gray-700 rounded">
                  Load a model to detect bones
                </div>
              ) : !skeletonMetadata.hasSkeletalData ? (
                <div className="text-xs text-yellow-500 p-2 border border-yellow-700 rounded">
                  ⚠ No skeletal data found in model
                </div>
              ) : (
                <>
                  {/* FILTER INPUT */}
                  <input
                    type="text"
                    placeholder="Filter bones..."
                    value={boneFilterQuery}
                    onChange={(e) => setBoneFilterQuery(e.target.value)}
                    className="w-full p-2 text-xs bg-black/50 border border-green-700 rounded mb-2 focus:outline-none focus:border-green-500"
                  />

                  {/* MESH SELECTOR */}
                  <select
                    value={selectedMesh}
                    onChange={(e) => setSelectedMesh(e.target.value)}
                    className="w-full p-2 text-xs bg-black/50 border border-green-700 rounded mb-2"
                  >
                    <option value="">All Meshes</option>
                    {skeletonMetadata.skinnedMeshes.map(mesh => (
                      <option key={mesh.uuid} value={mesh.name}>
                        {mesh.name} ({mesh.boneCount} bones)
                      </option>
                    ))}
                  </select>

                  {/* BONE LIST */}
                  <div className="max-h-60 overflow-y-auto border border-green-800 rounded">
                    {(() => {
                      // Filter logic
                      let bonesToDisplay = selectedMesh
                        ? skeletonMetadata.allBones.filter(b => b.meshName === selectedMesh)
                        : skeletonMetadata.allBones;

                      if (boneFilterQuery) {
                        bonesToDisplay = bonesToDisplay.filter(b =>
                          b.name.toLowerCase().includes(boneFilterQuery.toLowerCase())
                        );
                      }

                      return bonesToDisplay.length === 0 ? (
                        <div className="text-xs text-gray-500 italic p-2">
                          No bones match filter
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1 p-1">
                          {bonesToDisplay.map(bone => (
                            <button
                              key={bone.uuid}
                              onClick={() => setSelectedBone(bone.name)}
                              className={`
                                px-2 py-1.5 text-[10px] rounded transition-colors text-left
                                ${selectedBone === bone.name
                                  ? 'bg-green-600 border-2 border-green-400'
                                  : 'bg-green-900/30 border border-green-700 hover:bg-green-800'
                                }
                              `}
                              title={`UUID: ${bone.uuid}\nMesh: ${bone.meshName}\nIndex: ${bone.index}`}
                            >
                              <div className="font-mono">{bone.name}</div>
                              <div className="text-[8px] opacity-60 mt-0.5">
                                {bone.meshName} #{bone.index}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* SELECTED BONE INFO */}
                  {selectedBone && (() => {
                    const boneInfo = skeletonMetadata.allBones.find(b => b.name === selectedBone);
                    return boneInfo ? (
                      <div className="mt-2 p-2 bg-green-900/20 border border-green-600 rounded text-xs space-y-1">
                        <div><strong>Name:</strong> {boneInfo.name}</div>
                        <div><strong>UUID:</strong> <span className="font-mono text-[10px]">{boneInfo.uuid}</span></div>
                        <div><strong>Mesh:</strong> {boneInfo.meshName}</div>
                        <div><strong>Index:</strong> {boneInfo.index}</div>
                        <div><strong>Has Parent:</strong> {boneInfo.hasParent ? 'Yes' : 'No (Root)'}</div>
                        <div><strong>Children:</strong> {boneInfo.childCount}</div>
                      </div>
                    ) : null;
                  })()}

                  {/* SKELETON HELPER TOGGLE */}
                  <div className="mt-3 p-2 bg-black/30 border border-green-800 rounded">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSkeletonHelper}
                        onChange={(e) => setShowSkeletonHelper(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span>Show Skeleton Helper</span>
                    </label>
                    {showSkeletonHelper && (
                      <input
                        type="color"
                        value={skeletonHelperColor}
                        onChange={(e) => setSkeletonHelperColor(e.target.value)}
                        className="mt-2 w-full h-8 bg-black/50 border border-green-700 rounded cursor-pointer"
                      />
                    )}
                  </div>

                  {/* ANIMATION CLIPS */}
                            {skeletonMetadata.animationClips.length > 0 && (
                              <div className="mt-3 p-2 bg-blue-900/20 border border-blue-700 rounded">
                                <div className="text-xs font-bold mb-1">Embedded Animations:</div>
                                <div className="text-[10px] space-y-1">
                                  {skeletonMetadata.animationClips.map((clipName, idx) => (
                                    <div key={idx} className="px-2 py-1 bg-blue-800/30 rounded">
                                      {clipName}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                  
                            {/* HIERARCHY TOGGLE */}
                            <div className="mt-3 p-2 bg-black/30 border border-green-800 rounded">
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={showBoneHierarchy}
                                  onChange={(e) => setShowBoneHierarchy(e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span>Show Bone Hierarchy</span>
                              </label>
                            </div>
                  
                            {showBoneHierarchy && skeletonMetadata?.hasSkeletalData && (
                              <div className="mt-3 p-2 bg-black/50 border border-green-700 rounded max-h-80 overflow-y-auto">
                                <div className="text-xs font-bold mb-2">Bone Hierarchy:</div>
                                <BoneHierarchyTree skeletonMetadata={skeletonMetadata} />
                              </div>
                            )}                </>
              )}
            </div>
          </div>


          {/* TTS SECTION */}
          <div className="mt-4 border-t border-green-900 pt-4">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Volume2 /> TEXT TO SPEECH</h3>
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setLocalConfig({ ...localConfig, ttsBackend: 'browser' })}
                className={`p-2 border ${localConfig.ttsBackend === 'browser' ? 'bg-green-900 border-green-500' : 'border-gray-700'} rounded flex-1`}
              >
                Browser Native
              </button>
              <button
                onClick={() => setLocalConfig({ ...localConfig, ttsBackend: 'kokoro' })}
                className={`p-2 border ${localConfig.ttsBackend === 'kokoro' ? 'bg-green-900 border-green-500' : 'border-gray-700'} rounded flex-1`}
              >
                Local Kokoro
              </button>
            </div>

            {localConfig.ttsBackend === 'kokoro' && (
              <div className="bg-black/30 p-3 rounded border border-green-900">
                <label className="block text-xs mb-1 opacity-70">KOKORO API URL (Gradio)</label>
                <div className="flex gap-2">
                  <input
                    className="w-full bg-black border border-green-800 p-2 rounded text-green-400"
                    value={localConfig.kokoroUrl}
                    onChange={e => setLocalConfig({ ...localConfig, kokoroUrl: e.target.value })}
                  />
                  <button
                    onClick={testKokoro}
                    className={`px-3 py-1 rounded text-xs font-bold ${testStatus === 'success' ? 'bg-green-600' : testStatus === 'error' ? 'bg-red-600' : 'bg-gray-700'}`}
                  >
                    {testStatus === 'idle' ? 'TEST' : testStatus === 'testing' ? '...' : testStatus === 'success' ? 'OK' : 'FAIL'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 hover:bg-white/10 rounded">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-green-700 text-black font-bold rounded hover:bg-green-600">Save System</button>
        </div>
      </div>
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
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<ModelConfig>(DEFAULT_CONFIG);
  const [diarizationMode, setDiarizationMode] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>("/stellar_blade_-_lily_stargazer_coat.glb");
  const [currentVocalData, setCurrentVocalData] = useState<VocalMetaDataObject | null>(null);
  const [tools, setTools] = useState<any[]>([]); // MCP Tools state

  // New State for Animation selection
  const [currentAnimation, setCurrentAnimation] = useState<string>("");

  // Bone detection state
  const [skeletonMetadata, setSkeletonMetadata] = useState<SkeletonMetadata | null>(null);
  const [selectedBone, setSelectedBone] = useState<string>("");
  const [selectedMesh, setSelectedMesh] = useState<string>("");
  const [boneFilterQuery, setBoneFilterQuery] = useState<string>("");
  const [showBoneHierarchy, setShowBoneHierarchy] = useState<boolean>(false);

  // Optional: Bone visualization helpers
  const [showSkeletonHelper, setShowSkeletonHelper] = useState<boolean>(false);
  const [skeletonHelperColor, setSkeletonHelperColor] = useState<string>("#00ff41");

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

  const handleAvatarUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
  };

  const handleBonesDetected = useCallback((metadata: SkeletonMetadata) => {
    console.log('Bones detected in App:', metadata);
    setSkeletonMetadata(metadata);

    // Optional: Auto-select first bone
    if (metadata.uniqueBoneNames.length > 0) {
      setSelectedBone(metadata.uniqueBoneNames[0]);
    }
  }, []);

  // --- GLOBAL DEBUG INTERFACE ---
  useEffect(() => {
    // Expose debugging interface to window
    (window as any).__LEXI_DEBUG__ = {
      // Get skeleton metadata
      getSkeletonMetadata: () => skeletonMetadata,

      // Get all bone names
      getBoneNames: () => skeletonMetadata?.uniqueBoneNames || [],

      // Find a bone by name
      findBone: (name: string) => {
        // This would need access to the bone controller
        console.log('Searching for bone:', name);
      },

      // Manually animate a bone
      animateBone: (boneName: string, rotation: { x?: number; y?: number; z?: number }) => {
        console.log(`Animating bone ${boneName}:`, rotation);
        // Implementation would need bone controller access
      },

      // Reset all bone animations
      resetBones: () => {
        console.log('Resetting all bones');
      },

      // Log bone hierarchy
      logHierarchy: () => {
        console.log('Bone Hierarchy:', skeletonMetadata);
      }
    };

    console.log('%c🤖 LEXI Debug Mode Enabled', 'color: #00ff41; font-size: 16px; font-weight: bold;');
    console.log('%cAccess via: window.__LEXI_DEBUG__', 'color: #00ff41;');
  }, [skeletonMetadata]);

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
          <button onClick={() => setShowSettings(true)} className="p-2 rounded hover:bg-green-900/50 opacity-70 hover:opacity-100">
            <Settings className="w-5 h-5" />
          </button>
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
            onBonesDetected={handleBonesDetected}
            showSkeletonHelper={showSkeletonHelper}
            skeletonHelperColor={skeletonHelperColor}
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

      {showSettings && (
        <SettingsModal
          config={config}
          setConfig={setConfig}
          onClose={() => setShowSettings(false)}
          onAvatarUpload={handleAvatarUpload}
          currentAnimation={currentAnimation}
          setAnimation={setCurrentAnimation}
          skeletonMetadata={skeletonMetadata} // Pass skeletonMetadata
          selectedBone={selectedBone}
          setSelectedBone={setSelectedBone}
          selectedMesh={selectedMesh}
          setSelectedMesh={setSelectedMesh}
          boneFilterQuery={boneFilterQuery}
          setBoneFilterQuery={setBoneFilterQuery}
          showBoneHierarchy={showBoneHierarchy}
          setShowBoneHierarchy={setShowBoneHierarchy}
          showSkeletonHelper={showSkeletonHelper}
          setShowSkeletonHelper={setShowSkeletonHelper}
          skeletonHelperColor={skeletonHelperColor}
          setSkeletonHelperColor={setSkeletonHelperColor}
        />
      )}

      {/* BONE MANIPULATOR PANEL (DEV MODE ONLY) */}
      {import.meta.env.DEV && selectedBone && (
        <div className="fixed bottom-4 right-4 w-80 bg-black/90 border border-green-500 p-3 rounded text-xs font-mono z-50">
          <div className="font-bold mb-2 text-green-400">BONE INSPECTOR</div>
          <div className="space-y-1">
            <div><span className="opacity-70">Name:</span> {selectedBone}</div>
            {/* Real-time transform tracking would be implemented here */}
            <div className="text-[10px] opacity-50 mt-2">
              (Real-time transform tracking would be implemented here)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface BoneManipulatorPanelProps {
  boneName: string;
  boneFinder: any; // Ideally BoneFinder type
  onTransformChange: (boneName: string, transform: { rotation: THREE.Euler, position: THREE.Vector3, scale: THREE.Vector3 }) => void;
}

const BoneManipulatorPanel: React.FC<BoneManipulatorPanelProps> = ({ boneName, boneFinder, onTransformChange }) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });

  useEffect(() => {
    // Initialize with current bone transforms if available
    const bone = boneFinder.findByName(boneName);
    if (bone) {
      setRotation({ x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z });
      setPosition({ x: bone.position.x, y: bone.position.y, z: bone.position.z });
      setScale({ x: bone.scale.x, y: bone.scale.y, z: bone.scale.z });
    }
  }, [boneName, boneFinder]);

  const handleApply = () => {
    // This would need to communicate with the bone controller
    const newRotation = new THREE.Euler(rotation.x, rotation.y, rotation.z);
    const newPosition = new THREE.Vector3(position.x, position.y, position.z);
    const newScale = new THREE.Vector3(scale.x, scale.y, scale.z);
    onTransformChange(boneName, { rotation: newRotation, position: newPosition, scale: newScale });
  };

  return (
    <div className="p-3 bg-black/50 border border-green-700 rounded space-y-2">
      <div className="font-bold text-xs">Manipulate: {boneName}</div>

      {/* Rotation Controls */}
      <div>
        <label className="text-[10px] opacity-70">Rotation (radians)</label>
        <div className="grid grid-cols-3 gap-1 mt-1">
          <input type="number" step="0.1" value={rotation.x} onChange={e => setRotation({ ...rotation, x: parseFloat(e.target.value) })} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="X" />
          <input type="number" step="0.1" value={rotation.y} onChange={e => setRotation({ ...rotation, y: parseFloat(e.target.value) })} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Y" />
          <input type="number" step="0.1" value={rotation.z} onChange={e => setRotation({ ...rotation, z: parseFloat(e.target.value) })} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Z" />
        </div>
      </div>

      {/* Position Controls */}
      <div>
        <label className="text-[10px] opacity-70">Position</label>
        <div className="grid grid-cols-3 gap-1 mt-1">
          <input type="number" step="0.01" value={position.x} onChange={e => setPosition({ ...position, x: parseFloat(e.target.value) })} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="X" />
          <input type="number" step="0.01" value={position.y} onChange={e => setPosition({ ...position, y: parseFloat(e.target.value) })} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Y" />
          <input type="number" step="0.01" value={position.z} onChange={e => setPosition({ ...position, z: parseFloat(e.target.value) })} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Z" />
        </div>
      </div>

      {/* Scale Controls */}
      <div>
        <label className="text-[10px] opacity-70">Scale</label>
        <div className="grid grid-cols-3 gap-1 mt-1">
          <input type="number" step="0.1" value={scale.x} onChange={e => setScale({ ...scale, x: parseFloat(e.target.value) })} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="X" />
          <input type="number" step="0.1" value={scale.y} onChange={e => setScale({ ...scale, y: parseFloat(e.target.value) })} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Y" />
          <input type="number" step="0.1" value={scale.z} onChange={e => setScale({ ...scale, z: parseFloat(e.target.value) })} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Z" />
        </div>
      </div>

      <button
        onClick={handleApply}
        className="w-full p-2 bg-green-700 hover:bg-green-600 rounded text-xs font-bold"
      >
        APPLY TRANSFORM
      </button>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
