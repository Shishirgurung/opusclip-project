#!/usr/bin/env python3
"""
Direct processing test script to bypass RQ Windows fork issues.
This script runs the processing function directly without using RQ workers.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from processing import run_opus_transcription

def test_direct_processing():
    """Test the processing pipeline directly without RQ"""
    
    # Test parameters
    youtube_url = "https://youtu.be/ZzI9JE0i6Lc?si=HlRIsl33oQPHpaCU"
    
    layout_mode = "fit"  # Options: "fit", "square", "fill", "auto"
    template_name = "Karaoke"  # Template to use
    
    opus_template = {
        "name": template_name,
        "displayName": template_name, 
        "description": "",
        "category": "General",
        "wordsPerLine": 3,
        "positions": ["bottom_center"],
        "animationStyle": "bounce",
        "syncMode": "word",
        "fontFamily": "Arial",
        "fontSize": 48,
        "fontColor": "#FFFFFF",
        "shadowColor": "#000000",
        "shadowX": 2,
        "shadowY": 2,
        "shadowBlur": 3,
        "position": "bottom",
        "keywordHighlight": {
            "primaryColor": "#04f827FF",
            "secondaryColor": "#FFFDO3FF",
            "enabled": True
        }
    }
    
    clip_duration = 30
    exports_dir = r"C:\dev\opusclip-project\python_caption_service\exports"
    layout_mode = "fit"
    
    print("🚀 Testing direct processing with:")
    print(f"   Layout: {layout_mode}")
    print(f"   Template: {opus_template['name']}")
    print(f"   Duration: {clip_duration}s")
    print()
    
    try:
        # Run processing directly
        result = run_opus_transcription(
            youtube_url=youtube_url,
            opus_template=opus_template,
            clip_duration=clip_duration,
            exports_dir=exports_dir,
            original_filename=None,
            layout_mode=layout_mode
        )
        
        print("✅ Processing completed successfully!")
        print(f"Result: {result}")
        
    except Exception as e:
        print(f"❌ Processing failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_direct_processing()
