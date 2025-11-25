"""
Hook Detection and Viral Scoring System
Similar to Opus Clip / Ssemble viral moment detection
"""

import re
import json
import sys
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from datetime import timedelta

# Fix Windows console encoding for Hindi/Unicode characters
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


@dataclass
class TranscriptSegment:
    """Individual transcript segment with timing"""
    start_time: float
    end_time: float
    text: str
    confidence: float = 0.0
    original_segment: Any = None  # CRITICAL: Store original Whisper segment with word-level timestamps


@dataclass
class VideoClip:
    """Potential viral clip with scoring"""
    start_time: float
    end_time: float
    duration: float
    transcript: str
    viral_score: float
    hook_keywords: List[str]
    has_question: bool
    emotion_score: float
    length_bonus: float
    segments: List[Any] = None  # CRITICAL: Store original Whisper segments with word-level timestamps
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable format"""
        return {
            "start_time": self._format_timestamp(self.start_time),
            "end_time": self._format_timestamp(self.end_time),
            "duration": round(self.duration, 2),
            "score": round(self.viral_score, 3),
            "transcript": self.transcript.strip(),
            "segments": self.segments,  # CRITICAL: Pass segments with word timestamps
            "analysis": {
                "hook_keywords": self.hook_keywords,
                "has_question": self.has_question,
                "emotion_score": round(self.emotion_score, 3),
                "length_bonus": self.length_bonus
            }
        }
    
    def _format_timestamp(self, seconds: float) -> str:
        """Convert seconds to HH:MM:SS format"""
        td = timedelta(seconds=seconds)
        hours, remainder = divmod(td.total_seconds(), 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"


class HookDetector:
    """Main hook detection and viral scoring engine"""
    
    # Viral hook keywords (based on Opus Clip / Ssemble patterns)
    HOOK_KEYWORDS = [
        # Secrets & Reveals
        "secret", "secrets", "hidden", "revealed", "expose", "exposed", "truth about",
        "nobody told you", "nobody tells you", "they don't want you to know",
        
        # Mistakes & Problems
        "mistake", "mistakes", "wrong", "error", "problem", "issue", "fail", "failure",
        "biggest mistake", "common mistake", "avoid this",
        
        # Crazy & Shocking
        "crazy", "insane", "shocking", "unbelievable", "incredible", "amazing",
        "you won't believe", "mind-blowing", "jaw-dropping",
        
        # Explanatory Hooks
        "this is why", "here's why", "the reason", "because", "how to", "watch this",
        "look at this", "check this out", "pay attention",
        
        # Urgency & FOMO
        "right now", "immediately", "before it's too late", "limited time",
        "don't miss", "last chance", "urgent",
        
        # Emotional Triggers
        "love", "hate", "angry", "frustrated", "excited", "scared", "worried"
    ]
    
    # Question starters for hook detection
    QUESTION_STARTERS = [
        "what", "why", "how", "when", "where", "who", "which", "whose",
        "can you", "do you", "have you", "are you", "will you", "would you",
        "is it", "are they", "did you know"
    ]
    
    def __init__(self, target_length: int = 60, min_length: int = 30, max_length: int = 90):
        """
        Initialize hook detector
        
        Args:
            target_length: Desired clip length in seconds
            min_length: Minimum clip length
            max_length: Maximum clip length
        """
        self.target_length = target_length
        self.min_length = min_length
        self.max_length = max_length
        self.sentiment_analyzer = None
        
    def load_sentiment_model(self):
        """Load multilingual sentiment analysis model (supports Hindi, Nepali, English, 100+ languages)"""
        try:
            from transformers import pipeline
            import torch
            
            # Auto-detect GPU for sentiment model
            device = 0 if torch.cuda.is_available() else -1  # 0 = GPU, -1 = CPU
            device_name = "GPU" if device == 0 else "CPU"
            
            # Try multilingual models first (support Hindi, Nepali, English, etc.)
            models_to_try = [
                # Best for viral content - Twitter-trained, 100+ languages
                ("cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual", "sentiment-analysis"),
                # Lightweight multilingual alternative
                ("lxyuan/distilbert-base-multilingual-cased-sentiments-student", "sentiment-analysis"),
                # Fallback: English-only (legacy)
                ("j-hartmann/emotion-english-distilroberta-base", "text-classification"),
            ]
            
            for model_name, task in models_to_try:
                try:
                    print(f"Trying sentiment model: {model_name}")
                    
                    # For multilingual models, don't use return_all_scores to avoid token issues
                    if "multilingual" in model_name or "xlm" in model_name:
                        self.sentiment_analyzer = pipeline(
                            task,
                            model=model_name,
                            framework="pt",
                            device=device,  # GPU support
                            max_length=512,  # Prevent token limit errors
                            truncation=True   # Auto-truncate long text
                        )
                    else:
                        # English-only models
                        self.sentiment_analyzer = pipeline(
                            task,
                            model=model_name,
                            return_all_scores=True,
                            framework="pt",
                            device=device  # GPU support
                        )
                    
                    print(f"✅ Sentiment model loaded on {device_name}: {model_name}")
                    if "multilingual" in model_name or "xlm" in model_name:
                        print(f"   Supports: Hindi, Nepali, English, and 100+ languages")
                    if device == 0:
                        print(f"   Speed boost: ~3-5x faster on GPU")
                    return
                    
                except Exception as model_error:
                    print(f"   Failed: {str(model_error)[:100]}...")
                    continue
            
            # If all models fail, disable sentiment analysis
            print("⚠️  All sentiment models failed. Continuing without sentiment analysis.")
            print("   Viral scores will be based on keywords only.")
            self.sentiment_analyzer = None
            
        except ImportError:
            print("⚠️  transformers not installed. Sentiment analysis disabled.")
            print("   Install with: pip install transformers torch")
            self.sentiment_analyzer = None
        
    def segment_transcript(self, transcript_segments: List[TranscriptSegment]) -> List[VideoClip]:
        """
        Split transcript into candidate clips of target length
        
        Args:
            transcript_segments: List of transcript segments with timestamps
            
        Returns:
            List of potential video clips
        """
        clips = []
        
        # Sort segments by start time
        segments = sorted(transcript_segments, key=lambda x: x.start_time)
        
        i = 0
        while i < len(segments):
            clip_start = segments[i].start_time
            clip_text = ""
            clip_segments = []
            best_clip_end = None
            best_clip_segments = []
            best_clip_text = ""
            
            # Build clip by adding segments until we reach target duration
            j = i
            while j < len(segments):
                segment = segments[j]
                potential_duration = segment.end_time - clip_start
                
                # Stop if we exceed max length
                if potential_duration > self.max_length:
                    break
                
                clip_segments.append(segment)
                clip_text += " " + segment.text
                
                # Save sentence boundaries in the target range as candidates
                if potential_duration >= self.min_length and self._is_sentence_boundary(segment.text):
                    # Prefer clips closer to target_length
                    if best_clip_end is None or abs(potential_duration - self.target_length) < abs((best_clip_end - clip_start) - self.target_length):
                        best_clip_end = segment.end_time
                        best_clip_segments = clip_segments.copy()
                        best_clip_text = clip_text.strip()
                    
                    # If we're past target_length and found a good boundary, stop looking
                    if potential_duration >= self.target_length:
                        break
                
                j += 1
            
            # Create clip if we found a valid boundary
            if best_clip_end is not None:
                duration = best_clip_end - clip_start
                
                clip = VideoClip(
                    start_time=clip_start,
                    end_time=best_clip_end,
                    duration=duration,
                    transcript=best_clip_text,
                    viral_score=0.0,
                    hook_keywords=[],
                    has_question=False,
                    emotion_score=0.0,
                    length_bonus=0.0,
                    segments=best_clip_segments  # CRITICAL: Store segments for word-level timestamps
                )
                clips.append(clip)
                
                # Move forward (overlap clips by 50% for better coverage)
                i += max(1, len(best_clip_segments) // 2)
            else:
                # No valid clip found, move to next segment
                i += 1
        
        return clips
    
    def _is_sentence_boundary(self, text: str) -> bool:
        """Check if text ends with sentence boundary"""
        text = text.strip()
        return text.endswith(('.', '!', '?', '...')) or len(text.split()) > 10
    
    def score_clips(self, clips: List[VideoClip]) -> List[VideoClip]:
        """
        Score all clips for viral potential
        
        Args:
            clips: List of video clips to score
            
        Returns:
            List of scored clips
        """
        for clip in clips:
            clip.viral_score = self._calculate_viral_score(clip)
        
        # Sort by viral score (highest first)
        return sorted(clips, key=lambda x: x.viral_score, reverse=True)
    
    def _calculate_viral_score(self, clip: VideoClip) -> float:
        """Calculate viral score for a single clip"""
        score = 0.0
        
        # 1. Hook keyword detection (+2 points each)
        hook_keywords = self._detect_hook_keywords(clip.transcript)
        clip.hook_keywords = hook_keywords
        score += len(hook_keywords) * 2
        
        # 2. Question detection (+2 points)
        has_question = self._detect_question_hook(clip.transcript)
        clip.has_question = has_question
        if has_question:
            score += 2
        
        # 3. Sentiment/emotion analysis (0-2 points)
        emotion_score = self._analyze_emotion(clip.transcript)
        clip.emotion_score = emotion_score
        score += emotion_score * 2
        
        # 4. Length bonus (+1 if within 10% of target)
        length_bonus = self._calculate_length_bonus(clip.duration)
        clip.length_bonus = length_bonus
        score += length_bonus
        
        return score
    
    def _detect_hook_keywords(self, text: str) -> List[str]:
        """Detect hook keywords in text"""
        text_lower = text.lower()
        found_keywords = []
        
        for keyword in self.HOOK_KEYWORDS:
            if keyword in text_lower:
                found_keywords.append(keyword)
        
        return found_keywords
    
    def _detect_question_hook(self, text: str) -> bool:
        """Detect if text starts with a question"""
        text_lower = text.lower().strip()
        
        # Check for question starters
        for starter in self.QUESTION_STARTERS:
            if text_lower.startswith(starter):
                return True
        
        # Check for question marks
        sentences = text.split('.')
        if sentences and '?' in sentences[0]:
            return True
        
        return False
    
    def _analyze_emotion(self, text: str) -> float:
        """
        Analyze emotional intensity using multilingual sentiment model
        Supports Hindi, Nepali, English, and 100+ languages
        """
        if not self.sentiment_analyzer:
            return 0.0
        
        try:
            # Clean and truncate text (multilingual models already handle this via pipeline config)
            text = text.strip()
            if not text:
                return 0.0
            
            results = self.sentiment_analyzer(text)
            
            # Handle multilingual sentiment model output
            # Format: [{'label': 'positive'/'negative'/'neutral', 'score': 0.95}]
            if isinstance(results, list) and len(results) > 0:
                result = results[0]
                label = result.get('label', '').lower()
                score = result.get('score', 0.0)
                
                # Map sentiment to viral potential
                # Positive and negative emotions drive engagement
                if label in ['positive', 'pos']:
                    # Positive emotions are viral (joy, excitement, inspiration)
                    return min(1.0, score * 1.2)  # 20% boost for positive
                elif label in ['negative', 'neg']:
                    # Negative emotions are also viral (anger, shock, controversy)
                    return min(1.0, score * 1.3)  # 30% boost for negative (more viral)
                elif label in ['neutral']:
                    # Neutral is less viral but still valid
                    return score * 0.5
                else:
                    # Unknown label, use raw score
                    return score
            
            # Fallback for unexpected format
            return 0.5
        
        except Exception as e:
            # Don't print error for every segment - just return neutral score
            # Only print if it's a new type of error
            error_msg = str(e)
            if "expanded size" not in error_msg:  # Skip token size errors (already handled)
                print(f"Emotion analysis error: {error_msg[:100]}")
            return 0.0
    
    def _calculate_length_bonus(self, duration: float) -> float:
        """Calculate bonus for optimal length"""
        target = self.target_length
        tolerance = target * 0.1  # 10% tolerance
        
        if abs(duration - target) <= tolerance:
            return 1.0 

        
        return 0.0
    
    def find_viral_clips(self, transcript_segments: List[TranscriptSegment], top_n: int = 10) -> List[Dict[str, Any]]:
        """
        Main method to find viral clips from transcript
        
        Args:
            transcript_segments: Raw transcript segments
            top_n: Number of top clips to return
            
        Returns:
            List of top viral clips as dictionaries
        """
        print(f"Analyzing transcript for viral clips...")
        print(f"   Target length: {self.target_length}s")
        print(f"   Range: {self.min_length}-{self.max_length}s")
        
        # Step 1: Segment transcript into clips
        clips = self.segment_transcript(transcript_segments)
        print(f"Generated {len(clips)} candidate clips")
        
        # Step 2: Score clips for viral potential
        scored_clips = self.score_clips(clips)
        print(f"Scored and ranked clips")
        
        # Step 3: Return top N clips
        top_clips = scored_clips[:top_n]
        
        print(f"Found {len(top_clips)} viral clips")
        for i, clip in enumerate(top_clips[:3]):  # Show top 3
            print(f"   #{i+1}: Score {clip.viral_score:.2f} - {clip.transcript[:50]}...")
        
        return [clip.to_dict() for clip in top_clips]


def parse_whisper_segments(whisper_segments: List[Dict]) -> List[TranscriptSegment]:
    """
    Convert Whisper output to TranscriptSegment objects
    
    Args:
        whisper_segments: Raw segments from Whisper transcription
        
    Returns:
        List of TranscriptSegment objects
    """
    segments = []
    
    for segment in whisper_segments:
        # Handle both Whisper Segment objects and dictionary formats
        if hasattr(segment, 'start'):
            # Whisper Segment object (from faster-whisper with word_timestamps=True)
            ts = TranscriptSegment(
                start_time=segment.start,
                end_time=segment.end,
                text=segment.text.strip() if hasattr(segment, 'text') else '',
                confidence=getattr(segment, 'confidence', 0.0),
                original_segment=segment  # CRITICAL: Preserve original segment with word timestamps
            )
        else:
            # Dictionary format (fallback)
            ts = TranscriptSegment(
                start_time=segment.get('start', 0.0),
                end_time=segment.get('end', 0.0),
                text=segment.get('text', '').strip(),
                confidence=segment.get('confidence', 0.0),
                original_segment=segment  # Preserve original segment
            )
        segments.append(ts)
    
    return segments


# Example usage and testing
if __name__ == "__main__":
    # Test with sample data
    sample_segments = [
        {"start": 0.0, "end": 5.0, "text": "Welcome to this crazy tutorial about secrets nobody told you."},
        {"start": 5.0, "end": 12.0, "text": "Today I'm going to reveal the biggest mistake people make."},
        {"start": 12.0, "end": 18.0, "text": "This is why your videos aren't getting views."},
        {"start": 18.0, "end": 25.0, "text": "Watch this technique that will blow your mind."},
        {"start": 25.0, "end": 35.0, "text": "The secret is in the hook detection algorithm we're building."},
    ]
    
    # Convert to TranscriptSegment objects
    segments = parse_whisper_segments(sample_segments)
    
    # Initialize detector
    detector = HookDetector(target_length=60)
    detector.load_sentiment_model()
    
    # Find viral clips
    viral_clips = detector.find_viral_clips(segments, top_n=5)
    
    # Print results
    print("\n🎬 Viral Clips Found:")
    print(json.dumps(viral_clips, indent=2))
