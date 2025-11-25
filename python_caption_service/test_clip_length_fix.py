#!/usr/bin/env python3
"""
Test that the clip length fix works correctly
Verify clips are now in the 60-90s range instead of 30s
"""

from hook_detector import HookDetector, TranscriptSegment

def create_long_transcript():
    """Create a 5-minute mock transcript"""
    segments = []
    
    # Create segments every 5-7 seconds for 5 minutes (300 seconds)
    sentences = [
        "Welcome to this amazing video about content creation.",
        "Today I'm going to share some incredible insights with you.",
        "The secret to viral content is understanding your audience deeply.",
        "Most creators make the same critical mistakes over and over again.",
        "Let me show you exactly what you need to do differently.",
        "This technique has helped thousands of creators grow their channels.",
        "You won't believe how simple this strategy actually is.",
        "The key is to focus on engagement rather than just views.",
        "Many people don't realize the importance of the first three seconds.",
        "Your hook determines whether people will watch or scroll past.",
        "I've tested this approach with over fifty different videos.",
        "The results were absolutely mind-blowing and consistent.",
        "Here's the exact framework that works every single time.",
        "First, you need to identify what makes your content unique.",
        "Then, you craft a compelling story around that uniqueness.",
        "The emotional connection is what keeps viewers watching.",
        "Data shows that videos with strong hooks perform ten times better.",
        "But it's not just about the hook, it's about the entire flow.",
        "You need to maintain momentum throughout the entire video.",
        "Every sentence should lead naturally into the next one.",
        "This creates a sense of anticipation and curiosity.",
        "Viewers stay engaged because they want to know what comes next.",
        "The pacing is crucial for maintaining that engagement.",
        "Too slow and people get bored, too fast and they get overwhelmed.",
        "Finding the right balance takes practice and experimentation.",
        "But once you master it, your content will transform completely.",
        "Let me break down the specific steps you need to follow.",
        "Step one is to analyze your best performing content carefully.",
        "Look for patterns in what resonates with your audience.",
        "Step two is to double down on what's already working well.",
        "Don't try to reinvent the wheel every single time.",
        "Consistency is key to building a loyal audience over time.",
        "Step three is to test new ideas systematically and measure results.",
        "Use analytics to guide your decisions rather than gut feelings.",
        "The data will tell you exactly what your audience wants.",
        "Step four is to optimize your thumbnails and titles for clicks.",
        "These are the first things people see before watching.",
        "Make them irresistible and impossible to ignore completely.",
        "Step five is to engage with your community regularly.",
        "Respond to comments and build genuine relationships with viewers.",
        "This creates loyalty and turns casual viewers into fans.",
        "Now let's talk about the biggest mistakes to avoid.",
        "Mistake number one is trying to appeal to everyone.",
        "You need a specific niche and target audience instead.",
        "Mistake number two is inconsistent posting schedules.",
        "Your audience needs to know when to expect new content.",
        "Mistake number three is ignoring audience feedback completely.",
        "Listen to what people are telling you in the comments.",
        "They're giving you free insights into what they want.",
        "Mistake number four is focusing only on subscriber count.",
        "Engagement metrics are far more important for growth.",
        "A small engaged audience beats a large passive one.",
        "Mistake number five is giving up too early on your journey.",
        "Success takes time and consistent effort over months.",
        "Most creators quit right before they would have succeeded.",
        "Don't let that be you, keep pushing forward always.",
        "The final piece of advice I want to share is this.",
        "Authenticity always wins in the long run, every time.",
        "People can tell when you're being genuine versus fake.",
        "Be yourself and let your unique personality shine through.",
        "That's what will make you stand out from everyone else.",
        "Thank you so much for watching this entire video today.",
    ]
    
    current_time = 0.0
    for i, sentence in enumerate(sentences):
        duration = 5.0 + (i % 3)  # Vary between 5-7 seconds
        segment = TranscriptSegment(
            start_time=current_time,
            end_time=current_time + duration,
            text=sentence
        )
        segments.append(segment)
        current_time += duration
    
    return segments

def test_clip_lengths():
    """Test that clips are now in the 60-90s range"""
    print("🧪 Testing Clip Length Fix")
    print("=" * 60)
    
    # Create 5-minute transcript
    transcript = create_long_transcript()
    total_duration = transcript[-1].end_time
    print(f"📝 Created transcript: {len(transcript)} segments, {total_duration:.1f}s total\n")
    
    # Test with 60-90s target range
    print("🎯 Test 1: Target 60-90s range")
    print("-" * 60)
    detector = HookDetector(target_length=75, min_length=60, max_length=90)
    clips = detector.segment_transcript(transcript)
    
    print(f"✅ Generated {len(clips)} clips\n")
    
    for i, clip in enumerate(clips, 1):
        duration = clip.duration
        in_range = "✅" if 60 <= duration <= 90 else "❌"
        print(f"Clip #{i}: {duration:.1f}s {in_range}")
        print(f"   Start: {clip.start_time:.1f}s → End: {clip.end_time:.1f}s")
        print(f"   Text: {clip.transcript[:80]}...")
        print()
    
    # Calculate statistics
    durations = [clip.duration for clip in clips]
    avg_duration = sum(durations) / len(durations) if durations else 0
    in_range_count = sum(1 for d in durations if 60 <= d <= 90)
    
    print("📊 Statistics:")
    print(f"   Average duration: {avg_duration:.1f}s")
    print(f"   Clips in 60-90s range: {in_range_count}/{len(clips)} ({in_range_count/len(clips)*100:.0f}%)")
    print(f"   Min duration: {min(durations):.1f}s")
    print(f"   Max duration: {max(durations):.1f}s")
    print()
    
    # Test with different ranges
    print("\n🎯 Test 2: Target 30-60s range (for comparison)")
    print("-" * 60)
    detector2 = HookDetector(target_length=45, min_length=30, max_length=60)
    clips2 = detector2.segment_transcript(transcript)
    
    print(f"✅ Generated {len(clips2)} clips\n")
    
    for i, clip in enumerate(clips2[:3], 1):  # Show first 3
        duration = clip.duration
        in_range = "✅" if 30 <= duration <= 60 else "❌"
        print(f"Clip #{i}: {duration:.1f}s {in_range}")
    
    durations2 = [clip.duration for clip in clips2]
    avg_duration2 = sum(durations2) / len(durations2) if durations2 else 0
    print(f"\n   Average duration: {avg_duration2:.1f}s")
    
    print("\n" + "=" * 60)
    print("🎉 FIX VERIFICATION:")
    if avg_duration >= 60:
        print("   ✅ Clips are now targeting the correct length range!")
        print("   ✅ No more 30s clips when you want 60-90s!")
    else:
        print("   ❌ Still generating short clips - needs more work")

if __name__ == "__main__":
    test_clip_lengths()
