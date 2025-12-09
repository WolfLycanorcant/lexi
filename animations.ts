
import * as THREE from 'three';

export type AnimationFunc = (ref: THREE.Group, t: number, delta: number) => void;

export const ANIMATION_LIBRARY: Record<string, AnimationFunc> = {
  // --- IDLES (1-10) ---
  "01_Idle_Float": (ref, t) => {
    ref.position.y = -1 + Math.sin(t * 1) * 0.05;
    ref.rotation.y = Math.sin(t * 0.5) * 0.05;
  },
  "02_Idle_Breathing": (ref, t) => {
    ref.position.y = -1;
    const breath = Math.sin(t * 2) * 0.02;
    ref.scale.set(1.5 + breath, 1.5 + breath, 1.5 + breath);
  },
  "03_Idle_DeepSleep": (ref, t) => {
    ref.position.y = -1.1 + Math.sin(t * 0.5) * 0.02;
    ref.rotation.x = 0.1; // Head down slightly
  },
  "04_Idle_Alert": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.y = Math.sin(t * 5) * 0.02; // Jittery look
  },
  "05_Idle_Scanning": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.y = Math.sin(t * 0.5) * 0.5; // Wide look
  },
  "06_Idle_HoverHigh": (ref, t) => {
    ref.position.y = -0.8 + Math.sin(t * 2) * 0.1;
  },
  "07_Idle_HoverLow": (ref, t) => {
    ref.position.y = -1.2 + Math.sin(t * 2) * 0.02;
  },
  "08_Idle_DriftLeft": (ref, t) => {
    ref.position.x = Math.sin(t * 0.2) * 0.5;
    ref.position.y = -1;
  },
  "09_Idle_DriftRight": (ref, t) => {
    ref.position.x = -Math.sin(t * 0.2) * 0.5;
    ref.position.y = -1;
  },
  "10_Idle_Statue": (ref) => {
    ref.position.y = -1;
    ref.rotation.set(0, 0, 0);
  },

  // --- EMOTIONS (11-20) ---
  "11_Emotion_HappyBounce": (ref, t) => {
    ref.position.y = -1 + Math.abs(Math.sin(t * 5)) * 0.2;
  },
  "12_Emotion_NodYes": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.x = Math.abs(Math.sin(t * 5)) * 0.2;
  },
  "13_Emotion_ShakeNo": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.y = Math.sin(t * 8) * 0.3;
  },
  "14_Emotion_ConfusedTilt": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.z = Math.sin(t) * 0.2;
  },
  "15_Emotion_ExcitedShaking": (ref, t) => {
    ref.position.y = -1;
    ref.position.x = (Math.random() - 0.5) * 0.05;
    ref.rotation.y = (Math.random() - 0.5) * 0.1;
  },
  "16_Emotion_ScaredShiver": (ref, t) => {
    ref.position.y = -1;
    ref.position.x = Math.sin(t * 50) * 0.02;
  },
  "17_Emotion_AngrySurge": (ref, t) => {
    const surge = Math.sin(t * 2);
    ref.position.y = -1;
    ref.scale.set(1.5 + (surge > 0.8 ? 0.1 : 0), 1.5 + (surge > 0.8 ? 0.1 : 0), 1.5 + (surge > 0.8 ? 0.1 : 0));
  },
  "18_Emotion_CuriousLean": (ref, t) => {
    ref.position.y = -1;
    ref.position.z = 1; // Lean forward
    ref.rotation.x = 0.2;
  },
  "19_Emotion_Dizzy": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.z = Math.sin(t * 2) * 0.1;
    ref.rotation.x = Math.cos(t * 2) * 0.1;
  },
  "20_Emotion_Triumph": (ref, t) => {
    ref.position.y = -0.8;
    ref.rotation.x = -0.2; // Look up
  },

  // --- GLITCHES (21-30) ---
  "21_Glitch_TwitchX": (ref, t) => {
    ref.position.y = -1;
    if (Math.random() > 0.9) ref.position.x = (Math.random() - 0.5) * 0.5;
    else ref.position.x = 0;
  },
  "22_Glitch_TwitchY": (ref, t) => {
    if (Math.random() > 0.9) ref.position.y = -1 + (Math.random() - 0.5) * 0.5;
    else ref.position.y = -1;
  },
  "23_Glitch_ScaleSnap": (ref, t) => {
    ref.position.y = -1;
    if (Math.random() > 0.95) ref.scale.set(0.1, 1.5, 1.5);
    else ref.scale.set(1.5, 1.5, 1.5);
  },
  "24_Glitch_Teleport": (ref, t) => {
    if (Math.random() > 0.9) ref.position.set((Math.random()-0.5)*2, -1 + (Math.random()-0.5)*2, 0);
  },
  "25_Glitch_Vibrate": (ref, t) => {
    ref.position.set((Math.random()-0.5)*0.1, -1 + (Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1);
  },
  "26_Glitch_FlickerRot": (ref, t) => {
    ref.position.y = -1;
    if (Math.random() > 0.8) ref.rotation.y = Math.random() * Math.PI * 2;
  },
  "27_Glitch_Flatten": (ref, t) => {
    ref.position.y = -1;
    const s = Math.sin(t * 10) > 0 ? 1.5 : 0.1;
    ref.scale.set(1.5, s, 1.5);
  },
  "28_Glitch_Stretch": (ref, t) => {
    ref.position.y = -1;
    const s = Math.sin(t * 20) > 0 ? 3 : 1.5;
    ref.scale.set(1.5, s, 1.5);
  },
  "29_Glitch_Ghost": (ref, t) => {
    ref.position.y = -1;
    ref.position.x = Math.sin(t * 50) * 0.1;
  },
  "30_Glitch_Chaos": (ref, t) => {
    ref.position.set((Math.random()-0.5), -1+(Math.random()-0.5), (Math.random()-0.5));
    ref.rotation.set((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5));
  },

  // --- ACTIONS/MOVEMENTS (31-40) ---
  "31_Action_SpinSlow": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.y = t * 1;
  },
  "32_Action_SpinFast": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.y = t * 10;
  },
  "33_Action_Pace": (ref, t) => {
    ref.position.y = -1;
    ref.position.x = Math.sin(t) * 2;
  },
  "34_Action_ZoomIn": (ref, t) => {
    ref.position.y = -1;
    ref.position.z = 2 + Math.sin(t) * 1;
  },
  "35_Action_Circle": (ref, t) => {
    ref.position.y = -1;
    ref.position.x = Math.cos(t) * 1;
    ref.position.z = Math.sin(t) * 1;
  },
  "36_Action_Figure8": (ref, t) => {
    ref.position.y = -1;
    ref.position.x = Math.sin(t) * 1;
    ref.position.z = Math.sin(t * 2) * 0.5;
  },
  "37_Action_ZigZag": (ref, t) => {
    ref.position.y = -1;
    ref.position.x = Math.sin(t) * 1.5;
    ref.position.z = Math.abs(Math.sin(t * 4)) * 0.5;
  },
  "38_Action_Bow": (ref, t) => {
    ref.position.y = -1;
    const cycle = t % 4;
    if (cycle < 1) ref.rotation.x = cycle * 0.5;
    else if (cycle < 2) ref.rotation.x = 0.5;
    else if (cycle < 3) ref.rotation.x = 0.5 - (cycle - 2) * 0.5;
    else ref.rotation.x = 0;
  },
  "39_Action_Jump": (ref, t) => {
    const jump = Math.abs(Math.sin(t * 3));
    ref.position.y = -1 + jump;
  },
  "40_Action_Sway": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.z = Math.sin(t) * 0.2;
    ref.position.x = Math.sin(t) * 0.5;
  },

  // --- ABSTRACT/SYSTEM (41-50) ---
  "41_Sys_Bootup": (ref, t) => {
    const stage = t % 5;
    ref.position.y = -1;
    if (stage < 1) ref.scale.set(0.1, 0.1, 0.1);
    else if (stage < 3) ref.scale.set(stage-1, stage-1, stage-1);
    else ref.scale.set(1.5, 1.5, 1.5);
  },
  "42_Sys_Shutdown": (ref, t) => {
    ref.position.y = -1 - (t % 2);
    ref.rotation.y += 0.1;
  },
  "43_Sys_Processing": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.z = t * 5;
  },
  "44_Sys_Error": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.x = Math.sin(t * 20) * 0.1;
    ref.rotation.z = Math.cos(t * 15) * 0.1;
  },
  "45_Sys_Updating": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.y = t * 2;
    ref.scale.y = 1.5 + Math.sin(t * 10) * 0.2;
  },
  "46_Sys_Heartbeat": (ref, t) => {
    ref.position.y = -1;
    const beat = Math.pow(Math.sin(t * 3), 63) * 0.3;
    ref.scale.set(1.5+beat, 1.5+beat, 1.5+beat);
  },
  "47_Sys_Levitate": (ref, t) => {
    ref.position.y = -1 + t % 2; // Rise continuously
    if (ref.position.y > 1) ref.position.y = -1;
  },
  "48_Sys_Invert": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.z = Math.PI;
  },
  "49_Sys_Matrix": (ref, t) => {
    ref.position.y = -1;
    ref.rotation.x = t;
    ref.rotation.y = t;
    ref.rotation.z = t;
  },
  "50_Sys_Zero": (ref) => {
    ref.position.set(0, -1, 0);
    ref.rotation.set(0, 0, 0);
    ref.scale.set(1.5, 1.5, 1.5);
  }
};

export const ANIMATION_NAMES = Object.keys(ANIMATION_LIBRARY);
