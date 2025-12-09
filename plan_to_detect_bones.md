# COMPREHENSIVE TECHNICAL PLAN: Skeletal Animation System for GLB Models

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Phase 1: Bone Detection & Logging](#phase-1-bone-detection--logging)
3. [Phase 2: Store and Display Bones in UI](#phase-2-store-and-display-bones-in-ui)
4. [Phase 3: Individual Bone Animation](#phase-3-individual-bone-animation)
5. [Phase 4: Debugging & Testing](#phase-4-debugging--testing)
6. [Performance Optimization](#performance-optimization)
7. [Error Handling & Edge Cases](#error-handling--edge-cases)
8. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

### Current System Analysis
**File:** `index.tsx:52-99`

The current implementation uses:
- `@react-three/fiber` (R3F) Canvas for rendering
- `@react-three/drei` for utilities (useGLTF, OrbitControls)
- Three.js primitives (THREE.Group, THREE.Mesh, etc.)
- Procedural animations that manipulate the entire model as a single `THREE.Group`

**Key Issue:** The model contains skeletal data (JOINTS_0, WEIGHTS_0 attributes) but animations only transform the root Group, ignoring the internal bone hierarchy.

### Three.js Skeletal Animation Architecture

```
GLB File Structure:
├── Scene (THREE.Scene)
│   ├── Mesh_0 (THREE.SkinnedMesh)
│   │   ├── geometry (BufferGeometry with skinning attributes)
│   │   │   ├── attributes.position
│   │   │   ├── attributes.normal
│   │   │   ├── attributes.skinIndex (JOINTS_0) - which bones affect each vertex
│   │   │   └── attributes.skinWeight (WEIGHTS_0) - how much each bone influences
│   │   ├── skeleton (THREE.Skeleton)
│   │   │   ├── bones[] (Array<THREE.Bone>)
│   │   │   ├── boneInverses[] (Matrix4[]) - inverse bind matrices
│   │   │   └── boneMatrices (Float32Array) - flat array for GPU
│   │   └── bindMatrix (Matrix4) - model-space to bone-space transform
│   ├── Mesh_1 (THREE.SkinnedMesh)
│   └── ... (up to 13 meshes as mentioned)
```

**Critical Concepts:**

1. **SkinnedMesh:** A mesh whose vertices are influenced by multiple bones
2. **Skeleton:** Container for the bone hierarchy and transformation matrices
3. **Bone:** A THREE.Object3D with a position, rotation, quaternion, and matrix
4. **Skinning:** The process of deforming mesh vertices based on bone transformations
5. **Bind Pose:** The default "T-pose" or "A-pose" the model was modeled in
6. **Inverse Bind Matrix:** Transforms from model space to bone space at bind time

---

## Phase 1: Bone Detection & Logging

### 1.1 Deep Dive: GLTFLoader Data Structure

**Technical Implementation**

When `useGLTF(url)` loads a model, it returns:
```typescript
{
  scene: THREE.Group,      // Root scene graph
  scenes: THREE.Group[],   // All scenes in the GLTF
  animations: THREE.AnimationClip[],  // Keyframe animations
  cameras: THREE.Camera[],
  asset: Object,           // GLTF metadata
  parser: GLTFParser,      // Internal parser object
  userData: Object,        // Custom user data
  nodes: { [name: string]: THREE.Object3D }  // Named nodes lookup
}
```

**File:** `index.tsx:52-99` (ModelViewer component)

#### Step 1.1.1: Update useGLTF Destructuring

**Current Code:**
```typescript
const { scene } = useGLTF(url);
```

**Updated Code:**
```typescript
const gltf = useGLTF(url);
const { scene, animations, nodes } = gltf;
```

**Why Each Property:**
- `scene`: Root scene graph for traversal
- `animations`: Pre-baked AnimationClips (if any exist in the GLB)
- `nodes`: Direct name-based access to objects (faster than traversal)

#### Step 1.1.2: Implement Comprehensive Bone Detection

**Location:** `index.tsx` - Add new useEffect after the clone useMemo (line ~68)

```typescript
// State to store bone detection results
const [boneData, setBoneData] = useState<{
  skinnedMeshes: Array<{
    name: string;
    uuid: string;
    boneCount: number;
    bones: Array<{ name: string; uuid: string; index: number }>;
  }>;
  allBones: Array<{ name: string; uuid: string; meshName: string }>;
  uniqueBoneNames: string[];
  hasSkeletalData: boolean;
} | null>(null);

useEffect(() => {
  // PART A: Traverse and find all SkinnedMesh objects
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
  const structuredData = {
    skinnedMeshes: skinnedMeshes.map(mesh => ({
      name: mesh.name || 'unnamed',
      uuid: mesh.uuid,
      boneCount: mesh.skeleton?.bones.length || 0,
      bones: (mesh.skeleton?.bones || []).map((bone, idx) => ({
        name: bone.name || `unnamed_bone_${idx}`,
        uuid: bone.uuid,
        index: idx
      }))
    })),
    allBones,
    uniqueBoneNames,
    hasSkeletalData: skinnedMeshes.length > 0
  };

  setBoneData(structuredData);

  // PART G: Call optional callback for parent component
  // (will be added in Phase 2)

}, [clone]); // Depend on clone, not scene, since we use the cloned object
```

### 1.2 Understanding Bone Hierarchies

**Critical Concept: Bone Parent-Child Relationships**

Bones form a tree structure:
```
Root (Hips)
├── Spine
│   ├── Spine1
│   │   ├── Spine2 (Chest)
│   │   │   ├── Neck
│   │   │   │   └── Head
│   │   │   │       ├── LeftEye
│   │   │   │       ├── RightEye
│   │   │   │       └── Jaw
│   │   │   ├── LeftShoulder
│   │   │   │   └── LeftArm
│   │   │   │       └── LeftForeArm
│   │   │   │           └── LeftHand
│   │   │   │               ├── LeftHandThumb1
│   │   │   │               ├── LeftHandIndex1
│   │   │   │               └── ...
│   │   │   └── RightShoulder
│   │   │       └── RightArm
│   │   │           └── ...
│   ├── LeftUpLeg
│   │   └── LeftLeg
│   │       └── LeftFoot
│   └── RightUpLeg
│       └── RightLeg
│           └── RightFoot
```

**Why This Matters:**
- Parent bone transformations affect all children
- Rotating the shoulder also rotates the arm, forearm, and hand
- Must respect hierarchy when animating

#### Step 1.2.1: Implement Hierarchy Visualization

**Add to bone detection logic:**

```typescript
// After bone detection, build hierarchy tree
interface BoneNode {
  bone: THREE.Bone;
  name: string;
  children: BoneNode[];
  depth: number;
}

const buildBoneTree = (bone: THREE.Bone, depth: number = 0): BoneNode => {
  const node: BoneNode = {
    bone,
    name: bone.name || `unnamed_${bone.uuid.slice(0, 8)}`,
    children: [],
    depth
  };

  bone.children.forEach(child => {
    if (child.type === 'Bone') {
      node.children.push(buildBoneTree(child as THREE.Bone, depth + 1));
    }
  });

  return node;
};

const printBoneTree = (node: BoneNode) => {
  const indent = '  '.repeat(node.depth);
  console.log(`${indent}├─ ${node.name} (depth: ${node.depth})`);
  node.children.forEach(child => printBoneTree(child));
};

// Find root bones (bones with no Bone parent)
const rootBones: THREE.Bone[] = [];
skinnedMeshes.forEach(mesh => {
  mesh.skeleton?.bones.forEach(bone => {
    if (!bone.parent || bone.parent.type !== 'Bone') {
      rootBones.push(bone);
    }
  });
});

console.group('=== BONE HIERARCHY ===');
rootBones.forEach(root => {
  const tree = buildBoneTree(root);
  printBoneTree(tree);
});
console.groupEnd();
```

### 1.3 Detecting Animation Clips

**Background:** GLB files can contain baked animations (AnimationClips) separate from the skeleton structure.

```typescript
// After bone detection
if (animations && animations.length > 0) {
  console.group('=== EMBEDDED ANIMATION CLIPS ===');
  console.log(`Found ${animations.length} animation clip(s)`);

  animations.forEach((clip, idx) => {
    console.log(`\nClip[${idx}]: ${clip.name}`);
    console.log(`  Duration: ${clip.duration.toFixed(2)}s`);
    console.log(`  Tracks: ${clip.tracks.length}`);

    // Analyze tracks
    const trackTypes = new Set<string>();
    const targetBones = new Set<string>();

    clip.tracks.forEach(track => {
      // Track name format: ".bones[BoneName].position" or ".bones[BoneName].quaternion"
      const match = track.name.match(/\.bones\[([^\]]+)\]\.(\w+)/);
      if (match) {
        targetBones.add(match[1]); // Bone name
        trackTypes.add(match[2]);  // position, quaternion, scale
      }
    });

    console.log(`  Track Types: ${[...trackTypes].join(', ')}`);
    console.log(`  Affects ${targetBones.size} bone(s):`, [...targetBones]);
  });

  console.groupEnd();
}
```

---

## Phase 2: Store and Display Bones in UI

### 2.1 State Management Architecture

**Location:** `index.tsx:436-451` (Main App component)

#### Step 2.1.1: Define Comprehensive Type Definitions

```typescript
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
```

#### Step 2.1.2: Add State Variables

**Location:** Inside App component after existing state

```typescript
// Bone detection state
const [skeletonMetadata, setSkeletonMetadata] = useState<SkeletonMetadata | null>(null);
const [selectedBone, setSelectedBone] = useState<string>("");
const [selectedMesh, setSelectedMesh] = useState<string>("");
const [boneFilterQuery, setBoneFilterQuery] = useState<string>("");
const [showBoneHierarchy, setShowBoneHierarchy] = useState<boolean>(false);

// Optional: Bone visualization helpers
const [showSkeletonHelper, setShowSkeletonHelper] = useState<boolean>(false);
const [skeletonHelperColor, setSkeletonHelperColor] = useState<string>("#00ff41");
```

### 2.2 Callback Communication Pattern

**Architecture:** ModelViewer (child) → App (parent) data flow

#### Step 2.2.1: Update ModelViewer Props Interface

**File:** `index.tsx:52-99`

```typescript
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
  // ... existing code ...
};
```

#### Step 2.2.2: Trigger Callback After Detection

**Add to bone detection useEffect:**

```typescript
useEffect(() => {
  // ... bone detection logic from Phase 1 ...

  // Build metadata object
  const metadata: SkeletonMetadata = {
    skinnedMeshes: skinnedMeshes.map(mesh => ({
      name: mesh.name || 'unnamed',
      uuid: mesh.uuid,
      boneCount: mesh.skeleton?.bones.length || 0,
      bones: (mesh.skeleton?.bones || []).map((bone, idx) => ({
        name: bone.name || `unnamed_bone_${idx}`,
        uuid: bone.uuid,
        meshName: mesh.name,
        index: idx,
        hasParent: bone.parent !== null && bone.parent.type === 'Bone',
        childCount: bone.children.filter(c => c.type === 'Bone').length
      })),
      hasAnimations: animations.length > 0
    })),
    allBones: allBonesArray,
    uniqueBoneNames: uniqueNames,
    totalBones: allBonesArray.length,
    totalMeshes: skinnedMeshes.length,
    hasSkeletalData: skinnedMeshes.length > 0,
    animationClips: animations.map(clip => clip.name)
  };

  // Call parent callback
  if (onBonesDetected) {
    onBonesDetected(metadata);
  }

}, [clone, onBonesDetected]);
```

#### Step 2.2.3: Handle Callback in App Component

**File:** `index.tsx` - App component

```typescript
const handleBonesDetected = useCallback((metadata: SkeletonMetadata) => {
  console.log('Bones detected in App:', metadata);
  setSkeletonMetadata(metadata);

  // Optional: Auto-select first bone
  if (metadata.uniqueBoneNames.length > 0) {
    setSelectedBone(metadata.uniqueBoneNames[0]);
  }
}, []);

// Update Avatar3D call
<Avatar3D
  modelUrl={avatarUrl}
  isSpeaking={isSpeaking}
  animationName={currentAnimation}
  labanState={currentLabanState}
  onBonesDetected={handleBonesDetected}
  showSkeletonHelper={showSkeletonHelper}
  skeletonHelperColor={skeletonHelperColor}
/>
```

### 2.3 Advanced UI Components

**Location:** `index.tsx:239-424` (SettingsModal component)

#### Step 2.3.1: Bone List Panel

**Add after Animation Library section (around line 376):**

```typescript
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
    </>
  )}
</div>
```

#### Step 2.3.2: Hierarchy Tree View (Advanced)

**Add toggle for hierarchy view:**

```typescript
{showBoneHierarchy && skeletonMetadata?.hasSkeletalData && (
  <div className="mt-3 p-2 bg-black/50 border border-green-700 rounded max-h-80 overflow-y-auto">
    <div className="text-xs font-bold mb-2">Bone Hierarchy:</div>
    {/* TODO: Implement recursive tree component */}
    <BoneHierarchyTree skeletonMetadata={skeletonMetadata} />
  </div>
)}
```

**Recursive Tree Component:**

```typescript
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
```

---

## Phase 3: Individual Bone Animation

### 3.1 Animation System Architecture

**Core Concept:** Bone animations manipulate the rotation/position/scale of individual THREE.Bone objects within a skeleton, triggering GPU skinning to deform the mesh.

#### Step 3.1.1: Bone Animation Function Types

**File:** Create new file `src/anim_engine/bone_animations.ts`

```typescript
import * as THREE from 'three';

/**
 * Bone animation function signature
 * @param bone - The THREE.Bone to animate
 * @param t - Time in seconds (elapsed time)
 * @param delta - Frame delta time in seconds
 * @param context - Additional context (speaking state, emotion, etc.)
 */
export type BoneAnimationFunc = (
  bone: THREE.Bone,
  t: number,
  delta: number,
  context?: AnimationContext
) => void;

export interface AnimationContext {
  isSpeaking?: boolean;
  emotionIntensity?: number; // 0-1
  labanWeight?: 'light' | 'strong';
  labanTime?: 'sudden' | 'sustained';
  customParams?: Record<string, any>;
}

/**
 * Bone animation library: maps animation names to functions
 */
export const BONE_ANIMATION_LIBRARY: Record<string, BoneAnimationFunc> = {

  // === FACIAL ANIMATIONS ===

  "Jaw_Talk": (bone, t, delta, context) => {
    // Realistic jaw movement for speech
    // Frequency varies based on speech intensity
    const freq = context?.isSpeaking ? 12 : 0;
    const amplitude = context?.isSpeaking ? 0.15 : 0;

    // Target rotation (open mouth)
    const targetX = Math.sin(t * freq) * amplitude;

    // Smooth interpolation
    bone.rotation.x += (targetX - bone.rotation.x) * 0.3;
  },

  "Jaw_Smile": (bone, t) => {
    // Subtle upward tilt for smiling
    bone.rotation.x = -0.05;
  },

  "Eye_Blink": (bone, t) => {
    // Periodic blinking (every 3-5 seconds)
    const blinkCycle = t % 4;
    const isBlinking = blinkCycle < 0.15;

    // Scale eyelid bone vertically
    const targetScale = isBlinking ? 0.1 : 1.0;
    bone.scale.y += (targetScale - bone.scale.y) * 0.5;
  },

  "Eye_LookAt": (bone, t, delta, context) => {
    // Look at target (would need target position in context)
    if (context?.customParams?.lookTarget) {
      const target = context.customParams.lookTarget as THREE.Vector3;
      // Convert target to local space and adjust rotation
      // This is simplified - real implementation needs inverse kinematics
    }
  },

  // === HEAD ANIMATIONS ===

  "Head_Nod": (bone, t) => {
    // Nodding motion (agreement)
    bone.rotation.x = Math.sin(t * 2) * 0.3;
  },

  "Head_Shake": (bone, t) => {
    // Shaking motion (disagreement)
    bone.rotation.y = Math.sin(t * 4) * 0.4;
  },

  "Head_Tilt": (bone, t) => {
    // Curious tilt
    bone.rotation.z = Math.sin(t * 0.5) * 0.2;
  },

  "Head_Breathing": (bone, t) => {
    // Subtle breathing motion
    const breathCycle = Math.sin(t * 0.5); // ~6 breaths/min
    bone.position.y = breathCycle * 0.01;
    bone.rotation.x = breathCycle * 0.02;
  },

  // === UPPER BODY ANIMATIONS ===

  "Spine_Breathe": (bone, t) => {
    // Chest expansion during breathing
    const breath = Math.sin(t * 0.5);
    bone.scale.x = 1 + breath * 0.03;
    bone.scale.z = 1 + breath * 0.03;
    bone.position.y = breath * 0.005;
  },

  "Chest_Puff": (bone, t) => {
    // Confidence pose
    bone.rotation.x = -0.1; // Chest out
    bone.scale.x = 1.05;
  },

  // === ARM ANIMATIONS ===

  "Arm_Wave": (bone, t) => {
    // Waving motion (use on shoulder/upper arm)
    bone.rotation.z = Math.sin(t * 4) * 0.5 + 0.5; // Swing arm
  },

  "Arm_Idle": (bone, t) => {
    // Subtle idle arm movement
    bone.rotation.x = Math.sin(t * 0.3) * 0.05;
  },

  "Hand_Gesture": (bone, t) => {
    // Talking hand gestures
    bone.rotation.x = Math.sin(t * 3) * 0.2;
    bone.rotation.z = Math.cos(t * 2) * 0.15;
  },

  // === FINGER ANIMATIONS ===

  "Finger_Curl": (bone, t) => {
    // Curl fingers (fist)
    bone.rotation.z = 1.2; // Radians (~70 degrees)
  },

  "Finger_Idle": (bone, t) => {
    // Subtle finger movement
    bone.rotation.z = Math.sin(t * 1.5 + bone.position.x) * 0.1;
  },

  // === LOWER BODY ANIMATIONS ===

  "Hip_Sway": (bone, t) => {
    // Idle hip sway
    bone.rotation.z = Math.sin(t * 0.5) * 0.05;
  },

  // === UTILITY ANIMATIONS ===

  "Reset": (bone) => {
    // Reset bone to bind pose
    bone.rotation.set(0, 0, 0);
    bone.position.set(0, 0, 0);
    bone.scale.set(1, 1, 1);
  }
};

export const BONE_ANIMATION_NAMES = Object.keys(BONE_ANIMATION_LIBRARY);
```

### 3.2 Bone Targeting System

**File:** Update `src/anim_engine/bone_system.ts`

**Current code review:** The existing `bone_system.ts` has basic bone finding and animation. We'll enhance it.

```typescript
import * as THREE from 'three';

/**
 * Enhanced bone finder with caching
 */
export class BoneFinder {
  private boneCache: Map<string, THREE.Bone> = new Map();
  private scene: THREE.Group;

  constructor(scene: THREE.Group) {
    this.scene = scene;
    this.buildCache();
  }

  private buildCache() {
    this.scene.traverse(obj => {
      if (obj.type === 'Bone') {
        const bone = obj as THREE.Bone;
        this.boneCache.set(bone.name.toLowerCase(), bone);
        this.boneCache.set(bone.uuid, bone);
      }
    });
  }

  /**
   * Find bone by exact name (case insensitive)
   */
  findByName(name: string): THREE.Bone | null {
    return this.boneCache.get(name.toLowerCase()) || null;
  }

  /**
   * Find bone by UUID
   */
  findByUUID(uuid: string): THREE.Bone | null {
    return this.boneCache.get(uuid) || null;
  }

  /**
   * Find bone by fuzzy matching (multiple candidate names)
   */
  findByPatterns(...patterns: string[]): THREE.Bone | null {
    for (const [key, bone] of this.boneCache) {
      for (const pattern of patterns) {
        if (key.includes(pattern.toLowerCase())) {
          return bone;
        }
      }
    }
    return null;
  }

  /**
   * Find all bones matching a pattern
   */
  findAllByPattern(pattern: string): THREE.Bone[] {
    const results: THREE.Bone[] = [];
    const regex = new RegExp(pattern, 'i');

    for (const [key, bone] of this.boneCache) {
      if (regex.test(key)) {
        results.push(bone);
      }
    }

    return results;
  }

  /**
   * Get all bones in the scene
   */
  getAllBones(): THREE.Bone[] {
    return Array.from(this.boneCache.values());
  }
}

/**
 * Bone animation controller
 */
export class BoneAnimationController {
  private boneFinder: BoneFinder;
  private activeAnimations: Map<string, { boneName: string; animation: Function }> = new Map();

  constructor(scene: THREE.Group) {
    this.boneFinder = new BoneFinder(scene);
  }

  /**
   * Register a bone animation
   */
  registerAnimation(
    animationId: string,
    boneNameOrPattern: string,
    animationFunc: (bone: THREE.Bone, t: number, delta: number, context?: any) => void
  ) {
    this.activeAnimations.set(animationId, {
      boneName: boneNameOrPattern,
      animation: animationFunc
    });
  }

  /**
   * Unregister a bone animation
   */
  unregisterAnimation(animationId: string) {
    this.activeAnimations.delete(animationId);
  }

  /**
   * Update all registered animations (call in useFrame)
   */
  update(t: number, delta: number, context?: any) {
    for (const [id, { boneName, animation }] of this.activeAnimations) {
      const bone = this.boneFinder.findByPatterns(boneName);
      if (bone) {
        animation(bone, t, delta, context);
      } else {
        console.warn(`Bone not found for animation "${id}": ${boneName}`);
      }
    }
  }

  /**
   * Clear all animations
   */
  clearAll() {
    this.activeAnimations.clear();
  }

  /**
   * Get the bone finder for manual bone access
   */
  getBoneFinder(): BoneFinder {
    return this.boneFinder;
  }
}
```

### 3.3 Integration with useFrame

**File:** `index.tsx:69-96` (ModelViewer useFrame hook)

```typescript
const ModelViewer = ({ url, isSpeaking, animationName, labanState, ... }: ModelViewerProps) => {
  const { scene, animations } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);
  const clone = React.useMemo(() => scene.clone(), [scene]);

  // NEW: Bone animation controller
  const boneController = useRef<BoneAnimationController | null>(null);

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
    const weightFactor = labanState?.weight === 'strong' ? 1.5 : 0.8;
    const timeFactor = labanState?.time === 'sudden' ? 2.0 : 0.5;

    // WHOLE-MODEL ANIMATION (existing system)
    if (animationName && ANIMATION_LIBRARY[animationName]) {
      ANIMATION_LIBRARY[animationName](modelRef.current, t * timeFactor, delta);
    } else {
      // Default idle
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
  });

  return <primitive object={clone} ref={modelRef} scale={1.5} position={[0, -1, 0]} />;
};
```

### 3.4 Advanced: Inverse Kinematics (IK)

**Concept:** IK allows targeting a bone chain to reach a specific point (e.g., hand reaching for an object).

**Implementation sketch (advanced):**

```typescript
/**
 * Simple 2-bone IK solver (e.g., shoulder -> elbow -> hand)
 */
export class TwoBoneIK {
  private bone1: THREE.Bone; // Upper arm
  private bone2: THREE.Bone; // Forearm
  private target: THREE.Vector3;

  constructor(bone1: THREE.Bone, bone2: THREE.Bone) {
    this.bone1 = bone1;
    this.bone2 = bone2;
    this.target = new THREE.Vector3();
  }

  setTarget(target: THREE.Vector3) {
    this.target.copy(target);
  }

  solve() {
    // Get bone lengths
    const length1 = this.bone1.position.distanceTo(this.bone2.position);
    const length2 = this.bone2.position.distanceTo(this.bone2.children[0].position);

    // Get target distance
    const targetDist = this.bone1.position.distanceTo(this.target);

    // Check if target is reachable
    if (targetDist > length1 + length2) {
      // Target too far - stretch toward it
      this.bone1.lookAt(this.target);
      this.bone2.rotation.set(0, 0, 0);
      return;
    }

    // Law of cosines to find joint angles
    const angle1 = Math.acos(
      (length1 * length1 + targetDist * targetDist - length2 * length2) /
      (2 * length1 * targetDist)
    );

    const angle2 = Math.acos(
      (length1 * length1 + length2 * length2 - targetDist * targetDist) /
      (2 * length1 * length2)
    );

    // Apply rotations
    this.bone1.rotation.x = angle1;
    this.bone2.rotation.x = Math.PI - angle2;
  }
}
```

---

## Phase 4: Debugging & Testing

### 4.1 Skeleton Helper Visualization

**Implementation in ModelViewer:**

```typescript
const ModelViewer = ({ showSkeletonHelper, skeletonHelperColor, ... }: ModelViewerProps) => {
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
      helper.material.linewidth = 2;
      (helper.material as THREE.LineBasicMaterial).color.set(skeletonHelperColor);

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
  }, [showSkeletonHelper, skeletonHelperColor]);

  // ... rest of component
};
```

### 4.2 Debug Console Commands

**Add global debugging interface:**

```typescript
// In App component or index.tsx
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
```

### 4.3 Real-time Bone Inspector

**Add to UI (dev mode only):**

```typescript
{import.meta.env.DEV && selectedBone && (
  <div className="fixed bottom-4 right-4 w-80 bg-black/90 border border-green-500 p-3 rounded text-xs font-mono z-50">
    <div className="font-bold mb-2 text-green-400">BONE INSPECTOR</div>
    <div className="space-y-1">
      <div><span className="opacity-70">Name:</span> {selectedBone}</div>
      {/* Real-time bone transform display would require state updates from useFrame */}
      <div className="text-[10px] opacity-50 mt-2">
        (Real-time transform tracking would be implemented here)
      </div>
    </div>
  </div>
)}
```

### 4.4 Bone Manipulation Panel (Advanced)

**Interactive bone control for testing:**

```typescript
const BoneManipulatorPanel: React.FC<{ boneName: string }> = ({ boneName }) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });

  const handleApply = () => {
    // This would need to communicate with the bone controller
    console.log(`Applying transform to ${boneName}:`, { rotation, position, scale });
  };

  return (
    <div className="p-3 bg-black/50 border border-green-700 rounded space-y-2">
      <div className="font-bold text-xs">Manipulate: {boneName}</div>

      {/* Rotation Controls */}
      <div>
        <label className="text-[10px] opacity-70">Rotation (radians)</label>
        <div className="grid grid-cols-3 gap-1 mt-1">
          <input type="number" step="0.1" value={rotation.x} onChange={e => setRotation({...rotation, x: parseFloat(e.target.value)})} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="X" />
          <input type="number" step="0.1" value={rotation.y} onChange={e => setRotation({...rotation, y: parseFloat(e.target.value)})} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Y" />
          <input type="number" step="0.1" value={rotation.z} onChange={e => setRotation({...rotation, z: parseFloat(e.target.value)})} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Z" />
        </div>
      </div>

      {/* Position Controls */}
      <div>
        <label className="text-[10px] opacity-70">Position</label>
        <div className="grid grid-cols-3 gap-1 mt-1">
          <input type="number" step="0.01" value={position.x} onChange={e => setPosition({...position, x: parseFloat(e.target.value)})} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="X" />
          <input type="number" step="0.01" value={position.y} onChange={e => setPosition({...position, y: parseFloat(e.target.value)})} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Y" />
          <input type="number" step="0.01" value={position.z} onChange={e => setPosition({...position, z: parseFloat(e.target.value)})} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Z" />
        </div>
      </div>

      {/* Scale Controls */}
      <div>
        <label className="text-[10px] opacity-70">Scale</label>
        <div className="grid grid-cols-3 gap-1 mt-1">
          <input type="number" step="0.1" value={scale.x} onChange={e => setScale({...scale, x: parseFloat(e.target.value)})} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="X" />
          <input type="number" step="0.1" value={scale.y} onChange={e => setScale({...scale, y: parseFloat(e.target.value)})} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Y" />
          <input type="number" step="0.1" value={scale.z} onChange={e => setScale({...scale, z: parseFloat(e.target.value)})} className="p-1 bg-black border border-green-800 rounded text-xs" placeholder="Z" />
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
```

---

## Performance Optimization

### 5.1 Bone Animation Performance

**Problem:** Animating hundreds of bones per frame can be expensive.

**Solutions:**

#### 5.1.1 Selective Bone Updates

Only animate bones that are visible or relevant:

```typescript
class OptimizedBoneAnimationController extends BoneAnimationController {
  private priorityBones: Set<string> = new Set();
  private updateFrequency: Map<string, number> = new Map();
  private lastUpdate: Map<string, number> = new Map();

  setPriority(boneName: string, priority: 'high' | 'medium' | 'low') {
    const frequency = priority === 'high' ? 1 : priority === 'medium' ? 2 : 4;
    this.updateFrequency.set(boneName, frequency);
  }

  update(t: number, delta: number, context?: any) {
    const frame = Math.floor(t * 60); // Assuming 60 FPS

    for (const [id, { boneName, animation }] of this.activeAnimations) {
      const freq = this.updateFrequency.get(boneName) || 1;

      // Only update if frame is divisible by frequency
      if (frame % freq === 0) {
        const bone = this.getBoneFinder().findByPatterns(boneName);
        if (bone) {
          animation(bone, t, delta, context);
        }
      }
    }
  }
}
```

#### 5.1.2 Bone LOD (Level of Detail)

```typescript
enum BoneLOD {
  HIGH,    // All bones (close-up)
  MEDIUM,  // Major bones only (medium distance)
  LOW      // Root bone only (far away)
}

class LODBoneController {
  private currentLOD: BoneLOD = BoneLOD.HIGH;

  setLOD(distance: number) {
    if (distance < 5) this.currentLOD = BoneLOD.HIGH;
    else if (distance < 15) this.currentLOD = BoneLOD.MEDIUM;
    else this.currentLOD = BoneLOD.LOW;
  }

  shouldAnimateBone(boneName: string): boolean {
    switch (this.currentLOD) {
      case BoneLOD.HIGH:
        return true;
      case BoneLOD.MEDIUM:
        return this.isMajorBone(boneName);
      case BoneLOD.LOW:
        return this.isRootBone(boneName);
    }
  }

  private isMajorBone(name: string): boolean {
    const major = ['head', 'neck', 'spine', 'chest', 'hips', 'shoulder', 'elbow', 'knee'];
    return major.some(m => name.toLowerCase().includes(m));
  }

  private isRootBone(name: string): boolean {
    return name.toLowerCase().includes('hips') || name.toLowerCase().includes('root');
  }
}
```

### 5.2 Memory Management

#### 5.2.1 Proper Cleanup

```typescript
useEffect(() => {
  const controller = new BoneAnimationController(clone);

  return () => {
    // Clean up animations
    controller.clearAll();

    // Clean up skeleton helpers
    if (skeletonHelperRef.current) {
      skeletonHelperRef.current.dispose();
    }

    // Dispose geometries and materials
    clone.traverse(obj => {
      if ((obj as any).geometry) {
        (obj as any).geometry.dispose();
      }
      if ((obj as any).material) {
        const mat = (obj as any).material;
        if (Array.isArray(mat)) {
          mat.forEach(m => m.dispose());
        } else {
          mat.dispose();
        }
      }
    });
  };
}, [clone]);
```

### 5.3 GPU Skinning Optimization

**Background:** Three.js uses GPU skinning by default (vertex shader computes bone transformations).

**Verify GPU skinning is enabled:**

```typescript
useEffect(() => {
  clone.traverse(obj => {
    if (obj.type === 'SkinnedMesh') {
      const mesh = obj as THREE.SkinnedMesh;

      // Force GPU skinning (should be default)
      mesh.frustumCulled = true;

      // Log skinning method
      console.log(`${mesh.name} skinning:`, {
        boneCount: mesh.skeleton.bones.length,
        maxBones: mesh.skeleton.boneMatrices.length / 16,
        gpuSkinning: true // Three.js always uses GPU skinning
      });
    }
  });
}, [clone]);
```

---

## Error Handling & Edge Cases

### 6.1 Missing Bones

```typescript
const findBoneWithFallback = (controller: BoneAnimationController, ...candidates: string[]): THREE.Bone | null => {
  for (const candidate of candidates) {
    const bone = controller.getBoneFinder().findByPatterns(candidate);
    if (bone) {
      console.log(`Found bone: ${bone.name} (searched: ${candidate})`);
      return bone;
    }
  }

  console.warn(`No bone found for candidates: ${candidates.join(', ')}`);
  return null;
};

// Usage
const jaw = findBoneWithFallback(
  boneController.current,
  'jaw',
  'lowerjaw',
  'mandible',
  'chin',
  'mouth'
);
```

### 6.2 Malformed Skeleton Data

```typescript
const validateSkeleton = (mesh: THREE.SkinnedMesh): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!mesh.skeleton) {
    errors.push('No skeleton found');
    return { valid: false, errors };
  }

  if (mesh.skeleton.bones.length === 0) {
    errors.push('Skeleton has no bones');
  }

  if (mesh.skeleton.boneInverses.length !== mesh.skeleton.bones.length) {
    errors.push(`Bone inverses mismatch: ${mesh.skeleton.boneInverses.length} vs ${mesh.skeleton.bones.length}`);
  }

  if (!mesh.geometry.attributes.skinIndex) {
    errors.push('Missing skinIndex attribute');
  }

  if (!mesh.geometry.attributes.skinWeight) {
    errors.push('Missing skinWeight attribute');
  }

  return { valid: errors.length === 0, errors };
};
```

### 6.3 Extreme Bone Transforms

```typescript
const clampBoneRotation = (bone: THREE.Bone, limits: { x?: [number, number]; y?: [number, number]; z?: [number, number] }) => {
  if (limits.x) {
    bone.rotation.x = THREE.MathUtils.clamp(bone.rotation.x, limits.x[0], limits.x[1]);
  }
  if (limits.y) {
    bone.rotation.y = THREE.MathUtils.clamp(bone.rotation.y, limits.y[0], limits.y[1]);
  }
  if (limits.z) {
    bone.rotation.z = THREE.MathUtils.clamp(bone.rotation.z, limits.z[0], limits.z[1]);
  }
};

// Usage: Prevent jaw from rotating too far
BONE_ANIMATION_LIBRARY["Jaw_Talk_Safe"] = (bone, t, delta, context) => {
  const targetX = Math.sin(t * 12) * 0.15;
  bone.rotation.x += (targetX - bone.rotation.x) * 0.3;

  // Clamp to realistic jaw limits
  clampBoneRotation(bone, {
    x: [-0.2, 0.5],  // Can't close too much or open too wide
    y: [-0.1, 0.1],  // Minimal left/right
    z: [-0.05, 0.05] // Minimal roll
  });
};
```

---

## Testing Strategy

### 7.1 Unit Tests

**File:** Create `tests/bone_system.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BoneFinder, BoneAnimationController } from '../src/anim_engine/bone_system';

describe('BoneFinder', () => {
  let scene: THREE.Group;
  let boneFinder: BoneFinder;

  beforeEach(() => {
    // Create test skeleton
    scene = new THREE.Group();
    const rootBone = new THREE.Bone();
    rootBone.name = 'Root';

    const spineBone = new THREE.Bone();
    spineBone.name = 'Spine';
    rootBone.add(spineBone);

    const headBone = new THREE.Bone();
    headBone.name = 'Head';
    spineBone.add(headBone);

    scene.add(rootBone);
    boneFinder = new BoneFinder(scene);
  });

  it('should find bone by exact name', () => {
    const bone = boneFinder.findByName('Root');
    expect(bone).not.toBeNull();
    expect(bone?.name).toBe('Root');
  });

  it('should find bone by pattern', () => {
    const bone = boneFinder.findByPatterns('head', 'skull');
    expect(bone).not.toBeNull();
    expect(bone?.name).toBe('Head');
  });

  it('should return null for non-existent bone', () => {
    const bone = boneFinder.findByName('NonExistent');
    expect(bone).toBeNull();
  });
});

describe('BoneAnimationController', () => {
  it('should register and update animations', () => {
    const scene = new THREE.Group();
    const bone = new THREE.Bone();
    bone.name = 'TestBone';
    scene.add(bone);

    const controller = new BoneAnimationController(scene);

    let animationCalled = false;
    controller.registerAnimation('test', 'TestBone', () => {
      animationCalled = true;
    });

    controller.update(0, 0.016);
    expect(animationCalled).toBe(true);
  });
});
```

### 7.2 Integration Tests

**File:** Create `tests/model_loading.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

describe('GLB Model Loading', () => {
  it('should load model with skeletal data', async () => {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/path/to/test-model.glb');

    let foundSkinnedMesh = false;
    gltf.scene.traverse(obj => {
      if (obj.type === 'SkinnedMesh') {
        foundSkinnedMesh = true;
        const mesh = obj as THREE.SkinnedMesh;
        expect(mesh.skeleton).toBeDefined();
        expect(mesh.skeleton.bones.length).toBeGreaterThan(0);
      }
    });

    expect(foundSkinnedMesh).toBe(true);
  });
});
```

### 7.3 Visual Regression Tests

Use Playwright or similar to capture screenshots:

```typescript
import { test, expect } from '@playwright/test';

test('skeleton helper renders correctly', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Load model
  await page.click('[data-testid="load-model-button"]');
  await page.waitForTimeout(2000); // Wait for model load

  // Enable skeleton helper
  await page.click('[data-testid="skeleton-helper-toggle"]');
  await page.waitForTimeout(500);

  // Take screenshot
  await expect(page).toHaveScreenshot('skeleton-helper.png');
});
```

---

## Implementation Checklist

### Phase 1: Bone Detection
- [ ] Update useGLTF to extract nodes and animations
- [ ] Implement comprehensive bone traversal logic
- [ ] Log skeleton hierarchy to console
- [ ] Verify skinning attributes (skinIndex, skinWeight)
- [ ] Create structured bone metadata object
- [ ] Test with Stellar Blade model

### Phase 2: UI Integration
- [ ] Define TypeScript interfaces for bone data
- [ ] Add state management for skeleton metadata
- [ ] Implement callback from ModelViewer to App
- [ ] Create bone list panel with filtering
- [ ] Add mesh selector dropdown
- [ ] Implement bone selection and info display
- [ ] Add skeleton helper toggle
- [ ] Create hierarchy tree view (optional)
- [ ] Test UI responsiveness with large bone lists

### Phase 3: Bone Animation
- [ ] Create bone_animations.ts with animation library
- [ ] Enhance bone_system.ts with BoneFinder and BoneAnimationController
- [ ] Integrate BoneAnimationController into ModelViewer
- [ ] Implement jaw animation for speaking
- [ ] Add breathing animations (head, spine)
- [ ] Test animation blending with whole-model animations
- [ ] Implement Laban integration for bone animations
- [ ] Add real-time bone transform updates
- [ ] Implement IK system (advanced/optional)

### Phase 4: Debugging & Testing
- [ ] Add SkeletonHelper visualization
- [ ] Create global debug interface (window.__LEXI_DEBUG__)
- [ ] Implement bone inspector panel
- [ ] Add bone manipulation controls
- [ ] Write unit tests for bone finding
- [ ] Write integration tests for model loading
- [ ] Create visual regression tests
- [ ] Performance profiling with Chrome DevTools
- [ ] Test with multiple GLB models
- [ ] Document common bone naming conventions

### Performance & Polish
- [ ] Implement LOD system for bone animations
- [ ] Add selective bone update frequency
- [ ] Optimize memory usage and cleanup
- [ ] Add error handling for missing bones
- [ ] Implement bone rotation clamping
- [ ] Add loading states for bone detection
- [ ] Create user documentation
- [ ] Record demo video of bone animations

---

## Expected Results

After full implementation:

1. **Console Output:** Detailed bone hierarchy logs on model load
2. **UI:** Interactive bone list showing all 100+ bones in Stellar Blade model
3. **Visualization:** Skeleton helper overlay showing bone structure
4. **Animation:** Jaw moves when speaking, subtle breathing in head/chest
5. **Debug Tools:** Browser console commands to manipulate bones manually
6. **Performance:** 60 FPS maintained with all bone animations active

---

## Technical Notes

### Coordinate Systems
- Three.js uses right-handed coordinate system: +Y up, +Z forward (toward camera), +X right
- Bone rotations use Euler angles (XYZ order by default)
- Parent transforms affect children (hierarchical transformations)

### Quaternions vs Euler Angles
- Bones store both `rotation` (Euler) and `quaternion`
- Quaternions avoid gimbal lock but are less intuitive
- For simple animations, Euler angles are fine
- For complex rotations (e.g., IK), use quaternions

### Bind Pose
- The "bind pose" is the pose when the model was created
- `skeleton.boneInverses` stores the inverse bind matrices
- These matrices transform from bone space to mesh space
- Don't modify bind pose unless you know what you're doing!

### Skinning Math
```glsl
// Simplified vertex shader (GPU skinning)
vec4 skinnedVertex =
  (boneMatrix0 * vertex) * skinWeight0 +
  (boneMatrix1 * vertex) * skinWeight1 +
  (boneMatrix2 * vertex) * skinWeight2 +
  (boneMatrix3 * vertex) * skinWeight3;
```

### Common Pitfalls
1. **Modifying bone position instead of rotation:** Usually you only rotate bones, not translate
2. **Forgetting to update skeleton:** Call `skeleton.update()` if manually modifying matrices
3. **Animation conflicts:** Whole-model animations can conflict with bone animations
4. **Coordinate space confusion:** Bone rotations are in local space, not world space
5. **Extreme rotations:** Bones can flip or gimbal lock with large rotations

---

## Resources

- [Three.js SkinnedMesh Docs](https://threejs.org/docs/#api/en/objects/SkinnedMesh)
- [Three.js Skeleton Docs](https://threejs.org/docs/#api/en/objects/Skeleton)
- [GLTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins)
- [Skeletal Animation Tutorial](https://learnopengl.com/Guest-Articles/2020/Skeletal-Animation)

---

**End of Comprehensive Technical Plan**
