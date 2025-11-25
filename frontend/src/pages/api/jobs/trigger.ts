import type { NextApiRequest, NextApiResponse } from 'next';
import { getJobRepository } from '@/lib/job-repository';
import { JobStatus, JobErrorType, VideoProcessRequestOpus } from '@/types';

interface TriggerJobRequest {
  jobId: string;
  requestData: VideoProcessRequestOpus;
}

interface TriggerJobResponse {
  success: boolean;
  message: string;
  jobId: string;
}

interface FlaskJobRequest {
  job_id: string;
  video_url?: string;
  youtube_url?: string;
  opus_template: string;
  clip_duration: string;
  original_filename?: string;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // Progressive delays in milliseconds
const FLASK_TIMEOUT_MS = 30000; // 30 seconds for triggering (not processing)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TriggerJobResponse | { error: string; details?: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      error: `Method ${req.method} Not Allowed` 
    });
  }

  const jobRepository = getJobRepository();
  let jobId: string | undefined;

  try {
    const { jobId: requestJobId, requestData }: TriggerJobRequest = req.body;

    if (!requestJobId || !requestData) {
      return res.status(400).json({
        error: 'Missing required fields: jobId and requestData are required'
      });
    }

    jobId = requestJobId;

    const job = await jobRepository.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        error: `Job ${jobId} not found`
      });
    }

    if (job.status !== JobStatus.QUEUED) {
      return res.status(400).json({
        error: `Job ${jobId} is not in QUEUED status. Current status: ${job.status}`
      });
    }

    console.log(`Job Trigger - Starting Flask backend processing for job ${jobId}`);

    await jobRepository.updateJobStatus(
      jobId, 
      JobStatus.PROCESSING, 
      'Triggering Flask backend processing'
    );

    await jobRepository.updateJobProgress(
      jobId,
      5,
      'initializing',
      'Preparing video processing request',
      {
        name: 'initializing',
        description: 'Preparing video processing request',
        progress: 5
      }
    );

    const success = await triggerFlaskProcessing(jobId, requestData, jobRepository);

    if (success) {
      await jobRepository.updateJobProgress(
        jobId,
        10,
        'processing',
        'Flask backend processing started successfully',
        {
          name: 'processing',
          description: 'Flask backend processing started',
          progress: 10
        }
      );

      console.log(`Job Trigger - Successfully triggered Flask processing for job ${jobId}`);
      
      return res.status(200).json({
        success: true,
        message: 'Flask backend processing triggered successfully',
        jobId
      });
    } else {
      throw new Error('Failed to trigger Flask backend processing after all retry attempts');
    }

  } catch (error: any) {
    console.error(`Job Trigger - Error triggering Flask processing for job ${jobId}:`, error);

    if (jobId) {
      try {
        await jobRepository.setJobError(
          jobId,
          'Failed to trigger Flask backend processing',
          error.message,
          error.stack,
          JobErrorType.NETWORK_ERROR
        );
      } catch (updateError) {
        console.error(`Job Trigger - Failed to update job ${jobId} error status:`, updateError);
      }
    }

    return res.status(500).json({
      error: 'Failed to trigger Flask backend processing',
      details: error.message
    });
  }
}

async function triggerFlaskProcessing(
  jobId: string,
  requestData: VideoProcessRequestOpus,
  jobRepository: ReturnType<typeof getJobRepository>
): Promise<boolean> {
  const flaskUrl = process.env.FLASK_API_URL || 'http://localhost:5000';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), FLASK_TIMEOUT_MS);

    try {
      console.log(`Job Trigger - Attempt ${attempt}/${MAX_RETRIES} to trigger Flask processing for job ${jobId}`);

      const isYoutubeUrl = requestData.videoUrl.includes('youtube.com') || requestData.videoUrl.includes('youtu.be');
      console.log(`Job Trigger - Detected ${isYoutubeUrl ? 'YouTube' : 'direct video'} URL for job ${jobId}`);

      const formData = new FormData();
      formData.append('job_id', jobId);
      
      if (isYoutubeUrl) {
        formData.append('youtube_url', requestData.videoUrl);
      } else {
        formData.append('video_url', requestData.videoUrl);
      }
      
      // Convert template data to match Flask backend expectations
      const opusTemplateData = {
        name: requestData.template.name,
        displayName: requestData.template.name,
        description: requestData.template.description || '',
        category: 'General',
        wordsPerLine: requestData.template.defaultLines || 3,
        positions: ['bottom_center'],
        animationStyle: requestData.template.captionSettings?.animationStyle || 'bounce',
        syncMode: requestData.template.captionSettings?.syncMode || 'word',
        fontFamily: requestData.template.captionSettings?.font?.family || 'Arial',
        fontSize: requestData.template.captionSettings?.font?.size || 48,
        fontColor: requestData.template.captionSettings?.font?.color || '#FFFFFF',
        shadowColor: requestData.template.captionSettings?.font?.shadowColor || '#000000',
        shadowX: requestData.template.captionSettings?.font?.shadowX || 2,
        shadowY: requestData.template.captionSettings?.font?.shadowY || 2,
        shadowBlur: requestData.template.captionSettings?.font?.shadowBlur || 3,
        position: requestData.template.captionSettings?.position || 'bottom',
        keywordHighlight: {
          primaryColor: requestData.template.keywordHighlight?.primaryColor || '#04f827FF',
          secondaryColor: requestData.template.keywordHighlight?.secondaryColor || '#FFFDO3FF',
          enabled: requestData.template.keywordHighlight?.enabled ?? (requestData.template.captionSettings?.autoHighlight || true)
        }
      };
      
      formData.append('opus_template', JSON.stringify(opusTemplateData));
      formData.append('clip_duration', requestData.clipDuration.toString());
      
      // Add layout parameter if present
      if ('layout' in requestData) {
        formData.append('layout', String(requestData.layout));
      }
      
      // Add timeframe parameters if enabled
      if (requestData.useTimeframe && requestData.timeframeStart !== undefined && requestData.timeframeEnd !== undefined) {
        formData.append('timeframe_start', requestData.timeframeStart.toString());
        formData.append('timeframe_end', requestData.timeframeEnd.toString());
      }
      
      // Add clip length preferences
      if (requestData.minClipLength !== undefined) {
        formData.append('min_clip_length', requestData.minClipLength.toString());
      }
      if (requestData.maxClipLength !== undefined) {
        formData.append('max_clip_length', requestData.maxClipLength.toString());
      }
      if (requestData.targetClipLength !== undefined) {
        formData.append('target_clip_length', requestData.targetClipLength.toString());
      }

      console.log(`Job Trigger - Attempting to connect to: ${flaskUrl}/api/transcribe_opus`);
      
      const response = await fetch(`${flaskUrl}/api/transcribe_opus`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Flask backend returned ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      console.log(`Job Trigger - Successfully triggered Flask processing for job ${jobId} on attempt ${attempt}`);
      
      clearTimeout(timeoutId);

      return true;
    } catch (error: any) {
      clearTimeout(timeoutId);

      const isLastAttempt = attempt === MAX_RETRIES;
      const isTimeoutError = error.name === 'AbortError' || error.message?.includes('aborted');
      const isNetworkError = error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('ECONNREFUSED');

      console.error(`Job Trigger - Attempt ${attempt}/${MAX_RETRIES} failed for job ${jobId}:`, {
        error: error.message,
        isTimeoutError,
        isNetworkError,
        isLastAttempt
      });

      try {
        await jobRepository.updateJobProgress(
          jobId,
          5 + (attempt * 2),
          'retrying',
          `Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}${isLastAttempt ? '' : '. Retrying...'}`,
          {
            name: 'retrying',
            description: `Retry attempt ${attempt}/${MAX_RETRIES}`,
            progress: 5 + (attempt * 2)
          }
        );
      } catch (updateError) {
        console.error(`Job Trigger - Failed to update retry progress for job ${jobId}:`, updateError);
      }

      if (isLastAttempt) {
        let errorType = JobErrorType.PROCESSING_ERROR;
        if (isTimeoutError) {
          errorType = JobErrorType.TIMEOUT_ERROR;
        } else if (isNetworkError) {
          errorType = JobErrorType.NETWORK_ERROR;
        }

        throw new Error(`Flask backend trigger failed after ${MAX_RETRIES} attempts. Last error: ${error.message}`);
      }

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt - 1];
        console.log(`Job Trigger - Waiting ${delay}ms before retry ${attempt + 1} for job ${jobId}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return false;
}

