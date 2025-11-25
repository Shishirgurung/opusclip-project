import { useState, useEffect, useRef, useCallback } from 'react';
import { Job, JobStatus, JobPollingResponse, JobError, JobErrorType } from '../types';

interface UseJobPollingOptions {
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Maximum number of polling attempts (default: unlimited) */
  maxAttempts?: number;
  /** Whether to start polling immediately (default: true) */
  autoStart?: boolean;
  /** Whether to stop polling on error (default: false) */
  stopOnError?: boolean;
  /** Custom error handler */
  onError?: (error: JobError) => void;
  /** Custom success handler */
  onSuccess?: (job: Job) => void;
  /** Custom progress handler */
  onProgress?: (job: Job) => void;
  /** Whether to use exponential backoff on errors (default: true) */
  exponentialBackoff?: boolean;
  /** Maximum backoff delay in milliseconds (default: 30000) */
  maxBackoffDelay?: number;
}

interface UseJobPollingReturn {
  /** Current job data */
  job: Job | null;
  /** Whether polling is currently active */
  isPolling: boolean;
  /** Whether the initial job fetch is loading */
  isLoading: boolean;
  /** Current error state */
  error: JobError | null;
  /** Whether the job is completed (success or failure) */
  isCompleted: boolean;
  /** Whether the job completed successfully */
  isSuccess: boolean;
  /** Whether the job failed */
  isFailed: boolean;
  /** Current polling attempt count */
  attemptCount: number;
  /** Start polling */
  startPolling: () => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Retry polling (resets error state) */
  retryPolling: () => void;
  /** Manually refresh job status */
  refreshJob: () => Promise<void>;
  /** Reset hook state */
  reset: () => void;
}

const DEFAULT_POLL_INTERVAL = 2000; // 2 seconds
const DEFAULT_MAX_BACKOFF_DELAY = 30000; // 30 seconds
const BACKOFF_MULTIPLIER = 1.5;

export function useJobPolling(
  jobId: string | null,
  options: UseJobPollingOptions = {}
): UseJobPollingReturn {
  const {
    pollInterval = DEFAULT_POLL_INTERVAL,
    maxAttempts,
    autoStart = true,
    stopOnError = false,
    onError,
    onSuccess,
    onProgress,
    exponentialBackoff = true,
    maxBackoffDelay = DEFAULT_MAX_BACKOFF_DELAY,
  } = options;

  // State
  const [job, setJob] = useState<Job | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<JobError | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  // Refs for cleanup and interval management
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const currentBackoffDelay = useRef(pollInterval);

  // Derived state
  const isCompleted = job?.status === JobStatus.COMPLETED || job?.status === JobStatus.FAILED;
  const isSuccess = job?.status === JobStatus.COMPLETED;
  const isFailed = job?.status === JobStatus.FAILED;

  // Create job error helper
  const createJobError = useCallback((
    type: JobErrorType,
    message: string,
    details?: string,
    retryable: boolean = true
  ): JobError => ({
    type,
    message,
    details,
    timestamp: new Date().toISOString(),
    retryable,
  }), []);

  // Fetch job status
  const fetchJobStatus = useCallback(async (): Promise<Job | null> => {
    if (!jobId) {
      throw createJobError(
        JobErrorType.VALIDATION_ERROR,
        'Job ID is required',
        undefined,
        false
      );
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw createJobError(
            JobErrorType.VALIDATION_ERROR,
            'Job not found',
            `Job with ID ${jobId} does not exist`,
            false
          );
        }
        
        if (response.status >= 500) {
          throw createJobError(
            JobErrorType.NETWORK_ERROR,
            'Server error occurred',
            `HTTP ${response.status}: ${response.statusText}`,
            true
          );
        }

        throw createJobError(
          JobErrorType.NETWORK_ERROR,
          'Failed to fetch job status',
          `HTTP ${response.status}: ${response.statusText}`,
          true
        );
      }

      const data: JobPollingResponse = await response.json();
      
      if (!data.job) {
        throw createJobError(
          JobErrorType.PROCESSING_ERROR,
          'Invalid response format',
          'Job data is missing from response',
          true
        );
      }

      return data.job;
    } catch (err) {
      if (err instanceof Error && 'type' in err) {
        throw err; // Re-throw JobError
      }
      
      // Handle network errors
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw createJobError(
          JobErrorType.NETWORK_ERROR,
          'Network connection failed',
          'Unable to connect to the server',
          true
        );
      }

      // Handle unknown errors
      throw createJobError(
        JobErrorType.UNKNOWN_ERROR,
        'An unexpected error occurred',
        err instanceof Error ? err.message : String(err),
        true
      );
    }
  }, [jobId, createJobError]);

  // Handle polling iteration
  const pollOnce = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      setAttemptCount(prev => prev + 1);
      const jobData = await fetchJobStatus();
      
      if (!mountedRef.current) return;

      setJob(jobData);
      setError(null);
      
      // Reset backoff delay on success
      currentBackoffDelay.current = pollInterval;

      // Call progress handler
      if (onProgress && jobData) {
        onProgress(jobData);
      }

      // Check if job is completed
      if (jobData && (jobData.status === JobStatus.COMPLETED || jobData.status === JobStatus.FAILED)) {
        setIsPolling(false);
        
        if (jobData.status === JobStatus.COMPLETED && onSuccess) {
          onSuccess(jobData);
        }
        
        return true; // Signal completion
      }

      return false; // Continue polling
    } catch (err) {
      if (!mountedRef.current) return;

      const jobError = err as JobError;
      setError(jobError);

      // Call error handler
      if (onError) {
        onError(jobError);
      }

      // Stop polling if configured to do so or if error is not retryable
      if (stopOnError || !jobError.retryable) {
        setIsPolling(false);
        return true; // Signal stop
      }

      // Apply exponential backoff
      if (exponentialBackoff) {
        currentBackoffDelay.current = Math.min(
          currentBackoffDelay.current * BACKOFF_MULTIPLIER,
          maxBackoffDelay
        );
      }

      return false; // Continue polling with backoff
    }
  }, [
    fetchJobStatus,
    pollInterval,
    onProgress,
    onSuccess,
    onError,
    stopOnError,
    exponentialBackoff,
    maxBackoffDelay,
  ]);

  // Start polling function
  const startPolling = useCallback(() => {
    if (!jobId || isPolling) return;

    setIsPolling(true);
    setError(null);

    const poll = async () => {
      if (!mountedRef.current || !isPolling) return;

      // Check max attempts
      if (maxAttempts && attemptCount >= maxAttempts) {
        setIsPolling(false);
        setError(createJobError(
          JobErrorType.TIMEOUT_ERROR,
          'Maximum polling attempts reached',
          `Stopped after ${maxAttempts} attempts`,
          false
        ));
        return;
      }

      const shouldStop = await pollOnce();
      
      if (!shouldStop && mountedRef.current && isPolling) {
        // Schedule next poll
        intervalRef.current = setTimeout(poll, currentBackoffDelay.current);
      }
    };

    // Start polling immediately
    poll();
  }, [jobId, isPolling, maxAttempts, attemptCount, pollOnce, createJobError]);

  // Stop polling function
  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Retry polling function
  const retryPolling = useCallback(() => {
    setError(null);
    setAttemptCount(0);
    currentBackoffDelay.current = pollInterval;
    
    if (!isPolling) {
      startPolling();
    }
  }, [pollInterval, isPolling, startPolling]);

  // Manual refresh function
  const refreshJob = useCallback(async () => {
    if (!jobId) return;

    setIsLoading(true);
    try {
      const jobData = await fetchJobStatus();
      setJob(jobData);
      setError(null);
    } catch (err) {
      const jobError = err as JobError;
      setError(jobError);
      if (onError) {
        onError(jobError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [jobId, fetchJobStatus, onError]);

  // Reset function
  const reset = useCallback(() => {
    stopPolling();
    setJob(null);
    setError(null);
    setAttemptCount(0);
    setIsLoading(false);
    currentBackoffDelay.current = pollInterval;
  }, [stopPolling, pollInterval]);

  // Effect for auto-start
  useEffect(() => {
    if (jobId && autoStart && !isCompleted) {
      startPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [jobId, autoStart, isCompleted, startPolling, stopPolling]);

  // Effect for job ID changes
  useEffect(() => {
    if (jobId) {
      reset();
      if (autoStart) {
        startPolling();
      }
    } else {
      reset();
    }
  }, [jobId, autoStart, reset, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // Auto-stop polling when job is completed
  useEffect(() => {
    if (isCompleted && isPolling) {
      stopPolling();
    }
  }, [isCompleted, isPolling, stopPolling]);

  return {
    job,
    isPolling,
    isLoading,
    error,
    isCompleted,
    isSuccess,
    isFailed,
    attemptCount,
    startPolling,
    stopPolling,
    retryPolling,
    refreshJob,
    reset,
  };
}

export default useJobPolling;