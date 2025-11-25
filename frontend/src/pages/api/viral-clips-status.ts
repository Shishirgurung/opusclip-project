import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface ViralClipStatusResponse {
  success: boolean;
  status: 'processing' | 'completed' | 'error' | 'not_found';
  progress?: number;
  stage?: string;
  message?: string;
  clips?: Array<{
    filename: string;
    url: string;
    score: number;
    layout: string;
    template: string;
    duration: number;
  }>;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ViralClipStatusResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      status: 'error',
      error: 'Method not allowed. Use GET.'
    });
  }

  try {
    const { jobId } = req.query;

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'Job ID is required'
      });
    }

    // Path to check for completed clips
    const clipsDir = path.join(process.cwd(), '..', 'python_caption_service', 'exports', 'clips');
    const statusFile = path.join(clipsDir, `${jobId}_status.json`);
    
    console.log('🔍 Checking viral clips status for job:', jobId);
    console.log('📁 Clips directory:', clipsDir);
    console.log('📄 Status file:', statusFile);

    // Check if status file exists
    if (fs.existsSync(statusFile)) {
      try {
        const statusData = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
        console.log('📊 Status data:', statusData);
        
        if (statusData.status === 'completed' && statusData.clips) {
          // Convert file paths to URLs
          const clips = statusData.clips.map((clip: any) => ({
            filename: path.basename(clip.output_path || clip.path || clip.filename || 'unknown'),
            url: `/api/download-clip?file=${encodeURIComponent(path.basename(clip.output_path || clip.path || clip.filename || 'unknown'))}`,
            score: clip.score || 0,
            layout: clip.layout || 'unknown',
            template: clip.template || 'unknown',
            duration: clip.duration || 30
          }));

          return res.status(200).json({
            success: true,
            status: 'completed',
            progress: 100,
            stage: 'Completed',
            message: `Successfully generated ${clips.length} viral clips`,
            clips
          });
        }

        return res.status(200).json({
          success: true,
          status: statusData.status,
          progress: statusData.progress || 0,
          stage: statusData.stage || 'Processing',
          message: statusData.message || 'Processing your video...'
        });

      } catch (parseError) {
        console.error('Error parsing status file:', parseError);
        return res.status(500).json({
          success: false,
          status: 'error',
          error: 'Failed to parse status file'
        });
      }
    }

    // Check if any clips exist for this job (fallback method)
    if (fs.existsSync(clipsDir)) {
      const files = fs.readdirSync(clipsDir);
      // Only return clips that belong to this specific job (clips are prefixed with jobId)
      const jobClips = files.filter(file => 
        file.endsWith('.mp4') && file.startsWith(`${jobId}_`)
      );

      if (jobClips.length > 0) {
        console.log('📹 Found clips:', jobClips);
        
        const clips = jobClips.map(filename => ({
          filename,
          url: `/api/download-clip?file=${encodeURIComponent(filename)}`,
          score: 5.0, // Default score
          layout: 'unknown',
          template: 'unknown',
          duration: 30
        }));

        return res.status(200).json({
          success: true,
          status: 'completed',
          progress: 100,
          stage: 'Completed',
          message: `Found ${clips.length} generated clips`,
          clips
        });
      }
    }

    // Job is still processing or doesn't exist
    return res.status(200).json({
      success: true,
      status: 'processing',
      progress: 50,
      stage: 'Generating clips',
      message: 'Your viral clips are being generated...'
    });

  } catch (error) {
    console.error('Error in viral-clips-status API:', error);
    return res.status(500).json({
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
