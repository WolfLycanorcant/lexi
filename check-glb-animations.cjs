const fs = require('fs');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
const { GLTF } = require('three/examples/jsm/loaders/GLTFLoader.js');

// Simple Node.js script to check GLB animations
const gltfPath = './public/stellar_blade_-_lily_stargazer_coat.glb';

const loader = new GLTFLoader();

loader.load(gltfPath, (gltf) => {
  console.log('=== GLB ANIMATION CHECK ===');
  console.log('File:', gltfPath);
  console.log('Number of animations:', gltf.animations.length);

  if (gltf.animations.length > 0) {
    console.log('\n✓ YES - This model has built-in animations!\n');
    gltf.animations.forEach((anim, idx) => {
      console.log(`Animation ${idx + 1}:`);
      console.log(`  Name: "${anim.name}"`);
      console.log(`  Duration: ${anim.duration.toFixed(2)} seconds`);
      console.log(`  Tracks: ${anim.tracks.length}`);
    });
  } else {
    console.log('\n✗ NO - This model has no built-in animations');
  }
  console.log('===========================');
}, undefined, (error) => {
  console.error('Error loading GLB:', error);
});
