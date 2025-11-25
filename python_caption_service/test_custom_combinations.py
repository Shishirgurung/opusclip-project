#!/usr/bin/env python3

import os
import sys
import tempfile
import subprocess
from processing import run_opus_transcription

def test_custom_combinations():
    """Test specific template-layout combinations as requested"""
    
    # Custom combinations as requested
    combinations = [
        {"layout": "fit", "template": "Karaoke", "description": "Fit layout with Karaoke captions"},
        {"layout": "fill", "template": "BeastMode", "description": "Fill layout with BeastMode captions"},
        {"layout": "square", "template": "Glitch", "description": "Square layout with Glitch captions"},
        {"layout": "auto", "template": "SwipeUp", "description": "Auto layout with SwipeUp captions"}
    ]
    
    youtube_url = "https://www.youtube.com/watch?v=ZzI9JE0i6Lc"
    exports_dir = "exports"
    clip_duration = 30  # Short clips for quick testing
    
    print("🎬 Testing custom template-layout combinations...")
    print(f"📺 Video: {youtube_url}")
    print(f"⏱️  Duration: {clip_duration}s")
    print()
    
    for i, combo in enumerate(combinations, 1):
        layout = combo["layout"]
        template = combo["template"]
        description = combo["description"]
        
        print(f"🚀 Test {i}/4: {description}")
        print(f"   Layout: {layout} | Template: {template}")
        
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
                print(f"   📁 Saved as: exports/{output_file}")
            else:
                print(f"❌ Failed: No output generated")
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
        
        print("-" * 60)
    
    print("\n🎉 Custom combination testing completed!")
    print("\n📋 Generated videos:")
    print("   1. Fit + Karaoke → Blurred background with karaoke-style captions")
    print("   2. Fill + BeastMode → Full-screen video with BeastMode captions") 
    print("   3. Square + Glitch → Square video with glitch-effect captions")
    print("   4. Auto + SwipeUp → AI-cropped video with SwipeUp captions")
    print("\nCheck the exports/ directory for all generated videos!")

if __name__ == "__main__":
    test_custom_combinations()
