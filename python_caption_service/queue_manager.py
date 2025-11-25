# python_caption_service/queue_manager.py
import os
import sys
from redis import Redis
from rq import Queue
from rq.job import Job

# Establish a connection to Redis
# It reads the REDIS_URL from the environment variables set in docker-compose.yml
redis_conn = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

# Create a job queue
# The 'default' queue is where the worker will listen for jobs.
q = Queue(connection=redis_conn)

def enqueue_processing_job(func, *args, **kwargs):
    """
    
    Adds a job to the Redis queue.
    Args:
        func: The function to execute as a background job (e.g., run_opus_transcription).
        *args: Positional arguments for the function.
        **kwargs: Keyword arguments for the function.

    Returns:
        The RQ Job object.
    """
    # Pop 'job_id' from kwargs if it exists, to be passed to enqueue explicitly.
    # This prevents it from being passed in kwargs and as a named argument.
    job_id = kwargs.pop('job_id', None)

    # The job_timeout feature in RQ uses signals (SIGALRM) which are not
    # available on Windows. We conditionally disable it for Windows compatibility.
    job_timeout = '2h' if sys.platform != "win32" else None
        # The function expects positional arguments, so we must pass them explicitly
    # from the kwargs dictionary in the correct order.
    job = q.enqueue(
        func,
        args=[
            kwargs.get('youtube_url'),
            kwargs.get('opus_template'),
            kwargs.get('clip_duration'),
            kwargs.get('exports_dir'),
            kwargs.get('original_filename'),
            kwargs.get('layout', 'fit')
        ],
        job_id=job_id,
        job_timeout=job_timeout
    )
    return job

def get_job_status(job_id):
    """
    Fetches a job's status and result from Redis.

    Args:
        job_id: The ID of the job to fetch.

    Returns:
        A dictionary with the job's status, progress, and result/error.
    """
    try:
        job = Job.fetch(job_id, connection=redis_conn)
    except Exception:
        return {"status": "not_found"}

    status = job.get_status()
    progress_data = job.meta.get('progress', {})

    if status == 'finished':
        return {
            "id": job.id,
            "status": "COMPLETED",
            "progress": 100,
            "stage": "Complete",
            "message": "Processing complete.",
            "result": job.result,
        }
    elif status == 'failed':
        return {
            "id": job.id,
            "status": "FAILED",
            "progress": progress_data.get('percentage', 0),
            "stage": progress_data.get('stage', 'Failed'),
            "message": str(job.exc_info),
            "error": {
                "message": str(job.exc_info),
                "traceback": job.exc_info,
            }
        }
    else: # queued, started, deferred
        return {
            "id": job.id,
            "status": "PROCESSING", # Simplified status for the frontend
            "progress": progress_data.get('percentage', 0),
            "stage": progress_data.get('stage', 'Queued'),
            "message": progress_data.get('message', 'Job is waiting to be processed.'),
        }
