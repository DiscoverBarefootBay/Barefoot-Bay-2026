/**
 * Script to check which banner slide files exist in filesystem vs. what's in database
 * This helps verify that all needed banner slides are available
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Constants
const BANNER_SLIDES_FILESYSTEM_PATH = './uploads/banner-slides';
const BANNER_SLIDES_ROOT_PATH = './banner-slides';
const BANNER_SLIDES_SLUG = 'banner-slides';

async function main() {
  try {
    console.log('Checking banner slide files...');
    
    // 1. Get banner slides from database
    console.log('Fetching banner slides from database...');
    const slides = await getBannerSlidesFromDB();
    console.log(`Found ${slides.length} banner slides in database.`);
    
    // 2. List files in filesystem
    console.log('Checking files in filesystem...');
    const filesystemFiles = {
      uploads: scanDirectory(BANNER_SLIDES_FILESYSTEM_PATH),
      root: scanDirectory(BANNER_SLIDES_ROOT_PATH),
    };
    
    console.log(`Found ${filesystemFiles.uploads.length} files in /uploads/banner-slides`);
    console.log(`Found ${filesystemFiles.root.length} files in /banner-slides`);
    
    // 3. Extract filenames from database
    const expectedFilenames = slides.map(slide => {
      const url = slide.src;
      return path.basename(url);
    });
    
    console.log(`Expected ${expectedFilenames.length} files based on database records:`);
    expectedFilenames.forEach((filename, index) => {
      console.log(`  ${index + 1}. ${filename}`);
    });
    
    // 4. Check which expected files are missing
    const existingFilenames = [
      ...filesystemFiles.uploads.map(f => f.filename),
      ...filesystemFiles.root.map(f => f.filename),
    ];
    
    const missingFiles = expectedFilenames.filter(filename => !existingFilenames.includes(filename));
    
    console.log('\nMissing files:');
    if (missingFiles.length === 0) {
      console.log('  None - all expected files are present in filesystem');
    } else {
      missingFiles.forEach((filename, index) => {
        console.log(`  ${index + 1}. ${filename}`);
      });
    }
    
    // 5. Create a report of file mappings
    console.log('\nFile mapping:');
    for (const slide of slides) {
      const filename = path.basename(slide.src);
      const inUploads = filesystemFiles.uploads.some(f => f.filename === filename);
      const inRoot = filesystemFiles.root.some(f => f.filename === filename);
      
      console.log(`- ${filename}:`);
      console.log(`  - In database: Yes`);
      console.log(`  - In /uploads/banner-slides: ${inUploads ? 'Yes' : 'No'}`);
      console.log(`  - In /banner-slides: ${inRoot ? 'Yes' : 'No'}`);
      console.log(`  - Media type: ${slide.mediaType}`);
      console.log(`  - URL in DB: ${slide.src}`);
    }
    
    // 6. Copy missing files between directories if possible
    if (missingFiles.length > 0) {
      console.log('\nAttempting to fix missing files by copying between directories...');
      const copied = await copyMissingFiles(missingFiles, filesystemFiles);
      console.log(`Copied ${copied} files between directories`);
    }
    
    console.log('\nCheck completed!');
    
    return {
      expectedFiles: expectedFilenames.length,
      existingFilesInUploads: filesystemFiles.uploads.length,
      existingFilesInRoot: filesystemFiles.root.length,
      missingFiles: missingFiles.length,
    };
  } catch (error) {
    console.error('Error checking banner files:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Get banner slides from database
 */
async function getBannerSlidesFromDB() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, slug, content FROM page_contents WHERE slug = $1`,
      [BANNER_SLIDES_SLUG]
    );
    
    let slides = [];
    
    if (result.rows.length > 0) {
      const pageContent = result.rows[0];
      
      // Parse content
      const content = typeof pageContent.content === 'string' 
        ? JSON.parse(pageContent.content) 
        : pageContent.content;
      
      // Process content string if it's still a string
      const processedContent = typeof content === 'string' ? JSON.parse(content) : content;
      
      // Extract slides array
      if (Array.isArray(processedContent)) {
        slides = processedContent;
      } else if (processedContent && Array.isArray(processedContent.slides)) {
        slides = processedContent.slides;
      } else {
        console.warn('No slides array found in database content');
      }
    }
    
    return slides;
  } catch (error) {
    console.error('Error getting banner slides from database:', error);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Scan a directory for files
 */
function scanDirectory(directoryPath) {
  try {
    if (!fs.existsSync(directoryPath)) {
      console.warn(`Directory does not exist: ${directoryPath}`);
      return [];
    }
    
    const files = fs.readdirSync(directoryPath);
    
    return files
      .filter(file => {
        const filePath = path.join(directoryPath, file);
        return fs.statSync(filePath).isFile();
      })
      .map(file => {
        const filePath = path.join(directoryPath, file);
        const stats = fs.statSync(filePath);
        
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          mtime: stats.mtime,
        };
      });
  } catch (error) {
    console.error(`Error scanning directory ${directoryPath}:`, error);
    return [];
  }
}

/**
 * Copy missing files between directories if possible
 */
async function copyMissingFiles(missingFiles, filesystemFiles) {
  let copied = 0;
  
  // Create directories if they don't exist
  [BANNER_SLIDES_FILESYSTEM_PATH, BANNER_SLIDES_ROOT_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // For each missing file, check if it exists in the other directory
  for (const filename of missingFiles) {
    // Check if file exists in /uploads/banner-slides but not in /banner-slides
    const inUploads = filesystemFiles.uploads.find(f => f.filename === filename);
    const inRoot = filesystemFiles.root.find(f => f.filename === filename);
    
    if (inUploads && !inRoot) {
      // Copy from /uploads/banner-slides to /banner-slides
      const sourcePath = path.join(BANNER_SLIDES_FILESYSTEM_PATH, filename);
      const targetPath = path.join(BANNER_SLIDES_ROOT_PATH, filename);
      
      try {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`Copied ${filename} from uploads to root directory`);
        copied++;
      } catch (error) {
        console.error(`Error copying ${filename} from uploads to root:`, error);
      }
    } else if (inRoot && !inUploads) {
      // Copy from /banner-slides to /uploads/banner-slides
      const sourcePath = path.join(BANNER_SLIDES_ROOT_PATH, filename);
      const targetPath = path.join(BANNER_SLIDES_FILESYSTEM_PATH, filename);
      
      try {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`Copied ${filename} from root to uploads directory`);
        copied++;
      } catch (error) {
        console.error(`Error copying ${filename} from root to uploads:`, error);
      }
    } else {
      console.log(`Cannot fix missing file ${filename} - not found in either directory`);
    }
  }
  
  return copied;
}

// Run the script
main()
  .then((results) => {
    console.log('Check complete with results:', results);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  });