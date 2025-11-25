"""
Test Viral Clips Integration with Video Processing
Tests hook detection + fit layout + SwipeUp captions
"""

import json
import os
from hook_detector import HookDetector, parse_whisper_segments
from clip_processor import ClipProcessor


def test_viral_clips_with_fit_swipeup():
    """Test viral clip detection with fit layout and SwipeUp captions"""
    print("🎬 Testing Viral Clips Integration")
    print("   Layout: fit (blurred background)")
    print("   Template: SwipeUp (clean animations)")
    print("=" * 60)
    
    # Initialize clip processor
    processor = ClipProcessor(target_clip_length=60)
    
    # Test with realistic YouTube-style content
    test_video_url = "https://www.youtube.com/watch?v=ZzI9JE0i6Lc"
    
    print(f"🎯 Processing: {test_video_url}")
    print(f"   Target: 5 viral clips")
    print(f"   Min score: 4.0 (high-quality only)")
    
    try:
        # Find viral clips
        viral_clips = processor.process_video_for_clips(
            video_url=test_video_url,
            layout_mode="fit",      # Blurred background with centered video
            template="SwipeUp",     # Clean swipe-up caption animations
            max_clips=5,
            min_score=4.0          # Only high-scoring viral moments
        )
        
        print(f"\n📊 Viral Clips Found: {len(viral_clips)}")
        
        if not viral_clips:
            print("❌ No viral clips found above threshold")
            return []
        
        # Display results
        for i, clip in enumerate(viral_clips):
            print(f"\n🏆 Viral Clip #{i+1}")
            print(f"   Score: {clip['score']:.2f}")
            print(f"   Time: {clip['start_time']} - {clip['end_time']} ({clip['duration']:.1f}s)")
            print(f"   Layout: {clip['layout_mode']} (blurred background)")
            print(f"   Template: {clip['template']} (swipe-up animations)")
            print(f"   Hooks: {len(clip['analysis']['hook_keywords'])} viral keywords")
            print(f"   Question: {'Yes' if clip['analysis']['has_question'] else 'No'}")
            print(f"   Emotion: {clip['analysis']['emotion_score']:.2f}")
            print(f"   Text: {clip['transcript'][:80]}...")
        
        # Export for video generation
        export_path = "exports/viral_clips_fit_swipeup.json"
        processor.export_clips_json(viral_clips, export_path)
        
        print(f"\n💾 Exported clips metadata: {export_path}")
        print(f"   Ready for video generation with fit layout + SwipeUp captions")
        
        return viral_clips
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return []


def simulate_video_generation(clips):
    """Simulate the video generation process for viral clips"""
    print(f"\n🎬 Simulating Video Generation for {len(clips)} Clips")
    print("=" * 60)
    
    generated_videos = []
    
    for i, clip in enumerate(clips):
        print(f"\n📹 Generating Clip #{i+1}")
        print(f"   Score: {clip['score']:.2f}")
        print(f"   Duration: {clip['duration']:.1f}s")
        
        # Simulate video processing steps
        steps = [
            "🎥 Extracting video segment",
            "🖼️  Applying fit layout (blurred background)", 
            "📝 Generating SwipeUp captions",
            "🔥 Burning captions into video",
            "💾 Exporting final clip"
        ]
        
        for step in steps:
            print(f"   {step}")
        
        # Simulate output filename
        safe_score = str(clip['score']).replace('.', '_')
        filename = f"viral_clip_{i+1}_score_{safe_score}_fit_swipeup.mp4"
        output_path = f"exports/clips/{filename}"
        
        generated_videos.append({
            "clip_id": i+1,
            "score": clip['score'],
            "filename": filename,
            "output_path": output_path,
            "layout": "fit",
            "template": "SwipeUp",
            "duration": clip['duration'],
            "start_time": clip['start_time'],
            "end_time": clip['end_time']
        })
        
        print(f"   ✅ Generated: {filename}")
    
    return generated_videos


def create_viral_clips_summary(clips, generated_videos):
    """Create a summary of the viral clips generation"""
    print(f"\n📋 Viral Clips Generation Summary")
    print("=" * 60)
    
    print(f"🎯 Input Analysis:")
    print(f"   Video processed for viral moments")
    print(f"   Hook detection algorithm applied")
    print(f"   Sentiment analysis included")
    
    print(f"\n📊 Results:")
    print(f"   Clips found: {len(clips)}")
    print(f"   Average score: {sum(c['score'] for c in clips) / len(clips):.2f}")
    print(f"   Score range: {min(c['score'] for c in clips):.1f} - {max(c['score'] for c in clips):.1f}")
    print(f"   Total duration: {sum(c['duration'] for c in clips):.1f}s")
    
    print(f"\n🎬 Video Generation:")
    print(f"   Layout: fit (blurred background, centered video)")
    print(f"   Captions: SwipeUp (clean swipe-up animations)")
    print(f"   Format: 1080x1920 (vertical)")
    print(f"   Quality: High (libx264, CRF 23)")
    
    print(f"\n📁 Output Files:")
    for video in generated_videos:
        print(f"   {video['filename']} (Score: {video['score']:.1f})")
    
    # Create summary JSON
    summary = {
        "generation_summary": {
            "total_clips": len(clips),
            "average_score": sum(c['score'] for c in clips) / len(clips),
            "layout_mode": "fit",
            "caption_template": "SwipeUp",
            "clips": clips,
            "generated_videos": generated_videos
        }
    }
    
    summary_path = "exports/viral_clips_generation_summary.json"
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Summary exported: {summary_path}")
    
    return summary


def main():
    """Main test function"""
    print("🚀 Starting Viral Clips Integration Test")
    print("   Testing: Hook Detection + Fit Layout + SwipeUp Captions")
    print("=" * 70)
    
    # Step 1: Find viral clips
    viral_clips = test_viral_clips_with_fit_swipeup()
    
    if not viral_clips:
        print("\n❌ No viral clips found. Exiting test.")
        return
    
    # Step 2: Simulate video generation
    generated_videos = simulate_video_generation(viral_clips)
    
    # Step 3: Create summary
    summary = create_viral_clips_summary(viral_clips, generated_videos)
    
    print(f"\n" + "=" * 70)
    print("✅ Viral Clips Integration Test Complete!")
    print(f"   Found: {len(viral_clips)} viral clips")
    print(f"   Layout: fit (blurred background)")
    print(f"   Template: SwipeUp (clean animations)")
    print(f"   Ready for: Real video generation")
    
    print(f"\n🎯 Next Steps:")
    print(f"   1. Integrate with existing video processing pipeline")
    print(f"   2. Generate actual video files with FFmpeg")
    print(f"   3. Test with real YouTube videos")
    print(f"   4. Deploy to production!")


if __name__ == "__main__":
    # Ensure exports directory exists
    os.makedirs("exports/clips", exist_ok=True)
    
    # Run the test
    main()
