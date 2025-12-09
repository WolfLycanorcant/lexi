// Central export file for the animation engine

export { BoneFinder, BoneAnimationController } from './bone_system';
export {
  BONE_ANIMATION_LIBRARY,
  BONE_ANIMATION_NAMES,
  type BoneAnimationFunc,
  type AnimationContext
} from './bone_animations';
export {
  FULL_BODY_ANIMATIONS,
  animateBone,
  type BodyAnimation,
  type SkeletonMap
} from './library';
