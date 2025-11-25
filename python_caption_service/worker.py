import os
from redis import Redis
from rq import Worker, Queue, SimpleWorker
import logging
import sys
import time

# Set up basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Preload the Whisper model and other dependencies by importing the processing
# module. This ensures the model is loaded into memory once when the worker
# starts, rather than on the first job, which improves performance.
logger.info("Pre-loading dependencies from 'processing' module...")
import processing
logger.info("'processing' module loaded successfully.")

# This worker will listen on the 'default' queue, which is where
# the app.py sends the jobs.
listen = ['default']

# Get the Redis connection URL from the environment variable,
# or default to a local Redis instance for development.
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
conn = Redis.from_url(redis_url)

if __name__ == '__main__':
    print("Starting RQ worker...")
    
    # Create queue and worker - use SimpleWorker on Windows
    queue = Queue('default', connection=conn, job_timeout=600)  # Set timeout on queue
    if sys.platform == "win32":
        worker = SimpleWorker(['default'], connection=conn, name='opus-caption-worker')
    else:
        worker = Worker(['default'], connection=conn, name='opus-caption-worker')
    
    # Check for existing jobs and process them
    print(f"Checking queue... Found {len(queue)} jobs")
    
    try:
        worker.work()
    except KeyboardInterrupt:
        print("\nRQ worker shutting down.")
    print("RQ worker has stopped.")