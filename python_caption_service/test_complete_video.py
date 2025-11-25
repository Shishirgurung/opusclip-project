#!/usr/bin/env python3
"""
Test script for complete video processing with layout and captions.
This generates the final video with both video processing and captions.
"""

import os
import sys
import argparse
from opus_processor import OpusProcessor

def test_complete_video(input_video, layout_mode, template_name, output_video=None):
    """Test complete video processing with layout and captions."""
    
    if not os.path.exists(input_video):
        print(f"Error: Input video not found: {input_video}")
        return False
    
    if not output_video:
        video_name = os.path.splitext(os.path.basename(input_video))[0]
        output_video = f"{video_name}_{layout_mode}_{template_name}_complete.mp4"
    
    print(f"Processing complete video: {input_video}")
    print(f"Layout mode: {layout_mode}")
    print(f"Template: {template_name}")
    print(f"Output: {output_video}")
    
    try:
        processor = OpusProcessor()
        
        # Step 1: Process video with layout
        layout_video = f"temp_{layout_mode}_layout.mp4"
        print(f"\n🎬 Step 1: Processing video layout...")
        processor.process_video_for_vertical(input_video, layout_video, layout_mode=layout_mode)
        print(f"✅ Layout video created: {layout_video}")
        
        # Step 2: Generate captions
        print(f"\n📝 Step 2: Generating captions...")
        segments = processor.transcribe_audio(input_video)
        caption_file = processor.generate_karaoke_captions(segments, template_name, layout_mode=layout_mode)
        print(f"✅ Captions generated: {caption_file}")
        
        # Step 3: Combine video and captions
        print(f"\n🎯 Step 3: Combining video and captions...")
        processor.combine_video_with_captions(layout_video, caption_file, output_video)
        print(f"✅ Complete video created: {output_video}")
        
        # Cleanup temp files
        if os.path.exists(layout_video):
            os.remove(layout_video)
            
        print(f"\n🎉 SUCCESS! Complete video with {layout_mode} layout and {template_name} captions saved: {output_video}")
        print(f"📱 Video format: 1080x1920 (vertical)")
        print(f"🎬 Layout: {layout_mode.title()} mode")
        print(f"📝 Captions: {template_name} template")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during complete video processing: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Test complete video processing with layout and captions')
    parser.add_argument('input_video', help='Input video file')
    parser.add_argument('--layout', choices=['fit', 'fill', 'square'], default='fit', 
                       help='Layout mode (default: fit)')
    parser.add_argument('--template', default='BeastMode',
                       help='Caption template (default: BeastMode)')
    parser.add_argument('--output', help='Output video file (optional)')
    
    args = parser.parse_args()
    
    success = test_complete_video(args.input_video, args.layout, args.template, args.output)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
