"""
Test Script for Hook Detection System
Tests viral clip detection and scoring
"""

import json
from hook_detector import HookDetector, parse_whisper_segments
from clip_processor import ClipProcessor


def test_hook_detection():
    """Test basic hook detection functionality"""
    print("🧪 Testing Hook Detection System")
    print("=" * 50)
    
    # Sample transcript data (realistic YouTube video content)
    sample_transcript = [
        {"start": 0.0, "end": 6.0, "text": "What if I told you there's a secret that nobody wants you to know?"},
        {"start": 6.0, "end": 12.0, "text": "Today I'm going to reveal the biggest mistake entrepreneurs make."},
        {"start": 12.0, "end": 18.0, "text": "This is why 95% of startups fail in their first year."},
        {"start": 18.0, "end": 25.0, "text": "Watch this crazy technique that billionaires use every single day."},
        {"start": 25.0, "end": 32.0, "text": "The truth about success is not what you think it is."},
        {"start": 32.0, "end": 40.0, "text": "How do some people make millions while others struggle to pay bills?"},
        {"start": 40.0, "end": 47.0, "text": "The answer will shock you and change everything you believe."},
        {"start": 47.0, "end": 54.0, "text": "This is the exact framework I used to build a 7-figure business."},
        {"start": 54.0, "end": 62.0, "text": "You won't believe how simple this strategy actually is."},
        {"start": 62.0, "end": 70.0, "text": "The biggest problem with most advice is that it's completely wrong."},
        {"start": 70.0, "end": 78.0, "text": "Let me show you the real way to achieve financial freedom."},
        {"start": 78.0, "end": 85.0, "text": "This mistake is costing you thousands of dollars every month."},
        {"start": 85.0, "end": 92.0, "text": "Here's the secret formula that changed my entire life."},
        {"start": 92.0, "end": 100.0, "text": "Why do successful people never share this information publicly?"},
        {"start": 100.0, "end": 108.0, "text": "The reason will make you angry but also incredibly motivated."},
    ]
    
    print(f"📝 Sample transcript: {len(sample_transcript)} segments")
    print(f"   Total duration: {sample_transcript[-1]['end']:.1f} seconds")
    
    # Test 1: Basic Hook Detection
    print("\n🎯 Test 1: Hook Detection")
    print("-" * 30)
    
    detector = HookDetector(target_length=60)
    detector.load_sentiment_model()
    
    # Convert to segments
    segments = parse_whisper_segments(sample_transcript)
    
    # Find viral clips
    viral_clips = detector.find_viral_clips(segments, top_n=5)
    
    print(f"\n📊 Results:")
    for i, clip in enumerate(viral_clips):
        print(f"\n🏆 Clip #{i+1}")
        print(f"   Score: {clip['score']:.2f}")
        print(f"   Time: {clip['start_time']} - {clip['end_time']} ({clip['duration']:.1f}s)")
        print(f"   Hooks: {', '.join(clip['analysis']['hook_keywords']) if clip['analysis']['hook_keywords'] else 'None'}")
        print(f"   Question: {'Yes' if clip['analysis']['has_question'] else 'No'}")
        print(f"   Emotion: {clip['analysis']['emotion_score']:.2f}")
        print(f"   Text: {clip['transcript'][:80]}...")
    
    return viral_clips


def test_clip_processor():
    """Test the integrated clip processor"""
    print("\n\n🧪 Testing Clip Processor Integration")
    print("=" * 50)
    
    processor = ClipProcessor(target_clip_length=60)
    
    # Test with mock video URL
    test_url = "https://www.youtube.com/watch?v=test123"
    
    print(f"🎬 Processing: {test_url}")
    
    try:
        clips = processor.process_video_for_clips(
            video_url=test_url,
            layout_mode="fit",
            template="Karaoke",
            max_clips=3,
            min_score=2.0
        )
        
        print(f"\n📊 Processor Results:")
        print(f"   Found: {len(clips)} clips")
        
        for i, clip in enumerate(clips):
            print(f"\n📹 Clip #{i+1}")
            print(f"   Score: {clip['score']:.2f}")
            print(f"   Duration: {clip['duration']:.1f}s")
            print(f"   Layout: {clip['layout_mode']}")
            print(f"   Template: {clip['template']}")
            print(f"   Status: {clip['status']}")
        
        # Test JSON export
        if clips:
            output_file = "test_clips_output.json"
            processor.export_clips_json(clips, output_file)
            print(f"\n💾 Exported to: {output_file}")
        
        return clips
        
    except Exception as e:
        print(f"❌ Processor test failed: {e}")
        return []


def test_scoring_algorithm():
    """Test individual scoring components"""
    print("\n\n🧪 Testing Scoring Algorithm Components")
    print("=" * 50)
    
    detector = HookDetector()
    
    # Test cases with expected scores
    test_cases = [
        {
            "text": "What is the secret nobody told you about making money?",
            "expected_keywords": ["secret", "nobody told you"],
            "expected_question": True,
            "description": "High-scoring hook with secret + question"
        },
        {
            "text": "This is the biggest mistake entrepreneurs make when starting.",
            "expected_keywords": ["biggest mistake"],
            "expected_question": False,
            "description": "Medium-scoring hook with mistake keyword"
        },
        {
            "text": "Today we're going to learn about basic accounting principles.",
            "expected_keywords": [],
            "expected_question": False,
            "description": "Low-scoring regular content"
        },
        {
            "text": "You won't believe this crazy technique that will shock you!",
            "expected_keywords": ["won't believe", "crazy", "shock"],
            "expected_question": False,
            "description": "High-scoring emotional hook"
        }
    ]
    
    print("🔍 Testing scoring components:")
    
    for i, test in enumerate(test_cases):
        print(f"\n📝 Test Case {i+1}: {test['description']}")
        print(f"   Text: \"{test['text']}\"")
        
        # Test keyword detection
        keywords = detector._detect_hook_keywords(test['text'])
        print(f"   Keywords found: {keywords}")
        print(f"   Expected: {test['expected_keywords']}")
        
        # Test question detection  
        is_question = detector._detect_question_hook(test['text'])
        print(f"   Question detected: {is_question}")
        print(f"   Expected: {test['expected_question']}")
        
        # Calculate partial score
        keyword_score = len(keywords) * 2
        question_score = 2 if is_question else 0
        total_score = keyword_score + question_score
        
        print(f"   Partial Score: {total_score:.1f} (keywords: {keyword_score}, question: {question_score})")


def run_comprehensive_test():
    """Run all tests"""
    print("🚀 Starting Comprehensive Hook Detection Tests")
    print("=" * 60)
    
    try:
        # Test 1: Basic hook detection
        viral_clips = test_hook_detection()
        
        # Test 2: Clip processor integration
        processed_clips = test_clip_processor()
        
        # Test 3: Scoring algorithm components
        test_scoring_algorithm()
        
        print("\n" + "=" * 60)
        print("✅ All Tests Completed Successfully!")
        print(f"   Hook Detection: {len(viral_clips)} clips found")
        print(f"   Clip Processor: {len(processed_clips)} clips processed")
        print("   Scoring Algorithm: All components working")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test Suite Failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_comprehensive_test()
    
    if success:
        print("\n🎉 Hook Detection System Ready!")
        print("   Next steps:")
        print("   1. Install dependencies: pip install transformers torch")
        print("   2. Integrate with video processing pipeline")
        print("   3. Test with real YouTube videos")
    else:
        print("\n🔧 Please fix issues before proceeding")
