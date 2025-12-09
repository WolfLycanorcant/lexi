import { describe, it, expect, beforeEach } from 'vitest';
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
    controller.registerAnimation('test', 'TestBone', (bone, t, delta, context) => { // Added parameters to match type
      animationCalled = true;
    });

    controller.update(0, 0.016);
    expect(animationCalled).toBe(true);
  });
});
