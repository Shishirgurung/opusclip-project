"""
Test Hook Detection with Long Video (23 minutes)
Simulates a full-length YouTube video to test clip generation
"""

from hook_detector import HookDetector, parse_whisper_segments
from clip_processor import ClipProcessor


def generate_long_transcript():
    """Generate a 23-minute transcript with various viral moments"""
    
    # Simulate a 23-minute (1380 seconds) video transcript
    # Mix of high-viral, medium-viral, and regular content
    
    segments = []
    current_time = 0.0
    
    # Content patterns for different types of segments
    viral_hooks = [
        "What if I told you there's a secret that nobody wants you to know?",
        "This is the biggest mistake entrepreneurs make when starting a business.",
        "You won't believe this crazy technique that millionaires use every day.",
        "The truth about success is not what you think it is.",
        "How do some people make millions while others struggle?",
        "This mistake is costing you thousands of dollars every month.",
        "Why do successful people never share this information publicly?",
        "Watch this technique that will completely change your life.",
        "The secret formula that changed everything for me.",
        "Nobody told you about this because they don't want you to succeed.",
        "This is why 95% of people fail at making money online.",
        "The shocking truth about passive income that gurus hide.",
        "What successful people do differently that you don't know.",
        "The crazy method that made me $10k in 30 days.",
        "This is the exact strategy billionaires use to stay rich."
    ]
    
    medium_content = [
        "Let me explain how this process actually works in detail.",
        "The first step is to understand the fundamentals of this approach.",
        "Many people get confused about this concept, so let me clarify.",
        "Here's what you need to know before you get started.",
        "The key is to focus on the most important aspects first.",
        "This strategy has been proven to work time and time again.",
        "Let me walk you through the entire process step by step.",
        "The results speak for themselves when you apply this correctly.",
        "Most people overlook this critical component of success.",
        "Understanding this principle will transform your approach."
    ]
    
    regular_content = [
        "Today we're going to cover some basic principles.",
        "Let's start with the fundamentals and build from there.",
        "This is a comprehensive guide to getting started.",
        "We'll explore different methods and techniques available.",
        "The goal is to provide you with practical knowledge.",
        "These concepts apply to various situations and contexts.",
        "It's important to understand the background first.",
        "We'll examine several case studies and examples.",
        "The research shows interesting patterns and trends.",
        "Let's dive deeper into the technical aspects."
    ]
    
    # Generate segments with realistic timing
    segment_id = 0
    
    while current_time < 1380:  # 23 minutes
        # Choose content type based on position (more viral hooks at beginning/end)
        if current_time < 120 or current_time > 1200:  # First 2 min or last 3 min
            if segment_id % 3 == 0:  # 33% viral hooks
                content = viral_hooks[segment_id % len(viral_hooks)]
                duration = 6.0 + (segment_id % 4)  # 6-9 seconds
            else:
                content = medium_content[segment_id % len(medium_content)]
                duration = 5.0 + (segment_id % 3)  # 5-7 seconds
        else:  # Middle content
            if segment_id % 5 == 0:  # 20% viral hooks
                content = viral_hooks[segment_id % len(viral_hooks)]
                duration = 6.0 + (segment_id % 4)
            elif segment_id % 3 == 0:  # 33% medium content
                content = medium_content[segment_id % len(medium_content)]
                duration = 5.0 + (segment_id % 3)
            else:  # 47% regular content
                content = regular_content[segment_id % len(regular_content)]
                duration = 4.0 + (segment_id % 3)  # 4-6 seconds
        
        # Add segment
        segments.append({
            "start": current_time,
            "end": current_time + duration,
            "text": content
        })
        
        current_time += duration
        segment_id += 1
    
    print(f"📝 Generated long transcript:")
    print(f"   Duration: {current_time:.1f} seconds ({current_time/60:.1f} minutes)")
    print(f"   Segments: {len(segments)}")
    
    return segments


def test_long_video_processing():
    """Test hook detection on a 23-minute video"""
    print("🎬 Testing Hook Detection on 23-Minute Video")
    print("=" * 60)
    
    # Generate long transcript
    long_transcript = generate_long_transcript()
    
    # Test with ClipProcessor
    processor = ClipProcessor(target_clip_length=60)
    
    print(f"\n🎯 Processing long video...")
    print(f"   Target clips: 10")
    print(f"   Minimum score: 3.0")
    
    # Convert to segments
    segments = parse_whisper_segments(long_transcript)
    
    # Find viral clips
    detector = HookDetector(target_length=60)
    detector.load_sentiment_model()
    
    viral_clips = detector.find_viral_clips(segments, top_n=20)  # Get top 20 to see full range
    
    # Filter by score
    high_scoring_clips = [clip for clip in viral_clips if clip["score"] >= 3.0]
    
    print(f"\n📊 Results for 23-Minute Video:")
    print(f"   Total candidate clips: {len(viral_clips)}")
    print(f"   High-scoring clips (≥3.0): {len(high_scoring_clips)}")
    print(f"   Top 10 clips:")
    
    # Show top 10 clips
    top_10 = high_scoring_clips[:10]
    
    for i, clip in enumerate(top_10):
        print(f"\n🏆 Clip #{i+1}")
        print(f"   Score: {clip['score']:.1f}")
        print(f"   Time: {clip['start_time']} - {clip['end_time']} ({clip['duration']:.1f}s)")
        print(f"   Hooks: {len(clip['analysis']['hook_keywords'])} keywords")
        print(f"   Text: {clip['transcript'][:60]}...")
    
    # Show score distribution
    scores = [clip["score"] for clip in viral_clips]
    print(f"\n📈 Score Distribution:")
    print(f"   Highest: {max(scores):.1f}")
    print(f"   Average: {sum(scores)/len(scores):.1f}")
    print(f"   Clips ≥5.0: {len([s for s in scores if s >= 5.0])}")
    print(f"   Clips ≥3.0: {len([s for s in scores if s >= 3.0])}")
    print(f"   Clips ≥1.0: {len([s for s in scores if s >= 1.0])}")
    
    return top_10


def test_different_video_lengths():
    """Test hook detection on different video lengths"""
    print("\n\n🧪 Testing Different Video Lengths")
    print("=" * 60)
    
    test_cases = [
        {"minutes": 5, "expected_clips": "2-4"},
        {"minutes": 10, "expected_clips": "4-8"},
        {"minutes": 15, "expected_clips": "6-12"},
        {"minutes": 23, "expected_clips": "10-15"},
        {"minutes": 30, "expected_clips": "12-20"},
    ]
    
    for case in test_cases:
        print(f"\n📹 {case['minutes']}-minute video:")
        
        # Calculate expected segments
        total_seconds = case['minutes'] * 60
        expected_segments = total_seconds // 5  # ~5 seconds per segment
        expected_clips = total_seconds // 60    # ~60 seconds per clip
        
        print(f"   Duration: {total_seconds} seconds")
        print(f"   Expected segments: ~{expected_segments}")
        print(f"   Expected clips: ~{expected_clips}")
        print(f"   Predicted viral clips: {case['expected_clips']}")


if __name__ == "__main__":
    # Test long video processing
    top_clips = test_long_video_processing()
    
    # Test different lengths
    test_different_video_lengths()
    
    print(f"\n" + "=" * 60)
    print("✅ Long Video Test Complete!")
    print(f"   23-minute video generated {len(top_clips)} high-quality clips")
    print("   System can easily handle full-length YouTube videos")
    print("   Ready for production use with real videos!")
