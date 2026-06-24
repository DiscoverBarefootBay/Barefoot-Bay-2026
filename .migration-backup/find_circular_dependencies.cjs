const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// Map of file paths to their imports
const importGraph = new Map();
// Set to track visited nodes during DFS
const visited = new Set();
// Set to track nodes in current DFS recursion stack
const recursionStack = new Set();
// Store found circular dependencies
const circularDependencies = [];

// Regular expressions for import statements
const importRegexes = [
  /import\s+.*from\s+['"]([^'"]*)['"]/g,
  /import\s*\(\s*['"]([^'"]*)['"]\s*\)/g,
  /require\s*\(\s*['"]([^'"]*)['"]\s*\)/g,
];

async function isDirectory(path) {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

async function resolveImportPath(importPath, filePath) {
  // Handle relative imports with proper path resolution
  if (importPath.startsWith('.')) {
    const resolvedPath = path.resolve(path.dirname(filePath), importPath);
    
    // Try to resolve with various extensions
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const fullPath = resolvedPath + ext;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    // Try as directory with index file
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const indexPath = path.join(resolvedPath, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
  }
  
  // Handle aliases (like '@/components') - this is a simplified version
  if (importPath.startsWith('@/')) {
    const aliasPath = importPath.replace('@/', 'client/src/');
    
    // Try to resolve with various extensions
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const fullPath = aliasPath + ext;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    // Try as directory with index file
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const indexPath = path.join(aliasPath, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
  }
  
  return null; // External module or couldn't resolve
}

async function parseImports(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const imports = new Set();
    
    for (const regex of importRegexes) {
      let match;
      while ((match = regex.exec(content)) !== null) {
        const importPath = match[1];
        const resolvedPath = await resolveImportPath(importPath, filePath);
        if (resolvedPath) {
          imports.add(resolvedPath);
        }
      }
    }
    
    return Array.from(imports);
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return [];
  }
}

async function scanDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      await scanDirectory(fullPath);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const imports = await parseImports(fullPath);
      importGraph.set(fullPath, imports);
    }
  }
}

function detectCycle(node) {
  visited.add(node);
  recursionStack.add(node);
  
  const imports = importGraph.get(node) || [];
  
  for (const importPath of imports) {
    if (!visited.has(importPath)) {
      if (detectCycle(importPath)) {
        // Add this cycle to our list
        circularDependencies.push([node, importPath]);
        return true;
      }
    } else if (recursionStack.has(importPath)) {
      // Found a cycle
      circularDependencies.push([node, importPath]);
      return true;
    }
  }
  
  recursionStack.delete(node);
  return false;
}

async function main() {
  try {
    console.log('Scanning for imports...');
    await scanDirectory('client/src');
    
    console.log(`Found ${importGraph.size} files with imports.`);
    
    // Check specifically for toast-related dependencies first
    const toastFiles = Array.from(importGraph.keys()).filter(file => 
      file.includes('toast.ts') || file.includes('toaster.ts') || file.includes('use-toast.ts')
    );
    
    console.log('Checking for circular dependencies in toast-related files...');
    for (const file of toastFiles) {
      const deps = importGraph.get(file) || [];
      console.log(`${file} imports:`);
      deps.forEach(dep => console.log(`  - ${dep}`));
    }
    
    // Check for circular dependencies in all files
    console.log('Checking for circular dependencies in all files...');
    
    for (const node of importGraph.keys()) {
      if (!visited.has(node)) {
        detectCycle(node);
      }
    }
    
    if (circularDependencies.length > 0) {
      console.log('Found circular dependencies:');
      circularDependencies.forEach(([from, to]) => {
        console.log(`${from} -> ${to}`);
      });
    } else {
      console.log('No circular dependencies found.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
