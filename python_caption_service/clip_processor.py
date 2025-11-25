"""
Clip Processing Integration
Connects hook detection with existing video processing pipeline
"""

import os
import json
import tempfile
from typing import List, Dict, Any, Optional
from hook_detector import HookDetector, parse_whisper_segments, TranscriptSegment
from processing import run_opus_transcription


class ClipProcessor:
    """Integrates hook detection with video processing pipeline"""
    
    def __init__(self, target_clip_length: int = 60):
        """
        Initialize clip processor
        
        Args:
            target_clip_length: Target length for generated clips in seconds
        """
        self.target_clip_length = target_clip_length
        self.hook_detector = HookDetector(target_length=target_clip_length)
        
        # Load sentiment model on initialization
        self.hook_detector.load_sentiment_model()
    
    def process_video_for_clips(
        self, 
        video_url: str, 
        layout_mode: str = "fit",
        template: str = "Karaoke",
        max_clips: int = 10,
        min_score: float = 2.0
    ) -> List[Dict[str, Any]]:
        """
        Process video to find and generate viral clips
        
        Args:
            video_url: YouTube URL or video file path
            layout_mode: Video layout (fit, fill, square, auto)
            template: Caption template (Karaoke, BeastMode, Glitch, SwipeUp)
            max_clips: Maximum number of clips to generate
            min_score: Minimum viral score threshold
            
        Returns:
            List of generated clip information
        """
        print(f"🎬 Processing video for viral clips...")
        print(f"   Video: {video_url}")
        print(f"   Layout: {layout_mode} | Template: {template}")
        print(f"   Target clips: {max_clips} (min score: {min_score})")
        
        try:
            # Step 1: Get full transcript using existing pipeline
            transcript_data = self._extract_transcript(video_url)
            
            if not transcript_data:
                raise Exception("Failed to extract transcript")
            
            # Step 2: Find viral clips using hook detection
            viral_clips = self._find_viral_moments(transcript_data, max_clips, min_score)
            
            if not viral_clips:
                print("⚠️  No viral clips found above threshold")
                return []
            
            # Step 3: Generate actual video clips (future implementation)
            # For now, return clip metadata
            processed_clips = []
            
            for i, clip in enumerate(viral_clips):
                clip_info = {
                    "id": f"clip_{i}",
                    "start_time": clip["start_time"],
                    "end_time": clip["end_time"], 
                    "duration": clip["duration"],
                    "score": clip["score"],
                    "transcript": clip["transcript"],
                    "layout_mode": layout_mode,
                    "template": template,
                    "analysis": clip["analysis"],
                    "status": "detected"  # Will be "processed" after video generation
                }
                processed_clips.append(clip_info)
            
            print(f"✅ Successfully identified {len(processed_clips)} viral clips")
            return processed_clips
            
        except Exception as e:
            print(f"❌ Error processing video for clips: {e}")
            raise
    
    def _extract_transcript(self, video_url: str) -> Optional[List[Dict]]:
        """
        Extract transcript using existing transcription pipeline
        
        Args:
            video_url: Video URL or path
            
        Returns:
            Transcript segments or None if failed
        """
        try:
            print("📝 Extracting transcript...")
            
            # Use existing transcription logic from processing.py
            # This is a simplified version - in practice, we'd extract just the transcription part
            
            # For now, simulate transcript extraction
            # In real implementation, we'd call the Whisper transcription directly
            
            # Placeholder: Return mock transcript for testing
            # TODO: Integrate with actual Whisper transcription from processing.py
            
            mock_transcript = [
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
            
            print(f"✅ Extracted {len(mock_transcript)} transcript segments")
            return mock_transcript
            
        except Exception as e:
            print(f"❌ Transcript extraction failed: {e}")
            return None
    
    def _find_viral_moments(
        self, 
        transcript_data: List[Dict], 
        max_clips: int, 
        min_score: float
    ) -> List[Dict[str, Any]]:
        """
        Find viral moments in transcript using hook detection
        
        Args:
            transcript_data: Raw transcript segments
            max_clips: Maximum clips to return
            min_score: Minimum viral score
            
        Returns:
            List of viral clip candidates
        """
        try:
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
            
        except Exception as e:
            print(f"❌ Viral moment detection failed: {e}")
            return []
    
    def generate_clip_videos(
        self, 
        clips: List[Dict[str, Any]], 
        video_path: str,
        output_dir: str = "exports/clips"
    ) -> List[Dict[str, Any]]:
        """
        Generate actual video files for detected clips
        
        Args:
            clips: List of clip metadata
            video_path: Path to source video
            output_dir: Output directory for clips
            
        Returns:
            Updated clip information with video paths
        """
        print(f"🎬 Generating {len(clips)} video clips...")
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        generated_clips = []
        
        for i, clip in enumerate(clips):
            try:
                # TODO: Implement actual video cutting using FFmpeg
                # For now, just update metadata
                
                clip_filename = f"viral_clip_{i+1}_{clip['score']:.1f}.mp4"
                clip_path = os.path.join(output_dir, clip_filename)
                
                # Update clip info
                updated_clip = clip.copy()
                updated_clip.update({
                    "video_path": clip_path,
                    "filename": clip_filename,
                    "status": "ready_to_generate"  # Will be "generated" after actual processing
                })
                
                generated_clips.append(updated_clip)
                
                print(f"   📹 Clip {i+1}: {clip['score']:.1f} score - {clip['duration']:.1f}s")
                
            except Exception as e:
                print(f"❌ Failed to process clip {i+1}: {e}")
                continue
        
        print(f"✅ Prepared {len(generated_clips)} clips for generation")
        return generated_clips
    
    def export_clips_json(self, clips: List[Dict[str, Any]], output_path: str) -> str:
        """
        Export clips metadata to JSON file
        
        Args:
            clips: List of clip data
            output_path: Path for JSON export
            
        Returns:
            Path to exported JSON file
        """
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump({
                    "clips": clips,
                    "total_clips": len(clips),
                    "generated_at": str(os.path.getctime(output_path)) if os.path.exists(output_path) else "now",
                    "settings": {
                        "target_length": self.target_clip_length,
                        "hook_detector_version": "1.0"
                    }
                }, f, indent=2, ensure_ascii=False)
            
            print(f"📄 Exported clips metadata to: {output_path}")
            return output_path
            
        except Exception as e:
            print(f"❌ Failed to export clips JSON: {e}")
            raise


# Utility functions for integration
def analyze_video_for_clips(
    video_url: str,
    target_length: int = 60,
    layout_mode: str = "fit", 
    template: str = "Karaoke",
    max_clips: int = 10
) -> List[Dict[str, Any]]:
    """
    Convenience function to analyze video and find viral clips
    
    Args:
        video_url: YouTube URL or video path
        target_length: Target clip length in seconds
        layout_mode: Video layout mode
        template: Caption template
        max_clips: Maximum clips to find
        
    Returns:
        List of viral clips
    """
    processor = ClipProcessor(target_clip_length=target_length)
    return processor.process_video_for_clips(
        video_url=video_url,
        layout_mode=layout_mode,
        template=template,
        max_clips=max_clips
    )


# Example usage
if __name__ == "__main__":
    # Test the clip processor
    processor = ClipProcessor(target_clip_length=60)
    
    # Analyze video for clips
    clips = processor.process_video_for_clips(
        video_url="https://www.youtube.com/watch?v=ZzI9JE0i6Lc",
        layout_mode="fit",
        template="Karaoke", 
        max_clips=5,
        min_score=2.0
    )
    
    # Export results
    if clips:
        output_path = "exports/viral_clips_analysis.json"
        processor.export_clips_json(clips, output_path)
        
        print(f"\n🎯 Analysis Complete!")
        print(f"   Found: {len(clips)} viral clips")
        print(f"   Exported: {output_path}")
        
        # Show top clips
        for i, clip in enumerate(clips[:3]):
            print(f"\n📹 Clip #{i+1} (Score: {clip['score']:.1f})")
            print(f"   Time: {clip['start_time']} - {clip['end_time']}")
            print(f"   Text: {clip['transcript'][:100]}...")
    else:
        print("❌ No viral clips found")
