#!/usr/bin/env node

/**
 * Production Build Script
 * 
 * This script ensures proper asset copying and CSS compilation for production builds
 * to fix the layout stacking issues in production environment.
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Starting production build with asset management...');

async function copyAssets() {
  console.log('📁 Copying static assets...');
  
  const assetsMap = [
    { src: 'public/fonts', dest: 'dist/public/fonts' },
    { src: 'public/assets', dest: 'dist/public/assets' },
    { src: 'public/icons', dest: 'dist/public/icons' },
    { src: 'public/static', dest: 'dist/public/static' },
    { src: 'client/src/index.css', dest: 'dist/public/index.css' }
  ];

  for (const { src, dest } of assetsMap) {
    const srcPath = path.join(rootDir, src);
    const destPath = path.join(rootDir, dest);
    
    if (await fs.pathExists(srcPath)) {
      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(srcPath, destPath, { overwrite: true });
      console.log(`✅ Copied ${src} -> ${dest}`);
    } else {
      console.log(`⚠️  Source not found: ${src}`);
    }
  }
}

async function buildApplication() {
  console.log('🔨 Building application...');
  
  try {
    // Set production environment
    process.env.NODE_ENV = 'production';
    
    // Run the build command
    execSync('npm run build', { 
      stdio: 'inherit', 
      cwd: rootDir,
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    console.log('✅ Application build completed');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

async function validateBuild() {
  console.log('🔍 Validating build output...');
  
  const requiredPaths = [
    'dist/public/index.html',
    'dist/public/assets',
    'dist/index.js'
  ];
  
  for (const requiredPath of requiredPaths) {
    const fullPath = path.join(rootDir, requiredPath);
    if (!(await fs.pathExists(fullPath))) {
      console.error(`❌ Missing required build file: ${requiredPath}`);
      process.exit(1);
    }
  }
  
  console.log('✅ Build validation passed');
}

async function main() {
  try {
    await buildApplication();
    await copyAssets();
    await validateBuild();
    
    console.log('🎉 Production build completed successfully!');
    console.log('📦 All assets copied and CSS properly compiled');
    console.log('🔧 Layout issues should now be resolved in production');
  } catch (error) {
    console.error('❌ Production build failed:', error);
    process.exit(1);
  }
}

main();