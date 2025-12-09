import * as THREE from 'three';

// Helper function to animate a bone
export function animateBone(
  bone: THREE.Bone | undefined,
  rotation: { x?: number; y?: number; z?: number }
) {
  if (!bone) return;
  if (rotation.x !== undefined) bone.rotation.x = rotation.x;
  if (rotation.y !== undefined) bone.rotation.y = rotation.y;
  if (rotation.z !== undefined) bone.rotation.z = rotation.z;
}

// Skeleton map for full-body animations
export interface SkeletonMap {
  hips?: THREE.Bone;
  spine?: THREE.Bone;
  neck?: THREE.Bone;
  head?: THREE.Bone;
  leftArm?: THREE.Bone;
  leftForeArm?: THREE.Bone;
  leftHand?: THREE.Bone;
  rightArm?: THREE.Bone;
  rightForeArm?: THREE.Bone;
  rightHand?: THREE.Bone;
}

// The function signature for all full-body animations
export type BodyAnimation = (skeleton: SkeletonMap, t: number) => void;

export const FULL_BODY_ANIMATIONS: Record<string, BodyAnimation> = {

    // 1. Defiant / Flirty Doubt (Arms Crossed, Hip Out, Head Tilt)
    "Defiant_Flirty": (skel, t) => {
        const breathing = Math.sin(t * 2) * 0.05;

        // HIPS: Shift weight to one side (X axis usually)
        if (skel.hips) {
            // Rotation to pop the hip
            animateBone(skel.hips, { z: -0.1 + breathing * 0.1, y: 0.1 });
        }

        // SPINE: Counter-balance the hip
        animateBone(skel.spine, { z: 0.1, x: 0.1 }); // Lean back slightly

        // HEAD: The "Flirty Doubt" look
        // Tilted to side (Z), Turned slightly (Y), Chin Down (X)
        animateBone(skel.neck, { x: 0.1, y: 0.1 });
        animateBone(skel.head, {
            z: -0.2 + Math.sin(t) * 0.02, // Head tilt
            x: 0.2, // Chin down (doubt)
            y: -0.2 // Looking side-eye
        });

        // ARMS: Crossing Logic
        // Left Arm (Upper) - Rotate inward and forward
        animateBone(skel.leftArm, {
            z: 1.0, // Lift out slightly
            x: 0.8, // Move forward
            y: -0.5 // Rotate in
        });
        // Left Forearm - Bend completely to touch other arm
        animateBone(skel.leftForeArm, {
            z: 0.1, // Twist
            x: 2.2, // Deep bend (Standard T-pose usually requires X bend for elbow)
            y: 0.5
        });

        // Right Arm (Upper)
        animateBone(skel.rightArm, {
            z: -1.0, // Lift out
            x: 0.8, // Forward
            y: 0.5 // In
        });
        // Right Forearm
        animateBone(skel.rightForeArm, {
            x: 2.2, // Deep bend
            y: -0.5
        });

        // Hands - Relaxed
        animateBone(skel.leftHand, { x: 0.2 });
        animateBone(skel.rightHand, { x: 0.2 });
    },

    // 2. Idle - Hands on Hips (Power Pose)
    "Power_Pose": (skel, t) => {
        const breath = Math.sin(t);

        animateBone(skel.spine, { x: -0.1 + breath * 0.02 }); // Chest out

        // Arms -> Hands on hips
        animateBone(skel.leftArm, { z: 0.5, x: -0.2 });
        animateBone(skel.leftForeArm, { x: 1.5, y: -0.5 }); // Bend elbow out

        animateBone(skel.rightArm, { z: -0.5, x: -0.2 });
        animateBone(skel.rightForeArm, { x: 1.5, y: 0.5 });

        animateBone(skel.head, { x: -0.1 }); // Chin up
    },

    // 3. Thinking (Hand to Chin)
    "Thinking_Pose": (skel, t) => {
        // Right arm goes up
        animateBone(skel.rightArm, { x: 1.5, z: -0.2 });
        animateBone(skel.rightForeArm, { x: 2.5, y: 1.5 }); // Hand towards face
        animateBone(skel.rightHand, { x: 0.5 });

        // Left arm supports right elbow
        animateBone(skel.leftArm, { x: 0.5, z: 0.5 });
        animateBone(skel.leftForeArm, { x: 1.5, y: -1.0 });

        animateBone(skel.head, { z: 0.1, x: 0.2 }); // Look down at hand
    }
};
