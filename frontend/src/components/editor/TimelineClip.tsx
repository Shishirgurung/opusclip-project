import React, { useState, useRef } from "react";
import { useEditor, TimelineClip as TimelineClipType } from "@/contexts/EditorContext";
import { Scissors, Volume2, VolumeX, Link, Unlink, Trash2 } from "lucide-react";

interface TimelineClipProps {
  clip: TimelineClipType;
  timeToPosition: (time: number) => number;
  positionToTime: (position: number) => number;
  color: string;
}

export function TimelineClip({ clip, timeToPosition, positionToTime, color }: TimelineClipProps) {
  const { 
    mediaLibrary, 
    updateTimelineClip, 
    removeTimelineClip,
    selectedClipId, 
    setSelectedClipId,
    selectedClipIds,
    toggleClipSelection,
    editorSettings,
    splitClipAtTime,
    detachAudio,
    linkToVideo,
    currentTime, // Added currentTime for playhead constraint
    setTrimmingPreviewTime, // Added for dedicated trim preview
    isPlaying,              // Added to check playback state
    togglePlayback          // Added to pause playback on trim start
  } = useEditor();
  
  const clipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizingStart, setIsResizingStart] = useState(false);
  const [isResizingEnd, setIsResizingEnd] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [originalStartTime, setOriginalStartTime] = useState(0);
  const [originalEndTime, setOriginalEndTime] = useState(0);
  const [originalSourceOffset, setOriginalSourceOffset] = useState(0);
  const [showVolumeControls, setShowVolumeControls] = useState(false);
  const [hasDragExceededThreshold, setHasDragExceededThreshold] = useState(false);

  const media = mediaLibrary.find(m => m.id === clip.mediaId);
  const clipDuration = clip.endTime - clip.startTime;
  const isSelected = selectedClipId === clip.id || selectedClipIds.includes(clip.id);
  const isInTrimMode = editorSettings.trimMode;
  
  const DRAG_THRESHOLD = 5; // Pixels

  // Handle mouse down on clip body (for dragging)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If shift key is pressed, toggle multi-selection
    if (e.shiftKey) {
      toggleClipSelection(clip.id);
    } else {
      setSelectedClipId(clip.id);
    }
    
    setIsDragging(true);
    setIsResizingStart(false); // Ensure other modes are off
    setIsResizingEnd(false);   // Ensure other modes are off
    setDragStartX(e.clientX);
    setOriginalStartTime(clip.startTime);
    setOriginalEndTime(clip.endTime);
    setHasDragExceededThreshold(false); // Reset threshold flag
  };
  
  // Handle mouse down on start handle (for trimming start)
  const handleStartHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const playheadElement = document.getElementById('editor-playhead');
    if (playheadElement) {
      console.log('[TimelineClip] handleStartHandleMouseDown: Playhead pointerEvents BEFORE change:', playheadElement.style.pointerEvents);
      playheadElement.style.pointerEvents = 'none';
      console.log('[TimelineClip] handleStartHandleMouseDown: Playhead pointerEvents AFTER change to none:', playheadElement.style.pointerEvents);
    } else {
      console.warn('[TimelineClip] handleStartHandleMouseDown: Playhead element with ID "editor-playhead" not found.');
    }
    if (isPlaying) {
      togglePlayback(); // Pause playback if it's active
    }
    setIsResizingStart(true);
    setIsDragging(false);     // Ensure other modes are off
    setIsResizingEnd(false);  // Ensure other modes are off
    setDragStartX(e.clientX);
    console.log("TimelineClip: MouseDown on START handle"); // Debug log
    setOriginalStartTime(clip.startTime);
    setOriginalSourceOffset(clip.sourceOffset || 0);
    setSelectedClipId(clip.id);
    setHasDragExceededThreshold(false); // Reset threshold flag
  };
  
  // Handle mouse down on end handle (for trimming end)
  const handleEndHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const playheadElement = document.getElementById('editor-playhead');
    if (playheadElement) {
      console.log('[TimelineClip] handleEndHandleMouseDown: Playhead pointerEvents BEFORE change:', playheadElement.style.pointerEvents);
      playheadElement.style.pointerEvents = 'none';
      console.log('[TimelineClip] handleEndHandleMouseDown: Playhead pointerEvents AFTER change to none:', playheadElement.style.pointerEvents);
    } else {
      console.warn('[TimelineClip] handleEndHandleMouseDown: Playhead element with ID "editor-playhead" not found.');
    }
    if (isPlaying) {
      togglePlayback(); // Pause playback if it's active
    }
    setIsResizingEnd(true);
    setIsDragging(false);     // Ensure other modes are off
    setIsResizingStart(false); // Ensure other modes are off
    setDragStartX(e.clientX);
    console.log("TimelineClip: MouseDown on END handle"); // Debug log
    setOriginalEndTime(clip.endTime);
    setSelectedClipId(clip.id);
    setHasDragExceededThreshold(false); // Reset threshold flag
  };
  
  // Handle mouse move (for dragging and trimming)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging && !isResizingStart && !isResizingEnd) return;

    const deltaX = e.clientX - dragStartX;

    // First, check if drag has exceeded threshold if it hasn't already been marked as such.
    if (!hasDragExceededThreshold) {
      if (Math.abs(deltaX) > DRAG_THRESHOLD) {
        setHasDragExceededThreshold(true);
        // Threshold is now exceeded, proceed with calculations in this same event.
      } else {
        return; // Don't do anything until threshold is met
      }
    }

    // If we've reached here, hasDragExceededThreshold is true.
    // Proceed with updates.
    let deltaTime = positionToTime(deltaX);

    const mediaFps = clip.mediaFps;
    const minClipDurationFrames = 1; // Minimum 1 frame
    const minClipDurationSeconds = mediaFps && mediaFps > 0 
      ? minClipDurationFrames / mediaFps 
      : 0.1; // Fallback to 0.1 seconds if no FPS

    if (isResizingStart) {
      let newStartTime = originalStartTime + deltaTime;
      let newSourceOffset = originalSourceOffset + deltaTime;

      if (mediaFps && mediaFps > 0) {
        const frameDuration = 1 / mediaFps;
        newStartTime = Math.round(newStartTime / frameDuration) * frameDuration;
        const snappedDeltaTime = newStartTime - originalStartTime;
        newSourceOffset = originalSourceOffset + snappedDeltaTime;
        newSourceOffset = Math.round(newSourceOffset / frameDuration) * frameDuration;
      }

      // Constraint: Start handle cannot go to the left of the playhead
      newStartTime = Math.max(newStartTime, currentTime);
      // Recalculate snappedDeltaTime and newSourceOffset if newStartTime was adjusted by playhead constraint
      if (mediaFps && mediaFps > 0) {
        const potentiallyAdjustedSnappedDeltaTime = newStartTime - originalStartTime;
        newSourceOffset = originalSourceOffset + potentiallyAdjustedSnappedDeltaTime;
        newSourceOffset = Math.round(newSourceOffset / (1 / mediaFps)) * (1 / mediaFps); // Re-snap sourceOffset
      }

      newStartTime = Math.max(0, newStartTime);
      newSourceOffset = Math.max(0, newSourceOffset);

      if (media && media.duration && newSourceOffset > media.duration - minClipDurationSeconds) {
        const cappedSourceOffset = media.duration - minClipDurationSeconds;
        // If newSourceOffset is capped, newStartTime must be adjusted to maintain the relationship:
        // cappedSourceOffset = originalSourceOffset + (newStartTime_adjusted - originalStartTime)
        // So, newStartTime_adjusted = originalStartTime + (cappedSourceOffset - originalSourceOffset)
        newStartTime = originalStartTime + (cappedSourceOffset - originalSourceOffset);
        newSourceOffset = cappedSourceOffset; // Use the capped value

         // Re-snap newStartTime if it was adjusted due to sourceOffset capping and FPS is available
        if (mediaFps && mediaFps > 0) {
            const frameDuration = 1 / mediaFps;
            newStartTime = Math.round(newStartTime / frameDuration) * frameDuration;
        }
      }
      newStartTime = Math.max(0, newStartTime); // Ensure start time is not negative after adjustment

      if (newStartTime < clip.endTime - minClipDurationSeconds) {
        console.log(`TimelineClip: ResizingStart - Updating to startTime: ${newStartTime}, sourceOffset: ${newSourceOffset}`); // Debug log
        updateTimelineClip(clip.id, { startTime: newStartTime, sourceOffset: newSourceOffset });
        if (setTrimmingPreviewTime) {
          console.log(`TimelineClip: ResizingStart - Calling setTrimmingPreviewTime(${newStartTime})`); // Debug log
          setTrimmingPreviewTime(newStartTime);
        }
      }

    } else if (isResizingEnd) {
      let newEndTime = originalEndTime + deltaTime;

      if (mediaFps && mediaFps > 0) {
        const frameDuration = 1 / mediaFps;
        newEndTime = Math.round(newEndTime / frameDuration) * frameDuration;
      }

      // Constraint: End handle cannot go to the left of the playhead
      newEndTime = Math.max(newEndTime, currentTime);

      if (media && media.duration && (clip.sourceOffset + (newEndTime - clip.startTime)) > media.duration) {
        newEndTime = clip.startTime + (media.duration - (clip.sourceOffset || 0));
        // Re-snap newEndTime if it was adjusted due to media duration and FPS is available
        if (mediaFps && mediaFps > 0) {
            const frameDuration = 1 / mediaFps;
            newEndTime = Math.round(newEndTime / frameDuration) * frameDuration;
        }
      }
      
      if (newEndTime > clip.startTime + minClipDurationSeconds) {
        console.log(`TimelineClip: ResizingEnd - Updating to endTime: ${newEndTime}`); // Debug log
        updateTimelineClip(clip.id, { endTime: newEndTime });
        if (setTrimmingPreviewTime) {
          console.log(`TimelineClip: ResizingEnd - Calling setTrimmingPreviewTime(${newEndTime})`); // Debug log
          setTrimmingPreviewTime(newEndTime);
        }
      }
    } else if (isDragging) {
      let newStartTime = originalStartTime + deltaTime;
      if (mediaFps && mediaFps > 0) {
        const frameDuration = 1 / mediaFps;
        newStartTime = Math.round(newStartTime / frameDuration) * frameDuration;
      }
      newStartTime = Math.max(0, newStartTime);
      // Recalculate clip duration based on original start/end times to maintain it accurately
      const currentClipDuration = originalEndTime - originalStartTime;
      const newEndTime = newStartTime + currentClipDuration;

      updateTimelineClip(clip.id, {
        startTime: newStartTime,
        endTime: newEndTime
      });
      // Optional: Live preview when dragging the whole clip
      // if (setCurrentTime) {
      //   console.log(`TimelineClip: Dragging - Calling setCurrentTime(${newStartTime})`); // Debug log
      //   setCurrentTime(newStartTime);
      // }
    }
  };
  
  // Handle mouse up (end dragging/trimming)
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizingStart(false);
    setIsResizingEnd(false);
    if (setTrimmingPreviewTime) {
      console.log("TimelineClip: MouseUp - Clearing trimmingPreviewTime"); // Debug log
      setTrimmingPreviewTime(null);
    }
    const playheadElement = document.getElementById('editor-playhead');
    if (playheadElement) {
      console.log('[TimelineClip] handleMouseUp: Playhead pointerEvents BEFORE change:', playheadElement.style.pointerEvents);
      playheadElement.style.pointerEvents = 'auto';
      console.log('[TimelineClip] handleMouseUp: Playhead pointerEvents AFTER change to auto:', playheadElement.style.pointerEvents);
    } else {
      console.warn('[TimelineClip] handleMouseUp: Playhead element with ID "editor-playhead" not found.');
    }
  };
  
  // Handle right click on clip
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowVolumeControls(!showVolumeControls);
  };
  
  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    updateTimelineClip(clip.id, { volume });
  };
  
  // Handle mute toggle
  const handleMuteToggle = () => {
    updateTimelineClip(clip.id, { muted: !clip.muted });
  };
  
  // Handle split clip
  const handleSplitClip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!clipRef.current) return;
    
    const rect = clipRef.current.getBoundingClientRect();
    const clickPositionRelative = e.clientX - rect.left;
    const clipWidth = rect.width;
    const splitRatio = clickPositionRelative / clipWidth;
    const splitTime = clip.startTime + (clipDuration * splitRatio);
    
    splitClipAtTime(clip.id, splitTime);
  };
  
  // Handle detach audio (for video clips)
  const handleDetachAudio = () => {
    if (clip.type === "video" && !clip.detachedAudio) {
      detachAudio(clip.id);
    }
  };
  
  // Handle link to video (for audio clips)
  const handleLinkToVideo = () => {
    // This would typically open a dialog to select which video to link to
    // For now, we'll just link to the first video clip
    if (clip.type === "audio") {
      const firstVideoClip = mediaLibrary.find(item => item.type === "video");
      if (firstVideoClip) {
        linkToVideo(clip.id, firstVideoClip.id);
      }
    }
  };
  
  return (
    <div
      ref={clipRef}
      className={`absolute h-full top-0 ${color} rounded-sm cursor-move group ${
        isSelected ? "ring-2 ring-white" : ""
      }`}
      style={{
        left: `${timeToPosition(clip.startTime)}%`,
        width: `${timeToPosition(clipDuration)}%`,
        opacity: clip.muted ? 0.5 : 1
      }}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedClipId(clip.id);
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      {/* Clip content */}
      <div className="p-1 text-xs text-white truncate h-full flex flex-col">
        <div className="flex-1 flex items-center">
          {/* 
          <span className="truncate">
            {media?.name || (clip.type === "text" ? "Text" : clip.type === "audio" ? "Audio" : "Clip")}
          </span>
          */}
          
          {clip.muted && <VolumeX className="h-3 w-3 ml-1" />}
          {clip.linkedVideoId && <Link className="h-3 w-3 ml-1" />}
        </div> 
        {/* This closing div was missing */}
        
        {/* Waveform visualization for audio */}
        {clip.type === "audio" && media?.waveform && (
          <div className="h-3 w-full flex items-end space-x-px overflow-hidden">
            {media.waveform.map((value, i) => (
              <div 
                key={i} 
                className="w-0.5 bg-white opacity-50"
                style={{ height: `${value * 100}%` }}
              />
            ))}
          </div>
        )}
      </div> {/* This closes the 'p-1 text-xs text-white truncate h-full flex flex-col' div */}
      
      {/* Trim handles (only show in trim mode or on hover/selection) */}
      {(isInTrimMode || isSelected || clipRef.current?.matches(':hover')) && (
        <>
          {/* Start trim handle */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-2.5 bg-white cursor-ew-resize opacity-70 hover:opacity-100"
            style={{ zIndex: 35 }}
            onMouseDown={handleStartHandleMouseDown}
          />
          
          {/* End trim handle */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-2.5 bg-white cursor-ew-resize opacity-70 hover:opacity-100"
            style={{ zIndex: 35 }}
            onMouseDown={handleEndHandleMouseDown}
          />
        </>
      )}
      
      {/* Fade handles (only for audio clips) */}
      {clip.type === "audio" && (isSelected || clipRef.current?.matches(':hover')) && (
        <>
          {/* Fade in handle */}
          <div 
            className="absolute left-0 top-0 w-4 h-4 bg-green-500 rounded-full -ml-2 -mt-2 cursor-pointer opacity-70 hover:opacity-100"
            onMouseDown={(e) => {
              e.stopPropagation();
              // Handle fade in adjustment
            }}
          />
          
          {/* Fade out handle */}
          <div 
            className="absolute right-0 top-0 w-4 h-4 bg-green-500 rounded-full -mr-2 -mt-2 cursor-pointer opacity-70 hover:opacity-100"
            onMouseDown={(e) => {
              e.stopPropagation();
              // Handle fade out adjustment
            }}
          />
        </>
      )}
      
      {/* Clip controls (only show when selected) */}
      {isSelected && (
        <div className="absolute -top-8 left-0 bg-gray-800 rounded-md p-1 flex items-center space-x-1 z-20">
          <button 
            className="p-1 hover:bg-gray-700 rounded"
            onClick={handleSplitClip}
            title="Split clip"
          >
            <Scissors className="h-3 w-3 text-white" />
          </button>
          
          <button 
            className="p-1 hover:bg-gray-700 rounded"
            onClick={handleMuteToggle}
            title={clip.muted ? "Unmute" : "Mute"}
          >
            {clip.muted ? (
              <VolumeX className="h-3 w-3 text-white" />
            ) : (
              <Volume2 className="h-3 w-3 text-white" />
            )}
          </button>
          
          {/* Remove Clip Button */}
          <button 
            className="p-1 hover:bg-gray-700 rounded text-red-500 hover:text-red-400"
            onClick={(e) => {
              e.stopPropagation(); // Prevent clip selection changes
              removeTimelineClip(clip.id);
            }}
            title="Remove clip"
          >
            <Trash2 className="h-3 w-3" />
          </button>

          {clip.type === "video" && !clip.detachedAudio && (
            <button 
              className="p-1 hover:bg-gray-700 rounded"
              onClick={handleDetachAudio}
              title="Detach audio"
            >
              <Unlink className="h-3 w-3 text-white" />
            </button>
          )}
          
          {clip.type === "audio" && !clip.linkedVideoId && (
            <button 
              className="p-1 hover:bg-gray-700 rounded"
              onClick={handleLinkToVideo}
              title="Link to video"
            >
              <Link className="h-3 w-3 text-white" />
            </button>
          )}
        </div>
      )}
      
      {/* Volume controls (show when right-clicked) */}
      {showVolumeControls && (
        <div 
          className="absolute -bottom-12 left-0 bg-gray-800 rounded-md p-2 z-20 min-w-[100px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center space-x-2">
            <button onClick={handleMuteToggle}>
              {clip.muted ? (
                <VolumeX className="h-4 w-4 text-white" />
              ) : (
                <Volume2 className="h-4 w-4 text-white" />
              )}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={clip.volume || 1}
              onChange={handleVolumeChange}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
