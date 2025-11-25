import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditor, MediaItem, TimelineClip } from "@/contexts/EditorContext";
import { Upload, Folder, Video, Mic, Image as ImageIcon, FileText, Package, Music, Star, Tag, Plus, Settings, Volume2, VolumeX } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music2, UploadCloud } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export function Sidebar() {
  const { 
    mediaLibrary, 
    addMediaItem, 
    timelineClips, 
    textClips, 
    prebuiltAudioLibrary, 
    addMediaItemToTimeline, 
    updateMediaItem, 
    updateTimelineClip,
    selectedClipId,
    addToExclusiveAudio, 
    addTagToMedia, 
    toggleFavoriteMedia,
    setDuration
  } = useEditor();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("media");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter media based on current filters
  const filteredMedia = mediaLibrary.filter(item => {
    // Exclude exclusive audio from the main media tab
    if (item.isExclusiveAudio) return false;

    // Filter by favorites if enabled
    if (showFavoritesOnly && !item.isFavorite) return false;
    
    // Filter by tag if selected
    if (filterTag && (!item.tags || !item.tags.includes(filterTag))) return false;
    
    return true;
  });
  
  // Get exclusive audio items
  const exclusiveAudioItems = mediaLibrary.filter(item => item.isExclusiveAudio && item.type === "audio");
  
  // Get all unique tags from media library
  const allTags = Array.from(new Set(
    mediaLibrary.flatMap(item => item.tags || [])
  ));

  const setData = (event: React.DragEvent, mediaItem: MediaItem, isPrebuilt = false) => {
    event.dataTransfer.setData("application/json", JSON.stringify({
      ...mediaItem,
      type: isPrebuilt ? 'prebuilt-audio' : mediaItem.type, // Special type for prebuilt
      isPrebuilt,
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const fileType = file.type.split("/")[0];
      const isVideo = fileType === "video";
      const isAudio = fileType === "audio";
      const isImage = fileType === "image";

      if (isVideo || isAudio || isImage) {
        const fileURL = URL.createObjectURL(file);
        
        const mockWaveform = isAudio ? Array.from({ length: 100 }, () => Math.random()) : undefined;
        const mediaDuration = isVideo ? 300 : isAudio ? 240 : undefined; // Placeholder

        if (mediaDuration) {
          setDuration(Math.max(300, mediaDuration + 60));
        }
        
        // Prepare the properties for otherDetails
        const mediaProperties: Partial<MediaItem> = {
          id: uuidv4(),
          type: isVideo ? "video" : isAudio ? "audio" : "image",
          name: file.name,
          src: fileURL,
          captions: { status: 'none' },
        };

        if (isAudio && mockWaveform) {
          mediaProperties.waveform = mockWaveform;
        }
        // If there's an initial mediaDuration (placeholder for now)
        // if (mediaDuration) {
        //   mediaProperties.duration = mediaDuration;
        // }

        if (isVideo) {
          const videoElement = document.createElement('video');
          videoElement.src = fileURL;
          videoElement.onloadedmetadata = () => {
            let currentDuration = videoElement.duration;
            if (isNaN(currentDuration) || currentDuration < 0.5) { // Check if duration is too small or NaN
              console.warn(`Video ${file.name}: Read duration ${currentDuration}s is too short or invalid. Falling back.`);
              currentDuration = 10; // Fallback to 10 seconds if duration is unreliable
            }

            addMediaItem({ 
              ...mediaProperties,
              duration: currentDuration 
            } as MediaItem);
          };
          videoElement.onerror = () => {
            console.error("Error loading video metadata for:", file.name);
            addMediaItem({ 
              ...mediaProperties,
              duration: 0
            } as MediaItem);
          };
        } else { // For audio or image
          addMediaItem(mediaProperties as MediaItem);
        }
      }
    });

    // Reset file input to allow selecting the same file again
    if (event.target) {
      event.target.value = "";
    }
  };
  
  const handleAddToExclusiveAudio = (id: string) => {
    addToExclusiveAudio(id);
  };
  
  const handleAddTag = (id: string, tag: string) => {
    if (tag.trim()) {
      addTagToMedia(id, tag);
      setNewTagName("");
    }
  };
  
  const handleToggleFavorite = (id: string) => {
    toggleFavoriteMedia(id);
  };
  
  const renderMediaItem = (item: MediaItem) => {
    const IconComponent = 
      item.type === "video" ? Video :
      item.type === "audio" ? Music :
      ImageIcon;

    const handleDragStart = (e: React.DragEvent) => {
      setData(e, item);
      e.dataTransfer.effectAllowed = "copy";
    };

    return (
      <div 
        key={item.id} 
        className="flex items-center justify-between p-2 hover:bg-gray-100 rounded-md cursor-pointer group"
        draggable={true} 
        onDragStart={handleDragStart} 
      >
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {item.thumbnail ? (
            <div className="relative w-12 h-12 bg-gray-200 rounded-sm mr-3 flex-shrink-0 overflow-hidden">
              <Image 
                src={item.thumbnail} 
                alt={item.name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-sm mr-3 flex-shrink-0 flex items-center justify-center">
              <IconComponent className="h-6 w-6 text-gray-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center">
              <p className="text-sm font-medium text-gray-900 truncate flex-1">{item.name}</p>
              {item.isFavorite && <Star className="h-4 w-4 text-yellow-400 ml-1" />}
            </div>
            {item.duration && (
              <p className="text-xs text-gray-500">
                {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
              </p>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs py-0 px-1">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Add to Exclusive Audio Button - only for non-exclusive audio items */}
          {item.type === "audio" && !item.isExclusiveAudio && (
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6"
              onClick={() => handleAddToExclusiveAudio(item.id)}
              title="Add to Exclusive Audio"
            >
              <Mic className="h-3.5 w-3.5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6">
                <span className="sr-only">Open menu</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.type === "audio" && !item.isExclusiveAudio && (
                <DropdownMenuItem onClick={() => handleAddToExclusiveAudio(item.id)}>
                  <Music className="mr-2 h-4 w-4" />
                  <span>Add to Exclusive Audio</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleToggleFavorite(item.id)}>
                <Star className="mr-2 h-4 w-4" />
                <span>{item.isFavorite ? "Remove from Favorites" : "Add to Favorites"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Tag className="mr-2 h-4 w-4" />
                <span>Add Tag</span>
                <div className="ml-2 flex" onClick={e => e.stopPropagation()}>
                  <Input 
                    className="h-6 w-24 text-xs"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        handleAddTag(item.id, newTagName);
                      }
                    }}
                  />
                  <Button 
                    size="sm" 
                    className="h-6 ml-1 px-1"
                    onClick={() => handleAddTag(item.id, newTagName)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  const selectedClip = selectedClipId ? timelineClips.find(clip => clip.id === selectedClipId) : null;
  const selectedMediaItem = selectedClip ? mediaLibrary.find(item => item.id === selectedClip.mediaId) : null;

  return (
    <div className="w-full bg-white border-r border-gray-200 flex flex-col h-full"> 
      <div className="p-4 border-b border-gray-200">
        <Button 
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          onClick={() => document.getElementById("file-upload")?.click()}
        >
          <Upload className="mr-2 h-4 w-4" /> Import media
        </Button>
        <input 
          id="file-upload" 
          type="file" 
          multiple 
          accept="video/*,audio/*,image/*" 
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      <Tabs defaultValue="media" className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-3 p-0 bg-gray-100">
          <TabsTrigger value="media" className="py-2" onClick={() => setActiveTab("media")}>Media</TabsTrigger>
          <TabsTrigger value="exclusive-audio" className="py-2" onClick={() => setActiveTab("exclusive-audio")}>
            Exclusive Audio
          </TabsTrigger>
          <TabsTrigger value="templates" className="py-2" onClick={() => setActiveTab("templates")}>Templates</TabsTrigger>
        </TabsList>
        
        {/* Media Library Tab */}
        <TabsContent value="media" className="flex-1 overflow-y-auto p-0 m-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700">Your media</h3>
              <div className="flex space-x-2">
                <Button 
                  size="sm" 
                  variant={showFavoritesOnly ? "default" : "outline"} 
                  className="h-7 px-2"
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 px-2">
                      <Tag className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setFilterTag(null)}>
                      All Tags
                    </DropdownMenuItem>
                    {allTags.map(tag => (
                      <DropdownMenuItem key={tag} onClick={() => setFilterTag(tag)}>
                        {tag}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            <div className="space-y-2">
              {filteredMedia.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Folder className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2">No media files yet</p>
                  <p className="text-sm">Import media to get started</p>
                </div>
              ) : (
                filteredMedia.map(item => renderMediaItem(item))
              )}
            </div>
          </div>
        </TabsContent>
        
        {/* Exclusive Audio Tab */}
        <TabsContent value="exclusive-audio" className="flex-1 overflow-y-auto p-0 m-0">
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="grid grid-cols-2 gap-2 p-2">
              {prebuiltAudioLibrary.length === 0 && (
                <p className="col-span-2 text-sm text-gray-500 text-center py-4">
                  No pre-built audio found.
                </p>
              )}
              {prebuiltAudioLibrary.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-md p-2 cursor-grab hover:bg-gray-800 transition-colors aspect-square flex flex-col items-center justify-center"
                  draggable
                  onDragStart={(event) => setData(event, item, true)}
                >
                  <Music2 className="w-8 h-8 mb-2 text-purple-400" />
                  <p className="text-xs text-center truncate w-full">{item.name}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        
        {/* Templates Tab */}
        <TabsContent value="templates" className="flex-1 overflow-y-auto p-0 m-0">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Templates</h3>
            <div className="text-center py-8 text-gray-500">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">Templates coming soon</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
