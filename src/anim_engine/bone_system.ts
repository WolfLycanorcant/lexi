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

  public rebuildCache() {
    this.boneCache.clear();
    this.scene.traverse(obj => {
      if (obj.type === 'Bone') {
        const bone = obj as THREE.Bone;
        this.boneCache.set(bone.name.toLowerCase(), bone);
        this.boneCache.set(bone.uuid, bone);
      }
    });
    console.log(`BoneFinder: Cache rebuilt with ${this.boneCache.size} entries.`);
    console.log('BoneFinder Keys:', Array.from(this.boneCache.keys()));
  }

  private buildCache() {
    this.rebuildCache();
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
        // Case-insensitive partial match
        if (key.toLowerCase().includes(pattern.toLowerCase().trim())) {
          return bone;
        }
        // Also check exact match against the bone name directly (in case cache key is weird)
        if (bone.name.toLowerCase().includes(pattern.toLowerCase().trim())) {
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

  rebuildCache() {
    this.boneFinder.rebuildCache();
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
        const keys = Array.from(this.boneFinder['boneCache'].keys()).slice(0, 50);
        console.warn(`Bone not found for animation "${id}": ${boneName}. Cache size: ${this.boneFinder['boneCache'].size}. Sample keys: ${JSON.stringify(keys)}`);
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

/**
 * Skeleton Map - Auto-maps bones to standard names
 */
export class SkeletonMap {
  hips?: THREE.Bone;
  spine?: THREE.Bone;
  chest?: THREE.Bone;
  neck?: THREE.Bone;
  head?: THREE.Bone;
  leftArm?: THREE.Bone;
  leftForeArm?: THREE.Bone;
  leftHand?: THREE.Bone;
  rightArm?: THREE.Bone;
  rightForeArm?: THREE.Bone;
  rightHand?: THREE.Bone;

  constructor(scene: THREE.Group) {
    const finder = new BoneFinder(scene);

    // HIPS / ROOT
    this.hips = finder.findByPatterns('Hips', 'Pelvis', 'Root', 'mixamorigHips', 'mixamorig_Hips', 'bip001-pelvis', 'bip001_pelvis');

    // SPINE
    this.spine = finder.findByPatterns('Spine', 'Spine1', 'Spine01', 'mixamorigSpine', 'mixamorig_Spine', 'bip001-spine', 'bip001_spine');
    this.chest = finder.findByPatterns('Chest', 'Spine2', 'Spine02', 'UpperChest', 'mixamorigSpine1', 'mixamorigSpine2', 'mixamorig_Spine1', 'mixamorig_Spine2', 'bip001-spine1', 'bip001_spine1');

    // HEAD & NECK
    this.neck = finder.findByPatterns('Neck', 'Neck1', 'mixamorigNeck', 'mixamorig_Neck', 'bip001-neck', 'bip001_neck');
    this.head = finder.findByPatterns('Head', 'Head1', 'mixamorigHead', 'mixamorig_Head', 'bip001-head', 'bip001_head');

    // LEFT ARM
    this.leftArm = finder.findByPatterns('LeftArm', 'L_Arm', 'L_UpperArm', 'mixamorigLeftArm', 'mixamorig_LeftArm', 'bip001-l-upperarm', 'bip001_l_upperarm');
    this.leftForeArm = finder.findByPatterns('LeftForeArm', 'L_ForeArm', 'L_LowerArm', 'mixamorigLeftForeArm', 'mixamorig_LeftForeArm', 'bip001-l-forearm', 'bip001_l_forearm');
    this.leftHand = finder.findByPatterns('LeftHand', 'L_Hand', 'L_Wrist', 'mixamorigLeftHand', 'mixamorig_LeftHand', 'bip001-l-hand', 'bip001_l_hand');

    // RIGHT ARM
    this.rightArm = finder.findByPatterns('RightArm', 'R_Arm', 'R_UpperArm', 'mixamorigRightArm', 'mixamorig_RightArm', 'bip001-r-upperarm', 'bip001_r_upperarm');
    this.rightForeArm = finder.findByPatterns('RightForeArm', 'R_ForeArm', 'R_LowerArm', 'mixamorigRightForeArm', 'mixamorig_RightForeArm', 'bip001-r-forearm', 'bip001_r_forearm');
    this.rightHand = finder.findByPatterns('RightHand', 'R_Hand', 'R_Wrist', 'mixamorigRightHand', 'mixamorig_RightHand', 'bip001-r-hand', 'bip001_r_hand');

    console.log("💀 SkeletonMap Created:", this);
  }
}