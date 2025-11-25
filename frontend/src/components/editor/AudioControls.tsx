
import React, { useState } from "react";
import { useEditor, TimelineClip } from "@/contexts/EditorContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX, Music, Wand2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AudioControlsProps {
  clipId: string;
}

export function AudioControls({ clipId }: AudioControlsProps) {
  const { timelineClips, updateTimelineClip, mediaLibrary } = useEditor();
  const [activeTab, setActiveTab] = useState("volume");
  
  // Find the clip
  const clip = timelineClips.find(c => c.id === clipId);
  if (!clip || (clip.type !== "audio" && !clip.detachedAudio)) return null;
  
  // Find the media item
  const media = mediaLibrary.find(m => m.id === clip.mediaId);
  if (!media) return null;
  
  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    updateTimelineClip(clipId, { volume: value[0] });
  };
  
  // Handle fade in change
  const handleFadeInChange = (value: number[]) => {
    updateTimelineClip(clipId, { fadeIn: value[0] });
  };
  
  // Handle fade out change
  const handleFadeOutChange = (value: number[]) => {
    updateTimelineClip(clipId, { fadeOut: value[0] });
  };
  
  // Handle mute toggle
  const handleMuteToggle = () => {
    updateTimelineClip(clipId, { muted: !clip.muted });
  };
  
  // Handle audio enhancement
  const handleAudioEnhance = (preset: string) => {
    // This would apply audio effects in a real implementation
    console.log(`Applying ${preset} preset to clip ${clipId}`);
  };
  
  return (
    <div className="p-4 bg-gray-100 rounded-md">
      <h3 className="text-sm font-medium mb-4 flex items-center">
        <Music className="mr-2 h-4 w-4" />
        Audio Controls: {media.name}
      </h3>
      
      <Tabs defaultValue="volume" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="volume" onClick={() => setActiveTab("volume")}>Volume</TabsTrigger>
          <TabsTrigger value="fades" onClick={() => setActiveTab("fades")}>Fades</TabsTrigger>
          <TabsTrigger value="enhance" onClick={() => setActiveTab("enhance")}>Enhance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="volume" className="space-y-4">
          <div className="flex items-center space-x-4">
            <Button 
              size="sm" 
              variant={clip.muted ? "default" : "outline"} 
              onClick={handleMuteToggle}
            >
              {clip.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            
            <div className="flex-1">
              <Slider
                value={[clip.volume || 1]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
              />
            </div>
            
            <span className="text-sm w-8 text-right">
              {Math.round((clip.volume || 1) * 100)}%
            </span>
          </div>
          
          {/* Volume curve visualization */}
          <div className="h-24 bg-gray-200 rounded-md p-2 relative">
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Volume Curve Editor
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="fades" className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Fade In</label>
              <div className="flex items-center space-x-2">
                <Slider
                  value={[clip.fadeIn || 0]}
                  min={0}
                  max={5}
                  step={0.1}
                  onValueChange={handleFadeInChange}
                />
                <span className="text-sm w-12">{clip.fadeIn || 0}s</span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Fade Out</label>
              <div className="flex items-center space-x-2">
                <Slider
                  value={[clip.fadeOut || 0]}
                  min={0}
                  max={5}
                  step={0.1}
                  onValueChange={handleFadeOutChange}
                />
                <span className="text-sm w-12">{clip.fadeOut || 0}s</span>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="enhance" className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="h-16 flex flex-col items-center justify-center"
              onClick={() => handleAudioEnhance("noise-reduction")}
            >
              <Wand2 className="h-5 w-5 mb-1" />
              <span className="text-xs">Noise Reduction</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-16 flex flex-col items-center justify-center"
              onClick={() => handleAudioEnhance("voice-enhance")}
            >
              <Wand2 className="h-5 w-5 mb-1" />
              <span className="text-xs">Voice Enhance</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-16 flex flex-col items-center justify-center"
              onClick={() => handleAudioEnhance("bass-boost")}
            >
              <Wand2 className="h-5 w-5 mb-1" />
              <span className="text-xs">Bass Boost</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-16 flex flex-col items-center justify-center"
              onClick={() => handleAudioEnhance("treble-boost")}
            >
              <Wand2 className="h-5 w-5 mb-1" />
              <span className="text-xs">Treble Boost</span>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
