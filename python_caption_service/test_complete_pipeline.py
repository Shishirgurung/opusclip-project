#!/usr/bin/env python3

import requests
import time
import json
import uuid

def test_complete_pipeline():
    """Test the complete pipeline with proper layout and captions"""
    
    # Submit a new job with specific parameters
    url = "http://localhost:5000/api/transcribe_opus"
    
    # Generate a unique job ID
    job_id = f"job_{int(time.time() * 1000)}_{str(uuid.uuid4())[:8]}"
    
    # Use form data format as expected by the Flask endpoint
    data = {
        "job_id": job_id,
        "youtube_url": "https://youtu.be/ZzI9JE0i6Lc?si=HlRIsl33oQPHpaCU",
        "opus_template": '{"name":"SwipeUp","displayName":"SwipeUp","description":"","category":"General","wordsPerLine":3,"positions":["bottom_center"],"animationStyle":"bounce","syncMode":"word","fontFamily":"Arial","fontSize":48,"fontColor":"#FFFFFF","shadowColor":"#000000","shadowX":2,"shadowY":2,"shadowBlur":3,"position":"bottom","keywordHighlight":{"primaryColor":"#04f827FF","secondaryColor":"#FFFDO3FF","enabled":true}}',
        "clip_duration": "30",  # Shorter for testing
        'layout': 'fit'    # Test square layout specifically
    }

    print("🚀 Testing complete pipeline with:")
    print(f"   Layout: {data['layout']}")
    print(f"   Template: {data['opus_template']}")
    print(f"   Duration: {data['clip_duration']}s")
    print()

    response = requests.post(url, data=data)
    
    if response.status_code == 200:
        job_data = response.json()
        job_id = job_data["job_id"]
        print(f"✅ Job submitted: {job_id}")
        
        # Monitor job progress
        status_url = f"http://localhost:5000/api/jobs/{job_id}"
        
        while True:
            try:
                status_response = requests.get(status_url)
                status_data = status_response.json()
                
                # The API returns data under 'job' key
                job_data = status_data.get('job', {})
                progress = job_data.get('progress', 0)
                status = job_data.get('status', 'unknown')
                message = job_data.get('message', '')
                
                print(f"📊 {status}: {progress}% - {message}")
                
                if status == 'completed':
                    print("\n🎉 Job completed successfully!")
                    if 'result' in status_data:
                        result = status_data['result']
                        if 'clips' in result and result['clips']:
                            video_path = result['clips'][0]['file_path']
                            print(f"📹 Video output: {video_path}")
                            
                            # Check if file exists
                            import os
                            if os.path.exists(video_path):
                                file_size = os.path.getsize(video_path) / (1024*1024)  # MB
                                print(f"📁 File size: {file_size:.1f} MB")
                            else:
                                print("❌ Output file not found!")
                    break
                    
                elif status == 'failed':
                    print(f"\n❌ Job failed: {message}")
                    if 'error' in status_data:
                        print(f"Error details: {status_data['error']}")
                    break
                    
                time.sleep(3)
                
            except Exception as e:
                print(f"Error checking status: {e}")
                time.sleep(5)
    else:
        print(f"❌ Failed to submit job: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_complete_pipeline()
