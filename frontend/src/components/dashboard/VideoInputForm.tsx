import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Youtube, Clock, Layout, Settings, Sparkles } from 'lucide-react';
import OpusTemplateSelector from '@/components/OpusTemplateSelector/OpusTemplateSelector';
import AnimationSelector from '@/components/AnimationSelector/AnimationSelector';
import CaptionPreview from '@/components/CaptionPreview/CaptionPreview';
import { BrandTemplate, AnimationStyle, CaptionPosition, FontCase, VideoProcessRequestOpus } from '@/types';
import { validateOpusTemplate } from '@/lib/opus-templates';
import { AnimationConfig, DEFAULT_ANIMATION_CONFIG } from '@/lib/animation-engine';

// Layout modes matching backend
type LayoutMode = 'fit' | 'fill' | 'square' | 'auto';

// Video length presets (in seconds)
const VIDEO_LENGTH_PRESETS = [
  { label: '30 seconds', value: 30, description: 'Perfect for TikTok & Instagram Reels' },
  { label: '45 seconds', value: 45, description: 'Ideal for YouTube Shorts' },
  { label: '60 seconds', value: 60, description: 'Maximum engagement length' },
  { label: 'Custom', value: 0, description: 'Set your own duration' }
];

// Clip length range presets (OpusClip style)
const CLIP_LENGTH_RANGES = [
  { label: '15-30s', minLength: 15, maxLength: 30, targetLength: 22, description: 'Quick viral clips' },
  { label: '30-60s', minLength: 30, maxLength: 60, targetLength: 45, description: 'Standard clips' },
  { label: '60-90s', minLength: 60, maxLength: 90, targetLength: 75, description: 'Long-form clips' },
];

// Layout options
const LAYOUT_OPTIONS = [
  { 
    value: 'fit' as LayoutMode, 
    label: 'Fit', 
    description: 'Fit entire video within frame',
    icon: '📱'
  },
  { 
    value: 'fill' as LayoutMode, 
    label: 'Fill', 
    description: 'Fill frame, may crop video',
    icon: '🖼️'
  },
  { 
    value: 'square' as LayoutMode, 
    label: 'Square', 
    description: 'Square format with blur background',
    icon: '⬜'
  },
  { 
    value: 'auto' as LayoutMode, 
    label: 'Auto', 
    description: 'AI detects faces and centers content',
    icon: '🤖'
  }
];

interface VideoInputFormProps {
  onSubmit: (data: VideoProcessRequestOpus) => void;
  isLoading?: boolean;
  error?: string;
}

const VideoInputForm: React.FC<VideoInputFormProps> = ({ onSubmit, isLoading = false, error }) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<BrandTemplate | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<LayoutMode>('fit');
  const [clipDuration, setClipDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState(60);
  const [generateCaptions, setGenerateCaptions] = useState(true);
  const [useCustomSettings, setUseCustomSettings] = useState(false);
  const [animationConfig, setAnimationConfig] = useState<AnimationConfig>(DEFAULT_ANIMATION_CONFIG);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Clip length range (OpusClip style)
  const [selectedRangeIndex, setSelectedRangeIndex] = useState(1); // Default: 30-60s
  const [minClipLength, setMinClipLength] = useState(30);
  const [maxClipLength, setMaxClipLength] = useState(60);
  const [targetClipLength, setTargetClipLength] = useState(45);
  
  // Processing timeframe (OpusClip style)
  const [useTimeframe, setUseTimeframe] = useState(false);
  const [timeframeStart, setTimeframeStart] = useState(0); // in seconds
  const [timeframeEnd, setTimeframeEnd] = useState(300); // will be updated when video loads
  const [videoDuration, setVideoDuration] = useState(300); // will be updated when video loads
  const [isLoadingDuration, setIsLoadingDuration] = useState(false);
  
  // Video preview
  const [videoId, setVideoId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)[a-zA-Z0-9_-]{11}/;
    return youtubeRegex.test(url);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Fetch video duration from YouTube using yt-dlp via backend
  const fetchVideoDuration = async (videoId: string) => {
    setIsLoadingDuration(true);
    try {
      // Call backend to get video info using yt-dlp
      const flaskUrl = process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://localhost:5000';
      const response = await fetch(`${flaskUrl}/api/video-info?video_id=${videoId}`);
      
      if (response.ok) {
        const data = await response.json();
        const duration = data.duration || 300; // fallback to 5 minutes
        setVideoDuration(duration);
        setTimeframeEnd(duration); // Set slider end to full video duration
        console.log(`Video duration fetched: ${duration}s (${formatTime(duration)})`);
      } else {
        console.warn('Failed to fetch video duration, using default 5 minutes');
        setVideoDuration(300);
        setTimeframeEnd(300);
      }
    } catch (error) {
      console.warn('Error fetching video duration:', error);
      // Fallback to default 5 minutes if API fails
      setVideoDuration(300);
      setTimeframeEnd(300);
    } finally {
      setIsLoadingDuration(false);
    }
  };

  // Update video preview and fetch duration when URL changes
  useEffect(() => {
    if (validateYouTubeUrl(youtubeUrl)) {
      const id = extractYouTubeId(youtubeUrl);
      setVideoId(id);
      setShowPreview(true);
      
      // Fetch video duration
      if (id) {
        fetchVideoDuration(id);
      }
    } else {
      setVideoId(null);
      setShowPreview(false);
      // Reset to defaults
      setVideoDuration(300);
      setTimeframeEnd(300);
    }
  }, [youtubeUrl]);

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!youtubeUrl.trim()) {
      errors.push('YouTube URL is required');
    } else if (!validateYouTubeUrl(youtubeUrl)) {
      errors.push('Please enter a valid YouTube URL');
    }
    
    if (!selectedTemplate) {
      errors.push('Please select a template');
    }
    
    const duration = clipDuration === 0 ? customDuration : clipDuration;
    if (duration < 15 || duration > 300) {
      errors.push('Duration must be between 15 and 300 seconds');
    }
    
    return errors;
  };

  useEffect(() => {
    setValidationErrors(validateForm());
  }, [youtubeUrl, selectedTemplate, clipDuration, customDuration]);

  const buildTemplateSettings = () => {
    if (!selectedTemplate) return null;
    
    const baseTemplate = validateOpusTemplate(selectedTemplate.name);
    if (!baseTemplate) return null;

    return {
      ...baseTemplate,
      displayName: selectedTemplate.displayName,
      captionSettings: useCustomSettings ? {
        ...baseTemplate.captionSettings,
        animationStyle: animationConfig.animationStyle,
        position: animationConfig.position,
        fontCase: animationConfig.fontCase,
        fontSize: animationConfig.fontSize,
        fontWeight: animationConfig.fontWeight,
        textColor: animationConfig.textColor,
        strokeColor: animationConfig.strokeColor,
        strokeWidth: animationConfig.strokeWidth,
        shadowColor: animationConfig.shadowColor,
        shadowOffset: animationConfig.shadowOffset,
        animationDuration: animationConfig.animationDuration,
        animationDelay: animationConfig.animationDelay,
        animationEasing: animationConfig.animationEasing
      } : baseTemplate.captionSettings
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const templateSettings = buildTemplateSettings();
    if (!templateSettings) {
      setValidationErrors(['Invalid template selected']);
      return;
    }

    const duration = clipDuration === 0 ? customDuration : clipDuration;
    
    const requestData: VideoProcessRequestOpus = {
      videoUrl: youtubeUrl.trim(),
      template: templateSettings,
      session: 'web-session-' + Date.now(),
      userId: 'user-' + Date.now(),
      clipDuration: duration,
      layout: selectedLayout,
      generateCaptions,
      // Include timeframe parameters if enabled
      useTimeframe,
      timeframeStart: useTimeframe ? timeframeStart : undefined,
      timeframeEnd: useTimeframe ? timeframeEnd : undefined,
      // Include clip length preferences
      minClipLength,
      maxClipLength,
      targetClipLength
    };

    onSubmit(requestData);
  };

  const handleAnimationConfigChange = (config: Partial<AnimationConfig>) => {
    setAnimationConfig(prev => ({ ...prev, ...config }));
    setUseCustomSettings(true);
  };

  const currentTemplateSettings = buildTemplateSettings();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* YouTube URL Input */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Youtube className="h-5 w-5 text-red-500" />
              YouTube Video
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="youtube-url" className="text-gray-300">YouTube URL</Label>
              <Input
                id="youtube-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">Paste any YouTube video URL to get started</p>
            </div>
            
            {/* Video Preview */}
            {showPreview && videoId && (
              <div className="mt-4 space-y-3">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="YouTube video preview"
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Youtube className="h-4 w-4 text-red-500" />
                  <span>Video preview loaded • Ready to generate clips</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preferred Clip Length (OpusClip Style) */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Preferred Clip Length
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-400">Choose the length range for generated viral clips</p>
            <div className="flex gap-3">
              {CLIP_LENGTH_RANGES.map((range, index) => (
                <button
                  key={range.label}
                  type="button"
                  onClick={() => {
                    setSelectedRangeIndex(index);
                    setMinClipLength(range.minLength);
                    setMaxClipLength(range.maxLength);
                    setTargetClipLength(range.targetLength);
                  }}
                  className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                    selectedRangeIndex === index
                      ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/50'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="font-bold text-lg">{range.label}</div>
                  <div className="text-xs opacity-75 mt-1">{range.description}</div>
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded">
              💡 Clips will be generated between {minClipLength}s and {maxClipLength}s, targeting {targetClipLength}s
            </div>
          </CardContent>
        </Card>

        {/* Processing Timeframe (OpusClip Style) */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Clock className="h-5 w-5 text-cyan-500" />
              Processing Timeframe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Process only a specific portion of the video</p>
              <Switch
                checked={useTimeframe}
                onCheckedChange={setUseTimeframe}
              />
            </div>
            
            {useTimeframe && (
              <div className="space-y-3 pt-2">
                {isLoadingDuration ? (
                  <div className="flex items-center justify-center py-4 text-sm text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-500 mr-2"></div>
                    Fetching video duration...
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cyan-400 font-mono">{formatTime(timeframeStart)}</span>
                      <span className="text-gray-500">to</span>
                      <span className="text-cyan-400 font-mono">{formatTime(timeframeEnd)}</span>
                    </div>
                    
                    <Slider
                      value={[timeframeStart, timeframeEnd]}
                      onValueChange={([start, end]) => {
                        setTimeframeStart(start);
                        setTimeframeEnd(end);
                      }}
                      min={0}
                      max={videoDuration}
                      step={1}
                      className="w-full"
                    />
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>0:00</span>
                      <span className="text-cyan-400">
                        Selected: {formatTime(timeframeEnd - timeframeStart)}
                      </span>
                      <span className="text-purple-400">Total: {formatTime(videoDuration)}</span>
                    </div>
                    
                    <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded">
                      💡 Drag the slider to select which part of the video to process
                    </div>
                  </>
                )}
                
                <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded">
                  ⚡ Only the selected portion will be transcribed and analyzed, saving processing time
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clip Duration */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Clock className="h-5 w-5 text-blue-500" />
              Clip Duration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {VIDEO_LENGTH_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setClipDuration(preset.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    clipDuration === preset.value
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-xs opacity-75">{preset.description}</div>
                </button>
              ))}
            </div>
            
            {clipDuration === 0 && (
              <div>
                <Label htmlFor="custom-duration" className="text-gray-300">Custom Duration (seconds)</Label>
                <Input
                  id="custom-duration"
                  type="number"
                  min="15"
                  max="300"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(parseInt(e.target.value) || 60)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Video Layout */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Layout className="h-5 w-5 text-green-500" />
              Video Layout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {LAYOUT_OPTIONS.map((layout) => (
                <button
                  key={layout.value}
                  type="button"
                  onClick={() => setSelectedLayout(layout.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selectedLayout === layout.value
                      ? 'bg-green-600 border-green-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <span>{layout.icon}</span>
                    {layout.label}
                  </div>
                  <div className="text-xs opacity-75 mt-1">{layout.description}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Caption Settings */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Settings className="h-5 w-5 text-purple-500" />
              Caption Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300">Generate Captions</Label>
                <p className="text-xs text-gray-500">AI-powered captions with animations</p>
              </div>
              <Switch
                checked={generateCaptions}
                onCheckedChange={setGenerateCaptions}
              />
            </div>
          </CardContent>
        </Card>

        {/* Template Selection */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Choose Your Opus Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OpusTemplateSelector
              selectedTemplate={selectedTemplate}
              onTemplateSelect={setSelectedTemplate}
            />
          </CardContent>
        </Card>

        {/* Custom Animation Settings */}
        {selectedTemplate && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Animation Customization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Use Custom Settings</Label>
                <Switch
                  checked={useCustomSettings}
                  onCheckedChange={setUseCustomSettings}
                />
              </div>
              
              {useCustomSettings && (
                <div className="space-y-4">
                  <AnimationSelector
                    config={animationConfig}
                    onChange={handleAnimationConfigChange}
                  />
                  
                  {currentTemplateSettings && (
                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-sm text-gray-300">Live Preview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CaptionPreview
                          template={currentTemplateSettings}
                          sampleText="This is how your captions will look!"
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {validationErrors.length > 0 && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
            <h4 className="text-red-400 font-medium mb-2">Please fix the following errors:</h4>
            <ul className="text-red-300 text-sm space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3" 
          disabled={isLoading || validationErrors.length > 0}
        >
          {isLoading ? 'Processing...' : 'Generate Clips'}
        </Button>
        
        {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
      </form>
    </div>
  );
};

export default VideoInputForm;
