# Bone Animation System

A powerful system for detecting, manipulating, and animating skeletal bones in 3D models.

## Features

- **Automatic Bone Detection**: Scans loaded GLB/GLTF models and catalogs all bones
- **Flexible Bone Finding**: Find bones by exact name, pattern matching, or UUID
- **Animation Library**: Pre-built animations for facial expressions, gestures, and poses
- **Real-time Animation**: Smooth bone animations driven by Laban movement qualities and vocal metadata
- **Visual Debugging**: Skeleton helper overlay for visualizing bone structure

## Core Components

### 1. BoneFinder

Finds and caches bones from a 3D scene for fast lookups.

```typescript
import { BoneFinder } from './anim_engine/bone_system';

const boneFinder = new BoneFinder(scene);

// Find by exact name
const jawBone = boneFinder.findByName('Jaw');

// Find by pattern (fuzzy matching)
const headBone = boneFinder.findByPatterns('head', 'skull', 'cranium');

// Find all bones matching a regex pattern
const fingerBones = boneFinder.findAllByPattern('finger');

// Get all bones
const allBones = boneFinder.getAllBones();
```

### 2. BoneAnimationController

Registers and manages bone animations, updating them each frame.

```typescript
import { BoneAnimationController } from './anim_engine/bone_system';
import { BONE_ANIMATION_LIBRARY } from './anim_engine/bone_animations';

const controller = new BoneAnimationController(scene);

// Register an animation
controller.registerAnimation(
  'jaw_talking',
  'jaw',
  BONE_ANIMATION_LIBRARY['Jaw_Talk']
);

// Update in your render loop (useFrame in React Three Fiber)
useFrame((state, delta) => {
  const t = state.clock.getElapsedTime();
  const context = {
    isSpeaking: true,
    emotionIntensity: 0.8,
    labanWeight: 'strong'
  };

  controller.update(t, delta, context);
});

// Unregister when done
controller.unregisterAnimation('jaw_talking');

// Or clear all
controller.clearAll();
```

### 3. Bone Animation Library

Pre-built animations for common bone movements.

**Facial Animations:**
- `Jaw_Talk`: Realistic jaw movement for speech
- `Jaw_Smile`: Subtle upward tilt for smiling
- `Eye_Blink`: Periodic natural blinking
- `Eye_LookAt`: Eye tracking (requires target in context)

**Head Animations:**
- `Head_Nod`: Nodding motion (agreement)
- `Head_Shake`: Shaking motion (disagreement)
- `Head_Tilt`: Curious head tilt
- `Head_Breathing`: Subtle breathing motion

**Body Animations:**
- `Spine_Breathe`: Chest expansion during breathing
- `Chest_Puff`: Confidence pose
- `Hip_Sway`: Idle hip sway

**Arm Animations:**
- `Arm_Wave`: Waving motion
- `Arm_Idle`: Subtle idle movement
- `Hand_Gesture`: Talking hand gestures

**Utility:**
- `Reset`: Reset bone to bind pose

### 4. Full Body Poses

Complete character poses combining multiple bones.

```typescript
import { FULL_BODY_ANIMATIONS, SkeletonMap } from './anim_engine/library';

// Build a skeleton map
const skeleton: SkeletonMap = {
  hips: boneFinder.findByPatterns('hips', 'pelvis'),
  spine: boneFinder.findByPatterns('spine'),
  head: boneFinder.findByPatterns('head'),
  leftArm: boneFinder.findByPatterns('left', 'arm', 'upper'),
  // ... etc
};

// Apply a pose
const t = performance.now() * 0.001;
FULL_BODY_ANIMATIONS['Defiant_Flirty'](skeleton, t);
```

**Available Poses:**
- `Defiant_Flirty`: Arms crossed, hip out, head tilt
- `Power_Pose`: Hands on hips, confident stance
- `Thinking_Pose`: Hand to chin, contemplative

## Animation Context

Animations can respond to contextual data:

```typescript
interface AnimationContext {
  isSpeaking?: boolean;        // Is the character speaking?
  emotionIntensity?: number;   // 0-1 intensity of emotion
  labanWeight?: 'light' | 'strong';  // Laban movement quality: weight
  labanTime?: 'sudden' | 'sustained'; // Laban movement quality: time
  customParams?: Record<string, any>; // Custom parameters
}
```

**Laban Movement Analysis:**
- `weight`: Controls amplitude of movement (light = subtle, strong = pronounced)
- `time`: Controls speed/rhythm (sudden = fast/jerky, sustained = slow/smooth)

## Integration Example

Complete example from `index.tsx`:

```typescript
const ModelViewer = ({ url, isSpeaking, labanState }: Props) => {
  const { scene } = useGLTF(url);
  const boneController = useRef<BoneAnimationController | null>(null);

  useEffect(() => {
    // Initialize controller
    boneController.current = new BoneAnimationController(scene);

    // Register animations
    boneController.current.registerAnimation(
      'jaw_talking',
      'jaw',
      BONE_ANIMATION_LIBRARY['Jaw_Talk']
    );

    return () => boneController.current?.clearAll();
  }, [scene]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const context = {
      isSpeaking,
      labanWeight: labanState?.weight,
      labanTime: labanState?.time,
      emotionIntensity: isSpeaking ? 1.0 : 0.3
    };

    boneController.current?.update(t, delta, context);
  });

  return <primitive object={scene} />;
};
```

## Skeleton Detection

The system automatically detects and catalogs skeletal data:

```typescript
interface SkeletonMetadata {
  skinnedMeshes: SkinnedMeshInfo[];
  allBones: BoneInfo[];
  uniqueBoneNames: string[];
  totalBones: number;
  totalMeshes: number;
  hasSkeletalData: boolean;
  animationClips: string[];
}
```

Access via the `onBonesDetected` callback:

```typescript
<ModelViewer
  url={modelUrl}
  onBonesDetected={(metadata) => {
    console.log('Found bones:', metadata.uniqueBoneNames);
    console.log('Total bones:', metadata.totalBones);
  }}
/>
```

## Visual Debugging

Enable skeleton helper to visualize bones:

```typescript
<ModelViewer
  url={modelUrl}
  showSkeletonHelper={true}
  skeletonHelperColor="#00ff41"
/>
```

## Creating Custom Animations

```typescript
import { BoneAnimationFunc } from './bone_animations';

const MyCustomAnimation: BoneAnimationFunc = (bone, t, delta, context) => {
  // Animate based on time
  const frequency = context?.isSpeaking ? 10 : 2;
  const amplitude = 0.2;

  // Smooth interpolation to target rotation
  const targetRotation = Math.sin(t * frequency) * amplitude;
  bone.rotation.x += (targetRotation - bone.rotation.x) * 0.3;
};

// Register it
controller.registerAnimation('my_custom', 'boneName', MyCustomAnimation);
```

## Console Debug Interface

Access bone system from browser console:

```javascript
// Get skeleton metadata
window.__LEXI_DEBUG__.getSkeletonMetadata()

// Get all bone names
window.__LEXI_DEBUG__.getBoneNames()

// Log bone hierarchy
window.__LEXI_DEBUG__.logHierarchy()
```

## Common Bone Name Patterns

Different models may use different naming conventions:

**Head/Face:**
- Head: `head`, `skull`, `cranium`
- Jaw: `jaw`, `mandible`, `chin`
- Eyes: `eye`, `eyeball`
- Neck: `neck`, `cervical`

**Body:**
- Spine: `spine`, `back`, `vertebra`
- Hips: `hips`, `pelvis`, `waist`
- Chest: `chest`, `thorax`, `ribcage`

**Arms:**
- Upper Arm: `arm`, `upperarm`, `shoulder`
- Forearm: `forearm`, `lowerarm`, `elbow`
- Hand: `hand`, `palm`

**Use pattern matching to handle variations:**

```typescript
const jawBone = boneFinder.findByPatterns('jaw', 'mandible', 'chin');
```

## Performance Tips

1. **Cache bone references**: Don't search for bones every frame
2. **Limit active animations**: Only register animations you're currently using
3. **Use pattern matching wisely**: More specific patterns = faster lookups
4. **Avoid creating new objects in animation functions**: Reuse vectors/quaternions

## Troubleshooting

**Bones not found:**
- Check console logs from bone detection
- Verify model has skeletal data (check `hasSkeletalData`)
- Try pattern matching instead of exact names
- Use skeleton helper to visualize bone structure

**Animations not updating:**
- Ensure `controller.update()` is called in render loop
- Check that bone names match between registration and model
- Verify context data is being passed correctly

**Performance issues:**
- Reduce number of active animations
- Optimize animation functions (avoid heavy calculations)
- Use simpler bone hierarchies when possible
