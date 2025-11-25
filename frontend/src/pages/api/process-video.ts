import type { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'undici';
import {
  VideoProcessRequest,
  VideoProcessRequestOpus,
  VideoProcessResponse,
  TimelineClip,
  BrandTemplate,
  OpusTemplate,
  ClipMetadata,
  JobCreateResponse,
  JobStatus,
} from '@/types';

// Opus Clip template validation
function validateOpusTemplate(template: any): { isValid: boolean; error?: string } {
  if (!template) {
    return { isValid: false, error: 'Template is required' };
  }

  // Check if it's an Opus template
  if (template.name && ['Karaoke', 'Beasty', 'Mozi', 'Deep Driver', 'Popline'].includes(template.name)) {
    // Validate basic required fields
    if (!template.name) {
      return { isValid: false, error: 'Missing required field: template.name' };
    }

    if (!template.defaultLines) {
      return { isValid: false, error: 'Missing required field: template.defaultLines' };
    }

    // Validate caption settings structure
    if (!template.captionSettings) {
      return { isValid: false, error: 'Missing required field: template.captionSettings' };
    }

    // Validate sync mode in the correct nested location
    if (!template.captionSettings.syncMode) {
      return { isValid: false, error: 'Missing required field: template.captionSettings.syncMode' };
    }

    if (!['word', 'line'].includes(template.captionSettings.syncMode)) {
      return { isValid: false, error: 'template.captionSettings.syncMode must be "word" or "line"' };
    }

    // Validate default lines
    const lines = parseInt(template.defaultLines);
    if (isNaN(lines) || lines < 1 || lines > 3) {
      return { isValid: false, error: 'template.defaultLines must be between 1 and 3' };
    }

    // Validate animation style if provided
    const validAnimations = ['bounce', 'pop', 'scale', 'underline', 'slide-left', 'slide-up', 'box', 'fade', 'flash', 'shake', 'none', 'karaoke'];
    if (template.captionSettings.animationStyle && !validAnimations.includes(template.captionSettings.animationStyle)) {
      return { isValid: false, error: `Invalid animation style in template.captionSettings.animationStyle: ${template.captionSettings.animationStyle}` };
    }

    // Validate font settings if provided
    if (template.captionSettings.font) {
      if (!template.captionSettings.font.family) {
        return { isValid: false, error: 'Missing required field: template.captionSettings.font.family' };
      }
      if (!template.captionSettings.font.size || template.captionSettings.font.size <= 0) {
        return { isValid: false, error: 'Invalid field: template.captionSettings.font.size must be a positive number' };
      }
      if (!template.captionSettings.font.color) {
        return { isValid: false, error: 'Missing required field: template.captionSettings.font.color' };
      }
    }

    return { isValid: true };
  }

  // For non-Opus templates, basic validation
  if (!template.id || !template.name) {
    return { isValid: false, error: 'Template must have id and name' };
  }

  return { isValid: true };
}

// Process video with Opus Clip backend
async function processOpusVideo(request: VideoProcessRequestOpus): Promise<ClipMetadata[]> {
  const FLASK_BASE_URL = process.env.FLASK_BASE_URL || 'http://localhost:5000';
  
  // Configure timeout handling
  const timeoutMs = parseInt(process.env.OPUS_PROCESS_TIMEOUT_MS || '900000'); // Default 15 minutes
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  
  // Configure Undici client with disabled internal timeouts
  const client = new Client(FLASK_BASE_URL, {
    headersTimeout: 0,
    bodyTimeout: 0,
  });
  
  const startTime = Date.now();
  
  try {
    console.log('API - Processing Opus Clip video with Flask backend');
    
    // Prepare form data for Flask backend
    const formData = new FormData();
    
    // Detect YouTube URLs
    const youtubeRegex = /(youtube\.com|youtu\.be)/;
    const isYouTubeUrl = youtubeRegex.test(request.videoUrl);
    
    if (isYouTubeUrl) {
      // For YouTube URLs, send the URL directly to Flask backend
      console.log('API - Detected YouTube URL, sending to Flask for processing');
      formData.append('youtube_url', request.videoUrl);
    } else {
      // For regular URLs, download video file and add to form data
      console.log('API - Processing direct video URL');
      try {
        const videoResponse = await fetch(request.videoUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to fetch video from direct URL: ${videoResponse.statusText}`);
        }
        
        const videoBlob = await videoResponse.blob();
        formData.append('file', videoBlob, request.originalFilename || 'video.mp4');
      } catch (error: any) {
        throw new Error(`Direct video URL processing failed: ${error.message}`);
      }
    }
    
    // Add Opus template data - ensure proper field mapping from nested structure
    const opusTemplateData = {
      name: request.template.name,
      syncMode: request.template.captionSettings?.syncMode || 'line',
      defaultLines: request.template.defaultLines || 2,
      animationStyle: request.template.captionSettings?.animationStyle || 'none',
      highlightWords: request.template.captionSettings?.highlightWords || [],
      autoHighlight: request.template.captionSettings?.autoHighlight || true,
      fontFamily: request.template.captionSettings?.font?.family || 'Montserrat',
      fontSize: request.template.captionSettings?.font?.size || 48,
      fontColor: request.template.captionSettings?.font?.color || '#FFFFFF',
      shadowColor: request.template.captionSettings?.font?.shadowColor || '#000000',
      shadowX: request.template.captionSettings?.font?.shadowX || 2,
      shadowY: request.template.captionSettings?.font?.shadowY || 2,
      shadowBlur: request.template.captionSettings?.font?.shadowBlur || 3,
      position: request.template.captionSettings?.position || 'bottom',
      keywordHighlight: {
        primaryColor: request.template.keywordHighlight?.primaryColor || '#04f827FF',
        secondaryColor: request.template.keywordHighlight?.secondaryColor || '#FFFDO3FF',
        enabled: request.template.keywordHighlight?.enabled ?? (request.template.captionSettings?.autoHighlight || true)
      }
    };
    
    formData.append('opus_template', JSON.stringify(opusTemplateData));
    
    // Add clip duration parameter to Flask backend
    formData.append('clip_duration', request.clipDuration.toString());
    
    // Call Flask backend with timeout configuration
    const response = await fetch(`${FLASK_BASE_URL}/transcribe_opus`, {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
      // @ts-ignore - Undici dispatcher option
      dispatcher: client,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorPrefix = isYouTubeUrl ? 'YouTube URL processing failed' : 'Direct video processing failed';
      throw new Error(errorData.error || `${errorPrefix}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('API - Opus processing successful:', result.message);
    
    // Handle multiple clips response or single clip for backward compatibility
    let clipsMetadata: ClipMetadata[] = [];
    
    if (result.clips && Array.isArray(result.clips)) {
      // Handle multiple clips response
      console.log('API - Processing multiple clips:', result.clips.length);
      clipsMetadata = result.clips.map((clip: any, index: number) => ({
        id: `${request.session || Date.now().toString()}_${index}`,
        previewUrl: clip.filename ? `/api/download/${clip.filename}` : null,
        summary: `Opus Clip ${index + 1} processed with ${result.template_name || request.template.name} template`,
        captionData: clip.ass_subtitle_content || result.ass_subtitle_content || null,
        sourceVideoUrl: request.videoUrl,
        startTime: clip.start || 0,
        endTime: clip.end || (clip.start || 0) + (clip.duration || request.clipDuration || 60),
        originalFilename: request.originalFilename || 'video.mp4',
        error: null,
        traceback: null,
        templateId: request.template.id,
        aspectRatio: request.template.aspectRatio || '9:16',
        duration: clip.duration || request.clipDuration || 60,
        resultUrl: clip.filename ? `/api/download/${clip.filename}` : undefined
      }));
    } else if (result.processed_filename) {
      // Handle single clip response for backward compatibility
      console.log('API - Processing single clip (backward compatibility)');
      const clipMetadata: ClipMetadata = {
        id: request.session || Date.now().toString(),
        previewUrl: result.processed_filename ? `/api/download/${result.processed_filename}` : null,
        summary: `Opus Clip processed with ${result.template_name || request.template.name} template`,
        captionData: result.ass_subtitle_content || null,
        sourceVideoUrl: request.videoUrl,
        startTime: 0,
        endTime: request.clipDuration || 60,
        originalFilename: request.originalFilename || 'video.mp4',
        error: null,
        traceback: null,
        templateId: request.template.id,
        aspectRatio: request.template.aspectRatio || '9:16',
        duration: request.clipDuration || 60,
        resultUrl: result.processed_filename ? `/api/download/${result.processed_filename}` : undefined
      };
      clipsMetadata = [clipMetadata];
    } else {
      // Handle case where no clips were generated
      throw new Error('No clips were generated from the video processing');
    }
    
    return clipsMetadata;
    
  } catch (error: any) {
    console.error('API - Opus processing error:', error);
    
    // Calculate processing duration
    const processingDuration = Date.now() - startTime;
    const processingMinutes = Math.round(processingDuration / 60000);
    
    // Determine error type for better user feedback
    const youtubeRegex = /(youtube\.com|youtu\.be)/;
    const isYouTubeUrl = youtubeRegex.test(request.videoUrl);
    
    let errorMessage: string;
    let errorPrefix: string;
    
    // Check if error is due to timeout (AbortError)
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      const timeoutMinutes = Math.round(timeoutMs / 60000);
      errorPrefix = isYouTubeUrl 
        ? `YouTube URL processing exceeded ${timeoutMinutes} minutes` 
        : `Video processing exceeded ${timeoutMinutes} minutes`;
      errorMessage = `${errorPrefix}. Consider increasing OPUS_PROCESS_TIMEOUT_MS for longer videos or slower hardware.`;
    } else {
      errorPrefix = isYouTubeUrl ? 'YouTube URL processing failed' : 'Video processing failed';
      errorMessage = error.message || 'Unknown error occurred';
    }
    
    // Return error as ClipMetadata with enhanced timeout information
    const errorClip: ClipMetadata = {
      id: request.session || Date.now().toString(),
      previewUrl: null,
      summary: `${errorPrefix} (${processingMinutes}m elapsed)`,
      captionData: null,
      sourceVideoUrl: request.videoUrl,
      startTime: 0,
      endTime: request.clipDuration || 60,
      originalFilename: request.originalFilename || 'video.mp4',
      error: errorMessage,
      traceback: error.stack || null,
      templateId: request.template.id,
      aspectRatio: request.template.aspectRatio || '9:16',
      duration: request.clipDuration || 60
    };
    
    return [errorClip];
  } finally {
    // Clean up timeout and client
    clearTimeout(timeoutId);
    client.destroy();
  }
}

// Legacy video processing function (placeholder)
async function processVideo(videoUrl: string, template: BrandTemplate): Promise<ClipMetadata[]> {
  // This would contain the original video processing logic
  // For now, return a placeholder response
  console.log('API - Processing with legacy template:', template.name);
  
  const clipMetadata: ClipMetadata = {
    id: Date.now().toString(),
    previewUrl: null,
    summary: `Processed with ${template.name} template`,
    captionData: null,
    sourceVideoUrl: videoUrl,
    startTime: 0,
    endTime: 60,
    originalFilename: 'video.mp4',
    error: null,
    traceback: null,
    templateId: template.id,
    aspectRatio: template.aspectRatio,
    duration: 60
  };
  
  return [clipMetadata];
}

// Create job via new job system
async function createJobForLongRequest(opusRequest: VideoProcessRequestOpus): Promise<JobCreateResponse> {
  try {
    const jobsApiUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/jobs`;
    
    console.log('Process-Video API - Redirecting to job system for long-running request');
    
    const response = await fetch(jobsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true', // Mark as internal request
      },
      body: JSON.stringify(opusRequest)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Job creation failed: ${response.statusText}`);
    }
    
    return await response.json();
    
  } catch (error: any) {
    console.error('Process-Video API - Failed to create job:', error);
    throw new Error(`Failed to create background job: ${error.message}`);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VideoProcessResponse | JobCreateResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const requestBody = req.body;
    console.log('API - Received video processing request');

    // DEPRECATION NOTICE: Log usage for migration tracking
    console.warn('DEPRECATION NOTICE: /api/process-video endpoint is deprecated. Please migrate to /api/jobs for new implementations.');
    console.log('Process-Video API - Usage tracking:', {
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer,
      isInternalRequest: req.headers['x-internal-request'] === 'true'
    });

    // Determine if this is an Opus Clip request or legacy request using explicit opusMode flag
    const isOpusRequest = requestBody.opusMode === true;
    
    if (isOpusRequest) {
      // Handle Opus Clip request
      const opusRequest = requestBody as VideoProcessRequestOpus;
      
      // Validate required fields for Opus mode
      if (!opusRequest.videoUrl || !opusRequest.template) {
        const errorResponse: VideoProcessResponse = { 
          error: 'Video URL and template are required for Opus processing' 
        };
        return res.status(400).json(errorResponse);
      }

      // Additional validation for Opus mode specific fields
      if (!opusRequest.session || !opusRequest.userId || opusRequest.clipDuration === undefined) {
        const errorResponse: VideoProcessResponse = { 
          error: 'Opus mode requires session, userId, and clipDuration fields' 
        };
        return res.status(400).json(errorResponse);
      }

      // Validate Opus template with specific feedback for Opus mode
      const validation = validateOpusTemplate(opusRequest.template);
      if (!validation.isValid) {
        const errorResponse: VideoProcessResponse = { 
          error: `Opus template validation failed: ${validation.error}. Please ensure you are using a valid Opus Clip template (Karaoke, Beasty, Mozi, Deep Driver, or Popline) with proper captionSettings.syncMode and defaultLines configuration.` 
        };
        return res.status(400).json(errorResponse);
      }

      // BACKWARD COMPATIBILITY LAYER: Route based on clip duration
      const clipDuration = Number(opusRequest.clipDuration);
      const SYNC_PROCESSING_THRESHOLD = 30; // seconds
      
      console.log('Process-Video API - Request analysis:', {
        clipDuration,
        templateName: opusRequest.template.name,
        userId: opusRequest.userId,
        processingMode: clipDuration < SYNC_PROCESSING_THRESHOLD ? 'SYNCHRONOUS' : 'ASYNCHRONOUS'
      });

      if (clipDuration < SYNC_PROCESSING_THRESHOLD) {
        // SYNCHRONOUS PROCESSING: For quick demos and short clips
        console.log(`Process-Video API - Processing synchronously (${clipDuration}s < ${SYNC_PROCESSING_THRESHOLD}s threshold)`);
        const clips = await processOpusVideo(opusRequest);
        
        if (clips.length > 0 && clips[0].error) {
          const response: VideoProcessResponse = {
            error: clips[0].error,
            details: clips[0].traceback,
            clips: clips,
          };
          return res.status(500).json(response);
        }

        if (clips.length === 0) {
          const errorResponse: VideoProcessResponse = {
            error: 'Processing completed, but no clips were generated.',
            details: 'The video may not contain speech or could not be analyzed.'
          };
          return res.status(500).json(errorResponse);
        }

        const successResponse: VideoProcessResponse = {
          message: 'Opus Clip processing completed successfully!',
          clips,
        };
        return res.status(200).json(successResponse);
        
      } else {
        // ASYNCHRONOUS PROCESSING: Route to job system for longer clips
        console.log(`Process-Video API - Redirecting to job system (${clipDuration}s >= ${SYNC_PROCESSING_THRESHOLD}s threshold)`);

        try {
          const jobResponse = await createJobForLongRequest(opusRequest);
          return res.status(202).json(jobResponse);
          
        } catch (jobError: any) {
          console.error('Process-Video API - Job creation failed, falling back to synchronous processing:', jobError);

          const clips = await processOpusVideo(opusRequest);
          
          if (clips.length > 0 && clips[0].error) {
            const errorResponse: VideoProcessResponse = {
              error: 'Job system failed, and synchronous fallback also failed.',
              details: clips[0].error,
              clips: clips,
            };
            return res.status(500).json(errorResponse);
          }

          if (clips.length === 0) {
            const errorResponse: VideoProcessResponse = {
              error: 'Processing completed via fallback, but no clips were generated.',
              details: 'The video may not contain speech or could not be analyzed.',
              fallbackWarning: 'Job system unavailable, processed synchronously (may have timed out)'
            };
            return res.status(500).json(errorResponse);
          }

          const fallbackResponse: VideoProcessResponse = {
            message: 'Video processing completed synchronously after job system failure.',
            clips,
            fallbackWarning: 'Job system unavailable, processed synchronously (may have timed out)'
          };
          return res.status(200).json(fallbackResponse);
        }
      }
      
    } else {
      // Handle legacy request (non-Opus mode)
      const legacyRequest = requestBody as VideoProcessRequest;

      if (!legacyRequest.videoUrl || !legacyRequest.template) {
        const errorResponse: VideoProcessResponse = { error: 'Video URL and template are required' };
        return res.status(400).json(errorResponse);
      }

      const clips = await processVideo(legacyRequest.videoUrl, legacyRequest.template);

      const response: VideoProcessResponse = {
        message: 'Video processing completed successfully!',
        clips,
      };
      return res.status(200).json(response);
    }

  } catch (error: any) {
    console.error('API - Unhandled error in process-video handler:', error);
    const errorResponse: VideoProcessResponse = {
      error: 'An unexpected error occurred.',
      details: error.message,
    };
    return res.status(500).json(errorResponse);
  }
}
