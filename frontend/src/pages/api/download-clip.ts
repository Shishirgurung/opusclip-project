import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const { file } = req.query;

    if (!file || typeof file !== 'string') {
      return res.status(400).json({ error: 'File parameter is required' });
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(file);
    
    // Path to clips directory
    const clipsDir = path.join(process.cwd(), '..', 'python_caption_service', 'exports', 'clips');
    const filePath = path.join(clipsDir, sanitizedFilename);

    console.log('📥 Download request for:', sanitizedFilename);
    console.log('📁 Full path:', filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if it's a video file
    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const fileExtension = path.extname(sanitizedFilename).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    console.log('📊 File stats:', { size: fileSize, extension: fileExtension });

    // Set appropriate headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Accept-Ranges', 'bytes');

    // Handle range requests for video streaming
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // Send entire file
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }

  } catch (error) {
    console.error('Error in download-clip API:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}
