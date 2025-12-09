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