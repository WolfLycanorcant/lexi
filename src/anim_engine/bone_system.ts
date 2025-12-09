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