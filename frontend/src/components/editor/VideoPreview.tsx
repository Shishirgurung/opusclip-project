import React, { useRef, useEffect, useState } from "react";
import { useEditor } from "@/contexts/EditorContext";
import { Maximize2, RotateCcw, RotateCw, Split, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function VideoPreview() {
  const { 
    currentTime, 
    setCurrentTime, 
    isPlaying, 
    togglePlayback,
    mediaLibrary,
    timelineClips,
    editorSettings,
    updateEditorSettings,
    duration
  } = useEditor();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Find the active video clip based on current time
  const activeVideoClip = timelineClips.find(clip => 
    clip.type === "video" && 
    currentTime >= clip.startTime && 
    currentTime <= clip.endTime
  );
  
  // Find all active audio clips based on current time
  const activeAudioClips = timelineClips.filter(clip => 
    clip.type === "audio" && 
    currentTime >= clip.startTime && 
    currentTime <= clip.endTime
  );
  
  // Get the source URL for the active clips
  const activeVideoSrc = activeVideoClip 
    ? mediaLibrary.find(item => item.id === activeVideoClip.mediaId)?.src 
    : undefined;
  
  // Get the primary audio clip (first one if multiple)
  const primaryAudioClip = activeAudioClips.length > 0 ? activeAudioClips[0] : null;
  const primaryAudioSrc = primaryAudioClip 
    ? mediaLibrary.find(item => item.id === primaryAudioClip.mediaId)?.src 
    : undefined;
  
  // Update video source and internal time when activeVideoClip changes
  useEffect(() => {
    if (videoRef.current && activeVideoSrc) {
      if (videoRef.current.src !== activeVideoSrc) {
        videoRef.current.src = activeVideoSrc;
        videoRef.current.load(); // Important: load the new source
      }
      // Adjust video element's currentTime relative to the clip's start
      if (activeVideoClip) {
        const internalClipTime = currentTime - activeVideoClip.startTime;
        // Ensure internalClipTime is within the clip's bounds and video's duration
        if (internalClipTime >= 0 && videoRef.current.duration > 0 && internalClipTime <= videoRef.current.duration) {
            // Only seek if the difference is significant to avoid jitter
            if (Math.abs(videoRef.current.currentTime - internalClipTime) > 0.2) {
                 videoRef.current.currentTime = internalClipTime;
            }
        }
      }
      if (isPlaying) {
        videoRef.current.play().catch(error => {
          console.error("Error playing video on source change:", error);
        });
      }
    } else if (videoRef.current && !activeVideoSrc && isPlaying) {
        // If no active video clip but we are in playing state, pause.
        videoRef.current.pause();
    }
  }, [activeVideoSrc, activeVideoClip, currentTime, isPlaying]); // Added currentTime and isPlaying
  
  // Set volume for all media elements
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    if (originalVideoRef.current) {
      originalVideoRef.current.volume = volume;
    }
  }, [volume]);
  
  // Set muted state for all media elements
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
    if (originalVideoRef.current) {
      originalVideoRef.current.muted = isMuted;
    }
  }, [isMuted]);
  
  // Handle playback state changes
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(error => {
          console.error("Error playing video:", error);
          togglePlayback(); // Reset playing state if there's an error
        });
        
        // Also play the original video if in split-screen mode
        if (editorSettings.splitScreenPreview && originalVideoRef.current) {
          originalVideoRef.current.play().catch(console.error);
          originalVideoRef.current.currentTime = videoRef.current.currentTime;
        }
        
        // Play audio if available
        if (audioRef.current && primaryAudioSrc) {
          audioRef.current.play().catch(console.error);
        }
      } else {
        videoRef.current.pause();
        
        // Also pause the original video if in split-screen mode
        if (editorSettings.splitScreenPreview && originalVideoRef.current) {
          originalVideoRef.current.pause();
        }
        
        // Pause audio if available
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }
    }
  }, [isPlaying, togglePlayback, editorSettings.splitScreenPreview, primaryAudioSrc]);
  
  // Update video time when currentTime changes
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
      
      // Also update the original video if in split-screen mode
      if (editorSettings.splitScreenPreview && originalVideoRef.current) {
        originalVideoRef.current.currentTime = currentTime;
      }
    }
    
    // Check if we need to update audio
    if (audioRef.current && primaryAudioClip) {
      // If current time is within the audio clip's range
      if (currentTime >= primaryAudioClip.startTime && currentTime <= primaryAudioClip.endTime) {
        const audioOffset = currentTime - primaryAudioClip.startTime;
        audioRef.current.currentTime = audioOffset;
        
        // Play audio if we're playing and it's not already playing
        if (isPlaying && audioRef.current.paused) {
          audioRef.current.play().catch(console.error);
        }
      } else {
        // If current time is outside the audio clip's range, pause the audio
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    }
  }, [currentTime, editorSettings.splitScreenPreview, primaryAudioClip, isPlaying]);
  
  // Update audio source when active audio clip changes
  useEffect(() => {
    if (audioRef.current && primaryAudioSrc) {
      // Only update if the source has changed
      if (audioRef.current.src !== primaryAudioSrc) {
        audioRef.current.src = primaryAudioSrc;
        audioRef.current.load();
        audioRef.current.volume = volume;
        audioRef.current.muted = isMuted;
        
        if (isPlaying && primaryAudioClip && 
            currentTime >= primaryAudioClip.startTime && 
            currentTime <= primaryAudioClip.endTime) {
          const audioOffset = currentTime - primaryAudioClip.startTime;
          audioRef.current.currentTime = audioOffset;
          audioRef.current.play().catch(console.error);
        }
      }
    } else if (audioRef.current && !primaryAudioSrc) {
      // No active audio clip, pause audio
      audioRef.current.pause();
    }
  }, [primaryAudioSrc, isPlaying, volume, isMuted, currentTime, primaryAudioClip]);
  
  // Update currentTime when video time changes
  const handleTimeUpdate = () => {
    if (videoRef.current && activeVideoClip) {
      const globalTime = activeVideoClip.startTime + videoRef.current.currentTime;
      // Only update if the time has actually changed to avoid excessive re-renders
      if (Math.abs(currentTime - globalTime) > 0.01) { 
        setCurrentTime(globalTime);
      }
    }
  };
  
  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
  };
  
  // Handle mute toggle
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };
  
  // Handle fullscreen toggle
  const handleFullscreenToggle = () => {
    const previewContainer = document.getElementById("video-preview-container");
    
    if (!previewContainer) return;
    
    if (!document.fullscreenElement) {
      previewContainer.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      });
    }
  };
  
  // Handle split-screen toggle
  const handleSplitScreenToggle = () => {
    updateEditorSettings({ splitScreenPreview: !editorSettings.splitScreenPreview });
  };
  
  // Handle hover preview
  const handlePreviewHover = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || isPlaying) return;
    
    const rect = videoRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const ratio = x / width;
    const previewTime = ratio * (videoRef.current.duration || 0);
    
    // Show a 2-second preview at the hover position
    videoRef.current.currentTime = previewTime;
    videoRef.current.play().then(() => {
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }, 2000);
    }).catch(console.error);
  };
  
  return (
    <div 
      id="video-preview-container"
      className="flex-1 flex flex-col items-center justify-center bg-gray-900 p-4 relative"
    >
      {/* Hidden audio element for audio clips */}
      <audio 
        ref={audioRef} 
        src={primaryAudioSrc} 
        className="hidden"
      />
      
      <div className={`relative w-full max-w-3xl ${editorSettings.splitScreenPreview ? "flex space-x-2" : ""}`}>
        {/* Main preview */}
        <div className={`${editorSettings.splitScreenPreview ? "flex-1" : "w-full"} aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center`}>
          {activeVideoSrc ? (
            <video
              ref={videoRef}
              src={activeVideoSrc}
              className="w-full h-full"
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => {
                const globalEndTimeOfClip = activeVideoClip ? activeVideoClip.endTime : currentTime;
                // If the clip ended and it's not the very end of the timeline,
                // advance currentTime slightly to ensure the next clip/state is evaluated.
                if (isPlaying && globalEndTimeOfClip < duration) {
                  // Advance slightly past the end of the clip to ensure the next effect picks up a new activeClip
                  // This also helps if there's a tiny gap or rounding issue.
                  setCurrentTime(globalEndTimeOfClip + 0.01);
                } else if (isPlaying && globalEndTimeOfClip >= duration) {
                  // End of timeline, stop playback
                  togglePlayback();
                }
                // If not isPlaying, do nothing, time is managed by scrubbing or other interactions
              }}
              onMouseMove={handlePreviewHover}
            />
          ) : (
            <div className="text-gray-500 text-center">
              <p>No video selected</p>
              <p className="text-sm">Add media to the timeline to preview</p>
            </div>
          )}
        </div>
        
        {/* Original video (for split-screen comparison) */}
        {editorSettings.splitScreenPreview && (
          <div className="flex-1 aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
            {activeVideoSrc ? (
              <video
                ref={originalVideoRef}
                src={activeVideoSrc}
                className="w-full h-full"
              />
            ) : (
              <div className="text-gray-500 text-center">
                <p>Original video</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Preview controls */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-80 rounded-full px-4 py-2 flex items-center space-x-4">
        <Button 
          size="sm" 
          variant="ghost" 
          className="text-white"
          onClick={handleMuteToggle}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        
        <div className="w-24">
          <Slider
            value={[volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
          />
        </div>
      </div>
      
      {/* Top controls */}
      <div className="absolute top-6 right-6 flex space-x-4 items-center">
        <div className="flex items-center space-x-2">
          <Switch
            id="split-screen"
            checked={editorSettings.splitScreenPreview}
            onCheckedChange={handleSplitScreenToggle}
          />
          <Label htmlFor="split-screen" className="text-white text-sm">Split Screen</Label>
        </div>
        
        <Button 
          size="sm" 
          variant="ghost" 
          className="text-white"
          onClick={handleFullscreenToggle}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
