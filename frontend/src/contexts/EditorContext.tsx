import React, { createContext, useContext, useState, useEffect } from "react";

export interface MediaItem {
  id: string;
  type: "video" | "audio" | "image";
  name: string;
  src: string;
  duration?: number;
  thumbnail?: string;
  waveform?: number[]; // Audio waveform data
  isExclusiveAudio?: boolean; // Flag for exclusive audio library
  tags?: string[]; // Tags for organizing media
  isFavorite?: boolean; // Favorite status
  captions?: { status: 'none' | 'in-progress' | 'completed' | 'failed' }; // Added to fix build error
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  startTime: number;
  endTime: number;
  trackIndex: number;
  type: "video" | "audio" | "text";
  volume?: number; // Volume level (0-1)
  fadeIn?: number; // Fade in duration in seconds
  fadeOut?: number; // Fade out duration in seconds
  detachedAudio?: boolean; // If audio is detached from video
  linkedVideoId?: string; // ID of linked video clip
  muted?: boolean; // If audio is muted
  solo?: boolean; // If track is soloed
  volumePoints?: {time: number, value: number}[]; // Points for volume curve
  thumbnails?: string[]; // Array of thumbnail URLs for video clips
  sourceOffset?: number; // Added to fix build error
  mediaFps?: number; // Frames per second of the source media
}

export interface TextClip {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  trackIndex: number;
  type: "text";
  mediaId?: string; // Added to make TextClip compatible with TimelineClip
  style: {
    fontFamily: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    alignment: "left" | "center" | "right";
  };
}

export interface EditorSettings {
  thumbnailInterval: number; // Interval for generating thumbnails in seconds
  snapToClips: boolean; // Enable/disable snapping to clip edges
  showWaveforms: boolean; // Show audio waveforms
  splitScreenPreview: boolean; // Enable split-screen preview
  trimMode: boolean; // Trim mode active
}

interface EditorContextType {
  projectName: string;
  setProjectName: (name: string) => void;
  mediaLibrary: MediaItem[];
  addMediaItem: (item: MediaItem) => void;
  addMediaItemToTimeline: (item: MediaItem) => void;
  removeMediaItem: (id: string) => void;
  updateMediaItem: (id: string, updates: Partial<MediaItem>) => void;
  timelineClips: TimelineClip[];
  addTimelineClip: (clip: TimelineClip) => void;
  updateTimelineClip: (id: string, updates: Partial<TimelineClip>) => void;
  removeTimelineClip: (id: string) => void;
  textClips: TextClip[];
  prebuiltAudioLibrary: MediaItem[];
  addTextClip: (clip: TextClip) => void;
  updateTextClip: (id: string, updates: Partial<TextClip>) => void;
  removeTextClip: (id: string) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  togglePlayback: () => void;
  duration: number;
  setDuration: (duration: number) => void;
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  selectedClipIds: string[]; // For multi-select
  toggleClipSelection: (id: string) => void;
  clearSelection: () => void;
  editorSettings: EditorSettings;
  updateEditorSettings: (updates: Partial<EditorSettings>) => void;
  toggleTrimMode: () => void;
  setTrimmingPreviewTime: (time: number | null) => void;
  duplicateClip: (id: string) => void;
  splitClipAtTime: (id: string, time: number) => void;
  detachAudio: (videoClipId: string) => void;
  linkToVideo: (audioClipId: string, videoClipId: string) => void;
  addToExclusiveAudio: (id: string) => void;
  addTagToMedia: (id: string, tag: string) => void;
  toggleFavoriteMedia: (id: string) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projectName, setProjectName] = useState<string>("Untitled video");
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
  const [textClips, setTextClips] = useState<TextClip[]>([]);
  const [prebuiltAudioLibrary, setPrebuiltAudioLibrary] = useState<MediaItem[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0); // Initialize with 0, will be calculated
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    thumbnailInterval: 5,
    snapToClips: true,
    showWaveforms: true,
    splitScreenPreview: false,
    trimMode: false
  });
  const [trimmingPreviewTime, setTrimmingPreviewTime] = useState<number | null>(null);

  // Mock data for testing
  useEffect(() => {
    // Add a sample video to the media library
    const sampleVideo: MediaItem = {
      id: "sample-video-1",
      type: "video",
      name: "Sample Video",
      src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", // Corrected in previous step
      duration: 596, // Duration of BigBuckBunny
      thumbnail: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=200&h=200&fit=crop"
    };
    setMediaLibrary([sampleVideo]);

    // Add a sample clip to the timeline for initial testing
    // const initialClip: TimelineClip = {
    //   id: "initial-clip-1",
    //   mediaId: sampleVideo.id,
    //   startTime: 0,
    //   endTime: 10, // Show first 10 seconds
    //   trackIndex: 0,
    //   type: "video",
    // };
    // setTimelineClips([initialClip]);

  }, []);

  // Effect to calculate total duration whenever timelineClips change
  useEffect(() => {
    if (timelineClips.length === 0) {
      setDuration(0); // No clips, duration is 0
      return;
    }

    // Find the maximum endTime among all clips
    const maxEndTime = timelineClips.reduce((max, clip) => {
      return clip.endTime > max ? clip.endTime : max;
    }, 0);
    setDuration(maxEndTime);
  }, [timelineClips]);

  const addMediaItemToTimeline = (item: MediaItem) => {
    if (item.type === 'audio' || item.type === 'video') {
        const newClip: TimelineClip = {
            id: `clip_${Date.now()}`,
            mediaId: item.id,
            startTime: duration, // Adds the clip at the end of the timeline
            endTime: duration + (item.duration || 10), // Use item duration or a default
            trackIndex: item.type === 'video' ? 0 : 1, // Videos on track 0, audio on track 1
            type: item.type,
        };
        addTimelineClip(newClip);
    }
  };

  const addMediaItem = (item: MediaItem) => {
    setMediaLibrary(prev => [...prev, item]);
  };

  const removeMediaItem = (id: string) => {
    setMediaLibrary(prev => prev.filter(item => item.id !== id));
    // Also remove any timeline clips that use this media
    setTimelineClips(prev => prev.filter(clip => clip.mediaId !== id));
  };

  const updateMediaItem = (id: string, updates: Partial<MediaItem>) => {
    setMediaLibrary(prev => 
      prev.map(item => item.id === id ? { ...item, ...updates } : item)
    );
  };

  const addTimelineClip = (clip: TimelineClip) => {
    // Ensure the clip has the full duration of the media item if not specified
    if (!clip.endTime && clip.mediaId) {
      const media = mediaLibrary.find(item => item.id === clip.mediaId);
      if (media && media.duration) {
        clip.endTime = clip.startTime + media.duration;
      }
    }
    
    setTimelineClips(prev => [...prev, clip]);
  };

  const updateTimelineClip = (id: string, updates: Partial<TimelineClip>) => {
    setTimelineClips(prev => 
      prev.map(clip => clip.id === id ? { ...clip, ...updates } : clip)
    );
  };

  const removeTimelineClip = (id: string) => {
    setTimelineClips(prev => prev.filter(clip => clip.id !== id));
  };

  const addTextClip = (clip: TextClip) => {
    setTextClips(prev => [...prev, clip]);
  };

  const updateTextClip = (id: string, updates: Partial<TextClip>) => {
    setTextClips(prev => 
      prev.map(clip => clip.id === id ? { ...clip, ...updates } : clip)
    );
  };

  const removeTextClip = (id: string) => {
    setTextClips(prev => prev.filter(clip => clip.id !== id));
  };

  const togglePlayback = () => {
    setIsPlaying(prev => !prev);
  };

  const toggleClipSelection = (id: string) => {
    setSelectedClipIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(clipId => clipId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const clearSelection = () => {
    setSelectedClipIds([]);
    setSelectedClipId(null);
  };

  const updateEditorSettings = (updates: Partial<EditorSettings>) => {
    setEditorSettings(prev => ({ ...prev, ...updates }));
  };

  const toggleTrimMode = () => {
    setEditorSettings(prev => ({ ...prev, trimMode: !prev.trimMode }));
  };

  const duplicateClip = (id: string) => {
    const clipToDuplicate = timelineClips.find(clip => clip.id === id);
    if (!clipToDuplicate) return;

    const newClip = {
      ...clipToDuplicate,
      id: Math.random().toString(36).substring(2, 9), // Simple ID generation
      startTime: clipToDuplicate.endTime, // Place after the original clip
      endTime: clipToDuplicate.endTime + (clipToDuplicate.endTime - clipToDuplicate.startTime)
    };

    addTimelineClip(newClip);
  };

  const splitClipAtTime = (id: string, time: number) => {
    const clipToSplit = timelineClips.find(clip => clip.id === id);
    if (!clipToSplit || time <= clipToSplit.startTime || time >= clipToSplit.endTime) return;

    // Create two new clips from the original
    const firstHalf = {
      ...clipToSplit,
      id: Math.random().toString(36).substring(2, 9),
      endTime: time
    };

    const secondHalf = {
      ...clipToSplit,
      id: Math.random().toString(36).substring(2, 9),
      startTime: time
    };

    // Remove the original clip and add the two new ones
    removeTimelineClip(id);
    addTimelineClip(firstHalf);
    addTimelineClip(secondHalf);
  };

  const detachAudio = (videoClipId: string) => {
    const videoClip = timelineClips.find(clip => clip.id === videoClipId && clip.type === "video");
    if (!videoClip) return;

    const mediaItem = mediaLibrary.find(item => item.id === videoClip.mediaId);
    if (!mediaItem) return;

    // Create a new audio clip based on the video clip
    const audioClip: TimelineClip = {
      id: Math.random().toString(36).substring(2, 9),
      mediaId: videoClip.mediaId,
      startTime: videoClip.startTime,
      endTime: videoClip.endTime,
      trackIndex: videoClip.trackIndex + 1, // Place on the next track
      type: "audio",
      detachedAudio: true,
      linkedVideoId: videoClip.id,
      volume: 1,
      muted: false
    };

    // Update the video clip to indicate its audio is detached
    updateTimelineClip(videoClipId, { detachedAudio: true });
    
    // Add the new audio clip
    addTimelineClip(audioClip);
  };

  const linkToVideo = (audioClipId: string, videoClipId: string) => {
    updateTimelineClip(audioClipId, { linkedVideoId: videoClipId });
  };

  const addToExclusiveAudio = (id: string) => {
    updateMediaItem(id, { isExclusiveAudio: true });
  };

  const addTagToMedia = (id: string, tag: string) => {
    const mediaItem = mediaLibrary.find(item => item.id === id);
    if (!mediaItem) return;

    const currentTags = mediaItem.tags || [];
    if (!currentTags.includes(tag)) {
      updateMediaItem(id, { tags: [...currentTags, tag] });
    }
  };

  const toggleFavoriteMedia = (id: string) => {
    const mediaItem = mediaLibrary.find(item => item.id === id);
    if (!mediaItem) return;

    updateMediaItem(id, { isFavorite: !mediaItem.isFavorite });
  };

  return (
    <EditorContext.Provider
      value={{
        projectName,
        setProjectName,
        mediaLibrary,
        addMediaItem,
        addMediaItemToTimeline,
        removeMediaItem,
        updateMediaItem,
        timelineClips,
        addTimelineClip,
        updateTimelineClip,
        removeTimelineClip,
        textClips,
        prebuiltAudioLibrary,
        addTextClip,
        updateTextClip,
        removeTextClip,
        currentTime,
        setCurrentTime,
        isPlaying,
        togglePlayback,
        duration,
        setDuration,
        selectedClipId,
        setSelectedClipId,
        selectedClipIds,
        toggleClipSelection,
        clearSelection,
        editorSettings,
        updateEditorSettings,
        toggleTrimMode,
        setTrimmingPreviewTime,
        duplicateClip,
        splitClipAtTime,
        detachAudio,
        linkToVideo,
        addToExclusiveAudio,
        addTagToMedia,
        toggleFavoriteMedia
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return context;
};
