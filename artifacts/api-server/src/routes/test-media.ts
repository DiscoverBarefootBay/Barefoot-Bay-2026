import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// Test endpoint to verify media access
router.get('/list-calendar-media', (req, res) => {
  const calendarDir = path.join(process.cwd(), 'uploads', 'calendar');
  
  try {
    const files = fs.readdirSync(calendarDir);
    const fileStats = files.map(file => {
      const filePath = path.join(calendarDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        path: `/uploads/calendar/${file}`,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isAccessible: true
      };
    });
    
    res.json({
      success: true,
      message: 'Media files in calendar directory',
      files: fileStats,
      count: fileStats.length,
      directory: calendarDir
    });
  } catch (error) {
    console.error('Error listing calendar media:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing calendar media files',
      error: error.message
    });
  }
});

// Test endpoint to verify accessibility of a specific file
router.get('/check-file/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(process.cwd(), 'uploads', 'calendar', filename);
  
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      res.json({
        success: true,
        message: 'File exists and is accessible',
        file: {
          name: filename,
          path: `/uploads/calendar/${filename}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found',
        file: filename
      });
    }
  } catch (error) {
    console.error(`Error checking file ${filename}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error checking file',
      error: error.message,
      file: filename
    });
  }
});

export default router;