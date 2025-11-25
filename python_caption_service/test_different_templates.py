#!/usr/bin/env python3

import os
import sys
import tempfile
import subprocess
from processing import run_opus_transcription

def test_templates_and_layouts():
    """Test different caption templates and layout modes"""
    
    # Available templates and layouts to test
    templates = ["SwipeUp", "Bounce", "Fade", "Slide"]  # Add more as needed
    layouts = ["fit", "square", "fill"]
    
    youtube_url = "https://www.youtube.com/watch?v=ZzI9JE0i6Lc"
    exports_dir = "exports"
    clip_duration = 30  # Short clips for quick testing
    
    print("🎬 Testing different caption templates and layouts...")
    print(f"📺 Video: {youtube_url}")
    print(f"⏱️  Duration: {clip_duration}s")
    print()
    
    for template in templates:
        for layout in layouts:
            print(f"🚀 Testing: {template} template with {layout} layout")
            
            try:
                result = run_opus_transcription(
                    youtube_url=youtube_url,
                    opus_template=template,
                    clip_duration=clip_duration,
                    exports_dir=exports_dir,
                    layout_mode=layout
                )
                
                if result and len(result) > 0:
                    output_file = result[0].get('previewUrl', '').replace('/exports/', '')
                    print(f"✅ Success: {output_file}")
                else:
                    print(f"❌ Failed: No output generated")
                    
            except Exception as e:
                print(f"❌ Error: {str(e)}")
            
            print("-" * 50)
    
    print("\n🎉 Template testing completed!")
    print("Check the exports/ directory for all generated videos")

if __name__ == "__main__":
    test_templates_and_layouts()
