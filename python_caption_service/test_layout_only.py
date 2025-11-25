#!/usr/bin/env python3

import os
import sys
import tempfile
import subprocess
from processing import process_video_for_layout, download_youtube_video

def test_layout_processing():
    """Test just the layout processing step in isolation"""
    
    print("🔧 Testing layout processing in isolation...")
    
    # Use the same YouTube URL
    youtube_url = "https://www.youtube.com/watch?v=ZzI9JE0i6Lc"
    
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"📁 Working in: {temp_dir}")
        
        # Download original video
        print("⬇️ Downloading original video...")
        original_file_path, original_filename = download_youtube_video(youtube_url, temp_dir)
        print(f"✅ Downloaded: {original_file_path}")
        
        # Test layout processing
        print("🎨 Testing 'fit' layout processing...")
        layout_output_path = os.path.join(temp_dir, "layout_test_fit.mp4")
        
        try:
            result_path = process_video_for_layout(
                original_file_path, 
                layout_output_path, 
                "fit", 
                target_width=1080, 
                target_height=1920
            )
            print(f"✅ Layout processing completed: {result_path}")
            
            # Check if file exists and has content
            if os.path.exists(result_path):
                file_size = os.path.getsize(result_path)
                print(f"📊 Output file size: {file_size:,} bytes")
                
                # Copy to exports for inspection
                exports_dir = "exports"
                os.makedirs(exports_dir, exist_ok=True)
                test_output = os.path.join(exports_dir, "layout_test_fit_output.mp4")
                
                import shutil
                shutil.copy2(result_path, test_output)
                print(f"📋 Copied to: {test_output}")
                
                # Get video info
                probe_cmd = [
                    'ffprobe', '-v', 'quiet', '-print_format', 'json', 
                    '-show_streams', result_path
                ]
                probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
                if probe_result.returncode == 0:
                    import json
                    info = json.loads(probe_result.stdout)
                    for stream in info.get('streams', []):
                        if stream.get('codec_type') == 'video':
                            print(f"📺 Video dimensions: {stream.get('width')}x{stream.get('height')}")
                            print(f"🎬 Codec: {stream.get('codec_name')}")
                            break
                
            else:
                print("❌ Output file does not exist!")
                
        except Exception as e:
            print(f"❌ Layout processing failed: {e}")
            return False
    
    return True

if __name__ == "__main__":
    success = test_layout_processing()
    if success:
        print("\n🎉 Layout test completed! Check exports/layout_test_fit_output.mp4")
    else:
        print("\n💥 Layout test failed!")
