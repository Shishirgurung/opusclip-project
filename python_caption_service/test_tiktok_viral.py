#!/usr/bin/env python3
"""
Test TikTokViral captions with square layout using existing video
"""

import os
from opus_processor import OpusProcessor

def test_tiktok_viral_captions():
    """Test TikTokViral captions with existing video file"""
    
    # Check for existing video files
    video_files = [
        "final_caption_test.mp4",
        "test_caption_output.mp4", 
        "test_square_captions_fixed.mp4"
    ]
    
    input_video = None
    for video_file in video_files:
        if os.path.exists(video_file):
            input_video = video_file
            break
    
    if not input_video:
        print("❌ No existing video files found for testing")
        return False
    
    print(f"🧪 Testing TikTokViral captions with existing video: {input_video}")
    
    # Create test segments with fun content for TikTok style
    test_segments = [
        {"start": 0.0, "end": 0.6, "text": "WAIT"},
        {"start": 0.6, "end": 1.2, "text": "WHAT"},
        {"start": 1.2, "end": 1.8, "text": "JUST"},
        {"start": 1.8, "end": 2.4, "text": "HAPPENED"},
        {"start": 2.4, "end": 3.0, "text": "THIS"},
        {"start": 3.0, "end": 3.6, "text": "IS"},
        {"start": 3.6, "end": 4.2, "text": "INSANE"},
        {"start": 4.2, "end": 4.8, "text": "TIKTOK"},
        {"start": 4.8, "end": 5.4, "text": "VIRAL"},
        {"start": 5.4, "end": 6.0, "text": "CONTENT"}
    ]
    
    print(f"   📋 Created {len(test_segments)} TikTok-style segments")
    
    # Initialize OpusProcessor
    processor = OpusProcessor()
    
    try:
        # Generate TikTokViral captions
        print("   📝 Generating TikTokViral captions...")
        ass_content = processor.generate_karaoke_captions(
            segments=test_segments,
            template_name="TikTokViral",
            audio_path=None,
            layout_mode="square"  # Square layout for TikTok style
        )
        
        print(f"   ✅ ASS content generated: {len(ass_content)} characters")
        
        # Count dialogue events
        dialogue_count = ass_content.count('Dialogue:')
        print(f"   📋 Dialogue events: {dialogue_count}")
        
        if dialogue_count == 0:
            print("   ❌ No dialogue events found!")
            return False
        
        # Save ASS file
        ass_file = "test_tiktok_viral_captions.ass"
        with open(ass_file, 'w', encoding='utf-8') as f:
            f.write(ass_content)
        print(f"   📁 ASS file saved: {ass_file}")
        
        # Test FFmpeg caption burning
        output_video = "test_tiktok_viral_output.mp4"
        
        import subprocess
        import tempfile
        import shutil
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Copy ASS file to temp directory with simple name
            simple_ass_path = os.path.join(temp_dir, "captions.ass")
            shutil.copy2(ass_file, simple_ass_path)
            
            # Change to temp directory for FFmpeg
            original_cwd = os.getcwd()
            os.chdir(temp_dir)
            
            try:
                # FFmpeg command to burn captions
                ffmpeg_cmd = [
                    'ffmpeg', '-y',
                    '-i', os.path.abspath(os.path.join(original_cwd, input_video)),
                    '-vf', 'ass=captions.ass',
                    '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
                    '-c:a', 'copy',
                    '-t', '10',  # Only process first 10 seconds
                    os.path.abspath(os.path.join(original_cwd, output_video))
                ]
                
                print(f"   🔥 Burning TikTokViral captions with FFmpeg...")
                result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
                
                # Restore directory
                os.chdir(original_cwd)
                
                if result.returncode == 0:
                    print(f"   ✅ TikTokViral captions burned successfully!")
                    print(f"   📁 Output video: {output_video}")
                    print(f"   🎬 Play the video to see bouncy neon TikTok-style animations")
                    print(f"   🌈 Features: Neon colors, bouncy effects, viral energy!")
                    return True
                else:
                    print(f"   ❌ FFmpeg failed: {result.stderr}")
                    return False
                    
            except Exception as e:
                os.chdir(original_cwd)
                print(f"   ❌ Error during caption burning: {e}")
                return False
        
    except Exception as e:
        print(f"   ❌ Error generating TikTokViral captions: {e}")
        return False

if __name__ == "__main__":
    success = test_tiktok_viral_captions()
    print(f"\n{'✅ SUCCESS' if success else '❌ FAILED'}: TikTokViral caption test")
