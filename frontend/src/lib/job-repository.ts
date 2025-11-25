import Redis from 'ioredis';
import { 
  Job, 
  JobStatus, 
  JobCreateRequest, 
  VideoProcessRequestOpus, 
  ClipMetadata, 
  JobError, 
  JobErrorType,
  ProcessingStage 
} from '../types';

export class JobRepository {
  private redis: Redis;
  private readonly keyPrefix = 'job:';
  private readonly defaultExpiration = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(redisUrl?: string) {
    const connectionString = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.redis = new Redis(connectionString, {
      // lazyConnect and enableOfflineQueue are removed to allow immediate connection
      // and command queueing, which prevents the race condition on startup.
      connectTimeout: 10000, // 10 seconds
      retryStrategy: (times) => {
        // Default is Math.min(times * 50, 2000)
        // This provides an exponential backoff strategy.
        const delay = Math.min(times * 100, 3000); // e.g. 100ms, 200ms, 300ms ... up to 3s
        return delay;
      },
      enableReadyCheck: false,
      maxRetriesPerRequest: this.maxRetries, // This is for commands, not connection.
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    });

    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      console.log('Connected to Redis');
    });

    this.redis.on('ready', () => {
      console.log('Redis connection ready');
    });

    this.redis.on('close', () => {
      console.log('Redis connection closed');
    });
  }

  /**
   * Create a new job in Redis
   */
  async createJob(request: JobCreateRequest): Promise<Job> {
    const jobId = this.generateJobId();
    const now = new Date().toISOString();
    
    const job: Job = {
      id: jobId,
      status: JobStatus.QUEUED,
      progress: 0,
      stage: 'queued',
      message: 'Job created and queued for processing',
      startTime: now,
      endTime: null,
      userId: request.requestData.userId,
      requestData: request.requestData,
      result: null,
      error: null,
      stages: [
        {
          name: 'queued',
          description: 'Job queued for processing',
          progress: 0
        }
      ],
      metadata: {
        originalFilename: request.requestData.originalFilename,
        estimatedProcessingTime: this.estimateProcessingTime(request.requestData)
      }
    };

    await this.executeWithRetry(async () => {
      const key = this.getJobKey(jobId);
      await this.redis.setex(key, this.defaultExpiration, JSON.stringify(job));
      
      // Add to user's job list
      const userJobsKey = `user:${request.requestData.userId}:jobs`;
      await this.redis.sadd(userJobsKey, jobId);
      await this.redis.expire(userJobsKey, this.defaultExpiration);
      
      // Add to global job queue for monitoring
      await this.redis.zadd('job:queue', Date.now(), jobId);
    });

    return job;
  }

  /**
   * Update job progress and stage
   */
  async updateJobProgress(
    jobId: string, 
    progress: number, 
    stage: string, 
    message: string,
    stageDetails?: ProcessingStage
  ): Promise<void> {
    await this.executeWithRetry(async () => {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      job.progress = Math.max(0, Math.min(100, progress));
      job.stage = stage;
      job.message = message;

      // Update stages array
      if (stageDetails) {
        if (!job.stages) {
          job.stages = [];
        }
        
        // Update existing stage or add new one
        const existingStageIndex = job.stages.findIndex(s => s.name === stageDetails.name);
        if (existingStageIndex >= 0) {
          job.stages[existingStageIndex] = stageDetails;
        } else {
          job.stages.push(stageDetails);
        }
      }

      const key = this.getJobKey(jobId);
      await this.redis.setex(key, this.defaultExpiration, JSON.stringify(job));
    });
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId: string, status: JobStatus, message?: string): Promise<void> {
    await this.executeWithRetry(async () => {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      job.status = status;
      if (message) {
        job.message = message;
      }

      // Set end time for completed or failed jobs
      if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
        job.endTime = new Date().toISOString();
        
        // Calculate actual processing time
        if (job.metadata) {
          const startTime = new Date(job.startTime).getTime();
          const endTime = new Date(job.endTime).getTime();
          job.metadata.actualProcessingTime = Math.round((endTime - startTime) / 1000);
        }

        // Remove from active queue
        await this.redis.zrem('job:queue', jobId);
      }

      // Update progress based on status
      if (status === JobStatus.PROCESSING && job.progress === 0) {
        job.progress = 1;
      } else if (status === JobStatus.COMPLETED) {
        job.progress = 100;
      }

      const key = this.getJobKey(jobId);
      await this.redis.setex(key, this.defaultExpiration, JSON.stringify(job));
    });
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    return await this.executeWithRetry(async () => {
      const key = this.getJobKey(jobId);
      const jobData = await this.redis.get(key);
      
      if (!jobData) {
        return null;
      }

      try {
        return JSON.parse(jobData) as Job;
      } catch (error) {
        console.error(`Failed to parse job data for ${jobId}:`, error);
        return null;
      }
    });
  }

  /**
   * Set job result when processing is completed
   */
  async setJobResult(jobId: string, result: ClipMetadata[]): Promise<void> {
    await this.executeWithRetry(async () => {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      job.result = result;
      job.status = JobStatus.COMPLETED;
      job.progress = 100;
      job.stage = 'completed';
      job.message = `Processing completed successfully. Generated ${result.length} clips.`;
      job.endTime = new Date().toISOString();

      // Calculate actual processing time
      if (job.metadata) {
        const startTime = new Date(job.startTime).getTime();
        const endTime = new Date(job.endTime).getTime();
        job.metadata.actualProcessingTime = Math.round((endTime - startTime) / 1000);
      }

      // Update final stage
      if (job.stages) {
        job.stages.push({
          name: 'completed',
          description: 'Processing completed successfully',
          progress: 100
        });
      }

      const key = this.getJobKey(jobId);
      await this.redis.setex(key, this.defaultExpiration, JSON.stringify(job));
      
      // Remove from active queue
      await this.redis.zrem('job:queue', jobId);
    });
  }

  /**
   * Set job error when processing fails
   */
  async setJobError(
    jobId: string, 
    errorMessage: string, 
    errorDetails?: string, 
    traceback?: string,
    errorType: JobErrorType = JobErrorType.PROCESSING_ERROR
  ): Promise<void> {
    await this.executeWithRetry(async () => {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const jobError: JobError = {
        type: errorType,
        message: errorMessage,
        details: errorDetails,
        traceback: traceback,
        timestamp: new Date().toISOString(),
        retryable: this.isRetryableError(errorType)
      };

      job.error = {
        message: errorMessage,
        details: errorDetails,
        traceback: traceback
      };
      job.status = JobStatus.FAILED;
      job.stage = 'failed';
      job.message = `Processing failed: ${errorMessage}`;
      job.endTime = new Date().toISOString();

      // Calculate actual processing time
      if (job.metadata) {
        const startTime = new Date(job.startTime).getTime();
        const endTime = new Date(job.endTime).getTime();
        job.metadata.actualProcessingTime = Math.round((endTime - startTime) / 1000);
      }

      // Update final stage
      if (job.stages) {
        job.stages.push({
          name: 'failed',
          description: `Processing failed: ${errorMessage}`,
          progress: job.progress
        });
      }

      const key = this.getJobKey(jobId);
      await this.redis.setex(key, this.defaultExpiration, JSON.stringify(job));
      
      // Remove from active queue
      await this.redis.zrem('job:queue', jobId);
    });
  }

  /**
   * Get jobs for a specific user
   */
  async getUserJobs(userId: string, limit: number = 50, offset: number = 0): Promise<Job[]> {
    return await this.executeWithRetry(async () => {
      const userJobsKey = `user:${userId}:jobs`;
      const jobIds = await this.redis.smembers(userJobsKey);
      
      if (jobIds.length === 0) {
        return [];
      }

      // Get jobs in batches to avoid memory issues
      const jobs: Job[] = [];
      const batchSize = 10;
      
      for (let i = offset; i < Math.min(jobIds.length, offset + limit); i += batchSize) {
        const batch = jobIds.slice(i, i + batchSize);
        const batchJobs = await Promise.all(
          batch.map(jobId => this.getJob(jobId))
        );
        
        jobs.push(...batchJobs.filter(job => job !== null) as Job[]);
      }

      // Sort by start time (newest first)
      return jobs.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    });
  }

  /**
   * Delete a job
   */
  async deleteJob(jobId: string): Promise<boolean> {
    return await this.executeWithRetry(async () => {
      const job = await this.getJob(jobId);
      if (!job) {
        return false;
      }

      const key = this.getJobKey(jobId);
      const deleted = await this.redis.del(key);
      
      // Remove from user's job list
      const userJobsKey = `user:${job.userId}:jobs`;
      await this.redis.srem(userJobsKey, jobId);
      
      // Remove from queue
      await this.redis.zrem('job:queue', jobId);
      
      return deleted > 0;
    });
  }

  /**
   * Get queue information
   */
  async getQueueInfo(): Promise<{ queueLength: number; activeJobs: Job[] }> {
    return await this.executeWithRetry(async () => {
      const queueLength = await this.redis.zcard('job:queue');
      const activeJobIds = await this.redis.zrange('job:queue', 0, -1);
      
      const activeJobs = await Promise.all(
        activeJobIds.map(jobId => this.getJob(jobId))
      );
      
      return {
        queueLength,
        activeJobs: activeJobs.filter(job => job !== null) as Job[]
      };
    });
  }

  /**
   * Clean up expired jobs
   */
  async cleanupExpiredJobs(): Promise<number> {
    return await this.executeWithRetry(async () => {
      const cutoffTime = Date.now() - (this.defaultExpiration * 1000);
      const expiredJobIds = await this.redis.zrangebyscore('job:queue', 0, cutoffTime);
      
      let deletedCount = 0;
      for (const jobId of expiredJobIds) {
        const deleted = await this.deleteJob(jobId);
        if (deleted) {
          deletedCount++;
        }
      }
      
      return deletedCount;
    });
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Check if Redis connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  // Private helper methods

  private getJobKey(jobId: string): string {
    return `${this.keyPrefix}${jobId}`;
  }

  private generateJobId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `job_${timestamp}_${randomPart}`;
  }

  private estimateProcessingTime(requestData: VideoProcessRequestOpus): number {
    // Base processing time estimation based on clip duration
    // This is a rough estimate - actual times may vary significantly
    const baseTimePerSecond = 2; // 2 seconds of processing per second of video
    const overhead = 30; // 30 seconds overhead for setup/cleanup
    
    return Math.max(60, (requestData.clipDuration * baseTimePerSecond) + overhead);
  }

  private isRetryableError(errorType: JobErrorType): boolean {
    return [
      JobErrorType.NETWORK_ERROR,
      JobErrorType.RESOURCE_ERROR,
      JobErrorType.TIMEOUT_ERROR
    ].includes(errorType);
  }

  private async executeWithRetry<T>(action: () => Promise<T>): Promise<T> {
    let retries = 0;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error as Error;
        console.error(`Redis operation failed (attempt ${attempt}/${this.maxRetries}):`, error);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Redis operation failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }
}

// Export a singleton instance for use across the application
let jobRepositoryInstance: JobRepository | null = null;

export function getJobRepository(): JobRepository {
  if (!jobRepositoryInstance) {
    jobRepositoryInstance = new JobRepository();
  }
  return jobRepositoryInstance;
}

// Export for testing purposes
export function createJobRepository(redisUrl?: string): JobRepository {
  return new JobRepository(redisUrl);
}