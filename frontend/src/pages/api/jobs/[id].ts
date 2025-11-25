import { NextApiRequest, NextApiResponse } from 'next';
import { getJobRepository } from '../../../lib/job-repository';
import { JobStatus, JobStatusResponse, JobPollingResponse } from '../../../types';

/**
 * Job status polling endpoint - GET /api/jobs/[id]
 * Returns current job state, progress, and results
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<JobStatusResponse | JobPollingResponse | { error: string; code?: string }>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      error: `Method ${req.method} not allowed`,
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { id: jobId } = req.query;
    const { poll, userId } = req.query;

    // Validate job ID
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ 
        error: 'Job ID is required and must be a string',
        code: 'INVALID_JOB_ID'
      });
    }

    // Validate user ID for authorization
    if (!userId || typeof userId !== 'string') {
      return res.status(401).json({ 
        error: 'User ID is required for authorization',
        code: 'MISSING_USER_ID'
      });
    }

    const jobRepository = getJobRepository();

    // Check Redis connection health
    const isHealthy = await jobRepository.healthCheck();
    if (!isHealthy) {
      console.error('Redis connection unhealthy for job status request');
      return res.status(503).json({ 
        error: 'Service temporarily unavailable. Please try again later.',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    // Retrieve job from Redis
    const job = await jobRepository.getJob(jobId);

    if (!job) {
      return res.status(404).json({ 
        error: 'Job not found',
        code: 'JOB_NOT_FOUND'
      });
    }

    // Authorization check - ensure user can only access their own jobs
    if (job.userId !== userId) {
      return res.status(403).json({ 
        error: 'Access denied. You can only access your own jobs.',
        code: 'ACCESS_DENIED'
      });
    }

    // Determine if this is a polling request
    const isPollingRequest = poll === 'true';
    const isActive = job.status === JobStatus.QUEUED || job.status === JobStatus.PROCESSING;

    // Set appropriate caching headers based on job status
    setCachingHeaders(res, job.status, isPollingRequest);

    // Calculate queue position and estimated wait time for queued jobs
    let queuePosition: number | undefined;
    let estimatedWaitTime: number | undefined;

    if (job.status === JobStatus.QUEUED) {
      try {
        const queueInfo = await jobRepository.getQueueInfo();
        const activeJobs = queueInfo.activeJobs
          .filter(j => j.status === JobStatus.QUEUED)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        
        queuePosition = activeJobs.findIndex(j => j.id === jobId) + 1;
        
        // Estimate wait time based on queue position and average processing time
        if (queuePosition > 0 && job.metadata?.estimatedProcessingTime) {
          estimatedWaitTime = queuePosition * job.metadata.estimatedProcessingTime;
        }
      } catch (error) {
        console.error('Failed to calculate queue position:', error);
        // Continue without queue info rather than failing the request
      }
    }

    // Determine next polling interval based on job status and stage
    const nextPollInterval = calculatePollingInterval(job.status, job.stage, job.progress);

    // Prepare base response
    const baseResponse: JobStatusResponse = {
      job,
      isActive,
      nextPollInterval
    };

    // Return enhanced response for polling requests
    if (isPollingRequest) {
      const pollingResponse: JobPollingResponse = {
        ...baseResponse,
        shouldContinuePolling: isActive,
        pollInterval: nextPollInterval,
        serverTime: new Date().toISOString(),
        queuePosition,
        estimatedWaitTime
      };

      return res.status(200).json(pollingResponse);
    }

    // Return standard response for non-polling requests
    return res.status(200).json(baseResponse);

  } catch (error) {
    console.error('Error retrieving job status:', error);

    // Handle specific Redis connection errors
    if (error instanceof Error) {
      if (error.message.includes('Redis')) {
        return res.status(503).json({ 
          error: 'Database connection error. Please try again later.',
          code: 'DATABASE_ERROR'
        });
      }

      if (error.message.includes('timeout')) {
        return res.status(504).json({ 
          error: 'Request timeout. Please try again.',
          code: 'TIMEOUT_ERROR'
        });
      }
    }

    return res.status(500).json({ 
      error: 'Internal server error occurred while retrieving job status',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Set appropriate caching headers based on job status and request type
 */
function setCachingHeaders(res: NextApiResponse, status: JobStatus, isPollingRequest: boolean): void {
  if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
    // Completed/failed jobs can be cached longer since they won't change
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300'); // 5 minutes
    res.setHeader('ETag', `"${status}-${Date.now()}"`);
  } else if (status === JobStatus.PROCESSING) {
    // Processing jobs should have minimal caching to show real-time progress
    if (isPollingRequest) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5'); // 5 seconds
    }
  } else if (status === JobStatus.QUEUED) {
    // Queued jobs can be cached briefly
    res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=10'); // 10 seconds
  }

  // Add headers to optimize polling performance
  if (isPollingRequest) {
    res.setHeader('X-Polling-Optimized', 'true');
    res.setHeader('Connection', 'keep-alive');
  }

  // Add CORS headers for cross-origin polling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

/**
 * Calculate optimal polling interval based on job status and progress
 */
function calculatePollingInterval(status: JobStatus, stage: string, progress: number): number {
  // Default polling intervals in milliseconds
  const DEFAULT_POLL_INTERVAL = 3000; // 3 seconds
  const FAST_POLL_INTERVAL = 1000; // 1 second
  const SLOW_POLL_INTERVAL = 5000; // 5 seconds
  const VERY_SLOW_POLL_INTERVAL = 10000; // 10 seconds

  // Get custom interval from environment or use default
  const customInterval = process.env.JOB_POLLING_INTERVAL_MS;
  const baseInterval = customInterval ? parseInt(customInterval, 10) : DEFAULT_POLL_INTERVAL;

  switch (status) {
    case JobStatus.QUEUED:
      // Slower polling for queued jobs
      return Math.max(baseInterval, SLOW_POLL_INTERVAL);

    case JobStatus.PROCESSING:
      // Adaptive polling based on stage and progress
      if (stage === 'transcribing' || stage === 'analyzing') {
        // These stages can take longer, use slower polling
        return Math.max(baseInterval, SLOW_POLL_INTERVAL);
      } else if (stage === 'generating' || stage === 'rendering') {
        // These stages show more frequent progress updates
        return Math.min(baseInterval, DEFAULT_POLL_INTERVAL);
      } else if (progress > 90) {
        // Near completion, poll more frequently
        return FAST_POLL_INTERVAL;
      } else if (progress < 10) {
        // Early stages, poll less frequently
        return SLOW_POLL_INTERVAL;
      }
      return baseInterval;

    case JobStatus.COMPLETED:
    case JobStatus.FAILED:
      // No need to poll completed jobs
      return VERY_SLOW_POLL_INTERVAL;

    default:
      return baseInterval;
  }
}