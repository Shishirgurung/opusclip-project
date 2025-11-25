#!/usr/bin/env python3

import redis
from rq import Worker

def clear_worker_registry():
    """Clear the worker registry to remove stale worker entries"""
    
    # Connect to Redis
    conn = redis.Redis(host='localhost', port=6379, db=0)
    
    # Get all workers
    workers = Worker.all(connection=conn)
    
    print(f"Found {len(workers)} workers in registry:")
    for worker in workers:
        print(f"  - {worker.name} (PID: {worker.pid}, State: {worker.state})")
        
        # Remove dead/stale workers
        try:
            if worker.state in ['dead', 'idle']:
                print(f"    Removing stale worker: {worker.name}")
                worker.cleanup()
        except Exception as e:
            print(f"    Force removing worker: {worker.name}")
            worker.cleanup()
    
    # Force clear the registry
    conn.delete('rq:workers')
    print("Worker registry cleared!")

if __name__ == "__main__":
    clear_worker_registry()
