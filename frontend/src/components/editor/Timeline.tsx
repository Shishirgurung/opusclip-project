import React, { useState, useRef, useEffect, useCallback } from "react";
import { useEditor, TimelineClip as TimelineClipType, TextClip, MediaItem } from "@/contexts/EditorContext";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Type, 
  Music, 
  Scissors, 
  ZoomIn, 
  ZoomOut,
  Volume2,
  Split
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { TimelineClip } from "@/components/editor/TimelineClip";
import { Tooltip } from "@/components/ui/tooltip";

export function Timeline() {
  const { 
    currentTime, 
    setCurrentTime, 
    isPlaying, 
    togglePlayback,
    duration,
    mediaLibrary,
    addMediaItem,
    timelineClips,
    addTimelineClip,
    updateTimelineClip,
    removeTimelineClip,
    selectedClipId,
    setSelectedClipId,
    editorSettings,
    toggleTrimMode,
    duplicateClip,
    splitClipAtTime,
    addTextClip
  } = useEditor();
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.5); // Increased default zoom for wider timeline
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragClipId, setDragClipId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<{ id: string, type: "video" | "audio" | "text" }[]>([
    { id: "video-1", type: "video" },
    { id: "audio-1", type: "audio" },
    { id: "text-1", type: "text" }
  ]);
  
  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Calculate position on timeline based on time
  const timeToPosition = useCallback((time: number) => {
    return (time / duration) * 100;
  }, [duration]);
  
  // Calculate time based on position on timeline
  const positionToTime = useCallback((position: number) => {
    const timelineWidth = timelineRef.current?.clientWidth || 1;
    return (position / timelineWidth) * duration;
  }, [duration]);
  
  // Handle timeline click to seek
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const newTime = positionToTime(clickPosition);
    
    setCurrentTime(Math.max(0, Math.min(newTime, duration)));
  };
  
  // Handle adding a clip to the timeline
  const handleAddClip = (mediaId: string, type: "video" | "audio") => {
    const media = mediaLibrary.find(item => item.id === mediaId);
    if (!media) return;
    
    const newClip: TimelineClipType = {
      id: uuidv4(),
      mediaId,
      startTime: currentTime,
      endTime: currentTime + (media.duration || 30),
      trackIndex: type === "video" ? 0 : 1,
      type,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      muted: false,
      sourceOffset: 0, // Added: Default to start of media
    };
    
    addTimelineClip(newClip);
    setSelectedClipId(newClip.id);
  };
  
  // Add text clip at current position
  const handleAddText = () => {
    const newTextClip: TextClip = {
      id: uuidv4(),
      text: "Add your text here",
      startTime: currentTime,
      endTime: currentTime + 5,
      trackIndex: 2,
      type: "text",
      mediaId: "text-" + uuidv4(), // Add a mediaId for compatibility
      style: {
        fontFamily: "Arial",
        fontSize: 24,
        color: "#ffffff",
        bold: false,
        italic: false,
        alignment: "center"
      }
    };
    
    addTextClip(newTextClip);
    setSelectedClipId(newTextClip.id);
  };
  
  // Add audio track
  const handleAddAudio = () => {
    // This would typically open a dialog to select audio
    // For now, we'll just add a placeholder
    const audioMedia = mediaLibrary.find(item => item.type === "audio");
    
    if (audioMedia) {
      const newAudioClip: TimelineClipType = {
        id: uuidv4(),
        mediaId: audioMedia.id,
        startTime: currentTime,
        endTime: currentTime + (audioMedia.duration || 30),
        trackIndex: 1,
        type: "audio",
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        muted: false,
        sourceOffset: 0 // Add this line
      };
      
      addTimelineClip(newAudioClip);
      setSelectedClipId(newAudioClip.id);
    }
  };
  
  // Handle zoom in
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 8)); // Increased max zoom
  };
  
  // Handle zoom out
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.5));
  };
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar - Play/Pause
      if (e.code === "Space") {
        togglePlayback();
      }
      
      // T - Toggle trim mode
      if (e.code === "KeyT") {
        toggleTrimMode();
      }
      
      // Ctrl/Cmd + D - Duplicate selected clip
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyD" && selectedClipId) {
        e.preventDefault();
        duplicateClip(selectedClipId);
      }
      
      // Ctrl/Cmd + Z - Undo (would need to implement history)
      // Ctrl/Cmd + Y - Redo (would need to implement history)
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayback, toggleTrimMode, duplicateClip, selectedClipId]);
  
  // Handle drop on timeline
  const handleDrop = (e: React.DragEvent, trackIndex: number) => {
    e.preventDefault();
    
    const dataString = e.dataTransfer.getData("application/json");
    if (!dataString) return;

    const droppedItemData = JSON.parse(dataString);

    const { 
      id: itemId, // This is the original ID from mediaLibrary or prebuiltAudioLibrary
      name: itemName,
      src: itemSrc,
      type: itemType, // This will be 'video', 'audio', 'image', or 'prebuilt-audio'
      duration: itemDuration, // May be undefined for prebuilt audio initially
      isPrebuilt 
    } = droppedItemData;

    if (!timelineRef.current) return;

    const timelineRect = timelineRef.current.getBoundingClientRect();
    const dropX = e.clientX - timelineRect.left;
    const newClipStartTime = (dropX / timelineRect.width) * duration;
    let newClipMediaId = itemId;

    // Handle prebuilt audio: ensure it's in mediaLibrary
    if (isPrebuilt && itemType === 'prebuilt-audio') {
      const existingMediaItem = mediaLibrary.find(item => item.id === itemId);
      if (!existingMediaItem) {
        // If it's not in mediaLibrary, add it.
        // The ID from prebuiltAudioLibrary is already prefixed (e.g., prebuilt_...)
        const newMediaItemData: MediaItem = {
          id: itemId, 
          name: itemName,
          src: itemSrc,
          type: 'audio', // It's an audio type in the media library
          isExclusiveAudio: true,
          // Duration will be undefined here; can be fetched later if needed
        };

        addMediaItem(newMediaItemData);
        // newClipMediaId remains itemId, which is now in mediaLibrary
      }
    }

    // Determine default duration (e.g., 5 seconds for images or audio without duration)
    let clipDuration = itemDuration;
    if (itemType === 'image' || (itemType === 'audio' && !itemDuration) || (isPrebuilt && !itemDuration)) {
      clipDuration = 5; // Default 5 seconds for images or audio without known duration
    }
    if (!clipDuration || clipDuration <= 0) {
        clipDuration = 10; // Fallback default duration
    }

    const newClip: TimelineClipType = {
      id: Math.random().toString(36).substring(2, 9), // Generate a new unique ID for the timeline clip itself
      mediaId: newClipMediaId, // This is the ID of the item in mediaLibrary
      startTime: newClipStartTime,
      endTime: newClipStartTime + clipDuration,
      trackIndex: trackIndex,
      type: (isPrebuilt && itemType === 'prebuilt-audio') ? 'audio' : itemType, // Final type on timeline
      volume: 1,
      muted: false,
      sourceOffset: 0, // Add this line: Start from the beginning of the source media
    };

    addTimelineClip(newClip);

    // Optional: Adjust total timeline duration if the new clip extends it
  };
  
  // Add a new track
  const handleAddTrack = (type: "video" | "audio" | "text") => {
    const newTrackId = `${type}-${tracks.filter(t => t.type === type).length + 1}`;
    setTracks(prev => [...prev, { id: newTrackId, type }]);
  };
  
  return (
    <div className="h-96 bg-gray-800 border-t border-gray-700 flex flex-col"> {/* Increased height from h-80 to h-96 */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-gray-300 hover:text-white"
            onClick={() => setCurrentTime(0)}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-gray-300 hover:text-white"
            onClick={togglePlayback}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-gray-300 hover:text-white"
            onClick={() => setCurrentTime(Math.min(currentTime + 5, duration))}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          
          <div className="text-gray-300 text-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            size="sm" 
            variant={editorSettings.trimMode ? "default" : "ghost"} 
            className={`text-gray-300 ${editorSettings.trimMode ? "bg-purple-600" : "hover:text-white"}`}
            onClick={toggleTrimMode}
            title="Toggle trim mode (T)"
          >
            <Scissors className="h-4 w-4 mr-1" />
            <span className="text-xs">Trim</span>
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-gray-300 hover:text-white"
            onClick={handleAddText}
            title="Add text"
          >
            <Type className="h-4 w-4 mr-1" />
            <span className="text-xs">Text</span>
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-gray-300 hover:text-white"
            onClick={handleAddAudio}
            title="Add audio"
          >
            <Music className="h-4 w-4 mr-1" />
            <span className="text-xs">Audio</span>
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-gray-300 hover:text-white"
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-gray-300 hover:text-white"
            onClick={handleZoomOut}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-auto relative">
        <div className="flex">
          {/* Track labels */}
          <div className="w-24 flex-shrink-0">
            <div className="h-6 bg-gray-700"></div> {/* Time markers row */}
            
            {tracks.map((track, index) => (
              <div 
                key={track.id} 
                className="flex items-center h-14 px-2 border-b border-gray-700 bg-gray-700 text-gray-300 text-xs" /* Reduced height from h-20 to h-14 */
              >
                {track.type === "video" ? "Video" : track.type === "audio" ? "Audio" : "Text"} {index + 1}
              </div>
            ))}
            
            <div className="p-1">
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-gray-300 hover:text-white w-full"
                onClick={() => handleAddTrack("video")}
              >
                + Video
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-gray-300 hover:text-white w-full"
                onClick={() => handleAddTrack("audio")}
              >
                + Audio
              </Button>
            </div>
          </div>
          
          {/* Timeline content */}
          <div 
            ref={timelineRef}
            className="h-full relative flex-1"
            onClick={handleTimelineClick}
            style={{ width: `${100 * zoom}%`, minWidth: "calc(100% - 96px)" }}
          >
            {/* Time markers */}
            <div className="h-6 border-b border-gray-700 flex">
              {Array.from({ length: Math.ceil(duration / 60) + 1 }).map((_, i) => (
                <div 
                  key={i} 
                  className="flex-1 text-gray-400 text-xs border-r border-gray-700 relative"
                >
                  <span className="absolute left-1">{i}:00</span>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div 
                      key={j}
                      className="absolute h-2 w-px bg-gray-700"
                      style={{ left: `${(j + 1) * 20}%`, bottom: 0 }}
                    />
                  ))}
                </div>
              ))}
            </div>
            
            {/* Tracks */}
            {tracks.map((track, index) => (
              <div 
                key={track.id}
                className="h-14 border-b border-gray-700 bg-gray-900 relative" /* Reduced height from h-20 to h-14 */
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("bg-gray-800");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("bg-gray-800");
                }}
                onDrop={(e) => {
                  e.currentTarget.classList.remove("bg-gray-800");
                  handleDrop(e, index);
                }}
              >
                {/* Clips for this track */}
                {timelineClips
                  .filter(clip => clip.trackIndex === index)
                  .map(clip => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      timeToPosition={timeToPosition}
                      positionToTime={positionToTime}
                      color={
                        clip.type === "video" 
                          ? "bg-purple-600" 
                          : clip.type === "audio" 
                            ? "bg-green-600" 
                            : "bg-blue-600"
                      }
                    />
                  ))}
              </div>
            ))}
            
            {/* Playhead */}
            <div 
              id="editor-playhead" className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
              style={{ left: `${timeToPosition(currentTime)}%` }}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 -mt-1.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
