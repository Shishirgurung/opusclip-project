import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface GenerateViralClipsRequest {
  videoUrl: string;
  layout: 'fit' | 'fill' | 'square' | 'auto';
  template: 'Karaoke' | 'SwipeUp' | 'TikTokViral' | 'BeastMode' | 'Glitch';
  maxClips?: number;
  minScore?: number;
}

interface GenerateViralClipsResponse {
  success: boolean;
  jobId?: string;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateViralClipsResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    const { videoUrl, layout, template, maxClips = 3, minScore = 4.0 }: GenerateViralClipsRequest = req.body;

    // Validate required fields
    if (!videoUrl || !layout || !template) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: videoUrl, layout, template'
      });
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(videoUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
    }

    // Validate layout options
    const validLayouts = ['fit', 'fill', 'square', 'auto'];
    if (!validLayouts.includes(layout)) {
      return res.status(400).json({
        success: false,
        error: `Invalid layout. Must be one of: ${validLayouts.join(', ')}`
      });
    }

    // Validate template options - ALL 16 TEMPLATES
    const validTemplates = [
      'Karaoke', 'SwipeUp', 'TikTokViral', 'BeastMode', 'Glitch',
      'ComicPop', 'NeonPulse', 'TypeWriter', 'BubblePop', 'BoldPop',
      'HighlightSweep', 'RageMode', 'HypeTrain', 'GlitchStreamer',
      'Cinematic', 'PodcastPro'
    ];
    if (!validTemplates.includes(template)) {
      return res.status(400).json({
        success: false,
        error: `Invalid template. Must be one of: ${validTemplates.join(', ')}`
      });
    }

    // Generate unique job ID
    const jobId = `viral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Path to Python script
    const pythonScriptPath = path.join(process.cwd(), '..', 'python_caption_service', 'complete_viral_clip_generator.py');
    
    // Check if Python script exists
    if (!fs.existsSync(pythonScriptPath)) {
      return res.status(500).json({
        success: false,
        error: 'Python backend script not found'
      });
    }

    // Extract clip length parameters from request
    const minClipLength = req.body.minClipLength || 30;
    const maxClipLength = req.body.maxClipLength || 60;
    const targetClipLength = req.body.targetClipLength || 45;
    
    // Extract processing timeframe parameters
    const useTimeframe = req.body.useTimeframe || false;
    const timeframeStart = req.body.timeframeStart || 0;
    const timeframeEnd = req.body.timeframeEnd || null;
    
    // Extract language parameters
    const videoLanguage = req.body.videoLanguage || 'auto';
    const translateCaptions = req.body.translateCaptions || false;
    const captionLanguage = req.body.captionLanguage || 'en';

    // Prepare arguments for Python script
    const args = [
      pythonScriptPath,
      '--video-url', videoUrl,
      '--layout', layout,
      '--template', template,
      '--max-clips', maxClips.toString(),
      '--min-score', minScore.toString(),
      '--job-id', jobId,
      '--min-length', minClipLength.toString(),
      '--max-length', maxClipLength.toString(),
      '--target-length', targetClipLength.toString(),
      '--video-language', videoLanguage,
      '--caption-language', captionLanguage
    ];
    
    // Add timeframe parameters if enabled
    if (useTimeframe && timeframeEnd) {
      args.push('--timeframe-start', timeframeStart.toString());
      args.push('--timeframe-end', timeframeEnd.toString());
    }
    
    // Add translation flag if enabled
    if (translateCaptions) {
      args.push('--translate-captions');
    }

    console.log('🚀 Starting viral clip generation:', {
      jobId,
      videoUrl,
      layout,
      template,
      maxClips,
      minScore
    });

    // Start Python process asynchronously
    const pythonProcess = spawn('python', args, {
      cwd: path.join(process.cwd(), '..', 'python_caption_service'),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true
    });

    // Don't wait for the process to complete - return immediately
    pythonProcess.unref();

    // Log process output for debugging
    pythonProcess.stdout.on('data', (data) => {
      console.log(`[${jobId}] Python stdout:`, data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`[${jobId}] Python stderr:`, data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log(`[${jobId}] Python process exited with code ${code}`);
    });

    // Return job ID immediately for client to poll status
    return res.status(200).json({
      success: true,
      jobId,
      message: 'Viral clip generation started successfully'
    });

  } catch (error) {
    console.error('Error in generate-viral-clips API:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: false,
  },
};
