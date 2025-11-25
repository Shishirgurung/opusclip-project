"""
Opus Clip Processing Module

This module handles the core Opus Clip processing logic for generating
captions with various templates, word-level synchronization, and animation effects.
"""

import re
import math
import os
from typing import Dict, List, Any, Optional
import random

# MoviePy imports moved to function level to avoid FFmpeg dependency issues

# Import simple speaker detection as fallback
try:
    from simple_speaker_detection import (
        detect_speaker_changes_simple, 
        assign_speaker_colors_simple, 
        map_words_to_speakers_simple
    )
    SIMPLE_SPEAKER_DETECTION_AVAILABLE = True
except ImportError:
    SIMPLE_SPEAKER_DETECTION_AVAILABLE = False
from moviepy.video.fx.all import crop, resize
import skimage.filters as filters
import ffmpeg
try:
    from pyannote.audio import Pipeline
    SPEAKER_DIARIZATION_AVAILABLE = True
except ImportError:
    SPEAKER_DIARIZATION_AVAILABLE = False
    print("Warning: pyannote.audio not available. PodcastPro style will use fallback mode.")

# --- Opus Clip Template Definitions ---
OPUS_TEMPLATES = {
    "OpusClipStyle": {
        "name": "OpusClipStyle",
        "description": "Commercial-grade animations",
        "category": "Professional",
        "words_per_line": 3,
        "positions": ["lower_1", "lower_2"],
        "style_def": "Style: Default,Arial Black,144,&H00FFFFFF,&H0000FF00,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,8,3,2,10,10,40,1"
    },
    "SwipeUp": {
        "name": "SwipeUp",
        "description": "Progressive fill with conditional animations",
        "category": "Viral",
        "words_per_line": 3,
        "positions": ["lower_1", "lower_2"],
        "style_def": "Style: Default,Arial Black,144,&H00FFFFFF,&H0000FF00,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,8,3,2,10,10,40,1"
    },
    "Karaoke": {
        "name": "Karaoke",
        "description": "Instant highlighting with scaling effects",
        "category": "Classic",
        "words_per_line": 6,
        "positions": ["bottom_center"],
        "style_def": "Style: Karaoke,Arial Black,120,&H00FFFFFF,&H0000FF00,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,4,4,2,10,10,40,1"
    },
    "BeastMode": {
        "name": "BeastMode",
        "description": "Complex multi-effect animations",
        "category": "Gaming",
        "words_per_line": 4,
        "positions": ["center", "bottom_center", "top_center"],
        "style_def": "Style: BeastMode,Impact,100,&H0000FF00,&H00000000,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,6,0,2,10,10,40,1"
    },
    "TikTokViral": {
        "name": "TikTokViral",
        "description": "Bouncy animations with neon colors",
        "category": "Social",
        "words_per_line": 4,
        "positions": ["bottom_center", "center"],
        "style_def": "Style: TikTokViral,Bangers,130,&H00FF00FF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,7,3,2,10,10,40,1"
    },
    "PodcastPro": {
        "name": "PodcastPro",
        "description": "Clean, professional podcast style",
        "category": "Professional",
        "words_per_line": 8,
        "positions": ["bottom_center"],
        "style_def": "Style: PodcastPro,Open Sans,90,&H00FFFFFF,&H00000000,&H00333333,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,40,1",
        "speaker_colors": ["&H0000FF00&", "&H000000FF&", "&H00FFFFFF&", "&H0000FFFF&"],
        "enable_speaker_detection": True
    },
    "GamerRage": {
        "name": "GamerRage",
        "description": "Explosive gaming reactions",
        "category": "Gaming",
        "words_per_line": 3,
        "positions": ["center", "top_center"],
        "style_def": "Style: GamerRage,Bebas Neue,150,&H0000FFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,10,0,2,10,10,40,1"
    },
    "MinimalChic": {
        "name": "MinimalChic",
        "description": "Clean, modern aesthetic",
        "category": "Lifestyle",
        "words_per_line": 7,
        "positions": ["bottom_center", "top_center"],
        "style_def": "Style: MinimalChic,Helvetica Neue,85,&H00FFFFFF,&H00000000,&H00666666,&H80000000,0,0,0,0,100,100,2,0,1,1,0,2,10,10,40,1"
    },
    "RetroWave": {
        "name": "RetroWave",
        "description": "80s synthwave aesthetic",
        "category": "Retro",
        "words_per_line": 4,
        "positions": ["center", "bottom_center"],
        "style_def": "Style: RetroWave,Orbitron,120,&H00FF00FF,&H0000FFFF,&H00FF0080,&H80000000,-1,0,0,0,100,100,0,0,1,5,4,2,10,10,40,1"
    },
    "NewsBreaking": {
        "name": "NewsBreaking",
        "description": "Urgent news ticker style",
        "category": "News",
        "words_per_line": 6,
        "positions": ["bottom_center"],
        "style_def": "Style: NewsBreaking,Arial,95,&H00FFFFFF,&H000000FF,&H00000000,&H80FF0000,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,40,1"
    },
    "ComedyGold": {
        "name": "ComedyGold",
        "description": "Playful comedy animations",
        "category": "Comedy",
        "words_per_line": 5,
        "positions": ["bottom_center", "center"],
        "style_def": "Style: ComedyGold,Comic Sans MS,110,&H0000FFFF,&H000080FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,3,2,10,10,40,1"
    },
    "TechReview": {
        "name": "TechReview",
        "description": "Modern tech channel style",
        "category": "Tech",
        "words_per_line": 6,
        "positions": ["bottom_center", "center"],
        "style_def": "Style: TechReview,Roboto,100,&H00FFFFFF,&H0000FFFF,&H00333333,&H80000000,0,0,0,0,100,100,0,0,1,3,1,2,10,10,40,1"
    },
    "Glitch": {
        "name": "Glitch",
        "description": "Digital glitch effects",
        "category": "Tech",
        "words_per_line": 3,
        "positions": ["bottom_center"],
        "style_def": "Style: GlitchStyle,Impact,120,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,-1,0,1,5,2,5,10,10,40,1",
        "power_keywords": ["digital", "tech", "system", "error", "glitch", "hack", "code"],
        "auto_keywords": True,
        "reveal_mode": "full",
        "random_chunking": True,
        "min_words_per_line": 1,
        "max_words_per_line": 3
    },
    "Cinematic": {
        "name": "Cinematic",
        "description": "Movie-style captions",
        "category": "Professional",
        "words_per_line": 4,
        "positions": ["cinematic_bottom"],
        "style_def": "Style: CinematicStyle,Lato Bold,100,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,-1,0,1,3,1,2,10,10,20,1",
        "reveal_mode": "full",
        "random_chunking": True,
        "min_words_per_line": 2,
        "max_words_per_line": 4
    },
    "ComicPop": {
        "name": "ComicPop",
        "description": "Comic book style effects",
        "category": "Comedy",
        "words_per_line": 3,
        "positions": ["comic_center"],
        "style_def": "Style: ComicPopStyle,Komika Axis,100,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,-1,0,0,0,100,100,-1,0,1,8,2,2,10,10,15,1",
        "reveal_mode": "full",
        "random_chunking": True,
        "min_words_per_line": 1,
        "max_words_per_line": 3
    },
    "NeonPulse": {
        "name": "NeonPulse",
        "description": "Pulsing neon effects",
        "category": "Tech",
        "words_per_line": 4,
        "positions": ["comic_center"],
        "style_def": "Style: NeonPulseStyle,Orbitron,95,&H00808000,&H00FFBF00,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,2,10,10,20,1",
        "reveal_mode": "full",
        "random_chunking": True,
        "min_words_per_line": 2,
        "max_words_per_line": 4
    },
    "NeonSign": {
        "name": "NeonSign",
        "description": "Neon sign style",
        "category": "Retro",
        "words_per_line": 4,
        "positions": ["{\\an5\\pos(540,880)}"],
        "style_def": "Style: NeonSignStyle,Vegas,52,&H00FF00FF,&H00FFFFFF,&H00000000,&H00FF00FF,-1,0,0,0,100,100,0,0,1,2,0,2,10,10,15,1",
        "reveal_mode": "word_by_word",
        "random_chunking": True,
        "min_words_per_line": 2,
        "max_words_per_line": 4
    },
    "TypeWriter": {
        "name": "TypeWriter",
        "description": "Typewriter style",
        "category": "Retro",
        "words_per_line": 5,
        "positions": ["comic_center"],
        "style_def": "Style: TypeWriterStyle,Consolas,85,&H00FFFFFF,&H0000FF00,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,10,10,15,1",
        "reveal_mode": "progressive",
        "random_chunking": True,
        "min_words_per_line": 4,
        "max_words_per_line": 6
    },
    "BubblePop": {
        "name": "BubblePop",
        "words_per_line": 4,
        "positions": ["comic_center"],
        "style_def": (
            "Style: BubblePopStyle,Comfortaa,95,&H00E6E6FA,&H00FF69B4,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,2,10,10,15,1"
        ),
        "reveal_mode": "bubble",
        "random_chunking": True,
        "min_words_per_line": 3,
        "max_words_per_line": 5
    },
    "BoldPop": {
        "name": "BoldPop",
        "words_per_line": 3,
        "positions": ["{\\an5\\pos(540,800)}"],
        "style_def": (
            "Style: BoldPopStyle,Poppins,90,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,15,0,2,10,10,15,1"
        ),
        "reveal_mode": "word_by_word",
        "random_chunking": True,
        "min_words_per_line": 1,
        "max_words_per_line": 3
    },
    "BounceBox": {
        "name": "BounceBox",
        "words_per_line": 2,
        "positions": ["{\\an5\\pos(540,750)}"],
        "style_def": (
            "Style: BounceBoxStyle,Montserrat,85,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,2,20,20,20,1"
        ),
        "reveal_mode": "word_by_word",
        "random_chunking": True,
        "min_words_per_line": 1,
        "max_words_per_line": 2
    },
    "HighlightSweep": {
        "name": "HighlightSweep",
        "words_per_line": 3,
        "positions": ["{\\an5\\pos(540,780)}"],
        "style_def": (
            "Style: HighlightSweepStyle,Inter,88,&H00000000,&H00000000,&H00FFFFFF,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,15,15,20,1"
        ),
        "reveal_mode": "word_by_word",
        "random_chunking": True,
        "min_words_per_line": 2,
        "max_words_per_line": 3
    },
    "PodcastPro": {
        "name": "PodcastPro",
        "words_per_line": 5,
        "positions": ["{\\an5\\pos(540,850)}"],
        "style_def": (
            "Style: PodcastProStyle,Open Sans,75,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,2,15,15,20,1"
        ),
        "reveal_mode": "speaker_based",
        "speaker_colors": ["&H0000FF00&", "&H000000FF&", "&H00FFFFFF&", "&H0000FFFF&"],  # Green, Red, White, Yellow
        "random_chunking": False,
        "words_per_line": 5
    },
    "CodeFlow": {
        "name": "CodeFlow",
        "words_per_line": 4,
        "positions": ["{\\an5\\pos(540,800)}"],
        "style_def": (
            "Style: CodeFlowStyle,Consolas,85,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00333333,-1,0,0,0,100,100,0,0,1,3,1,2,15,15,20,1"
        ),
        "reveal_mode": "code_typing",
        "code_colors": {
            "keyword": "&H00FF6B35&",      # Orange for keywords
            "string": "&H0098FB98&",       # Light green for strings
            "number": "&H00FFD700&",       # Gold for numbers
            "comment": "&H00808080&",      # Gray for comments
            "default": "&H00FFFFFF&"       # White for default text
        },
        "typing_speed": 80,  # milliseconds per character
        "cursor_blink": True,
        "syntax_highlight": True,
        "random_chunking": True,
        "min_words_per_line": 2,
        "max_words_per_line": 5
    },
    "RageMode": {
        "name": "RageMode",
        "words_per_line": 3,
        "positions": ["{\\an5\\pos(540,800)}"],
        "style_def": (
            "Style: RageModeStyle,Impact,120,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,8,0,2,15,15,20,1"
        ),
        "reveal_mode": "rage_slam",
        "rage_colors": ["&H000000FF&", "&H0000FFFF&", "&H000080FF&"],  # Red, Orange, Dark Orange
        "intensity_words": ["what", "bro", "no", "way", "damn", "yo", "man", "dude", "bruh", "fire", "crazy", "insane"],
        "max_scale": 150,  # 150% scale for slam effect
        "shake_intensity": 5,
        "random_chunking": True,
        "min_words_per_line": 1,
        "max_words_per_line": 4
    },
    "HypeTrain": {
        "name": "HypeTrain",
        "words_per_line": 4,
        "positions": ["{\\an5\\pos(540,800)}"],
        "style_def": (
            "Style: HypeTrainStyle,Arial Black,110,&H00FFFFFF,&H00FF00FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,6,0,2,15,15,20,1"
        ),
        "reveal_mode": "train_slide",
        "rainbow_colors": ["&H000000FF&", "&H0000FFFF&", "&H0000FF00&", "&H00FF00FF&", "&H00FFFF00&", "&H00FF0080&"],  # Red, Orange, Green, Magenta, Yellow, Purple
        "momentum_words": ["let's", "go", "yes", "wow", "amazing", "incredible", "poggers", "sheesh", "W", "chat", "viewers"],
        "slide_distance": 200,  # pixels to slide from
        "momentum_boost": True,
        "random_chunking": True,
        "min_words_per_line": 2,
        "max_words_per_line": 5
    },
    "GlitchStreamer": {
        "name": "GlitchStreamer",
        "words_per_line": 3,
        "positions": ["{\\an5\\pos(540,800)}"],
        "style_def": (
            "Style: GlitchStreamerStyle,Courier New,100,&H00FFFFFF,&H0000FF00,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,2,15,15,20,1"
        ),
        "reveal_mode": "rgb_glitch",
        "glitch_colors": ["&H000000FF&", "&H0000FF00&", "&H00FF0000&"],  # Red, Green, Blue (RGB split)
        "error_words": ["error", "failed", "crashed", "lag", "disconnect", "bug", "glitch", "broken", "rip", "oof"],
        "static_intensity": 3,
        "rgb_offset": 5,  # pixels for RGB split
        "random_chunking": True,
        "min_words_per_line": 1,
        "max_words_per_line": 4
    },
    "BeastMode": {
        "name": "BeastMode",
        "words_per_line": 2,
        "positions": ["{\\an5\\pos(540,800)}"],
        "style_def": (
            "Style: BeastModeStyle,Impact,160,&H00FFFFFF,&H0000FF00,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,12,0,2,15,15,20,1"
        ),
        "reveal_mode": "beast_impact",
        "money_colors": ["&H0000FF00&", "&H0000FFFF&", "&H00FFD700&"],  # Green, Yellow, Gold (money theme)
        "impact_words": ["million", "thousand", "dollars", "money", "win", "winner", "challenge", "impossible", "insane", "crazy"],
        "max_scale": 200,  # 200% scale for maximum impact
        "explosion_particles": True,
        "drop_shadow": True,
        "random_chunking": False,  # Keep consistent for impact
        "min_words_per_line": 1,
        "max_words_per_line": 3
    }
}

# This is a new dictionary to hold the style definitions separately.
CAPTION_STYLES = {
    "Default": "Style: Default,Arial Black,144,&H00FFFFFF,&H0000FF00,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,8,3,2,10,10,40,1",
    "Karaoke": "Style: Karaoke,Arial Black,120,&H00FFFFFF,&H0000FF00,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,4,4,2,10,10,40,1",
    "BeastStyle": "Style: BeastStyle,Komika Axis,50,&H00FFFFFF,&H00FFFF00,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,16,2,2,10,10,40,1"
}

# Animation styles for different effects
OPUS_ANIMATION_STYLES = {
    "fade_in": "\\fad(300,0)",
    "fade_out": "\\fad(0,300)",
    "slide_up": "\\move(540,960,540,540)",
    "slide_down": "\\move(540,360,540,540)",
    "zoom_in": "\\t(\\fscx120\\fscy120)\\t(300,600,\\fscx100\\fscy100)",
    "bounce": "\\t(0,150,\\fscx110\\fscy110)\\t(150,300,\\fscx100\\fscy100)",
    "glow": "\\3c&H00FFFF&\\t(0,500,\\3c&H000000&)",
    "shake": "\\t(0,100,\\frx5)\\t(100,200,\\frx-5)\\t(200,300,\\frx0)"
}

# Default highlight colors for different content types
DEFAULT_HIGHLIGHT_COLORS = {
    "keyword": "&H0000FFFF&",      # Yellow for keywords
    "emphasis": "&H000080FF&",     # Orange for emphasis
    "question": "&H00FF8080&",     # Light blue for questions
    "exclamation": "&H008080FF&",  # Light red for exclamations
    "number": "&H0080FF80&",       # Light green for numbers
    "default": "&H00FFFFFF&"       # White for default
}

class OpusProcessor:
    def __init__(self):
        self.speaker_pipeline = None
        if SPEAKER_DIARIZATION_AVAILABLE:
            try:
                # Initialize speaker diarization pipeline
                self.speaker_pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
            except Exception as e:
                print(f"Warning: Could not load speaker diarization model: {e}")
                self.speaker_pipeline = None
        # Merge both template definitions, with enhanced versions taking priority
        self.templates = OPUS_TEMPLATES.copy()
        
        # Override with enhanced BeastMode template
        enhanced_beastmode = {
            "name": "BeastMode",
            "description": "Complex multi-effect animations",
            "category": "Gaming",
            "words_per_line": 2,  # Fewer words for more impact
            "positions": ["center", "bottom_center", "top_center"],
            "style_def": "Style: BeastMode,Impact,160,&H00FFFFFF,&H0000FF00,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,12,0,2,15,15,20,1",
            "money_colors": ["&H0000FF00&", "&H0000FFFF&", "&H00FFD700&"],  # Green, Yellow, Gold
            "impact_words": ["million", "thousand", "dollars", "money", "win", "winner", "challenge", "impossible", "insane", "crazy", "what", "how", "why", "amazing", "incredible"],
            "max_scale": 200,
            "explosion_particles": True,
            "drop_shadow": True
        }
        self.templates["BeastMode"] = enhanced_beastmode

    def detect_speakers(self, audio_file_path: str):
        """Detect speakers in audio file and return speaker segments"""
        if not self.speaker_pipeline:
            print("Speaker diarization not available, using fallback mode")
            return None
        
        try:
            print("Detecting speakers in audio...")
            diarization = self.speaker_pipeline(audio_file_path)
            
            # Convert to list of speaker segments
            speaker_segments = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                speaker_segments.append({
                    'start': turn.start,
                    'end': turn.end,
                    'speaker': speaker
                })
            
            print(f"Detected {len(set(seg['speaker'] for seg in speaker_segments))} unique speakers")
            return speaker_segments
            
        except Exception as e:
            print(f"Error in speaker detection: {e}")
            return None

    def assign_speaker_colors(self, speaker_segments, template):
        """Assign consistent colors to each speaker"""
        if not speaker_segments:
            return {}
        
        unique_speakers = list(set(seg['speaker'] for seg in speaker_segments))
        base_colors = template.get('speaker_colors', ["&H0000FF00&", "&H000000FF&", "&H00FFFFFF&", "&H0000FFFF&"])
        
        speaker_color_map = {}
        import random
        
        for i, speaker in enumerate(unique_speakers):
            if i < len(base_colors):
                speaker_color_map[speaker] = base_colors[i]
            else:
                # Generate random bright colors for additional speakers
                random_colors = ["&H00FF00FF&", "&H0000FFFF&", "&H00FF8000&", "&H008000FF&", "&H00FFFF80&"]
                speaker_color_map[speaker] = random.choice(random_colors)
        
        return speaker_color_map

    def get_word_speaker(self, word_start, word_end, speaker_segments):
        """Find which speaker is talking during a specific word"""
        if not speaker_segments:
            return None
        
        # Find speaker segment that overlaps with word timing
        for segment in speaker_segments:
            if (word_start >= segment['start'] and word_start <= segment['end']) or \
               (word_end >= segment['start'] and word_end <= segment['end']) or \
               (word_start <= segment['start'] and word_end >= segment['end']):
                return segment['speaker']
        
        return None

    def format_time(self, seconds: float) -> str:
        """Formats seconds into ASS time format 0:00:00.00"""
        m, s = divmod(seconds, 60)
        h, m = divmod(m, 60)
        return f"{int(h):d}:{int(m):02d}:{s:05.2f}"

    def create_ass_header(self, style_def: str) -> str:
        """Creates the ASS file header with styles.

        Includes Default and Karaoke styles plus the template-provided style_def
        so that each template can inject its own style (e.g., BeastStyle).
        """
        styles_section = (
            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            "Style: Default,Arial Black,128,&H00FFFFFF,&H0000FF00,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,6,2,2,10,10,30,1\n"
            "Style: Karaoke,Arial Black,120,&H00FFFFFF,&H0000FF00,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,4,4,2,10,10,40,1\n"
            f"{style_def}\n"
        )
        return (
            f"[Script Info]\nTitle: OpusClip Style Captions\nScriptType: v4.00+\n"
            f"PlayResX: 1080\nPlayResY: 1920\n\n"
            f"{styles_section}\n\n"
            f"[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        )

    def create_ass_event(self, text: str, start_time: str, end_time: str, style_name: str, position: str, layer: int = 0) -> str:
        """Creates a single ASS dialogue event with specified position and optional layer."""
        # Final corrected layout for the lower third of the screen
        if position == 'lower_1':
            pos_tags = f"{{\\an2\\pos(540,1200)}}"  # Much higher and more visible
        elif position == 'lower_2':
            pos_tags = f"{{\\an2\\pos(540,1350)}}"  # Much higher and more visible
        elif position == 'bottom_center':
            pos_tags = f"{{\\an2\\pos(540,1750)}}"  # Bottom center for Karaoke style
        elif position == 'beast_center':
            pos_tags = f"{{\\an2\\pos(540,1560)}}"  # Slightly above bottom, tuned position
        elif position == 'glitch_center':
            pos_tags = f"{{\\an2\\pos(540, 1560)}}"  # Lower-third position
        elif position == 'cinematic_bottom':
            pos_tags = f"{{\\an2\\pos(540, 1800)}}"  # Very bottom of the screen
        elif position == 'comic_center':
            pos_tags = f"{{\\an2\\pos(540, 1560)}}"  # Classic bottom-center
        elif position == 'upper_1':
            pos_tags = f"{{\\an8\\pos(540, 200)}}"
        elif position == 'upper_2':
            pos_tags = f"{{\\an8\\pos(540, 350)}}"
        elif position == 'neon_upper':
            pos_tags = f"{{\\an2\\pos(540, 800)}}"
        else:
            # Check if position is already a formatted position string (e.g., "{\an5\pos(540,1600)}")
            if position.startswith('{') and 'pos(' in position:
                pos_tags = position  # Use the position string directly
            else:
                # Fallback to true center for unrecognized position names
                pos_tags = f"{{\\an5\\pos(540,960)}}"
        return f"Dialogue: {layer},{start_time},{end_time},{style_name},,0,0,0,,{pos_tags}{text}"

    def extract_word_timestamps(self, segment: Any) -> List[Dict[str, Any]]:
        """Extracts word-level timestamps from a whisper segment with fallback."""
        # Check if segment has word-level timestamps
        if hasattr(segment, 'words') and segment.words:
            # Use actual word-level timestamps from Whisper
            words = [{'word': w.word, 'start': w.start, 'end': w.end} for w in segment.words]
            # Debug: Print first word timing for verification
            if words and not hasattr(self, '_word_timing_logged'):
                print(f"[OK] Using REAL word-level timestamps: '{words[0]['word']}' at {words[0]['start']:.2f}s")
                self._word_timing_logged = True
            return words
        
        # Fallback: estimate word timing from sentence timing
        if hasattr(segment, 'text') and hasattr(segment, 'start') and hasattr(segment, 'end'):
            words = segment.text.strip().split()
            if not words:
                return []
            
            # Estimate timing by dividing segment duration equally among words
            segment_duration = segment.end - segment.start
            word_duration = segment_duration / len(words)
            
            estimated_words = []
            for i, word in enumerate(words):
                word_start = segment.start + (i * word_duration)
                word_end = word_start + word_duration
                estimated_words.append({
                    'word': word,
                    'start': word_start,
                    'end': word_end
                })
            
            if not hasattr(self, '_estimation_warning_logged'):
                print(f"[WARNING] Using ESTIMATED word timing (no word-level data from Whisper)")
                print(f"   This will cause poor audio-caption sync!")
                self._estimation_warning_logged = True
            return estimated_words
        
        return []

    def get_beast_neon_color(self, word: str, template: Dict[str, Any]) -> str:
        """Determines the neon color for Beast style based on word impact."""
        neon_colors = template.get('neon_colors', {})
        
        # Power keywords get electric colors
        if word in template.get('power_keywords', []):
            # Cycle through neon colors for power words
            colors = list(neon_colors.values())
            return colors[hash(word) % len(colors)] if colors else '&H0000FFFF'
        
        # Numbers and special words get hot pink
        elif word.isdigit() or len(word) <= 2:
            return neon_colors.get('hot_pink', '&H00FF00FF')
            
        # Default bright white for regular words
        else:
            return '&H00FFFFFF'

    def chunk_words(self, segments: List[Dict[str, Any]], chunk_size: int) -> List[Dict[str, Any]]:
        """Chunks words from all segments into lines of a specific size."""
        all_words = []
        for segment in segments:
            # Check if this is a dictionary (word-level segment)
            if isinstance(segment, dict) and 'text' in segment and 'start' in segment and 'end' in segment:
                # This is already a word-level segment, use it directly
                all_words.append({'word': segment['text'], 'start': segment['start'], 'end': segment['end']})
            else:
                # This is a Whisper Segment object, extract words
                all_words.extend(self.extract_word_timestamps(segment))
        
        word_chunks = []
        for i in range(0, len(all_words), chunk_size):
            chunk = all_words[i:i + chunk_size]
            if chunk:
                word_chunks.append({'words': chunk})
        return word_chunks

    def create_beast_mode_phrases(self, segments: List[Dict[str, Any]], target_words_per_phrase: int) -> List[Dict[str, Any]]:
        """Create phrase-level chunks for BeastMode with proper timing and impact"""
        all_words = []
        for segment in segments:
            # Check if this is a dictionary (word-level segment)
            if isinstance(segment, dict) and 'text' in segment and 'start' in segment and 'end' in segment:
                # This is already a word-level segment, use it directly
                all_words.append({'word': segment['text'], 'start': segment['start'], 'end': segment['end']})
            else:
                # This is a Whisper Segment object, extract words
                all_words.extend(self.extract_word_timestamps(segment))
        
        phrase_chunks = []
        i = 0
        while i < len(all_words):
            # Create phrases with 1-3 words for maximum impact
            phrase_size = min(target_words_per_phrase, len(all_words) - i)
            phrase_words = all_words[i:i + phrase_size]
            
            if phrase_words:
                # Extend timing for dramatic effect - each phrase gets minimum 1.2 seconds
                phrase_start = phrase_words[0]['start']
                phrase_end = phrase_words[-1]['end']
                phrase_duration = phrase_end - phrase_start
                
                # Ensure minimum duration for BeastMode impact
                min_phrase_duration = 1.2
                if phrase_duration < min_phrase_duration:
                    # Extend the end time, but check for next phrase
                    next_phrase_start = None
                    if i + phrase_size < len(all_words):
                        next_phrase_start = all_words[i + phrase_size]['start']
                    
                    if next_phrase_start is not None:
                        # Don't overlap with next phrase, leave 0.2s gap
                        max_end = next_phrase_start - 0.2
                        phrase_end = min(phrase_start + min_phrase_duration, max_end)
                    else:
                        phrase_end = phrase_start + min_phrase_duration
                    
                    # Update the last word's end time
                    phrase_words[-1]['end'] = phrase_end
                
                phrase_chunks.append({'words': phrase_words})
            
            i += phrase_size
        
        return phrase_chunks

    def chunk_words_variable(self, segments: List[Dict[str, Any]], min_w: int, max_w: int) -> List[Dict[str, Any]]:
        """Chunks words into variable-sized lines between min_w and max_w (weighted: prefer 2–3 words)."""
        all_words = []
        for segment in segments:
            all_words.extend(self.extract_word_timestamps(segment))

        i = 0
        n = len(all_words)
        chunks: List[Dict[str, Any]] = []
        prev_size = None
        while i < n:
            # Weighted size: 3 (0.5), 2 (0.4), 1 (0.1); avoid 1 twice in a row
            weights = [(3, 0.5), (2, 0.4), (1, 0.1)]
            choices, probs = zip(*weights)
            size = random.choices(choices, probs)[0]
            if prev_size == 1 and size == 1:
                size = 2
            size = max(min_w, min(max_w, size))
            chunk = all_words[i:i + size]
            if chunk:
                chunks.append({"words": chunk})
            i += size
            prev_size = size
        return chunks

    def adjust_template_for_layout(self, template: Dict[str, Any], layout_mode: str) -> Dict[str, Any]:
        """Adjust caption positioning based on video layout mode."""
        template_copy = template.copy()
        
        if layout_mode.lower() == "fit":
            # Fit mode: Video fits within canvas, captions at bottom (recommended)
            # Safe zone positioning to avoid blur areas
            template_copy['positions'] = ["{\\an5\\pos(540,1600)}"]  # Bottom center safe zone
            
        elif layout_mode.lower() == "square":
            # Square mode: Video centered as square, same caption positioning as fit
            # Both modes may have blur areas above and below
            template_copy['positions'] = ["{\\an5\\pos(540,1600)}"]  # Same as fit mode
            
        elif layout_mode.lower() == "fill":
            # Fill mode: Bottom positioning since entire canvas is filled
            template_copy['positions'] = ["{\\an5\\pos(540,1600)}"]  # Bottom area
            
        elif layout_mode.lower() == "auto":
            # Auto mode: Bottom positioning, face-centered video leaves bottom space
            template_copy['positions'] = ["{\\an5\\pos(540,1600)}"]  # Bottom area
            
        else:
            # Default: Use original template positioning
            pass
            
        return template_copy

    def get_code_syntax_color(self, word: str, color_map: Dict[str, str]) -> str:
        """Apply syntax highlighting colors to words based on programming context."""
        word_lower = word.lower().strip()
        
        # Java/Programming keywords
        keywords = {
            'public', 'private', 'protected', 'static', 'final', 'class', 'interface',
            'extends', 'implements', 'import', 'package', 'void', 'int', 'string',
            'boolean', 'double', 'float', 'char', 'byte', 'short', 'long',
            'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
            'continue', 'return', 'try', 'catch', 'finally', 'throw', 'throws',
            'new', 'this', 'super', 'null', 'true', 'false', 'java', 'javascript'
        }
        
        # Check for different syntax elements
        if word_lower in keywords:
            return color_map.get('keyword', color_map['default'])
        elif word.startswith('"') or word.endswith('"') or word.startswith("'") or word.endswith("'"):
            return color_map.get('string', color_map['default'])
        elif word.isdigit() or (word.replace('.', '').isdigit() and word.count('.') <= 1):
            return color_map.get('number', color_map['default'])
        elif word.startswith('//') or word.startswith('/*') or word.startswith('*'):
            return color_map.get('comment', color_map['default'])
        else:
            return color_map.get('default', '&H00FFFFFF&')

    def generate_karaoke_captions(self, segments: List[Dict[str, Any]], template_name: str, audio_path: Optional[str] = None, layout_mode: str = "fit") -> str:
        template = self.templates.get(template_name)
        if not template:
            raise ValueError(f"Template '{template_name}' not found.")

        ass_header = self.create_ass_header(template['style_def'])
        events = []
        
        # Get layout-specific positioning
        template = self.adjust_template_for_layout(template, layout_mode)
        
        # Default chunking
        word_chunks = self.chunk_words(segments, template['words_per_line'])
        
        # Handle different template styles
        if template_name == "Karaoke":
            # Karaoke style: instant color highlighting with smooth scaling animation
            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]
                
                # Create separate events for each word to achieve proper timing and scaling
                for i in range(len(chunk['words'])):
                    word_info = chunk['words'][i]
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    word_duration_ms = max(100, (word_end_s - word_start_s) * 1000)

                    # Event duration: exactly the word's duration for proper scaling timing
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)

                    # Calculate smooth easing durations
                    ease_in_duration = min(100, word_duration_ms // 4)  # 25% or 100ms max for ease-in
                    ease_out_start = max(ease_in_duration, word_duration_ms - 100)  # Start ease-out
                    
                    # Build line with current word highlighted and scaled, others normal
                    line_text = ""
                    for j, w_info in enumerate(chunk['words']):
                        current_word_text = w_info['word'].strip().upper()  # Uppercase
                        if i == j:
                            # Current word: green highlight + smooth scaling (1.0 -> 1.25 -> 1.0)
                            scale_animation = fr"\t(0,{ease_in_duration},\fscx125,\fscy125)\t({ease_out_start},{word_duration_ms},\fscx100,\fscy100)"
                            line_text += f"{{\\1c&H00FF00&{scale_animation}}}{current_word_text}{{\\1c&HFFFFFF&}} "
                        else:
                            # Other words: white, normal scale (1.0)
                            line_text += f"{{\\fscx100\\fscy100}}{current_word_text} "

                    event = self.create_ass_event(line_text.strip(), start_time, end_time, "Default", position)
                    events.append(event)
                    
                # Add transition events between words to ensure smooth reset
                for i in range(len(chunk['words']) - 1):
                    current_word = chunk['words'][i]
                    next_word = chunk['words'][i + 1]
                    
                    # Small gap between words for smooth transition
                    gap_start_s = current_word['end']
                    gap_end_s = next_word['start']
                    
                    if gap_end_s > gap_start_s:  # Only if there's actually a gap
                        gap_start_time = self.format_time(gap_start_s)
                        gap_end_time = self.format_time(gap_end_s)
                        
                        # Show all words in normal state during gap
                        gap_text = ""
                        for w_info in chunk['words']:
                            word_text = w_info['word'].strip().upper()
                            gap_text += f"{{\\fscx100\\fscy100}}{word_text} "
                        
                        gap_event = self.create_ass_event(gap_text.strip(), gap_start_time, gap_end_time, "Default", position)
                        events.append(gap_event)
        elif template_name == "Glitch":
            style_name = "GlitchStyle"
            power = set([w.lower() for w in template.get('power_keywords', [])])
            reveal_mode = template.get('reveal_mode', 'full')
            
            # Use standard chunking for Glitch template (variable chunking has issues with word-level segments)
            word_chunks = self.chunk_words(segments, template['words_per_line'])

            def is_power_word(w: str) -> bool:
                wl = w.strip().lower()
                if wl in power:
                    return True
                if not template.get('auto_keywords', False):
                    return False
                return (w.isdigit() or len(w) >= 6 or (w[:1].isalpha() and w[:1].upper() == w[:1] and w[1:].islower()))

            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]

                for i in range(len(chunk['words'])):
                    word_info = chunk['words'][i]
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)

                    words_to_render = chunk['words']
                    active_index = i

                    # Identify if active word is a keyword
                    active_word_raw = words_to_render[active_index]['word']
                    active_is_keyword = is_power_word(active_word_raw)

                    # Build line with fade-in and glitch effect on active word
                    line_prefix = f"{{\\fad(200,100)}}"
                    line_text = ""
                    for j, w_info in enumerate(words_to_render):
                        w_text = w_info['word'].strip().upper()
                        is_active = (j == active_index)

                        if is_active and active_is_keyword:
                            # Active keyword: purple color flash and glitch animation
                            glitch_anim = fr"\t(0,50,\frx-7)\t(50,100,\frx7)\t(100,150,\frx0)"
                            color_flash = "\\1c&HFF009D&" # Electric Purple
                            line_text += f"{{{color_flash}{glitch_anim}}}{w_text} "
                        else:
                            # Inactive words: default style (white)
                            line_text += f"{{\\r}}{w_text} "

                    full_line = f"{line_prefix}{line_text.strip()}"
                    event = self.create_ass_event(full_line, start_time, end_time, style_name, position)
                    events.append(event)

        elif template_name == "Cinematic":
            style_name = "CinematicStyle"
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, int(template.get('min_words_per_line', 2)), int(template.get('max_words_per_line', 4)))
            else:
                word_chunks = self.chunk_words_by_line(segments, template['words_per_line'])

            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]

                for i in range(len(chunk['words'])):
                    word_info = chunk['words'][i]
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)

                    words_to_render = chunk['words']
                    active_index = i

                    # Build line with fade-in, transparency, and drift-up animation
                    line_prefix = f"{{\\fad(300,200)}}" # Gentle fade
                    line_text = ""
                    for j, w_info in enumerate(words_to_render):
                        # Use original word case, no .upper()
                        w_text = w_info['word'].strip()
                        is_active = (j == active_index)

                        if is_active:
                            # Active word: fully opaque, drifts up
                            drift_anim = fr"\t(\move(x,y,x,y-10,0,300))"
                            line_text += f"{{\\alpha&H00&{drift_anim}}}{w_text} "
                        else:
                            # Inactive words: semi-transparent
                            line_text += f"{{\\alpha&H88&}}{w_text} "

                    full_line = f"{line_prefix}{line_text.strip()}"
                    event = self.create_ass_event(full_line, start_time, end_time, style_name, position)
                    events.append(event)
        
        elif template_name == "ComicPop":
            style_name = "ComicPopStyle"
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, int(template.get('min_words_per_line', 1)), int(template.get('max_words_per_line', 3)))
            else:
                word_chunks = self.chunk_words_by_line(segments, template['words_per_line'])

            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]

                for i in range(len(chunk['words'])):
                    word_info = chunk['words'][i]
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    word_duration_ms = max(150, int((word_end_s - word_start_s) * 1000))
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)

                    words_to_render = chunk['words']
                    active_index = i

                    # Build line with angled text and pop animation
                    line_prefix = f"{{\\frz-7\\fad(150,100)}}"
                    line_text = ""
                    for j, w_info in enumerate(words_to_render):
                        w_text = w_info['word'].strip().upper()
                        is_active = (j == active_index)

                        if is_active:
                            # Active word: gradient color (yellow-to-green) and bouncy pop
                            bop_anim = fr"\t(0,150,\fscx125\fscy125\2c&H00FFFF&)\t(150,{word_duration_ms},\fscx100\fscy100\2c&H00FF00&)"
                            line_text += f"{{\1c&H00FFFFFF&{bop_anim}}}{w_text} "
                        else:
                            # Inactive words: default style (white)
                            line_text += f"{{\\r}}{w_text} "

                    full_line = f"{line_prefix}{line_text.strip()}"
                    event = self.create_ass_event(full_line, start_time, end_time, style_name, position)
                    events.append(event)
        
        elif template_name == "NeonPulse":
            style_name = "NeonPulseStyle"
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, int(template.get('min_words_per_line', 2)), int(template.get('max_words_per_line', 4)))
            else:
                word_chunks = self.chunk_words_by_line(segments, template['words_per_line'])

            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]

                for i in range(len(chunk['words'])):
                    word_info = chunk['words'][i]
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    word_duration_ms = max(200, int((word_end_s - word_start_s) * 1000))
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)

                    words_to_render = chunk['words']
                    active_index = i

                    # Build line with neon glow and pulse effect
                    line_prefix = f"{{\\fad(250,150)\\blur3}}"
                    line_text = ""
                    for j, w_info in enumerate(words_to_render):
                        w_text = w_info['word'].strip().upper()
                        is_active = (j == active_index)

                        if is_active:
                            # Active word: bright electric blue with pulse effect
                            pulse_anim = fr"\t(0,{word_duration_ms//3},\1c&H00FFBF00&\3c&H00FFBF00&)\t({word_duration_ms//3},{word_duration_ms*2//3},\1c&H00FF8000&\3c&H00FF8000&)\t({word_duration_ms*2//3},{word_duration_ms},\1c&H00FFBF00&\3c&H00FFBF00&)"
                            line_text += f"{{\\1c&H00808000&{pulse_anim}}}{w_text} "
                        else:
                            # Inactive words: dark cyan with subtle glow
                            line_text += f"{{\\1c&H00808000&\\3c&H00404040&}}{w_text} "

                    full_line = f"{line_prefix}{line_text.strip()}"
                    event = self.create_ass_event(full_line, start_time, end_time, style_name, position)
                    events.append(event)
        
        elif template_name == "TypeWriter":
            style_name = "TypeWriterStyle"
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, int(template.get('min_words_per_line', 4)), int(template.get('max_words_per_line', 6)))
            else:
                word_chunks = self.chunk_words_by_line(segments, template['words_per_line'])

            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]

                # TypeWriter style: Words appear progressively (true typewriter effect)
                for word_idx, word_info in enumerate(chunk['words']):
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    start_time = self.format_time(word_start_s)
                    
                    # End time: either when next word starts or word ends
                    if word_idx + 1 < len(chunk['words']):
                        next_word_start = chunk['words'][word_idx + 1]['start']
                        end_time = self.format_time(next_word_start - 0.01)
                    else:
                        # Last word in chunk - check if there's a next chunk
                        if chunk_idx + 1 < len(word_chunks):
                            next_chunk_start = word_chunks[chunk_idx + 1]['words'][0]['start']
                            end_time = self.format_time(next_chunk_start - 0.01)
                        else:
                            end_time = self.format_time(word_end_s + 0.5)
                    
                    # Build progressive text (all words up to current one)
                    line_text = ""
                    for i in range(word_idx + 1):
                        w_text = chunk['words'][i]['word'].strip()
                        if i == word_idx:  # Current word being typed
                            line_text += f"{{\\1c&H00FFFFFF&}}{w_text}{{\\1c&H0000FF00&}}|"
                        else:  # Already typed words
                            line_text += f"{{\\1c&H00CCCCCC&}}{w_text} "
                    
                    full_line = line_text.strip()
                    event = self.create_ass_event(full_line, start_time, end_time, style_name, position)
                    events.append(event)
        
        elif template_name == "BubblePop":
            style_name = "BubblePopStyle"
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, int(template.get('min_words_per_line', 3)), int(template.get('max_words_per_line', 5)))
            else:
                word_chunks = self.chunk_words_by_line(segments, template['words_per_line'])

            import random
            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]

                # BubblePop style: Single event per word with combined float + pop effect
                for word_idx, word_info in enumerate(chunk['words']):
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    start_time = self.format_time(word_start_s)
                    
                    # Calculate end time to avoid overlap with next word
                    if word_idx + 1 < len(chunk['words']):
                        next_word_start = chunk['words'][word_idx + 1]['start']
                        end_time = self.format_time(next_word_start - 0.01)
                    else:
                        # Last word in chunk - check if there's a next chunk
                        if chunk_idx + 1 < len(word_chunks):
                            next_chunk_start = word_chunks[chunk_idx + 1]['words'][0]['start']
                            end_time = self.format_time(next_chunk_start - 0.01)
                        else:
                            end_time = self.format_time(word_end_s + 0.5)
                    
                    w_text = word_info['word'].strip()
                    word_duration_ms = max(300, int((word_end_s - word_start_s) * 1000))
                    
                    # Random floating direction for each word
                    directions = [
                        "\\move(400,1000,540,900)",  # from bottom
                        "\\move(100,900,540,900)",   # from left
                        "\\move(980,900,540,900)",   # from right
                        "\\move(540,800,540,900)"    # from top
                    ]
                    move_effect = random.choice(directions)
                    
                    # Single event with combined float + pop effect
                    bubble_scale = fr"\\t(0,150,\\fscx130\\fscy130)\\t(150,{word_duration_ms-100},\\fscx110\\fscy110)\\t({word_duration_ms-100},{word_duration_ms},\\fscx100\\fscy100)"
                    bubble_color = fr"\\t(0,100,\\1c&H00FF69B4&)\\t({word_duration_ms-200},{word_duration_ms},\\1c&H00E6E6FA&)"
                    bubble_shake = fr"\\t(0,100,\\frx2)\\t(100,200,\\frx-1)\\t(200,300,\\frx0)"
                    
                    bubble_line = f"{{\\1c&H00E6E6FA&\\fad(150,100){move_effect}{bubble_scale}{bubble_color}{bubble_shake}}}{w_text}"
                    bubble_event = self.create_ass_event(bubble_line, start_time, end_time, style_name, position)
                    events.append(bubble_event)
        
        elif template_name == "BoldPop":
            style_name = "BoldPopStyle"
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, int(template.get('min_words_per_line', 1)), int(template.get('max_words_per_line', 3)))
            else:
                word_chunks = self.chunk_words_by_line(segments, template['words_per_line'])

            import random
            accent_colors = ["&H0000FFFF&", "&H0000FF00&", "&H00FFFF00&"]  # Yellow, Green, Cyan
            
            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]

                # BoldPop style: Bold white text with colored accent words and pop animation
                for word_idx, word_info in enumerate(chunk['words']):
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)

                    w_text = word_info['word'].strip()
                    word_duration_ms = int((word_end_s - word_start_s) * 1000)

                    # Pop animation: scale up then down
                    pop_scale = fr"\\t(0,200,\\fscx120\\fscy120)\\t(200,{word_duration_ms},\\fscx100\\fscy100)"
                    
                    # Random accent color for important words
                    if len(w_text) > 4 or word_idx % 3 == 0:  # Accent every 3rd word or long words
                        accent_color = random.choice(accent_colors)
                        color_effect = fr"\\1c{accent_color}"
                    else:
                        color_effect = ""
                    
                    # Bold appearance with thick outline
                    bold_line = f"{{\\fad(100,100){pop_scale}{color_effect}}}{w_text}"
                    bold_event = self.create_ass_event(bold_line, start_time, end_time, style_name, position)
                    events.append(bold_event)
        
        elif template_name == "BounceBox":
            style_name = "BounceBoxStyle"
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, int(template.get('min_words_per_line', 1)), int(template.get('max_words_per_line', 2)))
            else:
                word_chunks = self.chunk_words_by_line(segments, template['words_per_line'])

            import random
            box_colors = ["&H000080FF&", "&H0000FF80&", "&H00FF8000&", "&H00FF0080&", "&H008000FF&"]  # Orange, Green, Blue, Purple, Red
            
            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]

                # BounceBox style: Words with colored background boxes and bounce animation
                for word_idx, word_info in enumerate(chunk['words']):
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)

                    w_text = word_info['word'].strip()
                    word_duration_ms = int((word_end_s - word_start_s) * 1000)

                    # Bounce animation: dramatic scale up then settle
                    bounce_scale = fr"\\t(0,150,\\fscx130\\fscy130)\\t(150,300,\\fscx95\\fscy95)\\t(300,{word_duration_ms},\\fscx100\\fscy100)"
                    
                    # Random bright background box color
                    box_color = random.choice(box_colors)
                    box_effect = fr"\\3c{box_color}\\4c{box_color}\\bord8"
                    
                    # Entrance effect
                    entrance = fr"\\fad(80,100)"
                    
                    # Combine effects for viral-style box captions
                    box_line = f"{{{entrance}{bounce_scale}{box_effect}}}{w_text}"
                    box_event = self.create_ass_event(box_line, start_time, end_time, style_name, position)
                    events.append(box_event)
        
        elif template_name == "HighlightSweep":
            style_name = "HighlightSweepStyle"
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, int(template.get('min_words_per_line', 2)), int(template.get('max_words_per_line', 3)))
            else:
                word_chunks = self.chunk_words_by_line(segments, template['words_per_line'])

            import random
            highlight_colors = ["&H0000FFFF&", "&H0000FF80&", "&H00FF80FF&", "&H0080FF80&", "&H00FFFF00&"]  # Yellow, Green, Pink, Light Green, Cyan
            
            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]

                # HighlightSweep style: Words get highlighted with marker sweep effect
                for word_idx, word_info in enumerate(chunk['words']):
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)

                    w_text = word_info['word'].strip()
                    word_duration_ms = int((word_end_s - word_start_s) * 1000)

                    # Highlighter sweep effect: background color sweeps across
                    highlight_color = random.choice(highlight_colors)
                    sweep_duration = min(300, word_duration_ms // 2)
                    
                    # Sweep animation: highlight appears from left to right
                    highlight_sweep = fr"\\t(0,{sweep_duration},\\3c&H00FFFFFF&,\\3c{highlight_color})\\t({sweep_duration},{word_duration_ms},\\3c{highlight_color})"
                    
                    # Slight scale emphasis when highlighted
                    emphasis_scale = fr"\\t(0,{sweep_duration},\\fscx105\\fscy105)\\t({sweep_duration},{word_duration_ms},\\fscx100\\fscy100)"
                    
                    # Quick fade in
                    quick_fade = fr"\\fad(50,100)"
                    
                    # Combine effects for trending highlighter style
                    highlight_line = f"{{{quick_fade}{highlight_sweep}{emphasis_scale}}}{w_text}"
                    highlight_event = self.create_ass_event(highlight_line, start_time, end_time, style_name, position)
                    events.append(highlight_event)
        
        elif template_name == "PodcastPro":
            style_name = "PodcastProStyle"
            words_per_line = template.get('words_per_line', 8) or 8
            # Correctly chunk the flat list of word segments
            word_chunks = [segments[i:i + words_per_line] for i in range(0, len(segments), words_per_line)]

            speaker_color_map = {}
            word_to_speaker_map = {}

            if self.speaker_pipeline and audio_path:
                try:
                    speaker_segments = self.detect_speakers(audio_path)
                    if speaker_segments:
                        speaker_color_map = self.assign_speaker_colors(speaker_segments)
                        word_to_speaker_map = self.map_words_to_speakers(segments, speaker_segments)
                except Exception as e:
                    print(f"Advanced speaker diarization failed: {e}")

            if not speaker_color_map and audio_path and SIMPLE_SPEAKER_DETECTION_AVAILABLE:
                try:
                    print("Trying simple speaker detection...")
                    speaker_segments = detect_speaker_changes_simple(audio_path, segments)
                    if speaker_segments:
                        speaker_color_map = assign_speaker_colors_simple(speaker_segments)
                        word_to_speaker_map = map_words_to_speakers_simple(segments, speaker_segments)
                        print(f"Found {len(set(seg['speaker'] for seg in speaker_segments))} unique speakers")
                        print(f"Speaker color map: {speaker_color_map}")
                        print(f"First few word mappings: {dict(list(word_to_speaker_map.items())[:5])}")
                except Exception as e:
                    print(f"Simple speaker detection also failed: {e}")

            fallback_colors = template.get('speaker_colors', ["&H00FF00&", "&H0000FF&", "&HFFFFFF&", "&H00FFFF&"])

            for chunk_idx, chunk in enumerate(word_chunks):
                if not chunk:
                    continue

                position = template['positions'][chunk_idx % len(template['positions'])]
                line_color = fallback_colors[chunk_idx % len(fallback_colors)]

                first_word_start = chunk[0]['start']
                speaker_label = word_to_speaker_map.get(first_word_start)
                if speaker_label and speaker_label in speaker_color_map:
                    line_color = speaker_color_map[speaker_label]
                    print(f"Chunk {chunk_idx}: Speaker {speaker_label} -> Color {line_color}")
                else:
                    print(f"Chunk {chunk_idx}: No speaker found for time {first_word_start}, using fallback color {line_color}")

                words_in_line = " ".join([word['word'].strip() for word in chunk])
                podcast_line = f"{{\\fad(100,100)}}{{\\1c{line_color}}}{words_in_line}"

                # Fix timing gaps: start from previous chunk's end time if there's a gap
                start_time_seconds = chunk[0]['start']
                if chunk_idx > 0 and events:
                    # Get the end time of the previous chunk
                    prev_chunk = word_chunks[chunk_idx - 1]
                    if prev_chunk:
                        prev_end_time = prev_chunk[-1]['end']
                        # If there's a gap > 0.3 seconds, start from previous end time
                        if start_time_seconds - prev_end_time > 0.3:
                            start_time_seconds = prev_end_time

                start_time = self.format_time(start_time_seconds)
                end_time = self.format_time(chunk[-1]['end'])
                
                podcast_event = self.create_ass_event(podcast_line, start_time, end_time, style_name, position)
                events.append(podcast_event)
        
        elif template_name == "CodeFlow":
            style_name = "CodeFlowStyle"
            
            # Use standard chunking
            word_chunks = self.chunk_words(segments, template['words_per_line'])
            
            for chunk_idx, chunk in enumerate(word_chunks):
                if not chunk['words']:
                    continue
                    
                position = template['positions'][chunk_idx % len(template['positions'])]
                
                # Create typing effect with syntax highlighting
                for word_idx, word_info in enumerate(chunk['words']):
                    word_text = word_info['word'].strip()
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    
                    # Apply syntax highlighting based on word content
                    word_color = self.get_code_syntax_color(word_text, template['code_colors'])
                    
                    # Build progressive typing effect
                    typing_line = ""
                    for w_idx, w_info in enumerate(chunk['words']):
                        w_text = w_info['word'].strip()
                        w_color = self.get_code_syntax_color(w_text, template['code_colors'])
                        
                        if w_idx <= word_idx:
                            # Already typed words - show with syntax colors
                            typing_line += f"{{\\1c{w_color}}}{w_text} "
                        else:
                            # Future words - show as dim gray
                            typing_line += f"{{\\1c&H00444444&}}{w_text} "
                    
                    # Add blinking cursor after current word
                    if word_idx == len(chunk['words']) - 1:
                        # Last word - cursor blinks then disappears
                        cursor_effect = "{\\alpha&H80&\\t(0,500,\\alpha&H00&)\\t(500,1000,\\alpha&H80&)}|"
                    else:
                        # Mid-typing - steady cursor
                        cursor_effect = "{\\1c&H00FFFFFF&}|"
                    
                    typing_line += cursor_effect
                    
                    # Add matrix-style background effect
                    bg_effect = "{\\blur3\\bord0\\shad2}"
                    final_line = f"{bg_effect}{typing_line.strip()}"
                    
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)
                    
                    code_event = self.create_ass_event(final_line, start_time, end_time, style_name, position)
                    events.append(code_event)
        
        elif template_name == "RageMode":
            style_name = "RageModeStyle"
            
            # Use variable chunking for dynamic energy
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, 
                    int(template.get('min_words_per_line', 1)), 
                    int(template.get('max_words_per_line', 4)))
            else:
                word_chunks = self.chunk_words(segments, template['words_per_line'])
            
            rage_colors = template['rage_colors']
            intensity_words = template.get('intensity_words', [])
            max_scale = template.get('max_scale', 150)
            
            for chunk_idx, chunk in enumerate(word_chunks):
                if not chunk['words']:
                    continue
                    
                position = template['positions'][chunk_idx % len(template['positions'])]
                
                # Create SLAM effect for each word
                for word_idx, word_info in enumerate(chunk['words']):
                    word_text = word_info['word'].strip()
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    word_duration_ms = max(200, (word_end_s - word_start_s) * 1000)
                    
                    # Check if word needs EXTRA intensity
                    is_intense = word_text.lower() in intensity_words
                    scale_percent = max_scale if is_intense else 130
                    
                    # Cycle through rage colors
                    rage_color = rage_colors[word_idx % len(rage_colors)]
                    
                    # Create SLAM animation: Scale up HUGE then snap back
                    slam_duration = min(150, word_duration_ms // 3)
                    
                    # Intense glow effect
                    glow_effect = "{\\blur4\\bord0\\shad3}" if is_intense else "{\\blur2\\bord0\\shad2}"
                    
                    # SLAM scale animation with screen shake
                    scale_effect = f"{{\\t(0,{slam_duration},\\fscx{scale_percent}\\fscy{scale_percent})\\t({slam_duration},{slam_duration + 50},\\fscx100\\fscy100)}}"
                    
                    # Color flash effect
                    color_flash = f"{{\\1c{rage_color}\\t({slam_duration},\\1c&H00FFFFFF&)}}"
                    
                    # Build the rage line
                    rage_line = f"{glow_effect}{scale_effect}{color_flash}{word_text.upper()}"
                    
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)
                    
                    rage_event = self.create_ass_event(rage_line, start_time, end_time, style_name, position)
                    events.append(rage_event)
        
        elif template_name == "HypeTrain":
            style_name = "HypeTrainStyle"
            
            # Use variable chunking for dynamic momentum
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, 
                    int(template.get('min_words_per_line', 2)), 
                    int(template.get('max_words_per_line', 5)))
            else:
                word_chunks = self.chunk_words(segments, template['words_per_line'])
            
            rainbow_colors = template['rainbow_colors']
            momentum_words = template.get('momentum_words', [])
            slide_distance = template.get('slide_distance', 200)
            
            for chunk_idx, chunk in enumerate(word_chunks):
                if not chunk['words']:
                    continue
                    
                position = template['positions'][chunk_idx % len(template['positions'])]
                
                # Create TRAIN SLIDE effect - each word slides in with increasing speed
                for word_idx, word_info in enumerate(chunk['words']):
                    word_text = word_info['word'].strip()
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    word_duration_ms = max(300, (word_end_s - word_start_s) * 1000)
                    
                    # Check for momentum boost words
                    is_hype = word_text.lower() in momentum_words
                    
                    # Increasing speed effect - later words slide faster
                    base_slide_duration = 200
                    speed_multiplier = max(0.3, 1.0 - (word_idx * 0.15))  # Each word 15% faster
                    slide_duration = int(base_slide_duration * speed_multiplier)
                    
                    # Rainbow color cycling
                    rainbow_color = rainbow_colors[word_idx % len(rainbow_colors)]
                    
                    # Momentum boost for hype words
                    if is_hype:
                        scale_effect = "{\\t(0,100,\\fscx140\\fscy140)\\t(100,200,\\fscx100\\fscy100)}"
                        glow_effect = "{\\blur5\\bord0\\shad4}"
                    else:
                        scale_effect = "{\\t(0,80,\\fscx120\\fscy120)\\t(80,160,\\fscx100\\fscy100)}"
                        glow_effect = "{\\blur3\\bord0\\shad2}"
                    
                    # Slide animation from right with momentum
                    slide_start_x = 540 + slide_distance + (word_idx * 20)  # Each word starts further right
                    slide_effect = f"{{\\move({slide_start_x},800,540,800,0,{slide_duration})}}"
                    
                    # Color transition effect
                    color_effect = f"{{\\1c{rainbow_color}}}"
                    
                    # Build the hype train line
                    train_line = f"{glow_effect}{scale_effect}{slide_effect}{color_effect}{word_text.upper()}"
                    
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)
                    
                    train_event = self.create_ass_event(train_line, start_time, end_time, style_name, position)
                    events.append(train_event)
        
        elif template_name == "GlitchStreamer":
            style_name = "GlitchStreamerStyle"
            
            # Use variable chunking for glitchy unpredictable flow
            if template.get('random_chunking'):
                word_chunks = self.chunk_words_variable(segments, 
                    int(template.get('min_words_per_line', 1)), 
                    int(template.get('max_words_per_line', 4)))
            else:
                word_chunks = self.chunk_words(segments, template['words_per_line'])
            
            glitch_colors = template['glitch_colors']
            error_words = template.get('error_words', [])
            rgb_offset = template.get('rgb_offset', 5)
            
            for chunk_idx, chunk in enumerate(word_chunks):
                if not chunk['words']:
                    continue
                    
                position = template['positions'][chunk_idx % len(template['positions'])]
                
                # Create RGB GLITCH effect - simulate broken stream/OBS
                for word_idx, word_info in enumerate(chunk['words']):
                    word_text = word_info['word'].strip()
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    word_duration_ms = max(250, (word_end_s - word_start_s) * 1000)
                    
                    # Check for error/glitch words
                    is_error = word_text.lower() in error_words
                    
                    # Create multiple RGB split layers for glitch effect
                    glitch_events = []
                    
                    # Red channel (offset left)
                    red_pos_x = 540 - rgb_offset
                    red_effect = f"{{\\pos({red_pos_x},800)\\1c&H000000FF&\\alpha&H80&}}"
                    
                    # Green channel (center, main text)
                    green_pos_x = 540
                    green_effect = f"{{\\pos({green_pos_x},800)\\1c&H0000FF00&}}"
                    
                    # Blue channel (offset right)
                    blue_pos_x = 540 + rgb_offset
                    blue_effect = f"{{\\pos({blue_pos_x},800)\\1c&H00FF0000&\\alpha&H80&}}"
                    
                    # Static/noise effect for error words
                    if is_error:
                        static_effect = "{\\blur6\\bord0\\shad4\\t(0,50,\\alpha&HFF&)\\t(50,100,\\alpha&H00&)\\t(100,150,\\alpha&HFF&)\\t(150,200,\\alpha&H00&)}"
                        scale_glitch = "{\\t(0,100,\\fscx110\\fscy90)\\t(100,200,\\fscx90\\fscy110)\\t(200,300,\\fscx100\\fscy100)}"
                    else:
                        static_effect = "{\\blur2\\bord0\\shad2}"
                        scale_glitch = ""
                    
                    # Position error simulation - slight random offset
                    import random
                    pos_error_x = random.randint(-3, 3)
                    pos_error_y = random.randint(-2, 2)
                    
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)
                    
                    # Create RGB split effect with 3 overlapping events
                    # Red layer
                    red_line = f"{static_effect}{red_effect}{scale_glitch}{word_text.upper()}"
                    red_event = self.create_ass_event(red_line, start_time, end_time, style_name, f"{{\\an5\\pos({red_pos_x + pos_error_x},{800 + pos_error_y})}}")
                    events.append(red_event)
                    
                    # Combine all effects
                    beast_line = f"{static_effect}{green_effect}{scale_glitch}{word_text.upper()}"
                    # Use layout-aware positioning instead of template position
                    layout_position = f"{{\\an5\\pos(540,800)}}"
                    beast_event = self.create_ass_event(beast_line, start_time, end_time, style_name, layout_position)
                    events.append(beast_event)
                    
                    # Blue layer
                    blue_line = f"{static_effect}{blue_effect}{scale_glitch}{word_text.upper()}"
                    blue_event = self.create_ass_event(blue_line, start_time, end_time, style_name, f"{{\\an5\\pos({blue_pos_x - pos_error_x},{800 - pos_error_y})}}")
                    events.append(blue_event)
        
        elif template_name == "BeastMode":
            style_name = "BeastModeStyle"
            
            # Use standard chunking for consistent impact
            word_chunks = self.chunk_words(segments, template['words_per_line'])
            
            money_colors = template['money_colors']
            impact_words = template.get('impact_words', [])
            max_scale = template.get('max_scale', 200)
            
            for chunk_idx, chunk in enumerate(word_chunks):
                if not chunk['words']:
                    continue
                    
                # Use the layout-adjusted position directly
                position = template['positions'][chunk_idx % len(template['positions'])]
                
                # Create BEAST IMPACT effect - massive scale with money theme
                for word_idx, word_info in enumerate(chunk['words']):
                    word_text = word_info['word'].strip()
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    word_duration_ms = max(400, (word_end_s - word_start_s) * 1000)
                    
                    # Check for high-impact words
                    is_impact = word_text.lower() in impact_words
                    scale_percent = max_scale if is_impact else 160
                    
                    # Money-themed color cycling
                    money_color = money_colors[word_idx % len(money_colors)]
                    
                    # MASSIVE drop animation with bounce
                    drop_duration = min(300, word_duration_ms // 2)
                    bounce_duration = min(200, word_duration_ms // 3)
                    
                    # Extract Y coordinate from the layout-adjusted position
                    import re
                    pos_match = re.search(r'pos\(\d+,(\d+)\)', position)
                    target_y = int(pos_match.group(1)) if pos_match else 800
                    
                    # Drop from top with massive scale
                    drop_effect = f"{{\\move(540,200,540,{target_y},0,{drop_duration})}}"
                    
                    # Scale explosion effect
                    scale_explosion = f"{{\\t(0,{drop_duration},{scale_percent},{scale_percent})\\t({drop_duration},{drop_duration + bounce_duration},\\fscx{scale_percent - 40}\\fscy{scale_percent - 40})\\t({drop_duration + bounce_duration},{drop_duration + bounce_duration + 100},\\fscx{scale_percent}\\fscy{scale_percent})}}"
                    
                    # Clean drop shadow and glow
                    shadow_effect = "{\\blur2\\bord0\\shad4\\4c&H00000000&}"
                    
                    # Money glow for impact words
                    if is_impact:
                        glow_effect = "{\\blur3\\bord0\\shad3}"
                        color_flash = f"{{\\1c{money_color}\\t({drop_duration},\\1c&H00FFFFFF&)}}"
                    else:
                        glow_effect = "{\\blur1\\bord0\\shad2}"
                        color_flash = f"{{\\1c{money_color}}}"
                    
                    # Build the beast line
                    beast_line = f"{shadow_effect}{glow_effect}{drop_effect}{scale_explosion}{color_flash}{word_text.upper()}"
                    
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)
                    
                    # Use consistent layout-aware positioning
                    beast_event = self.create_ass_event(beast_line, start_time, end_time, style_name, position)
                    events.append(beast_event)
        elif template_name == "TikTokViral":
            # TikTokViral: Explosive bouncy animations with bright neon colors - COMPLETELY DIFFERENT from Karaoke
            style_name = "TikTokViral"
            
            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]
                
                # TikTokViral: Each word gets its own explosive entrance
                for word_idx, word_info in enumerate(chunk['words']):
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']
                    word_duration_ms = max(200, (word_end_s - word_start_s) * 1000)
                    
                    start_time = self.format_time(word_start_s)
                    end_time = self.format_time(word_end_s)
                    
                    word_text = word_info['word'].strip().upper()  # Always uppercase for viral energy
                    
                    # EXPLOSIVE VIRAL EFFECTS - completely different from Karaoke
                    # 1. Massive scale explosion: 50% -> 180% -> 120% -> 100%
                    explosion_scale = fr"\t(0,100,\fscx180\fscy180)\t(100,250,\fscx120\fscy120)\t(250,{word_duration_ms},\fscx100\fscy100)"
                    
                    # 2. Bright electric colors cycling: Cyan -> Magenta -> Yellow
                    color_cycle = fr"\t(0,{word_duration_ms//3},\1c&H00FFFF00&)\t({word_duration_ms//3},{word_duration_ms*2//3},\1c&H00FF00FF&)\t({word_duration_ms*2//3},{word_duration_ms},\1c&H0000FFFF&)"
                    
                    # 3. Glow pulse effect
                    glow_pulse = fr"\t(0,150,\blur8\bord0\shad6)\t(150,{word_duration_ms},\blur4\bord0\shad3)"
                    
                    # 4. Shake effect for extra viral energy
                    shake_effect = fr"\t(0,50,\frx3)\t(50,100,\frx-3)\t(100,150,\frx0)"
                    
                    # Combine all viral effects
                    viral_line = f"{{{explosion_scale}{color_cycle}{glow_pulse}{shake_effect}}}{word_text}"
                    
                    viral_event = self.create_ass_event(viral_line, start_time, end_time, style_name, position)
                    events.append(viral_event)
        
        elif template_name == "OpusClipStyle":
            # OpusClipStyle: True karaoke with word-by-word highlighting
            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]
                
                # Create karaoke line with proper word-by-word timing
                chunk_start_s = chunk['words'][0]['start']
                chunk_end_s = chunk['words'][-1]['end']
                start_time = self.format_time(chunk_start_s)
                end_time = self.format_time(chunk_end_s)

                line_text = ""
                last_word_end_s = chunk_start_s

                for word_info in chunk['words']:
                    word_text = word_info['word'].strip()
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']

                    delay_ms = max(0, (word_start_s - last_word_end_s) * 1000)
                    word_duration_ms = max(20, (word_end_s - word_start_s) * 1000)
                    
                    # True karaoke: \kf for fill effect, \t for bounce on keywords
                    if 'javascript' in word_text.lower():
                        # Special bounce for JavaScript
                        line_text += f"{{\\kf{int(word_duration_ms/10)}\\t(0,150,\\fscx130\\fscy130)\\t(150,{int(word_duration_ms)},\\fscx100\\fscy100)}}{word_text} "
                    else:
                        # Standard karaoke fill
                        line_text += f"{{\\kf{int(word_duration_ms/10)}}}{word_text} "
                    
                    last_word_end_s = word_end_s

                event = self.create_ass_event(line_text.strip(), start_time, end_time, "Default", position)
                events.append(event)
        else:
            # SwipeUp: progressive fill with conditional bounce
            for chunk_idx, chunk in enumerate(word_chunks):
                position = template['positions'][chunk_idx % len(template['positions'])]
                
                # Single event for the entire line to ensure smooth progressive highlighting
                chunk_start_s = chunk['words'][0]['start']
                chunk_end_s = chunk['words'][-1]['end']
                start_time = self.format_time(chunk_start_s)
                end_time = self.format_time(chunk_end_s)

                line_text = ""
                last_word_end_s = chunk_start_s

                for word_info in chunk['words']:
                    word_text = word_info['word'].strip()
                    word_start_s = word_info['start']
                    word_end_s = word_info['end']

                    delay_ms = max(0, (word_start_s - last_word_end_s) * 1000)
                    word_duration_ms = max(10, (word_end_s - word_start_s) * 1000)
                    
                    # Conditional animation for the word "JavaScript"
                    if 'javascript' in word_text.lower():
                        bounce_duration = 150
                        animation_tags = fr"\k{int(delay_ms / 10)}\K{int(word_duration_ms / 10)}\t(0,{bounce_duration},\fscx125,\fscy125)\t({bounce_duration},{word_duration_ms},\fscx100,\fscy100)"
                    else:
                        # Standard karaoke effect for other words (no bounce)
                        animation_tags = fr"\k{int(delay_ms / 10)}\K{int(word_duration_ms / 10)}"
                    
                    line_text += f"{{{animation_tags}}}{word_text} "
                    
                    last_word_end_s = word_end_s

                event = self.create_ass_event(line_text.strip(), start_time, end_time, "Default", position)
                events.append(event)
            
        # Return ASS content directly
        ass_content = ass_header + "\n".join(events)
        return ass_content

    def process_video_for_vertical(self, input_path: str, output_path: str, blur_strength: int = 10, layout_mode: str = "fit"):
        """
        Processes a video to create a vertical version (1080x1920) with a blurred background
        using ffmpeg-python for robust and precise control.
        """
        try:
            probe = ffmpeg.probe(input_path)
            video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
            original_w = int(video_info['width'])
            original_h = int(video_info['height'])

            # Use smaller resolution for auto layout to avoid memory issues
            if layout_mode.lower() == "auto":
                output_w = 720  # Smaller resolution for auto layout
                output_h = 1280
            else:
                output_w = 1080
                output_h = 1920

            input_stream = ffmpeg.input(input_path)

            split_streams = input_stream.video.split()
            stream1 = split_streams[0]
            stream2 = split_streams[1]

            background = (
                stream1
                .filter('scale', w=-1, h=output_h)
                .filter('crop', w=output_w, h=output_h)
                .filter('boxblur', luma_radius=50, luma_power=5)
            )

            # Adjust foreground scaling based on layout mode
            if layout_mode.lower() == "square":
                # Square mode: create large square video with wider dimensions to fill horizontal space
                square_width = 1080  # Wider to fill more horizontal space
                square_height = 1200  # Keep the height that works well with captions
                foreground = (
                    stream2
                    .filter('scale', w=square_width, h=square_height)  # Remove aspect ratio constraint
                )
                # Position lower to match reference screenshot
                overlay_x = '(W-w)/2'
                overlay_y = '(H-h)/2+150'  # Move down significantly
            elif layout_mode.lower() == "fill":
                # Fill mode: center video content to fill vertical canvas
                foreground = (
                    stream2
                    .filter('scale', w=output_w, h=output_h)  # Scale to fill canvas
                )
                overlay_x = '0'
                overlay_y = '0'
            elif layout_mode.lower() == "auto":
                # Auto mode: AI face detection and centering
                try:
                    # Use face detection to center on speaking person
                    from face_detection import FaceDetector
                    detector = FaceDetector()
                    # Use audio analysis to determine which speaker is active
                    from speaker_detection import SpeakerDetector
                    speaker_detector = SpeakerDetector()
                    
                    # Extract audio from video for analysis
                    import tempfile
                    temp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                    temp_audio.close()
                    
                    # Extract audio using ffmpeg
                    import subprocess
                    subprocess.run([
                        'ffmpeg', '-y', '-i', input_path, 
                        '-ac', '2', '-ar', '16000', temp_audio.name
                    ], capture_output=True)
                    
                    # Get video duration
                    probe = ffmpeg.probe(input_path)
                    duration = float(probe['format']['duration'])
                    
                    # For now, analyze the first 30 seconds to determine primary speaker
                    prefer_left = speaker_detector.get_speaker_preference_for_segment(
                        temp_audio.name, 0, min(30, duration)
                    )
                    
                    face_center_x, face_center_y = detector.detect_face_center(input_path, prefer_left_side=prefer_left)
                    print(f"Face detected at: ({face_center_x}, {face_center_y})")
                    
                    # For auto layout, we want to zoom in and center on the face
                    # Calculate a much tighter crop around the face for close-up effect
                    zoom_factor = 3.0  # Zoom in 3x for much closer face view
                    crop_width = int(original_w / zoom_factor)
                    crop_height = int(original_h / zoom_factor)
                    
                    # Center crop around detected face
                    crop_x = max(0, min(original_w - crop_width, face_center_x - crop_width // 2))
                    crop_y = max(0, min(original_h - crop_height, face_center_y - crop_height // 2))
                    
                    print(f"Cropping: {crop_width}x{crop_height} at ({crop_x}, {crop_y})")
                    
                    foreground = (
                        stream2
                        .filter('crop', w=crop_width, h=crop_height, x=crop_x, y=crop_y)
                        .filter('scale', w=output_w, h=output_h)
                    )
                    overlay_x = '0'
                    overlay_y = '0'
                    
                except Exception as e:
                    print(f"Face detection failed, falling back to fill mode: {e}")
                    # Fallback to fill mode
                    foreground = (
                        stream2
                        .filter('scale', w=output_w, h=output_h)
                    )
                    overlay_x = '0'
                    overlay_y = '0'
            else:
                # Fit mode: standard scaling
                foreground = (
                    stream2
                    .filter('scale', w=output_w, h=-1)
                )
                overlay_x = '(W-w)/2'
                overlay_y = '(H-h)/2'

            processed_video = ffmpeg.overlay(
                background,
                foreground,
                x=overlay_x,
                y=overlay_y
            )

            final_output = ffmpeg.output(
                processed_video, 
                input_stream.audio, 
                output_path, 
                vcodec='libx264', 
                acodec='aac',
                shortest=None
            )

            final_output.overwrite_output().run(capture_stdout=True, capture_stderr=True)

        except ffmpeg.Error as e:
            print('FFmpeg Error:')
            print(e.stderr.decode())
            raise
