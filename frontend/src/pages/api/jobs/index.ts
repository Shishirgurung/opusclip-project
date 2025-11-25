import type { NextApiRequest, NextApiResponse } from 'next';
import {
  VideoProcessRequestOpus,
  JobCreateResponse,
  JobCreateRequest,
  JobStatus,
  JobErrorType
} from '@/types';
import { getJobRepository } from '@/lib/job-repository';

// Opus Clip template validation (copied from process-video.ts)
function validateOpusTemplate(template: any): { isValid: boolean; error?: string } {
  if (!template) {
    return { isValid: false, error: 'Template is required' };
  }

  // Check if it's an Opus template
  if (template.name && ['OpusClipStyle', 'SwipeUp', 'Karaoke', 'BeastMode', 'TikTokViral', 'PodcastPro', 'Glitch', 'Cinematic', 'ComicPop', 'NeonPulse', 'SpotlightFocus', 'TypeWriter', 'CodeFlow', 'BoldPop'].includes(template.name)) {
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
    const validAnimations = ['bounce', 'pop', 'scale', 'underline', 'slide-left', 'slide-up', 'box', 'fade', 'flash', 'shake', 'none'];
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

// Validate video URL format
function validateVideoUrl(url: string): { isValid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'Video URL is required and must be a string' };
  }

  // Check for valid URL format
  try {
    new URL(url);
  } catch {
    return { isValid: false, error: 'Video URL must be a valid URL' };
  }

  // Check for supported URL patterns
  const youtubeRegex = /(youtube\.com|youtu\.be)/;
  const httpRegex = /^https?:\/\//;
  
  if (!youtubeRegex.test(url) && !httpRegex.test(url)) {
    return { isValid: false, error: 'Video URL must be a YouTube URL or direct HTTP/HTTPS video link' };
  }

  return { isValid: true };
}

// Validate clip duration
function validateClipDuration(duration: any): { isValid: boolean; error?: string } {
  if (duration === undefined || duration === null) {
    return { isValid: false, error: 'Clip duration is required' };
  }

  const numDuration = Number(duration);
  if (isNaN(numDuration)) {
    return { isValid: false, error: 'Clip duration must be a valid number' };
  }

  if (numDuration <= 0) {
    return { isValid: false, error: 'Clip duration must be greater than 0' };
  }

  if (numDuration > 3600) { // 1 hour max
    return { isValid: false, error: 'Clip duration cannot exceed 3600 seconds (1 hour)' };
  }

  return { isValid: true };
}

// Trigger Flask backend processing asynchronously
async function triggerBackgroundProcessing(jobId: string, requestData: VideoProcessRequestOpus): Promise<void> {
  try {
    const triggerUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/jobs/trigger`;
    
    console.log(`Jobs API - Triggering background processing for job ${jobId}`);
    
    // Make async request to trigger endpoint (fire and forget)
    fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true', // Mark as internal request
      },
      body: JSON.stringify({
        jobId,
        requestData
      })
    }).catch(error => {
      console.error(`Jobs API - Failed to trigger background processing for job ${jobId}:`, error);
      // Note: We don't throw here as the job is already created and can be retried
    });
    
  } catch (error) {
    console.error(`Jobs API - Error triggering background processing for job ${jobId}:`, error);
    // Note: We don't throw here as the job is already created and can be retried
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<JobCreateResponse | { error: string; details?: string }>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      error: `Method ${req.method} Not Allowed`,
      details: 'This endpoint only accepts POST requests'
    });
  }

  let jobRepository;
  
  try {
    // Initialize job repository
    try {
      jobRepository = getJobRepository();
      
      // Test Redis connection
      const isHealthy = await jobRepository.healthCheck();
      if (!isHealthy) {
        throw new Error('Redis connection is not healthy');
      }
    } catch (redisError) {
      console.error('Jobs API - Redis connection failed:', redisError);
      return res.status(503).json({
        error: 'Job processing service is temporarily unavailable',
        details: 'Unable to connect to job queue. Please try again later.'
      });
    }

    const requestBody = req.body;
    console.log('Jobs API - Received job creation request');

    // Validate request body exists
    if (!requestBody || typeof requestBody !== 'object') {
      return res.status(400).json({
        error: 'Invalid request body',
        details: 'Request body must be a valid JSON object'
      });
    }

    // Extract and validate VideoProcessRequestOpus data
    const opusRequest = requestBody as VideoProcessRequestOpus;

    // Validate required fields for Opus mode
    if (!opusRequest.videoUrl || !opusRequest.template) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Video URL and template are required for job processing'
      });
    }

    // Additional validation for Opus mode specific fields
    if (!opusRequest.session || !opusRequest.userId || opusRequest.clipDuration === undefined) {
      return res.status(400).json({
        error: 'Missing required Opus fields',
        details: 'session, userId, and clipDuration fields are required for job processing'
      });
    }

    // Validate video URL
    const urlValidation = validateVideoUrl(opusRequest.videoUrl);
    if (!urlValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid video URL',
        details: urlValidation.error
      });
    }

    // Validate clip duration
    const durationValidation = validateClipDuration(opusRequest.clipDuration);
    if (!durationValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid clip duration',
        details: durationValidation.error
      });
    }

    // Validate Opus template
    const templateValidation = validateOpusTemplate(opusRequest.template);
    if (!templateValidation.isValid) {
      return res.status(400).json({
        error: 'Template validation failed',
        details: `${templateValidation.error}. Please ensure you are using a valid Opus Clip template (Karaoke, Beasty, Mozi, Deep Driver, or Popline) with proper captionSettings.syncMode and defaultLines configuration.`
      });
    }

    // Validate output format if provided
    if (opusRequest.outputFormat && typeof opusRequest.outputFormat !== 'string') {
      return res.status(400).json({
        error: 'Invalid output format',
        details: 'Output format must be a string'
      });
    }

    // Validate original filename if provided
    if (opusRequest.originalFilename && typeof opusRequest.originalFilename !== 'string') {
      return res.status(400).json({
        error: 'Invalid original filename',
        details: 'Original filename must be a string'
      });
    }

    console.log('Jobs API - Creating job for Opus Clip request with template:', opusRequest.template.name);
    console.log('Jobs API - Job details:', {
      userId: opusRequest.userId,
      session: opusRequest.session,
      clipDuration: opusRequest.clipDuration,
      templateName: opusRequest.template.name,
      videoUrl: opusRequest.videoUrl.substring(0, 100) + '...' // Log truncated URL for privacy
    });

    // Create job request
    const jobCreateRequest: JobCreateRequest = {
      requestData: opusRequest,
      priority: 5, // Default priority
      expirationHours: 24 // Jobs expire after 24 hours
    };

    // Create job in Redis
    let job;
    try {
      job = await jobRepository.createJob(jobCreateRequest);
      console.log(`Jobs API - Created job ${job.id} for user ${opusRequest.userId}`);
    } catch (jobCreationError) {
      console.error('Jobs API - Failed to create job:', jobCreationError);
      return res.status(500).json({
        error: 'Failed to create processing job',
        details: 'Unable to queue job for processing. Please try again later.'
      });
    }

    // Trigger background processing asynchronously
    // This is fire-and-forget to ensure immediate response to client
    triggerBackgroundProcessing(job.id, opusRequest);

    // Get queue information for client
    let queueInfo;
    try {
      queueInfo = await jobRepository.getQueueInfo();
    } catch (queueError) {
      console.warn('Jobs API - Failed to get queue info:', queueError);
      // Continue without queue info
    }

    // Prepare response
    const response: JobCreateResponse = {
      jobId: job.id,
      status: JobStatus.QUEUED,
      message: 'Job created successfully and queued for processing',
      estimatedProcessingTime: job.metadata?.estimatedProcessingTime,
      createdAt: job.startTime
    };

    // Add queue information if available
    if (queueInfo) {
      (response as any).queueInfo = {
        position: queueInfo.queueLength,
        estimatedWaitTime: queueInfo.estimatedWaitTime
      };
    }

    console.log(`Jobs API - Successfully created job ${job.id}, returning response to client`);
    
    // Return job creation response
    res.status(201).json(response);

  } catch (error: any) {
    console.error('Jobs API - Unexpected error during job creation:', error);
    
    // Determine error type and appropriate response
    let errorMessage = 'An unexpected error occurred while creating the processing job';
    let statusCode = 500;
    let errorDetails = error.message || 'No additional details available';

    // Handle specific error types
    if (error.name === 'ValidationError') {
      errorMessage = 'Request validation failed';
      statusCode = 400;
    } else if (error.message?.includes('Redis') || error.message?.includes('connection')) {
      errorMessage = 'Job processing service is temporarily unavailable';
      statusCode = 503;
      errorDetails = 'Unable to connect to job queue. Please try again later.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Request timeout';
      statusCode = 408;
      errorDetails = 'The request took too long to process. Please try again.';
    }

    res.status(statusCode).json({
      error: errorMessage,
      details: errorDetails
    });

  } finally {
    // Clean up resources if needed
    // Note: We don't disconnect the job repository here as it's a singleton
    // and may be used by other requests
  }
}