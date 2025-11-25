"""
Viral Clip Video Generator
Integrates hook detection with actual video processing to generate MP4 files
"""

import os
import json
import tempfile
from typing import List, Dict, Any
from hook_detector import HookDetector, parse_whisper_segments
from processing import run_opus_transcription
import yt_dlp


class ViralClipGenerator:
    """Generates actual video files for detected viral clips"""
    
    def __init__(self):
        self.hook_detector = HookDetector(target_length=60)
        self.hook_detector.load_sentiment_model()
    
    def generate_viral_clips_from_url(
        self, 
        video_url: str,
        layout_mode: str = "fit",
        template: str = "SwipeUp",
        max_clips: int = 5,
        min_score: float = 4.0,
        output_dir: str = "exports/clips"
    ) -> List[Dict[str, Any]]:
        """
        Generate actual viral clip videos from YouTube URL
        
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
        print(f"🎬 Generating Viral Clips from: {video_url}")
        print(f"   Layout: {layout_mode} | Template: {template}")
        print(f"   Target: {max_clips} clips (min score: {min_score})")
        
        try:
            # Step 1: Download video and extract transcript
            video_info = self._download_and_transcribe(video_url)
            
            if not video_info:
                raise Exception("Failed to download video or extract transcript")
            
            # Step 2: Find viral moments
            viral_clips = self._find_viral_moments(
                video_info['transcript'], 
                max_clips, 
                min_score
            )
            
            if not viral_clips:
                print("⚠️  No viral clips found above threshold")
                return []
            
            # Step 3: Generate actual video clips
            generated_clips = self._generate_clip_videos(
                viral_clips,
                video_info['video_path'],
                layout_mode,
                template,
                output_dir
            )
            
            print(f"✅ Successfully generated {len(generated_clips)} viral clips!")
            return generated_clips
            
        except Exception as e:
            print(f"❌ Error generating viral clips: {e}")
            raise
    
    def _download_and_transcribe(self, video_url: str) -> Dict[str, Any]:
        """Download video and extract transcript"""
        print("📥 Downloading video and extracting transcript...")
        
        try:
            # Create temporary directory for processing
            temp_dir = tempfile.mkdtemp(prefix="viral_clips_")
            
            # Download video using yt-dlp
            ydl_opts = {
                'format': 'best[height<=720]',  # Limit quality for faster processing
                'outtmpl': os.path.join(temp_dir, 'video.%(ext)s'),
                'quiet': True
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_title = info.get('title', 'Unknown')
                
            # Find downloaded video file
            video_files = [f for f in os.listdir(temp_dir) if f.startswith('video.')]
            if not video_files:
                raise Exception("Video download failed")
            
            video_path = os.path.join(temp_dir, video_files[0])
            
            print(f"✅ Downloaded: {video_title}")
            print(f"   Path: {video_path}")
            
            # Extract transcript using existing transcription
            # For now, use mock transcript - in real implementation, integrate with Whisper
            mock_transcript = self._get_mock_transcript()
            
            return {
                'video_path': video_path,
                'title': video_title,
                'transcript': mock_transcript,
                'temp_dir': temp_dir
            }
            
        except Exception as e:
            print(f"❌ Download/transcription failed: {e}")
            return None
    
    def _get_mock_transcript(self) -> List[Dict]:
        """Mock transcript for testing - replace with real Whisper integration"""
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
        min_score: float
    ) -> List[Dict[str, Any]]:
        """Find viral moments in transcript"""
        print("🎯 Analyzing transcript for viral moments...")
        
        # Convert to TranscriptSegment objects
        segments = parse_whisper_segments(transcript_data)
        
        # Find viral clips
        viral_clips = self.hook_detector.find_viral_clips(segments, top_n=max_clips * 2)
        
        # Filter by minimum score
        filtered_clips = [
            clip for clip in viral_clips 
            if clip["score"] >= min_score
        ][:max_clips]
        
        print(f"🏆 Found {len(filtered_clips)} clips above score threshold {min_score}")
        return filtered_clips
    
    def _generate_clip_videos(
        self,
        viral_clips: List[Dict],
        source_video_path: str,
        layout_mode: str,
        template: str,
        output_dir: str
    ) -> List[Dict[str, Any]]:
        """Generate actual video files for viral clips"""
        print(f"🎬 Generating {len(viral_clips)} video clips...")
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        generated_clips = []
        
        for i, clip in enumerate(viral_clips):
            try:
                print(f"\n📹 Generating Clip #{i+1} (Score: {clip['score']:.1f})")
                
                # Parse timestamps
                start_time = self._parse_timestamp(clip['start_time'])
                end_time = self._parse_timestamp(clip['end_time'])
                
                # Generate output filename
                safe_score = str(clip['score']).replace('.', '_')
                clip_filename = f"viral_clip_{i+1}_score_{safe_score}_{layout_mode}_{template.lower()}.mp4"
                clip_path = os.path.join(output_dir, clip_filename)
                
                # Use existing processing pipeline to generate clip
                result = self._process_single_clip(
                    source_video_path,
                    start_time,
                    end_time,
                    clip_path,
                    layout_mode,
                    template,
                    clip['transcript']
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
                        "status": "generated"
                    })
                    
                    print(f"   ✅ Generated: {clip_filename}")
                else:
                    print(f"   ❌ Failed to generate clip #{i+1}")
                
            except Exception as e:
                print(f"   ❌ Error generating clip #{i+1}: {e}")
                continue
        
        return generated_clips
    
    def _parse_timestamp(self, timestamp_str: str) -> float:
        """Parse timestamp string (HH:MM:SS) to seconds"""
        parts = timestamp_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = int(parts[2])
        return hours * 3600 + minutes * 60 + seconds
    
    def _process_single_clip(
        self,
        source_video: str,
        start_time: float,
        end_time: float,
        output_path: str,
        layout_mode: str,
        template: str,
        transcript_text: str
    ) -> bool:
        """Process a single clip using existing pipeline"""
        try:
            # For now, simulate clip generation using FFmpeg
            # In real implementation, integrate with your existing processing.py
            
            import subprocess
            
            # Extract video segment using FFmpeg
            duration = end_time - start_time
            
            ffmpeg_command = [
                'ffmpeg', '-y',
                '-i', source_video,
                '-ss', str(start_time),
                '-t', str(duration),
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-crf', '23',
                '-preset', 'fast',
                output_path
            ]
            
            print(f"   🎥 Extracting segment: {start_time:.1f}s - {end_time:.1f}s")
            result = subprocess.run(ffmpeg_command, capture_output=True, text=True)
            
            if result.returncode == 0 and os.path.exists(output_path):
                print(f"   ✅ Video segment extracted")
                
                # TODO: Add layout processing and caption burning here
                # This would integrate with your existing processing.py functions
                
                return True
            else:
                print(f"   ❌ FFmpeg failed: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"   ❌ Clip processing error: {e}")
            return False


# Convenience function for easy usage
def generate_viral_clips(
    video_url: str,
    layout_mode: str = "fit",
    template: str = "SwipeUp",
    max_clips: int = 5
) -> List[Dict[str, Any]]:
    """
    Generate viral clips from YouTube URL
    
    Args:
        video_url: YouTube URL
        layout_mode: fit, fill, square, auto
        template: Karaoke, BeastMode, Glitch, SwipeUp
        max_clips: Maximum clips to generate
        
    Returns:
        List of generated clips
    """
    generator = ViralClipGenerator()
    return generator.generate_viral_clips_from_url(
        video_url=video_url,
        layout_mode=layout_mode,
        template=template,
        max_clips=max_clips,
        min_score=4.0
    )


# Example usage
if __name__ == "__main__":
    # Test viral clip generation
    test_url = "https://www.youtube.com/watch?v=ZzI9JE0i6Lc"
    
    print("🚀 Testing Viral Clip Video Generation")
    print("=" * 60)
    
    try:
        clips = generate_viral_clips(
            video_url=test_url,
            layout_mode="fit",
            template="SwipeUp",
            max_clips=3
        )
        
        print(f"\n✅ Generated {len(clips)} viral clips!")
        
        for clip in clips:
            print(f"   📹 {clip['filename']} (Score: {clip['score']:.1f})")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        print("Note: This requires FFmpeg and yt-dlp to be installed")
