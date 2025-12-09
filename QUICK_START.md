# Quick Start - Bone Detection & Animation

## ✅ Everything is Ready!

The bone detection and animation system is fully implemented and working.

## 🚀 Start the App

```bash
npm run dev
```

Then open: `http://localhost:5173`

## 🔍 View Bone Data

### Method 1: Settings Panel
1. Click the **Settings** icon (⚙️) in the top-right
2. Scroll down to **"SKELETAL DATA"** section
3. You'll see:
   - Total bones detected (e.g., "274 bones in 1 mesh(es)")
   - Searchable list of all bones
   - Bone details when selected
   - Skeleton hierarchy tree
   - Skeleton helper toggle (visualizes bones in 3D)

### Method 2: Browser Console
Open DevTools Console (F12) and try:

```javascript
// Get all skeleton metadata
window.__LEXI_DEBUG__.getSkeletonMetadata()

// Get list of bone names
window.__LEXI_DEBUG__.getBoneNames()

// Log full hierarchy
window.__LEXI_DEBUG__.logHierarchy()
```

## 🎭 Active Animations

The system automatically animates these bones:

**When Speaking:**
- **Jaw** - Opens and closes realistically
- **Head** - Subtle breathing motion
- **Spine** - Chest expansion from breathing

**Movement Qualities (Laban):**
The animations respond to detected voice qualities:
- **Weight**: light (subtle) vs strong (pronounced)
- **Time**: sustained (smooth) vs sudden (jerky)

## 🎨 Visual Debugging

Enable skeleton helper to see bones:

1. Open Settings (⚙️)
2. Scroll to "SKELETAL DATA"
3. Check **"Show Skeleton Helper"**
4. Use color picker to change bone color
5. You'll see green lines showing the bone structure

## 📊 Test Status

```
✅ 4 tests passing (bone_system.test.ts)
⏭️  1 test skipped (model_loading.test.ts - too large for test env)
```

Run tests: `npm test`

## 📝 Available Bones

Your model has **274 bones** including:
- Facial bones (jaw, eyes, etc.)
- Head and neck
- Spine and torso
- Arms, hands, fingers
- Legs, feet, toes

All bone names are visible in the Settings panel!

## 🔧 For Developers

### Add Custom Animation

```typescript
import { BoneAnimationController, BONE_ANIMATION_LIBRARY } from './src/anim_engine';

// In your component
controller.registerAnimation(
  'my_animation',
  'jaw',  // bone name or pattern
  BONE_ANIMATION_LIBRARY['Jaw_Talk']
);
```

### Available Animations

Check `src/anim_engine/bone_animations.ts` for:
- Jaw_Talk, Jaw_Smile
- Eye_Blink, Eye_LookAt
- Head_Nod, Head_Shake, Head_Tilt
- Spine_Breathe, Chest_Puff
- Arm_Wave, Hand_Gesture
- And more...

### Full Documentation

See `src/anim_engine/README.md` for complete API reference.

## 🎯 Current Implementation

**What's Working:**
- ✅ Automatic bone detection
- ✅ Real-time bone animation
- ✅ Speaking-reactive jaw movement
- ✅ Breathing animations (head, spine)
- ✅ Laban movement quality integration
- ✅ Skeleton visualization
- ✅ UI for bone inspection
- ✅ Console debug interface

**What You Can Do Next:**
- Add more custom animations
- Implement eye tracking (Eye_LookAt)
- Create custom poses
- Add gesture recognition
- Implement IK for hand reaching

## 📚 Files to Know

- `index.tsx` - Main app with bone integration
- `src/anim_engine/` - All animation code
  - `bone_system.ts` - Core finder & controller
  - `bone_animations.ts` - Animation library
  - `library.ts` - Full-body poses
  - `README.md` - Full documentation
- `BONE_SYSTEM_SUMMARY.md` - Implementation details

## 💡 Tips

1. **Finding Bones**: Use pattern matching like `findByPatterns('jaw', 'chin', 'mandible')` to handle different naming conventions

2. **Performance**: Only register animations you're actively using

3. **Debugging**: Use the skeleton helper to visualize bone positions and rotations

4. **Console Logs**: Detailed bone info is logged on model load (check DevTools console)

---

**Need Help?** Check `src/anim_engine/README.md` for detailed documentation and examples!
