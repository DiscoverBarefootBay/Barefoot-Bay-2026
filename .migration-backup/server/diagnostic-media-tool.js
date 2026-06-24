/**
 * Diagnostic Media Tool
 * 
 * This tool helps diagnose and fix media loading issues on production servers.
 * Run it when images are not loading properly on the site.
 * 
 * Features:
 * 1. Checks for files in different locations
 * 2. Verifies static file serving configuration 
 * 3. Logs detailed diagnostics about media access
 * 4. Tests API responses for correct path normalization
 * 
 * Usage:
 * node server/diagnostic-media-tool.js [--fix] [--verbose]
 * 
 * Options:
 *   --fix       Attempt to fix issues automatically
 *   --verbose   Show detailed diagnostic information
 */

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const http = require('http');

// Configuration
const MEDIA_DIRECTORIES = [
  'calendar', 
  'banner-slides', 
  'content-media', 
  'forum-media', 
  'vendor-media', 
  'community-media', 
  'avatars', 
  'Real Estate', 
  'icons'
];

// Parse command line arguments
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const verbose = args.includes('--verbose');

// Initialize database connection
let pool;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  console.log('Database connection initialized.');
} catch (error) {
  console.error('Failed to initialize database connection:', error.message);
  process.exit(1);
}

/**
 * Main function
 */
async function main() {
  console.log('\n==============================================');
  console.log('        BAREFOOT BAY MEDIA DIAGNOSTICS        ');
  console.log('==============================================\n');

  console.log('Mode:', shouldFix ? 'FIX (will attempt to repair issues)' : 'DIAGNOSTIC ONLY (no changes will be made)');
  
  // Step 1: Check directory structure
  await checkDirectoryStructure();
  
  // Step 2: Check for sample files in both locations
  await checkSampleFiles();
  
  // Step 3: Test path normalization in the database
  if (pool) {
    await checkDatabasePathNormalization();
  }
  
  // Step 4: Verify server configuration
  await checkServerConfiguration();
  
  console.log('\n==============================================');
  console.log('        DIAGNOSTIC PROCESS COMPLETE           ');
  console.log('==============================================\n');
}

/**
 * Check that all necessary directories exist
 */
async function checkDirectoryStructure() {
  console.log('\n--- Checking Directory Structure ---\n');
  
  // Check uploads directory
  checkDirectory('uploads');
  
  // Check each media subdirectory in uploads
  for (const dir of MEDIA_DIRECTORIES) {
    checkDirectory(`uploads/${dir}`);
  }
  
  // Check root directories for production paths
  for (const dir of MEDIA_DIRECTORIES) {
    checkDirectory(dir);
  }
  
  function checkDirectory(dirPath) {
    const fullPath = path.join(process.cwd(), dirPath);
    
    try {
      if (fs.existsSync(fullPath)) {
        console.log(`✓ Directory exists: ${dirPath}`);
        
        // Extra checks in verbose mode
        if (verbose) {
          try {
            const stats = fs.statSync(fullPath);
            const isWritable = fs.accessSync(fullPath, fs.constants.W_OK) === undefined;
            console.log(`  - Permissions: ${(stats.mode & 0o777).toString(8)}`);
            console.log(`  - Writable: ${isWritable ? 'Yes' : 'No'}`);
            
            const files = fs.readdirSync(fullPath);
            console.log(`  - Contains ${files.length} files/subdirectories`);
          } catch (err) {
            console.log(`  - Error checking details: ${err.message}`);
          }
        }
      } else {
        console.log(`✗ Directory missing: ${dirPath}`);
        
        if (shouldFix) {
          try {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log(`  → Created directory: ${dirPath}`);
          } catch (err) {
            console.error(`  ! Failed to create directory: ${err.message}`);
          }
        } else {
          console.log(`  * Run with --fix to create this directory automatically`);
        }
      }
    } catch (err) {
      console.error(`! Error checking directory ${dirPath}: ${err.message}`);
    }
  }
}

/**
 * Check for sample files in both development and production locations
 */
async function checkSampleFiles() {
  console.log('\n--- Checking Sample Files ---\n');
  
  // Find some sample files to check
  const sampleFiles = [];
  
  // Check each media directory for files
  for (const dir of MEDIA_DIRECTORIES) {
    // Check uploads version
    const uploadsPath = path.join(process.cwd(), 'uploads', dir);
    if (fs.existsSync(uploadsPath)) {
      try {
        const files = fs.readdirSync(uploadsPath);
        if (files.length > 0) {
          // Get the first file with a common image extension
          const imageFile = files.find(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
          if (imageFile) {
            sampleFiles.push({
              directory: dir,
              filename: imageFile,
              uploadsPath: path.join(uploadsPath, imageFile),
              rootPath: path.join(process.cwd(), dir, imageFile)
            });
          }
        }
      } catch (err) {
        console.error(`! Error reading directory ${uploadsPath}: ${err.message}`);
      }
    }
  }
  
  if (sampleFiles.length === 0) {
    console.log('No sample files found to check. Are any images uploaded to the system?');
    return;
  }
  
  console.log(`Found ${sampleFiles.length} sample files to check.`);
  
  // Check each sample file exists in both locations
  for (const sample of sampleFiles) {
    console.log(`\nChecking file: ${sample.filename} (in ${sample.directory})`);
    
    // Check development path (with /uploads/)
    const uploadsExists = fs.existsSync(sample.uploadsPath);
    console.log(`  - Development path (/uploads/${sample.directory}/${sample.filename}): ${uploadsExists ? '✓ Exists' : '✗ Missing'}`);
    
    // Check production path (without /uploads/)
    const rootExists = fs.existsSync(sample.rootPath);
    console.log(`  - Production path (/${sample.directory}/${sample.filename}): ${rootExists ? '✓ Exists' : '✗ Missing'}`);
    
    // Fix if needed
    if (shouldFix && (uploadsExists || rootExists) && !(uploadsExists && rootExists)) {
      try {
        const sourcePath = uploadsExists ? sample.uploadsPath : sample.rootPath;
        const destPath = uploadsExists ? sample.rootPath : sample.uploadsPath;
        
        // Create the destination directory if needed
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        
        // Copy the file
        fs.copyFileSync(sourcePath, destPath);
        console.log(`  → Copied file from ${sourcePath} to ${destPath}`);
      } catch (err) {
        console.error(`  ! Failed to copy file: ${err.message}`);
      }
    }
  }
}

/**
 * Check database records for proper path normalization
 */
async function checkDatabasePathNormalization() {
  console.log('\n--- Checking Database Path Normalization ---\n');
  
  // Tables that might contain media paths
  const tables = [
    { table: 'events', columns: ['mediaUrls'] },
    { table: 'forum_posts', columns: ['mediaUrls'] },
    { table: 'forum_comments', columns: ['mediaUrls'] },
    { table: 'page_content', columns: ['content'] },
    { table: 'content', columns: ['content'] },
    { table: 'real_estate_listings', columns: ['mediaUrls'] },
    { table: 'users', columns: ['avatar_url'] }
  ];
  
  for (const { table, columns } of tables) {
    // Check if this table exists
    try {
      const tableExists = await checkTableExists(table);
      if (!tableExists) {
        console.log(`Table '${table}' does not exist, skipping.`);
        continue;
      }
      
      console.log(`Checking table: ${table}`);
      
      for (const column of columns) {
        // Check if this column exists
        const columnExists = await checkColumnExists(table, column);
        if (!columnExists) {
          console.log(`  Column '${column}' does not exist in table '${table}', skipping.`);
          continue;
        }
        
        // Count records with unnormalized paths
        const unnormalizedCount = await countUnnormalizedPaths(table, column);
        
        if (unnormalizedCount === 0) {
          console.log(`  ✓ All paths in ${table}.${column} are properly normalized.`);
        } else {
          console.log(`  ✗ Found ${unnormalizedCount} records in ${table}.${column} with unnormalized paths.`);
          
          if (shouldFix) {
            // Fix the paths if requested
            await fixUnnormalizedPaths(table, column);
          } else {
            console.log(`    * Run with --fix to normalize these paths automatically`);
          }
        }
      }
    } catch (err) {
      console.error(`! Error checking table ${table}: ${err.message}`);
    }
  }
  
  /**
   * Check if a table exists in the database
   */
  async function checkTableExists(tableName) {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `;
    const result = await pool.query(query, [tableName]);
    return result.rows[0].exists;
  }
  
  /**
   * Check if a column exists in a table
   */
  async function checkColumnExists(tableName, columnName) {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
      )
    `;
    const result = await pool.query(query, [tableName, columnName]);
    return result.rows[0].exists;
  }
  
  /**
   * Count records with unnormalized paths (/uploads/ prefix)
   */
  async function countUnnormalizedPaths(table, column) {
    // For JSON columns
    if (['mediaUrls'].includes(column)) {
      // Need special handling for JSON columns
      const query = `
        SELECT COUNT(*) FROM ${table}
        WHERE ${column}::text LIKE '%/uploads/%'
      `;
      const result = await pool.query(query);
      return parseInt(result.rows[0].count, 10);
    } else {
      // For regular text columns
      const query = `
        SELECT COUNT(*) FROM ${table}
        WHERE ${column} LIKE '%/uploads/%'
      `;
      const result = await pool.query(query);
      return parseInt(result.rows[0].count, 10);
    }
  }
  
  /**
   * Fix unnormalized paths in the database
   */
  async function fixUnnormalizedPaths(table, column) {
    try {
      console.log(`    Fixing paths in ${table}.${column}...`);
      
      // Get the primary key column name
      const pkQuery = `
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = '${table}'::regclass
        AND i.indisprimary
      `;
      const pkResult = await pool.query(pkQuery);
      
      if (pkResult.rows.length === 0) {
        console.error(`    ! Cannot fix: Unable to determine primary key for table ${table}`);
        return;
      }
      
      const pkColumn = pkResult.rows[0].attname;
      
      // Select records with unnormalized paths
      let selectQuery;
      if (['mediaUrls'].includes(column)) {
        // JSON column
        selectQuery = `
          SELECT ${pkColumn}, ${column} FROM ${table}
          WHERE ${column}::text LIKE '%/uploads/%'
        `;
      } else {
        // Regular text column
        selectQuery = `
          SELECT ${pkColumn}, ${column} FROM ${table}
          WHERE ${column} LIKE '%/uploads/%'
        `;
      }
      
      const recordsResult = await pool.query(selectQuery);
      
      console.log(`    Found ${recordsResult.rows.length} records to fix.`);
      
      let updatedCount = 0;
      
      for (const row of recordsResult.rows) {
        const id = row[pkColumn];
        const value = row[column];
        
        // Process different types of columns differently
        let newValue;
        
        if (typeof value === 'string') {
          // Simple string replacement for text columns
          newValue = value.replace(/\/uploads\//g, '/');
        } else if (Array.isArray(value)) {
          // Array column (like mediaUrls)
          newValue = value.map(item => {
            if (typeof item === 'string' && item.includes('/uploads/')) {
              return item.replace(/\/uploads\//g, '/');
            }
            return item;
          });
        } else {
          // Skip null or object values we can't handle
          continue;
        }
        
        // Update the record
        const updateQuery = `
          UPDATE ${table}
          SET ${column} = $1
          WHERE ${pkColumn} = $2
        `;
        
        await pool.query(updateQuery, [newValue, id]);
        updatedCount++;
      }
      
      console.log(`    ✓ Successfully updated ${updatedCount} records.`);
    } catch (err) {
      console.error(`    ! Error fixing paths: ${err.message}`);
    }
  }
}

/**
 * Check server configuration for proper media file handling
 */
async function checkServerConfiguration() {
  console.log('\n--- Checking Server Configuration ---\n');
  
  // Check if the current server has the correct static file serving setup
  let serverCodePath = path.join(process.cwd(), 'server', 'index.ts');
  if (!fs.existsSync(serverCodePath)) {
    serverCodePath = path.join(process.cwd(), 'server', 'index.js');
    if (!fs.existsSync(serverCodePath)) {
      console.log('! Server code not found at expected path. Cannot check configuration.');
      return;
    }
  }
  
  console.log(`Reading server configuration from: ${serverCodePath}`);
  
  try {
    const serverCode = fs.readFileSync(serverCodePath, 'utf8');
    
    // Check if mediaDirectories configuration exists
    const hasMediaDirectoriesConfig = serverCode.includes('mediaDirectories') && 
                                     MEDIA_DIRECTORIES.some(dir => serverCode.includes(`'${dir}'`));
    
    // Check if the code sets up static file serving for production paths
    const hasProductionPathServing = MEDIA_DIRECTORIES.some(dir => 
      serverCode.includes(`app.use('/${dir}'`) || 
      serverCode.includes(`app.use(\`/${dir}\``)
    );
    
    // Check if mediaRedirectMiddleware is present
    const hasMediaRedirectMiddleware = serverCode.includes('mediaRedirectMiddleware');
    
    // Log the results
    console.log('Server configuration check:');
    console.log(`  - Media directories configuration: ${hasMediaDirectoriesConfig ? '✓ Found' : '✗ Missing'}`);
    console.log(`  - Production path static file serving: ${hasProductionPathServing ? '✓ Found' : '✗ Missing'}`);
    console.log(`  - Media redirect middleware: ${hasMediaRedirectMiddleware ? '✓ Found' : '✗ Missing'}`);
    
    // Provide server configuration suggestion if needed
    if (!hasProductionPathServing && shouldFix) {
      console.log('\nGenerating server configuration fix:');
      
      const configFix = `
// CRITICAL: Serve static files from root directories for production path format
// This ensures that media at paths like /calendar/file.jpg can be accessed directly
const mediaDirectories = [
  ${MEDIA_DIRECTORIES.map(dir => `'${dir}'`).join(',\n  ')}
];

// Set up static file serving for each production media directory
mediaDirectories.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  
  // Create the directory if it doesn't exist
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(\`Created production media directory: \${dirPath}\`);
    }
  } catch (error) {
    console.error(\`Error creating production media directory \${dirPath}:\`, error);
  }
  
  // Set up static file serving for this directory
  app.use(\`/\${dir}\`, (req, res, next) => {
    // Skip auth checks for media files
    req.skipAuth = true;
    
    // Add cache control headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
    
    // CORS headers to ensure files load in all contexts
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    next();
  }, express.static(dirPath, {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    index: false,
    fallthrough: true
  }));
});
      `;
      
      console.log(configFix);
      
      const fixPath = path.join(process.cwd(), 'server-config-fix.js');
      fs.writeFileSync(fixPath, configFix);
      console.log(`\nConfiguration fix has been written to: ${fixPath}`);
      console.log('Please add this code to your server/index.ts file after the mediaRedirectMiddleware line.');
    } else if (!hasProductionPathServing) {
      console.log('\n! Your server is missing the configuration needed to serve files from production paths.');
      console.log('  This could be the reason media files are not loading in production.');
      console.log('  Run this tool with --fix to generate the necessary configuration code.');
    }
  } catch (err) {
    console.error(`! Error reading server configuration: ${err.message}`);
  }
}

// Run the diagnostic tool
main()
  .catch(err => {
    console.error('Fatal error:', err);
  })
  .finally(() => {
    if (pool) {
      pool.end();
    }
  });