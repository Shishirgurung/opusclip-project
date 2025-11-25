#!/usr/bin/env python3
"""
Complete Viral Clip Generator
Combines all components: YouTube download, transcription, viral scoring, layout processing, and caption generation
"""

import os
import sys
import time
import tempfile
import shutil
from typing import List, Dict, Any
from pathlib import Path
import json
import subprocess
from hook_detector import HookDetector, parse_whisper_segments
from opus_processor import OpusProcessor
import yt_dlp
from faster_whisper import WhisperModel

# Fix Windows console encoding for Hindi/Unicode characters
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# CRITICAL: Set Hugging Face cache to a location with more disk space
# If C: drive is full, uncomment and modify the line below to use another drive:
# os.environ['HF_HOME'] = 'D:/huggingface_cache'  # Change D: to your drive with space
# os.environ['TRANSFORMERS_CACHE'] = 'D:/huggingface_cache/transformers'

# Translation support
try:
    from deep_translator import GoogleTranslator
    TRANSLATION_AVAILABLE = True
except ImportError:
    TRANSLATION_AVAILABLE = False
    print("Warning: deep-translator not installed. Translation features disabled.")

# Transliteration support (Devanagari → Roman script)
try:
    from indic_transliteration import sanscript
    from indic_transliteration.sanscript import transliterate
    TRANSLITERATION_AVAILABLE = True
except ImportError:
    TRANSLITERATION_AVAILABLE = False
    print("Warning: indic-transliteration not installed. Hinglish features disabled.")

# Urdu to Hindi conversion support
try:
    from urdu_to_hindi_transliterator import UrduToHindiTransliterator
    URDU_CONVERTER_AVAILABLE = True
except ImportError:
    # Fallback: Use Google Translator for Urdu → Hindi
    URDU_CONVERTER_AVAILABLE = False

class CompleteViralClipGenerator:
    """Complete viral clip generator with layout processing and captions"""
    
    def __init__(self, min_length=30, max_length=90, target_length=60):
        self.hook_detector = HookDetector(
            target_length=target_length,
            min_length=min_length,
            max_length=max_length
        )
        self.hook_detector.load_sentiment_model()
        self.opus_processor = OpusProcessor()
        
        # Initialize Whisper model for real transcription
        # Model sizes: tiny(39MB), base(74MB), small(244MB), medium(769MB), large(1550MB)
        # For Hindi accuracy: medium > small > base > tiny
        
        # Auto-detect GPU availability
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
        
        if device == "cuda":
            print(f"🚀 GPU detected! Using CUDA acceleration")
            print(f"   GPU: {torch.cuda.get_device_name(0)}")
            print(f"   VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
        else:
            print(f"💻 No GPU detected, using CPU")
        
        try:
            # Try large first for best accuracy (especially for Nepali/Hindi)
            # Large model: 1550MB, ~5-10% better accuracy than medium
            self.whisper_model = WhisperModel("large", device=device, compute_type=compute_type)
            print(f"✅ Whisper large model loaded on {device.upper()} (best quality, ~1550MB)")
            if device == "cuda":
                print(f"   Speed boost: ~5-10x faster than CPU")
            else:
                print(f"   Note: Large model on CPU is slower. Consider using GPU (Google Colab, RunPod, etc.)")
        except Exception as e:
            print(f"Warning: large model failed ({e}), trying medium model...")
            try:
                # Fallback to medium - good balance of quality and resources
                self.whisper_model = WhisperModel("medium", device=device, compute_type=compute_type)
                print(f"✅ Whisper medium model loaded on {device.upper()} (high quality, ~769MB)")
                if device == "cuda":
                    print(f"   Speed boost: ~5-10x faster than CPU")
            except Exception as e2:
                print(f"Warning: medium model failed, trying small model: {e2}")
                try:
                    # Fallback to small - good balance of quality and resources
                    self.whisper_model = WhisperModel("small", device=device, compute_type=compute_type)
                    print(f"✅ Whisper small model loaded on {device.upper()} (good quality, ~244MB)")
                except Exception as e3:
                    print(f"Warning: small model failed, trying base model: {e3}")
                    try:
                        # Fallback to base - limited quality for Hindi
                        self.whisper_model = WhisperModel("base", device=device, compute_type=compute_type)
                        print(f"✅ Whisper base model loaded on {device.upper()} (basic quality, ~74MB)")
                    except Exception as e4:
                        print(f"Warning: base model failed, trying tiny model: {e4}")
                    try:
                        # Last resort: tiny - minimal quality
                        self.whisper_model = WhisperModel("tiny", device=device, compute_type=compute_type)
                        print(f"✅ Whisper tiny model loaded on {device.upper()} (minimal quality, ~39MB)")
                    except Exception as e4:
                        print(f"❌ ERROR: All Whisper models failed to load: {e4}")
                        print(f"   This usually means:")
                        print(f"   1. Not enough disk space (need at least 1GB free for medium)")
                        print(f"   2. Not enough RAM/VRAM (close other apps)")
                        print(f"   3. Network issues downloading the model")
                        if device == "cuda":
                            print(f"   4. GPU driver issues (update CUDA/cuDNN)")
                        self.whisper_model = None
    
    def generate_complete_viral_clips(
        self, 
        video_url: str,
        layout_mode: str = "auto",
        template: str = "TikTokViral",
        max_clips: int = 5,
        min_score: float = 4.0,
        output_dir: str = "exports/clips",
        min_length: int = 30,
        max_length: int = 90,
        target_length: int = 60,
        timeframe_start: int = None,
        timeframe_end: int = None,
        video_language: str = "auto",
        translate_captions: bool = False,
        caption_language: str = "en",
        job_id: str = None
    ) -> List[Dict[str, Any]]:
        """
        Generate complete viral clips with layout processing and captions
        
        Args:
            video_url: YouTube URL
            layout_mode: Video layout (fit, fill, square, auto)
            template: Caption template (Karaoke, BeastMode, Glitch, SwipeUp)
            max_clips: Maximum clips to generate
            min_score: Minimum viral score threshold
            output_dir: Output directory for clips
            
        Returns:
            List of generated clip information
        """
        print(f"Generating Complete Viral Clips")
        print(f"   Video: {video_url}")
        print(f"   Layout: {layout_mode} | Template: {template}")
        print(f"   Target: {max_clips} clips (min score: {min_score})")
        print("=" * 60)
        
        # Convert output_dir to absolute path to avoid issues with working directory changes
        output_dir = os.path.abspath(output_dir)
        print(f"Output directory: {output_dir}")
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            print(f"Created output directory: {output_dir}")
        
        try:
            # Step 1: Download video and extract transcript
            video_info = self._download_and_transcribe_real(video_url, video_language)
            if not video_info:
                error_msg = "Failed to download and transcribe video. Cannot proceed without real video."
                print(f"\n❌ ERROR: {error_msg}")
                print("   Please try a different video or check the error messages above.")
                raise Exception(error_msg)
            
            # Step 2: Find viral moments using hook detection
            viral_clips = self._find_viral_moments(
                video_info['transcript'], 
                max_clips, 
                min_score,
                min_length,
                max_length
            )
            
            if not viral_clips:
                print("Warning: No viral clips found above threshold")
                return []
            
            # Step 3: Generate complete video clips with layout and captions
            # Use detected language from video_info, fallback to specified or 'en'
            source_lang = video_info.get('detected_language', video_language if video_language != 'auto' else 'en')
            
            generated_clips = self._generate_complete_clips(
                viral_clips,
                video_info,
                layout_mode,
                template,
                output_dir,
                translate_captions=translate_captions,
                source_language=source_lang,
                target_language=caption_language
            )
            
            print(f"\nSuccessfully generated {len(generated_clips)} complete viral clips!")
            return generated_clips
            
        except Exception as e:
            print(f"Error generating complete viral clips: {e}")
            raise
        
    def _download_and_transcribe_real(self, video_url: str, video_language: str = "auto") -> Dict[str, Any]:
        """Download video and extract real transcript using Whisper"""
        print("Downloading video and extracting transcript...")
        
        try:
            # Create temporary directory for processing
            temp_dir = tempfile.mkdtemp(prefix="viral_clips_")
            
            # Download video using existing function
            video_path, original_filename = download_youtube_video(video_url, temp_dir)
            
            print(f"Downloaded video: {original_filename}")
            print(f"   Path: {video_path}")
            
            # Initialize video_info dict
            video_info = {
                'video_path': video_path,
                'temp_dir': temp_dir
            }
            
            # Extract real transcript using Whisper with WORD-LEVEL TIMESTAMPS
            if self.whisper_model:
                print("Transcribing audio with Whisper (word-level timestamps)...")
                # CRITICAL: word_timestamps=True enables word-level timing for perfect sync
                # Language detection: auto or specified language
                transcribe_params = {
                    'beam_size': 1,  # Use 1 instead of 5 to reduce memory usage significantly
                    'word_timestamps': True,  # Enable word-level timestamps for perfect audio sync
                    'task': 'transcribe',  # CRITICAL: Use 'transcribe' not 'translate' to keep original language
                    'language': None,  # Will be set below
                    'initial_prompt': None  # Will be set below for script hinting
                }
                
                # Determine language to use
                if video_language and video_language != "auto":
                    # User specified language - use it and FORCE consistency
                    transcribe_params['language'] = video_language
                    
                    # CRITICAL: Force Devanagari script for Hindi (not Urdu/Arabic script)
                    if video_language == 'hi':
                        transcribe_params['initial_prompt'] = "यह एक हिंदी वीडियो है। कृपया देवनागरी लिपि में लिखें।"
                        print(f"   Using specified language: {video_language} (forced Devanagari script)")
                    else:
                        print(f"   Using specified language: {video_language} (forced for consistency)")
                else:
                    # Auto-detect: Let Whisper detect during transcription (single pass to save memory)
                    print("   Auto-detecting language during transcription...")
                    # Don't set language - let Whisper auto-detect
                    # We'll check the detected language after transcription and re-run if needed for Hindi
                
                # Debug: Print transcription parameters
                prompt_preview = transcribe_params.get('initial_prompt')
                if prompt_preview:
                    prompt_preview = prompt_preview[:30] + "..." if len(prompt_preview) > 30 else prompt_preview
                print(f"   Transcription params: language={transcribe_params.get('language')}, task={transcribe_params.get('task')}, prompt={prompt_preview}")
                
                # Transcribe with memory-efficient settings
                try:
                    segments, info = self.whisper_model.transcribe(video_path, **transcribe_params)
                except Exception as transcribe_error:
                    print(f"   ERROR during transcription: {transcribe_error}")
                    print(f"   This is likely a memory issue. Try closing other applications.")
                    raise  # Re-raise to trigger proper error handling
                
                # Get detected language from Whisper
                detected_language = info.language if hasattr(info, 'language') else 'en'
                print(f"   Detected language: {detected_language}")
                
                # If Hindi was auto-detected and we didn't use the Devanagari prompt, re-transcribe
                if detected_language == 'hi' and not transcribe_params.get('initial_prompt'):
                    print(f"   Hindi detected! Re-transcribing with Devanagari script prompt...")
                    transcribe_params['language'] = 'hi'
                    transcribe_params['initial_prompt'] = "यह एक हिंदी वीडियो है। कृपया देवनागरी लिपि में लिखें।"
                    try:
                        segments, info = self.whisper_model.transcribe(video_path, **transcribe_params)
                        print(f"   Re-transcription complete with Devanagari prompt")
                    except Exception as retry_error:
                        print(f"   WARNING: Re-transcription failed: {retry_error}")
                        print(f"   Using initial transcription results")
                
                transcript_segments = []
                word_count = 0
                first_segment_checked = False
                
                for segment in segments:
                    # Debug: Check first segment script
                    if not first_segment_checked:
                        print(f"   First segment text: '{segment.text[:100]}...'")
                        has_devanagari = any(0x0900 <= ord(c) <= 0x097F for c in segment.text)
                        has_latin = any(ord(c) < 128 and c.isalpha() for c in segment.text)
                        has_urdu = any(0x0600 <= ord(c) <= 0x06FF for c in segment.text)
                        has_korean = any(0xAC00 <= ord(c) <= 0xD7AF for c in segment.text)
                        print(f"   Script check: Devanagari={has_devanagari}, Latin={has_latin}, Urdu={has_urdu}, Korean={has_korean}")
                        
                        # Warn if mixed/wrong scripts detected
                        if has_urdu or has_korean:
                            print(f"   ⚠️  WARNING: Mixed/wrong scripts detected! Whisper model may be too small.")
                            print(f"   ⚠️  Consider freeing more disk space to use 'small' model (244MB).")
                        
                        first_segment_checked = True
                    
                    # Clean segment if Hindi was requested but got mixed scripts
                    if detected_language == 'hi':
                        segment = self._clean_hindi_segment(segment)
                    
                    # Store the full segment object with word-level data
                    transcript_segments.append(segment)
                    # Count words for verification
                    if hasattr(segment, 'words') and segment.words:
                        word_count += len(segment.words)
                
                print(f"Transcribed {len(transcript_segments)} segments with word-level timing")
                print(f"   Total words with timestamps: {word_count}")
                if word_count == 0:
                    print("   WARNING: No word-level timestamps found! Captions may not sync properly.")
                
                # Apply timeframe filtering if specified
                if timeframe_start is not None and timeframe_end is not None:
                    original_count = len(transcript_segments)
                    transcript_segments = [
                        seg for seg in transcript_segments 
                        if seg.end >= timeframe_start and seg.start <= timeframe_end
                    ]
                    print(f"   Timeframe filter: {timeframe_start}s - {timeframe_end}s")
                    print(f"   Filtered to {len(transcript_segments)} segments (from {original_count})")
            else:
                # Fallback to mock transcript if Whisper failed
                print("Warning: Using mock transcript (Whisper not available)")
                transcript_segments = self._get_mock_transcript()
            
            # Extract real transcript using Whisper (DISABLED FOR TESTING)
            # if self.whisper_model:
            #     print("Transcribing audio with Whisper...")
            #     segments, info = self.whisper_model.transcribe(video_path, beam_size=5)
            #     
            #     transcript_segments = []
            #     for segment in segments:
            #         transcript_segments.append({
            #             "start": segment.start,
            #             "end": segment.end,
            #             "text": segment.text.strip()
            #         })
            #     
            #     print(f"Transcribed {len(transcript_segments)} segments")
            # else:
            #     # Fallback to mock transcript if Whisper failed
            #     print("Warning: Using mock transcript (Whisper not available)")
            #     transcript_segments = self._get_mock_transcript()
            
            # Store detected language in video_info
            video_info['detected_language'] = detected_language if 'detected_language' in locals() else 'en'
            video_info['original_filename'] = original_filename
            video_info['transcript'] = transcript_segments
            
            return video_info
            
        except Exception as e:
            error_msg = str(e)
            print(f"Download/transcription failed: {error_msg}")
            
            # Check for specific error types and provide helpful messages
            if "copyright" in error_msg.lower():
                print("\n⚠️  COPYRIGHT RESTRICTION ERROR")
                print("   This video cannot be downloaded due to copyright restrictions.")
                print("   Please try a different video that allows downloads.")
            elif "private" in error_msg.lower() or "unavailable" in error_msg.lower():
                print("\n⚠️  VIDEO UNAVAILABLE ERROR")
                print("   This video is private, deleted, or unavailable.")
                print("   Please check the URL and try again.")
            elif "network" in error_msg.lower() or "connection" in error_msg.lower():
                print("\n⚠️  NETWORK ERROR")
                print("   Could not connect to YouTube. Check your internet connection.")
            
            return None
    
    def _create_mock_video_info(self) -> Dict[str, Any]:
        """Create mock video info when real download fails"""
        print("Creating mock video for testing...")
        
        try:
            # Create temporary directory for processing
            temp_dir = tempfile.mkdtemp(prefix="viral_clips_")
            
            # Create a dummy video file path
            import os
            mock_video_path = os.path.join(temp_dir, "mock_video.mp4")
            
            # Create a small dummy video file for testing (with audio)
            import subprocess
            ffmpeg_create_dummy = [
                'ffmpeg', '-y',
                '-f', 'lavfi',
                '-i', 'color=black:size=1920x1080:duration=75',
                '-f', 'lavfi',
                '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-pix_fmt', 'yuv420p',
                '-r', '30',
                '-shortest',
                mock_video_path
            ]
            
            result = subprocess.run(ffmpeg_create_dummy, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Warning: Could not create dummy video: {result.stderr}")
                # Use a simple approach - create an empty file
                with open(mock_video_path, 'w') as f:
                    f.write("")
            
            print(f"Mock video created: mock_video.mp4")
            print(f"   Path: {mock_video_path}")
            
            # Use mock transcript for testing
            print("Using mock transcript for testing...")
            transcript_segments = self._get_mock_transcript()
            
            return {
                'video_path': mock_video_path,
                'original_filename': "mock_video.mp4",
                'transcript': transcript_segments,
                'temp_dir': temp_dir
            }
            
        except Exception as e:
            print(f"Failed to create mock video: {e}")
            return None
    
    def _get_mock_transcript(self) -> List[Dict]:
        """Mock transcript for testing when Whisper is not available"""
        return [
            {"start": 0.0, "end": 8.0, "text": "This is the biggest secret nobody told you about making viral videos."},
            {"start": 8.0, "end": 15.0, "text": "Today I'm going to reveal the crazy mistake that's killing your engagement."},
            {"start": 15.0, "end": 22.0, "text": "Watch this technique that will completely change how you create content."},
            {"start": 22.0, "end": 30.0, "text": "The truth about viral videos is not what you think it is."},
            {"start": 30.0, "end": 38.0, "text": "How do successful creators consistently get millions of views?"},
            {"start": 38.0, "end": 45.0, "text": "The answer will shock you and transform your content strategy."},
            {"start": 45.0, "end": 52.0, "text": "This is why your videos aren't performing as well as they could."},
            {"start": 52.0, "end": 60.0, "text": "Let me show you the exact framework that works every single time."},
            {"start": 60.0, "end": 68.0, "text": "You won't believe how simple this actually is once you understand it."},
            {"start": 68.0, "end": 75.0, "text": "The biggest mistake people make is focusing on the wrong metrics."},
        ]
    
    def _find_viral_moments(
        self, 
        transcript_data: List[Dict], 
        max_clips: int, 
        min_score: float,
        min_length: int = 30,
        max_length: int = 90
    ) -> List[Dict[str, Any]]:
        """Find viral moments in transcript using hook detection (Ssemble-style: always return top N)"""
        print("Analyzing transcript for viral moments...")
        
        segments = parse_whisper_segments(transcript_data)
        
        # Find ALL possible viral clips (generate more candidates)
        all_viral_clips = self.hook_detector.find_viral_clips(segments, top_n=max_clips * 3)
        
        # SSEMBLE LOGIC: Fully automatic clip count based on video length AND clip length
        # Calculate video duration from transcript (handle both Segment objects and dicts)
        if transcript_data:
            # Handle Segment objects
            if hasattr(transcript_data[-1], 'end'):
                video_duration_seconds = transcript_data[-1].end - transcript_data[0].start
            else:
                # Handle dictionary format
                video_duration_seconds = transcript_data[-1]['end'] - transcript_data[0]['start']
        else:
            video_duration_seconds = 600  # Default 10 minutes
        
        video_duration_minutes = video_duration_seconds / 60
        
        # Calculate theoretical maximum based on clip length
        # Use the average of min and max length for calculation
        average_clip_length = (min_length + max_length) / 2
        theoretical_max = int(video_duration_seconds / average_clip_length)
        
        # Smart maximum based on video length (fully automatic like Ssemble/OpusClip)
        if video_duration_minutes >= 20:      # Very long videos (20+ min)
            smart_max = min(10, theoretical_max)
        elif video_duration_minutes >= 10:    # Long videos (10-20 min)
            smart_max = min(8, theoretical_max)
        elif video_duration_minutes >= 5:     # Medium videos (5-10 min)
            smart_max = min(5, theoretical_max)
        elif video_duration_minutes >= 2:     # Short videos (2-5 min)
            smart_max = min(3, theoretical_max)
        else:                                  # Very short (under 2 min)
            smart_max = min(2, theoretical_max)
        
        # Final clip count: min of (user's max_clips preference, smart_max, available clips)
        actual_clips_to_return = min(max_clips, smart_max, len(all_viral_clips))
        
        print(f"   Video duration: {video_duration_minutes:.1f} minutes ({video_duration_seconds:.0f}s)")
        print(f"   Average clip length: {average_clip_length:.0f}s")
        print(f"   Theoretical max clips: {theoretical_max}")
        print(f"   Smart maximum clips: {smart_max} (automatic AI decision)")
        print(f"   Returning: {actual_clips_to_return} clips")
        
        # Sort by score descending and take the top actual_clips_to_return
        top_clips = sorted(all_viral_clips, key=lambda x: x["score"], reverse=True)[:actual_clips_to_return]
        
        # Show score distribution for transparency
        if top_clips:
            highest_score = top_clips[0]["score"]
            lowest_score = top_clips[-1]["score"]
            above_threshold = len([c for c in top_clips if c["score"] >= min_score])
            
            print(f"Found {len(top_clips)} clips (Ssemble-style ranking)")
            print(f"   Score range: {highest_score:.1f} - {lowest_score:.1f}")
            print(f"   {above_threshold}/{len(top_clips)} clips above quality threshold {min_score}")
            
            for i, clip in enumerate(top_clips, 1):
                quality_indicator = "HIGH" if clip["score"] >= min_score else "LOW"
                # Use 'transcript' instead of 'text' - that's the correct key name
                clip_text = clip.get('transcript', clip.get('text', 'No text available'))
                print(f"   #{i}: Score {clip['score']:.1f} {quality_indicator} - {clip_text[:50]}...")
        
        return top_clips
    
    def _translate_segments(
        self,
        segments: List,
        source_lang: str,
        target_lang: str
    ) -> List:
        """
        Translate transcript segments while preserving timing and structure
        
        Args:
            segments: List of Whisper segments with text and word-level timestamps
            source_lang: Source language code (e.g., 'hi' for Hindi)
            target_lang: Target language code (e.g., 'en' for English)
            
        Returns:
            Translated segments with preserved timing
        """
        if not TRANSLATION_AVAILABLE:
            print("   Warning: Translation not available, keeping original text")
            return segments
        
        if source_lang == target_lang:
            print(f"   Source and target language are the same ({source_lang}), skipping translation")
            return segments
        
        try:
            translator = GoogleTranslator(source=source_lang, target=target_lang)
            translated_segments = []
            
            print(f"   Translating {len(segments)} segments from {source_lang} to {target_lang}...")
            
            for segment in segments:
                # Translate the segment text
                original_text = segment.text
                try:
                    translated_text = translator.translate(original_text)
                    
                    # Create a new segment object with translated text but same timing
                    # We keep the original segment structure and just update the text
                    import copy
                    translated_segment = copy.deepcopy(segment)
                    translated_segment.text = translated_text
                    
                    # If there are word-level timestamps, we keep them
                    # Note: Word boundaries won't match perfectly, but timing will be preserved
                    translated_segments.append(translated_segment)
                    
                except Exception as e:
                    print(f"   Warning: Failed to translate segment '{original_text[:50]}...': {e}")
                    translated_segments.append(segment)  # Keep original on error
            
            print(f"   Translation complete: {len(translated_segments)} segments")
            return translated_segments
            
        except Exception as e:
            print(f"   Translation error: {e}")
            return segments  # Return original on error
    
    def _normalize_hinglish(self, text: str) -> str:
        """
        Converts IAST transliterated text to readable Hinglish/Roman Nepali
        IAST uses diacritics for long vowels: ā, ī, ū, etc.
        
        Args:
            text: IAST transliterated text (may contain diacritics)
            
        Returns:
            Normalized Hinglish/Roman Nepali text (ASCII only)
        """
        import unicodedata
        
        # Step 1: Handle special character replacements BEFORE decomposition
        # This prevents issues with combining marks
        replacements = [
            ('ṃ', 'n'),      # anusvara (ṃ in IAST)
            ('ṇ', 'n'),      # retroflex n
            ('ṭ', 't'),      # retroflex t
            ('ḍ', 'd'),      # retroflex d
            ('ṛ', 'ri'),     # vowel ri
            ('ṝ', 'ri'),     # long ri
            ('ḥ', 'h'),      # visarga (ḥ)
            ('ś', 's'),      # palatal s
            ('ṣ', 's'),      # retroflex s
            ('ñ', 'n'),      # palatal n
        ]
        
        normalized = text
        for char, replacement in replacements:
            normalized = normalized.replace(char, replacement)
        
        # Step 2: Remove diacritical marks (accents, macrons, etc.)
        # IAST uses: ā (macron a), ī (macron i), ū (macron u), etc.
        # Decompose characters into base + combining marks
        decomposed = unicodedata.normalize('NFD', normalized)
        
        # Remove combining marks (diacritics)
        # This converts: ā → a, ī → i, ū → u, etc.
        normalized = ''.join(
            char for char in decomposed 
            if unicodedata.category(char) != 'Mn'  # Mn = Mark, Nonspacing
        )
        
        # Step 3: Convert to lowercase for natural reading
        normalized = normalized.lower()
        
        # Step 4: Capitalize first letter of sentences
        sentences = normalized.split('. ')
        normalized = '. '.join(s.capitalize() if s else s for s in sentences)
        
        return normalized
    
    def _is_devanagari(self, text: str) -> bool:
        """Check if text contains Devanagari characters"""
        devanagari_range = range(0x0900, 0x097F)
        return any(ord(char) in devanagari_range for char in text)
    
    def _transliterate_word(self, word: str) -> str:
        """
        Transliterate a single word, preserving English words
        
        Args:
            word: Word to transliterate
            
        Returns:
            Transliterated word or original if English
        """
        # Check if word is purely English (ASCII letters)
        if word and all(ord(c) < 128 and (c.isalpha() or c.isdigit()) for c in word):
            return word  # Keep English words as-is
        
        # Check if word contains Devanagari
        if not self._is_devanagari(word):
            return word  # Not Devanagari, keep as-is
        
        try:
            # Transliterate from Devanagari to IAST (cleaner than ITRANS)
            # IAST: International Alphabet of Sanskrit Transliteration
            iast_word = transliterate(word, sanscript.DEVANAGARI, sanscript.IAST)
            # Normalize to natural Hinglish/Roman Nepali
            normalized_word = self._normalize_hinglish(iast_word)
            return normalized_word
        except Exception as e:
            return word  # Return original on error
    
    def _transliterate_mixed_text(self, text: str) -> str:
        """
        Transliterate text with mixed Devanagari and English words
        Preserves English words while transliterating Devanagari
        
        Args:
            text: Mixed text (Devanagari + English)
            
        Returns:
            Text with Devanagari transliterated, English preserved
        """
        import re
        
        # Split by word boundaries, preserving punctuation
        # Pattern: captures words (letters/digits) and everything else
        pattern = r"(\w+|[^\w\s]|\s+)"
        tokens = re.findall(pattern, text)
        
        result = []
        for token in tokens:
            if not token or token.isspace():
                result.append(token)
            elif re.match(r'^[a-zA-Z0-9]+$', token):
                # English word or number - keep as-is
                result.append(token)
            elif self._is_devanagari(token):
                # Devanagari word - transliterate
                transliterated = self._transliterate_word(token)
                result.append(transliterated)
            else:
                # Punctuation or mixed - try to transliterate
                result.append(self._transliterate_word(token))
        
        return ''.join(result)
    
    def _transliterate_segments(self, segments: List) -> List:
        """
        Transliterate Devanagari script to Roman script (Hinglish)
        Preserves English words while transliterating Devanagari
        
        Args:
            segments: List of Whisper segments with Devanagari text
            
        Returns:
            Transliterated segments with Roman script
        """
        if not TRANSLITERATION_AVAILABLE:
            print("   Warning: Transliteration not available, keeping original text")
            return segments
        
        try:
            transliterated_segments = []
            
            print(f"   Transliterating {len(segments)} segments to Roman script...")
            
            for segment in segments:
                original_text = segment.text
                try:
                    # Transliterate mixed text (preserves English words)
                    transliterated_text = self._transliterate_mixed_text(original_text)
                    
                    # Create a new segment with transliterated text but same timing
                    import copy
                    transliterated_segment = copy.deepcopy(segment)
                    transliterated_segment.text = transliterated_text
                    
                    # Transliterate word-level timestamps too
                    if hasattr(transliterated_segment, 'words') and transliterated_segment.words:
                        for word in transliterated_segment.words:
                            if hasattr(word, 'word'):
                                word.word = self._transliterate_word(word.word)
                    
                    transliterated_segments.append(transliterated_segment)
                    
                except Exception as e:
                    print(f"   Warning: Failed to transliterate segment '{original_text[:50]}...': {e}")
                    transliterated_segments.append(segment)  # Keep original on error
            
            print(f"   Transliteration complete: {len(transliterated_segments)} segments")
            return transliterated_segments
            
        except Exception as e:
            print(f"   Transliteration error: {e}")
            return segments  # Return original on error
    
    def _clean_hindi_segment(self, segment):
        """
        Clean Hindi segment by removing non-Devanagari characters
        Fixes Whisper hallucinations that mix Hindi/Urdu/English/gibberish
        
        Args:
            segment: Whisper segment object
            
        Returns:
            Cleaned segment with only Devanagari characters
        """
        import copy
        import re
        
        # Define Devanagari Unicode range: U+0900 to U+097F
        # Also allow common punctuation and spaces
        # REJECT: Arabic/Urdu, Korean, Chinese, and other non-Hindi scripts
        def is_devanagari_or_allowed(char):
            code = ord(char)
            
            # REJECT Arabic/Urdu script (U+0600-U+06FF)
            if 0x0600 <= code <= 0x06FF:
                return False
            
            # REJECT Korean (Hangul: U+AC00-U+D7AF, Jamo: U+1100-U+11FF)
            if (0xAC00 <= code <= 0xD7AF) or (0x1100 <= code <= 0x11FF):
                return False
            
            # REJECT Chinese (CJK: U+4E00-U+9FFF)
            if 0x4E00 <= code <= 0x9FFF:
                return False
            
            # REJECT Latin alphabet (a-z, A-Z) - Whisper hallucination
            if (0x0041 <= code <= 0x005A) or (0x0061 <= code <= 0x007A):
                return False
            
            # ACCEPT Devanagari range (Hindi script)
            if 0x0900 <= code <= 0x097F:
                return True
            
            # ACCEPT spaces, punctuation, numbers
            if char in ' .,!?।॥0123456789':
                return True
            
            return False
        
        try:
            cleaned_segment = copy.deepcopy(segment)
            
            # Clean main text
            original_text = segment.text
            cleaned_text = ''.join(char for char in original_text if is_devanagari_or_allowed(char))
            cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()  # Normalize whitespace
            
            cleaned_segment.text = cleaned_text if cleaned_text else original_text
            
            # Clean word-level timestamps
            if hasattr(cleaned_segment, 'words') and cleaned_segment.words:
                cleaned_words = []
                for word in cleaned_segment.words:
                    if hasattr(word, 'word'):
                        original_word = word.word
                        cleaned_word_text = ''.join(char for char in original_word if is_devanagari_or_allowed(char))
                        cleaned_word_text = cleaned_word_text.strip()
                        
                        # Only keep words with actual Devanagari content
                        if cleaned_word_text:
                            word.word = cleaned_word_text
                            cleaned_words.append(word)
                
                cleaned_segment.words = cleaned_words
            
            return cleaned_segment
            
        except Exception as e:
            print(f"   Warning: Failed to clean segment: {e}")
            return segment  # Return original on error
    
    def _romanize_to_devanagari(self, segments: List) -> List:
        """
        Convert romanized Hindi (Latin script) to Devanagari script
        Handles cases where Whisper outputs "Jai klaas" instead of "जय क्लास"
        
        Args:
            segments: List of Whisper segments with potentially romanized text
            
        Returns:
            Segments with Devanagari script
        """
        if not TRANSLITERATION_AVAILABLE:
            print("   Warning: Transliteration not available, keeping romanized text")
            return segments
        
        try:
            converted_segments = []
            
            print(f"   Converting {len(segments)} segments from Roman to Devanagari...")
            
            for segment in segments:
                original_text = segment.text
                try:
                    # Check if text is primarily Latin/Roman script
                    latin_chars = sum(1 for c in original_text if ord(c) < 128 and c.isalpha())
                    devanagari_chars = sum(1 for c in original_text if 0x0900 <= ord(c) <= 0x097F)
                    
                    # If more Latin than Devanagari, convert
                    if latin_chars > devanagari_chars:
                        # Convert from ITRANS/Roman to Devanagari
                        converted_text = transliterate(original_text, sanscript.ITRANS, sanscript.DEVANAGARI)
                        
                        import copy
                        converted_segment = copy.deepcopy(segment)
                        converted_segment.text = converted_text
                        
                        # Convert word-level timestamps too
                        if hasattr(converted_segment, 'words') and converted_segment.words:
                            for word in converted_segment.words:
                                if hasattr(word, 'word'):
                                    word_text = word.word
                                    word_latin = sum(1 for c in word_text if ord(c) < 128 and c.isalpha())
                                    if word_latin > 0:
                                        word.word = transliterate(word_text, sanscript.ITRANS, sanscript.DEVANAGARI)
                        
                        converted_segments.append(converted_segment)
                    else:
                        # Already in Devanagari, keep as is
                        converted_segments.append(segment)
                    
                except Exception as e:
                    print(f"   Warning: Failed to convert segment '{original_text[:50]}...': {e}")
                    converted_segments.append(segment)  # Keep original on error
            
            print(f"   Conversion complete: {len(converted_segments)} segments")
            return converted_segments
            
        except Exception as e:
            print(f"   Conversion error: {e}")
            return segments  # Return original on error
    
    def _normalize_to_devanagari(self, segments: List) -> List:
        """
        Normalize mixed script text to consistent Devanagari script
        Handles cases where Whisper outputs mixed Hindi/Urdu/English
        
        Args:
            segments: List of Whisper segments with potentially mixed scripts
            
        Returns:
            Normalized segments with consistent Devanagari script
        """
        if not TRANSLITERATION_AVAILABLE:
            print("   Warning: Transliteration not available, keeping original text")
            return segments
        
        try:
            normalized_segments = []
            
            print(f"   Normalizing {len(segments)} segments to Devanagari script...")
            
            for segment in segments:
                original_text = segment.text
                try:
                    # Detect if text contains Roman/Latin characters
                    has_latin = any(ord(c) < 128 and c.isalpha() for c in original_text)
                    
                    if has_latin:
                        # Try to transliterate from Roman to Devanagari (reverse transliteration)
                        # This handles "Yeh kaun hai" → "यह कौन है"
                        normalized_text = transliterate(original_text, sanscript.ITRANS, sanscript.DEVANAGARI)
                    else:
                        # Already in Devanagari or other script, keep as is
                        normalized_text = original_text
                    
                    # Create normalized segment
                    import copy
                    normalized_segment = copy.deepcopy(segment)
                    normalized_segment.text = normalized_text
                    
                    # Normalize word-level timestamps too
                    if hasattr(normalized_segment, 'words') and normalized_segment.words:
                        for word in normalized_segment.words:
                            if hasattr(word, 'word'):
                                word_text = word.word
                                has_latin_word = any(ord(c) < 128 and c.isalpha() for c in word_text)
                                if has_latin_word:
                                    word.word = transliterate(word_text, sanscript.ITRANS, sanscript.DEVANAGARI)
                    
                    normalized_segments.append(normalized_segment)
                    
                except Exception as e:
                    print(f"   Warning: Failed to normalize segment '{original_text[:50]}...': {e}")
                    normalized_segments.append(segment)  # Keep original on error
            
            print(f"   Normalization complete: {len(normalized_segments)} segments")
            return normalized_segments
            
        except Exception as e:
            print(f"   Normalization error: {e}")
            return segments  # Return original on error
    
    def _generate_complete_clips(
        self,
        viral_clips: List[Dict],
        video_info: Dict,
        layout_mode: str,
        template: str,
        output_dir: str,
        translate_captions: bool = False,
        source_language: str = "en",
        target_language: str = "en"
    ) -> List[Dict[str, Any]]:
        """Generate complete video clips with layout processing and captions"""
        print(f"Generating {len(viral_clips)} complete video clips...")
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        generated_clips = []
        source_video_path = video_info['video_path']
        
        for i, clip in enumerate(viral_clips):
            try:
                print(f"\nProcessing Clip #{i+1} (Score: {clip['score']:.1f})")
                
                # Parse timestamps
                start_time = self._parse_timestamp(clip['start_time'])
                end_time = self._parse_timestamp(clip['end_time'])
                
                # Generate output filename with job_id prefix
                safe_score = str(clip['score']).replace('.', '_')
                if job_id:
                    clip_filename = f"{job_id}_clip_{i+1}_score_{safe_score}_{layout_mode}_{template.lower()}.mp4"
                else:
                    clip_filename = f"viral_clip_{i+1}_score_{safe_score}_{layout_mode}_{template.lower()}.mp4"
                clip_path = os.path.join(output_dir, clip_filename)
                
                # Process complete clip with layout and captions
                # CRITICAL: Pass original segments with word-level timestamps
                clip_segments = clip.get('segments', [])
                result = self._process_complete_clip(
                    source_video_path,
                    start_time,
                    end_time,
                    clip_path,
                    layout_mode,
                    template,
                    clip['transcript'],
                    video_info['temp_dir'],
                    clip_segments,  # Pass segments with word timestamps
                    translate_captions,
                    source_language,
                    target_language
                )
                
                if result:
                    generated_clips.append({
                        "clip_id": i + 1,
                        "score": clip['score'],
                        "filename": clip_filename,
                        "output_path": clip_path,
                        "layout": layout_mode,
                        "template": template,
                        "duration": clip['duration'],
                        "start_time": clip['start_time'],
                        "end_time": clip['end_time'],
                        "transcript": clip['transcript'],
                        "hooks": clip['analysis']['hook_keywords'],
                        "emotion_score": clip['analysis']['emotion_score'],
                        "status": "complete"
                    })
                    
                    print(f"   Generated complete clip: {clip_filename}")
                else:
                    print(f"   Failed to generate clip #{i+1}")
                
            except Exception as e:
                print(f"   Error generating clip #{i+1}: {e}")
                continue
        
        return generated_clips
    
    def _parse_timestamp(self, timestamp_str: str) -> float:
        """Parse timestamp string (HH:MM:SS) to seconds"""
        parts = timestamp_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = int(parts[2])
        return hours * 3600 + minutes * 60 + seconds
    
    def _process_complete_clip(
        self,
        source_video: str,
        start_time: float,
        end_time: float,
        output_path: str,
        layout_mode: str,
        template: str,
        transcript_text: str,
        temp_dir: str,
        clip_segments: List = None,  # CRITICAL: Original segments with word timestamps
        translate_captions: bool = False,
        source_language: str = "en",
        target_language: str = "en"
    ) -> bool:
        """Process a complete clip with layout and captions using existing pipeline"""
        try:
            duration = end_time - start_time
            
            # Step 1: Extract video segment
            print(f"   Extracting segment: {start_time:.1f}s - {end_time:.1f}s")
            segment_path = os.path.join(temp_dir, f"segment_{start_time}_{end_time}.mp4")
            
            ffmpeg_extract_cmd = [
                'ffmpeg', '-y',
                '-i', source_video,
                '-ss', str(start_time),
                '-t', str(duration),
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-crf', '23',
                '-preset', 'fast',
                segment_path
            ]
            
            result = subprocess.run(ffmpeg_extract_cmd, capture_output=True, text=True)
            if result.returncode != 0 or not os.path.exists(segment_path):
                print(f"   Segment extraction failed: {result.stderr}")
                return False
            
            # Step 2: Apply layout processing using existing function
            print(f"   Applying {layout_mode} layout processing...")
            layout_processed_path = os.path.join(temp_dir, f"layout_{layout_mode}_{start_time}_{end_time}.mp4")
            
            try:
                # Use OpusProcessor for layout processing (more reliable)
                self.opus_processor.process_video_for_vertical(
                    segment_path, 
                    layout_processed_path, 
                    blur_strength=10,
                    layout_mode=layout_mode
                )
                print(f"   Layout processing complete")
            except Exception as e:
                print(f"   Layout processing failed: {e}")
                return False
            
            # Step 3: Generate captions using existing OpusProcessor
            print(f"   Generating {template} captions...")
            
            # CRITICAL: Use original segments with word-level timestamps if available
            if clip_segments and len(clip_segments) > 0:
                # Extract original Whisper segments with word timestamps
                # IMPORTANT: Adjust timestamps to be relative to clip start (0s)
                caption_segments = []
                for seg in clip_segments:
                    if hasattr(seg, 'original_segment') and seg.original_segment:
                        # Create a copy of the segment with adjusted timestamps
                        import copy
                        adjusted_seg = copy.deepcopy(seg.original_segment)
                        
                        # Adjust segment timing to start from 0
                        if hasattr(adjusted_seg, 'start'):
                            adjusted_seg.start = adjusted_seg.start - start_time
                            adjusted_seg.end = adjusted_seg.end - start_time
                            
                            # Adjust word-level timestamps too
                            if hasattr(adjusted_seg, 'words') and adjusted_seg.words:
                                for word in adjusted_seg.words:
                                    word.start = word.start - start_time
                                    word.end = word.end - start_time
                        
                        caption_segments.append(adjusted_seg)
                print(f"   Using {len(caption_segments)} segments with REAL word-level timestamps (adjusted to clip timing)")
                
                # Apply translation/transliteration based on target language
                # CRITICAL: Always process if target language is specified
                
                # Check if target is a romanized variant (ends with -Latn)
                if target_language and target_language.endswith('-Latn'):
                    # Transliteration request: Devanagari/native script → Roman script
                    base_lang = target_language.replace('-Latn', '')
                    print(f"   Transliterating captions to Roman script ({base_lang} → {target_language})...")
                    caption_segments = self._transliterate_segments(caption_segments)
                elif translate_captions and target_language and target_language != source_language:
                    # Full translation to different language
                    print(f"   Translating captions from {source_language} to {target_language}...")
                    caption_segments = self._translate_segments(
                        caption_segments,
                        source_language,
                        target_language
                    )
                elif source_language == 'hi' and (not target_language or target_language == 'hi'):
                    # Hindi source, Hindi target: Convert Roman → Devanagari if needed
                    print(f"   Converting to Devanagari script (Hindi)...")
                    caption_segments = self._romanize_to_devanagari(caption_segments)
                else:
                    # No translation/transliteration - keep as is
                    print(f"   Keeping captions in source language: {source_language}")
            else:
                # Fallback: Create estimated transcript segments (poor sync)
                print(f"   WARNING: No word-level timestamps available, using estimated timing")
                words = transcript_text.split()
                words_per_second = len(words) / duration if duration > 0 else 1
                caption_segments = []
                
                # Create segments with word-level timing
                for i, word in enumerate(words):
                    word_start = i / words_per_second
                    word_end = (i + 1) / words_per_second
                    caption_segments.append({
                        "start": word_start,
                        "end": word_end,
                        "text": word
                    })
            
            print(f"   Created {len(caption_segments)} caption segments")
            print(f"   Sample segment: {caption_segments[0] if caption_segments else 'None'}")
            
            try:
                # Generate proper SwipeUp captions using existing system
                ass_content = self.opus_processor.generate_karaoke_captions(
                    caption_segments,
                    template,
                    audio_path=None,
                    layout_mode=layout_mode
                )
                
                # Save ASS file
                ass_path = os.path.join(temp_dir, f"captions_{start_time}_{end_time}.ass")
                with open(ass_path, 'w', encoding='utf-8') as f:
                    f.write(ass_content)
                
                # Debug: Check what was generated
                print(f"   ASS content length: {len(ass_content)} characters")
                print(f"   ASS preview: {ass_content[:500]}...")
                
                # Count dialogue events
                dialogue_count = ass_content.count('Dialogue:')
                print(f"   Dialogue events found: {dialogue_count}")
                
                # Save a copy for inspection
                debug_ass_path = "debug_swipeup_captions.ass"
                with open(debug_ass_path, 'w', encoding='utf-8') as f:
                    f.write(ass_content)
                print(f"   Full ASS saved to: {debug_ass_path}")
                
                print(f"   Captions generated")
            except Exception as e:
                print(f"   Caption generation failed: {e}")
                return False
            
            # Step 4: Burn captions into video using existing method
            print(f"   Burning captions into video...")
            
            try:
                # Ensure output directory exists
                output_dir = os.path.dirname(output_path)
                if not os.path.exists(output_dir):
                    os.makedirs(output_dir, exist_ok=True)
                    print(f"   Created output directory: {output_dir}")
                
                # Use the same caption burning approach from processing.py
                # Change to temp directory for relative path compatibility
                original_cwd = os.getcwd()
                os.chdir(temp_dir)
                
                # Create the nested directory structure in temp directory for FFmpeg
                temp_output_dir = os.path.join(temp_dir, "exports", "clips")
                if not os.path.exists(temp_output_dir):
                    os.makedirs(temp_output_dir, exist_ok=True)
                
                # Copy ASS file with simple name to same directory as input
                simple_ass_name = f"captions.ass"
                simple_ass_path = os.path.join(temp_dir, simple_ass_name)
                
                if os.path.exists(ass_path):
                    with open(ass_path, 'r', encoding='utf-8') as src:
                        with open(simple_ass_path, 'w', encoding='utf-8') as dst:
                            dst.write(src.read())
                
                # Use absolute paths for FFmpeg input/output, relative for ASS
                abs_layout_path = os.path.abspath(layout_processed_path)
                abs_output_path = os.path.abspath(output_path)
                
                # FFmpeg command to burn subtitles (use relative path for ASS file)
                ffmpeg_burn_cmd = [
                    'ffmpeg', '-y',
                    '-i', abs_layout_path,
                    '-vf', f'ass={simple_ass_name}',
                    '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
                    '-c:a', 'copy',
                    abs_output_path
                ]
                
                
                result = subprocess.run(ffmpeg_burn_cmd, capture_output=True, text=True, cwd=temp_dir)
                
                # Restore original working directory
                os.chdir(original_cwd)
                
                # Check if FFmpeg succeeded and output file exists
                if result.returncode == 0:
                    # FFmpeg creates the file with the absolute path we provided
                    if os.path.exists(abs_output_path):
                        print(f"   Captions burned successfully")
                        
                        # Cleanup temporary files
                        for temp_file in [segment_path, layout_processed_path, ass_path, simple_ass_path]:
                            try:
                                if os.path.exists(temp_file):
                                    os.remove(temp_file)
                            except:
                                pass
                        
                        return True
                    else:
                        print(f"   Caption burning failed: Output file not created")
                        print(f"   Expected at: {abs_output_path}")
                        print(f"   FFmpeg stdout: {result.stdout}")
                        print(f"   FFmpeg stderr: {result.stderr}")
                        return False
                else:
                    print(f"   Caption burning failed: FFmpeg returned code {result.returncode}")
                    print(f"   FFmpeg stdout: {result.stdout}")
                    print(f"   FFmpeg stderr: {result.stderr}")
                    return False
                    
            except Exception as e:
                print(f"   Caption burning error: {e}")
                # Restore working directory on error
                try:
                    os.chdir(original_cwd)
                except:
                    pass
                return False
                
        except Exception as e:
            print(f"   Complete clip processing error: {e}")
            return False


# Convenience function for easy usage
def generate_complete_viral_clips_standalone(
    video_url: str,
    layout_mode: str = "auto",
    template: str = "TikTokViral",
    max_clips: int = 5,
    min_score: float = 4.0,
    min_length: int = 30,
    max_length: int = 90,
    target_length: int = 60,
    timeframe_start: int = None,
    timeframe_end: int = None,
    video_language: str = "auto",
    translate_captions: bool = False,
    caption_language: str = "en",
    job_id: str = None
) -> List[Dict[str, Any]]:
    """
    Convenience function to generate complete viral clips
    
    Args:
        video_url: YouTube video URL
        layout_mode: Layout mode (fit, fill, square, auto)
        template: Caption template
        max_clips: Maximum number of clips
        min_score: Minimum viral score
        min_length: Minimum clip length in seconds
        max_length: Maximum clip length in seconds
        target_length: Target clip length in seconds
        
    Returns:
        List of complete generated clips
    """
    generator = CompleteViralClipGenerator(
        min_length=min_length,
        max_length=max_length,
        target_length=target_length
    )
    return generator.generate_complete_viral_clips(
        video_url=video_url,
        layout_mode=layout_mode,
        template=template,
        max_clips=max_clips,
        min_score=min_score,
        min_length=min_length,
        max_length=max_length,
        target_length=target_length,
        timeframe_start=timeframe_start,
        timeframe_end=timeframe_end,
        video_language=video_language,
        translate_captions=translate_captions,
        caption_language=caption_language,
        job_id=job_id
    )


# Example usage and testing
if __name__ == "__main__":
    import argparse
    import json
    
    # Set up command line argument parsing
    parser = argparse.ArgumentParser(description='Generate viral clips from YouTube videos')
    parser.add_argument('--video-url', required=True, help='YouTube video URL')
    parser.add_argument('--layout', choices=['fit', 'fill', 'square', 'auto'], default='auto', help='Video layout mode')
    parser.add_argument('--template', choices=[
        'Karaoke', 'SwipeUp', 'TikTokViral', 'BeastMode', 'Glitch',
        'ComicPop', 'NeonPulse', 'TypeWriter', 'BubblePop', 'BoldPop',
        'HighlightSweep', 'RageMode', 'HypeTrain', 'GlitchStreamer',
        'Cinematic', 'PodcastPro'
    ], default='TikTokViral', help='Caption template')
    parser.add_argument('--max-clips', type=int, default=3, help='Maximum number of clips to generate')
    parser.add_argument('--min-score', type=float, default=4.0, help='Minimum viral score threshold')
    parser.add_argument('--job-id', help='Job ID for tracking progress')
    parser.add_argument('--min-length', type=int, default=30, help='Minimum clip length in seconds')
    parser.add_argument('--max-length', type=int, default=90, help='Maximum clip length in seconds')
    parser.add_argument('--target-length', type=int, default=60, help='Target clip length in seconds')
    parser.add_argument('--timeframe-start', type=int, default=None, help='Start time in seconds for processing timeframe')
    parser.add_argument('--timeframe-end', type=int, default=None, help='End time in seconds for processing timeframe')
    parser.add_argument('--video-language', default='auto', help='Video language code (e.g., hi, en, es) or "auto" for detection')
    parser.add_argument('--translate-captions', action='store_true', help='Enable caption translation')
    parser.add_argument('--caption-language', default='en', help='Target language for captions (e.g., en, hi, es)')
    
    args = parser.parse_args()
    
    # Use command line arguments if provided, otherwise use defaults for testing
    if len(sys.argv) > 1:
        video_url = args.video_url
        layout_mode = args.layout
        template = args.template
        target_clips = args.max_clips
        min_score = args.min_score
        job_id = args.job_id
        min_length = args.min_length
        max_length = args.max_length
        target_length = args.target_length
        timeframe_start = args.timeframe_start
        timeframe_end = args.timeframe_end
        video_language = args.video_language
        translate_captions = args.translate_captions
        caption_language = args.caption_language
    else:
        # Default test configuration
        print("   Testing Complete Viral Clip Generation")
        print("   Layout: auto (AI face detection - fixed memory)")
        print("   Template: TikTokViral (bouncy neon animations)")
        video_url = "https://youtu.be/ZzI9JE0i6Lc?si=kIzBCb1rsLoeqLDD"
        layout_mode = "auto"
        template = "TikTokViral"
        target_clips = 2
        min_score = 4.0
        job_id = None
        min_length = 30
        max_length = 90
        target_length = 60
        timeframe_start = None
        timeframe_end = None
        video_language = "auto"
        translate_captions = False
        caption_language = "en"
    
    # Create status file for job tracking
    def update_status(status, progress=0, stage="", message="", clips=None):
        if job_id:
            status_file = os.path.join("exports", "clips", f"{job_id}_status.json")
            os.makedirs(os.path.dirname(status_file), exist_ok=True)
            
            status_data = {
                "jobId": job_id,
                "status": status,
                "progress": progress,
                "stage": stage,
                "message": message,
                "timestamp": time.time()
            }
            
            if clips:
                status_data["clips"] = clips
            
            with open(status_file, 'w') as f:
                json.dump(status_data, f, indent=2)
    
    try:
        print(f"   Starting Viral Clip Generation")
        print(f"   Video: {video_url}")
        print(f"   Layout: {layout_mode} | Template: {template}")
        print(f"   Target: {target_clips} clips (min score: {min_score})")
        
        if job_id:
            update_status("processing", 10, "Starting", "Initializing viral clip generation...")
        
        clips = generate_complete_viral_clips_standalone(
            video_url=video_url,
            layout_mode=layout_mode,
            template=template,
            max_clips=target_clips,
            min_score=min_score,
            min_length=min_length,
            max_length=max_length,
            target_length=target_length,
            timeframe_start=timeframe_start,
            timeframe_end=timeframe_end,
            video_language=video_language,
            translate_captions=translate_captions,
            caption_language=caption_language,
            job_id=job_id
        )
        
        if clips:
            print(f"\n   SUCCESS! Generated {len(clips)} complete viral clips:")
            for i, clip in enumerate(clips, 1):
                print(f"   {i}. {clip['filename']} (Score: {clip['score']:.1f})")
                print(f"      Layout: {clip['layout']} | Template: {clip['template']}")
                print(f"      Duration: {clip['duration']:.1f}s | Status: {clip['status']}")
            
            if job_id:
                update_status("completed", 100, "Completed", f"Successfully generated {len(clips)} viral clips", clips)
        else:
            print("\n   No clips were generated")
            if job_id:
                update_status("error", 0, "Error", "No clips were generated - video may not have viral moments")
            
    except Exception as e:
        print(f"\n   Error: {e}")
        if job_id:
            # Remove emojis to avoid unicode errors
            error_msg = str(e).encode('ascii', 'ignore').decode('ascii')
            update_status("error", 0, "Error", error_msg)
        import traceback
        traceback.print_exc()
