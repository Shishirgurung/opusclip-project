import redis
import sys

# Manually specify the worker name to clean up
WORKER_NAME = 'opus-caption-worker'

def force_clean_worker_registration():
    """
    Connects to Redis and directly deletes the hash key associated with
    the worker's registration, bypassing higher-level RQ checks.
    """
    try:
        # Use the default Redis connection
        r = redis.from_url('redis://localhost:6379')
        r.ping() # Check connection
        print("Successfully connected to Redis.")
    except redis.exceptions.ConnectionError as e:
        print(f"Error connecting to Redis: {e}", file=sys.stderr)
        sys.exit(1)

    # The key for a worker registration in RQ is a hash with this format:
    worker_key = f'rq:worker:{WORKER_NAME}'

    print(f"Attempting to directly delete Redis key: '{worker_key}'")

    # The `delete` command returns the number of keys that were removed.
    keys_deleted = r.delete(worker_key)

    if keys_deleted > 0:
        print(f"Success: Found and deleted the registration key for worker '{WORKER_NAME}'.")
    else:
        print(f"No registration key found for worker '{WORKER_NAME}'. The worker was likely not registered or already cleaned up.")

    print("Cleanup script finished.")

if __name__ == '__main__':
    force_clean_worker_registration()
