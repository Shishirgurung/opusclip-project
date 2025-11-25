#!/usr/bin/env python3

import redis

def force_clear_redis():
    """Force clear all Redis worker-related keys"""
    
    # Connect to Redis
    conn = redis.Redis(host='localhost', port=6379, db=0)
    
    # Clear all worker-related keys
    worker_keys = [
        'rq:workers',
        'rq:worker:opus-caption-worker',
        'rq:worker:opus-caption-worker:birth',
        'rq:worker:opus-caption-worker:death',
        'rq:heartbeat:opus-caption-worker'
    ]
    
    for key in worker_keys:
        if conn.exists(key):
            conn.delete(key)
            print(f"Deleted key: {key}")
    
    # Clear any keys matching worker patterns
    pattern_keys = conn.keys('rq:worker:*')
    for key in pattern_keys:
        conn.delete(key)
        print(f"Deleted pattern key: {key.decode()}")
    
    print("Redis worker registry force cleared!")

if __name__ == "__main__":
    force_clear_redis()
