import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename } = req.query;

    // Validate filename parameter
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Invalid filename parameter' });
    }

    // Sanitize filename to prevent path traversal attacks
    const sanitizedFilename = encodeURIComponent(filename.trim());
    
    // Additional security check for path traversal patterns
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename format' });
    }

    // Get Flask base URL from environment variable
    const flaskBaseUrl = process.env.FLASK_BASE_URL || 'http://localhost:5000';
    const flaskDownloadUrl = `${flaskBaseUrl}/exports/${sanitizedFilename}`;

    console.log(`Proxying download request for: ${filename}`);
    console.log(`Flask URL: ${flaskDownloadUrl}`);

    // Fetch file from Flask backend
    const flaskResponse = await fetch(flaskDownloadUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
      },
    });

    // Handle Flask backend response
    if (!flaskResponse.ok) {
      if (flaskResponse.status === 404) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      console.error(`Flask backend error: ${flaskResponse.status} ${flaskResponse.statusText}`);
      return res.status(flaskResponse.status).json({ 
        error: 'Backend server error',
        details: `Flask server returned ${flaskResponse.status}`
      });
    }

    // Get content type from Flask response or set default
    const contentType = flaskResponse.headers.get('content-type') || 'application/octet-stream';
    
    // Convert response to ArrayBuffer
    const arrayBuffer = await flaskResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Set appropriate headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    
    // Optional: Set cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Send the file buffer to client
    res.status(200).send(buffer);

  } catch (error) {
    console.error('Download proxy error:', error);
    
    // Handle specific error types
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return res.status(503).json({ 
        error: 'Backend service unavailable',
        details: 'Could not connect to Flask backend'
      });
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(408).json({ 
        error: 'Request timeout',
        details: 'Download request timed out'
      });
    }

    // Generic error response
    return res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred during file download'
    });
  }
}