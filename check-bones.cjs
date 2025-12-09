const fs = require('fs');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
const THREE = require('three');

const loader = new GLTFLoader();

// Read the file as a buffer
const buffer = fs.readFileSync('./public/stellar_blade_-_lily_stargazer_coat.glb');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

loader.parse(arrayBuffer, '', (gltf) => {
  console.log('=== BONE/SKELETON DETECTION ===\n');

  let boneCount = 0;
  const bones = [];

  // Traverse the scene to find bones
  gltf.scene.traverse((object) => {
    if (object.isBone) {
      boneCount++;
      bones.push({
        name: object.name,
        type: object.type,
        uuid: object.uuid
      });
    }

    // Check for SkinnedMesh
    if (object.isSkinnedMesh) {
      console.log(`Found SkinnedMesh: "${object.name}"`);
      console.log(`  - Skeleton bones: ${object.skeleton.bones.length}`);
      console.log(`  - Bind mode: ${object.skeleton.bindMode}\n`);

      console.log('Bone hierarchy:');
      object.skeleton.bones.forEach((bone, idx) => {
        console.log(`  [${idx}] ${bone.name}`);
      });
    }
  });

  console.log(`\nTotal bones found: ${boneCount}`);

  if (boneCount === 0) {
    console.log('\n✗ NO BONES DETECTED - Model may not have skeletal rigging');
  } else {
    console.log('\n✓ BONES ARE PRESENT in the model');
  }

  console.log('===============================');
}, (error) => {
  console.error('Error parsing GLB:', error);
});
