#!/usr/bin/env python3

import requests
import time

# Test job submission
url = "http://localhost:5000/process_video"
data = {
    "youtube_url": "https://youtu.be/ZzI9JE0i6Lc?si=HlRIsl33oQPHpaCU",
    "opus_template": "SwipeUp",
    "clip_duration": 60,
    "layout": "fit"
}

print("Submitting job...")
response = requests.post(url, json=data)
print(f"Response: {response.status_code}")
print(f"Job ID: {response.json()}")

if response.status_code == 200:
    job_id = response.json()["job_id"]
    print(f"Job submitted successfully: {job_id}")
    
    # Check job status
    status_url = f"http://localhost:5000/job_status/{job_id}"
    
    while True:
        status_response = requests.get(status_url)
        status_data = status_response.json()
        
        print(f"Status: {status_data['status']} - {status_data.get('progress', 0)}%")
        if 'message' in status_data:
            print(f"Message: {status_data['message']}")
            
        if status_data['status'] in ['completed', 'failed']:
            break
            
        time.sleep(5)
        
    print("Final status:", status_data)
