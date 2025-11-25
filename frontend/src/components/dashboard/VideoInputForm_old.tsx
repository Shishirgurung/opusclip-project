import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// Layout options matching backend capabilities
const LAYOUT_OPTIONS = [
  { 
    id: 'fit' as LayoutMode, 
    name: 'Fit', 
    description: 'Fits entire video within vertical frame',
    icon: '📱',
    recommended: false
  },
  { 
    id: 'fill' as LayoutMode, 
    name: 'Fill', 
    description: 'Fills vertical canvas by centering content',
    icon: '🎬',
    recommended: false
  },
  { 
    id: 'square' as LayoutMode, 
    name: 'Square', 
    description: 'Square video with blur background',
    icon: '⬜',
    recommended: true
  },
  { 
    id: 'auto' as LayoutMode, 
    name: 'Auto (AI)', 
    description: 'AI detects and centers on speaking person',
    icon: '🤖',
    recommended: true
  }
];

// Define the props for the component
interface VideoInputFormProps {
  onSubmit: (data: VideoProcessRequestOpus & { layout: LayoutMode }) => void;
  isLoading: boolean;
}

const VideoInputForm: React.FC<VideoInputFormProps> = ({ onSubmit, isLoading }) => {
    // Core video settings
    const [videoUrl, setVideoUrl] = useState('');
    const [clipLength, setClipLength] = useState(30);
    const [customClipLength, setCustomClipLength] = useState(30);
    const [selectedPreset, setSelectedPreset] = useState(30);
    const [generateCaptions, setGenerateCaptions] = useState(true);
    const [selectedLayout, setSelectedLayout] = useState<LayoutMode>('auto');
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Opus template and animation settings
    const [selectedTemplate, setSelectedTemplate] = useState<BrandTemplate | null>(null);
    const [selectedAnimation, setSelectedAnimation] = useState<AnimationStyle>('bounce');
    const [animationConfig, setAnimationConfig] = useState<Partial<AnimationConfig>>(DEFAULT_ANIMATION_CONFIG);

    // Caption customization settings
    const [customFont, setCustomFont] = useState('Montserrat');
    const [customFontSize, setCustomFontSize] = useState(48);
    const [customFontColor, setCustomFontColor] = useState('#ffffff');
    const [customFontCase, setCustomFontCase] = useState<FontCase>('uppercase');
    const [customPosition, setCustomPosition] = useState<CaptionPosition>('bottom');
    const [customLines, setCustomLines] = useState(2);
    
    // Shadow settings
    const [shadowColor, setShadowColor] = useState('#000000');
    const [shadowX, setShadowX] = useState(2);
    const [shadowY, setShadowY] = useState(2);
    const [shadowBlur, setShadowBlur] = useState(4);

    // Keyword highlighting
    const [manualHighlightWords, setManualHighlightWords] = useState('');
    const [autoHighlight, setAutoHighlight] = useState(true);
    const [primaryHighlightColor, setPrimaryHighlightColor] = useState('#04f827FF');
    const [secondaryHighlightColor, setSecondaryHighlightColor] = useState('#FFFDO3FF');

    // Font stroke settings
    const [enableFontStroke, setEnableFontStroke] = useState(false);
    const [fontStrokeColor, setFontStrokeColor] = useState('#000000');
    const [fontStrokeWidth, setFontStrokeWidth] = useState(2);

    // Preview settings
    const [sampleText, setSampleText] = useState('This is AMAZING content! Watch this incredible transformation.');
    const [useCustomSettings, setUseCustomSettings] = useState(false);

    const fontOptions = [
        'Montserrat', 'Anton', 'Bangers', 'Georgia', 'Impact', 
        'Oswald', 'Roboto', 'Open Sans', 'Lato', 'Poppins',
        'Bebas Neue', 'Raleway', 'Source Sans Pro', 'Ubuntu'
    ];

    useEffect(() => {
        if (selectedTemplate && !useCustomSettings) {
            const cs = selectedTemplate.captionSettings;
            if (cs) {
                setCustomFont(cs.font.family);
                setCustomFontSize(cs.font.size);
                setCustomFontColor(cs.font.color);
                setCustomFontCase(cs.font.case);
                setCustomPosition(cs.position);
                setCustomLines(selectedTemplate.defaultLines);
                setSelectedAnimation(cs.animationStyle);
                setAutoHighlight(cs.autoHighlight);
                setManualHighlightWords(cs.highlightWords.join(', '));
            }
        }
    }, [selectedTemplate, useCustomSettings]);

    // YouTube URL validation
    const isValidYouTubeUrl = (url: string): boolean => {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)[a-zA-Z0-9_-]{11}/;
        return youtubeRegex.test(url);
    };

    const validateForm = (): string[] => {
        const errors: string[] = [];
        
        // YouTube URL validation
        if (!videoUrl.trim()) {
            errors.push('YouTube URL is required.');
        } else if (!isValidYouTubeUrl(videoUrl)) {
            errors.push('Please enter a valid YouTube URL.');
        }
        
        // Clip length validation
        const finalClipLength = selectedPreset === 0 ? customClipLength : selectedPreset;
        if (finalClipLength < 10 || finalClipLength > 300) {
            errors.push('Clip length must be between 10-300 seconds.');
        }
        
        // Template validation
        if (!selectedTemplate) {
            errors.push('Please select a caption template.');
        } else {
            const templateValidation = validateOpusTemplate(selectedTemplate);
            if (!templateValidation.isValid) {
                errors.push(...templateValidation.errors);
            }
        }
        
        return errors;
    };

    const buildTemplateSettings = () => {
        if (!selectedTemplate) return null;

        const baseSettings = useCustomSettings ? {
            ...selectedTemplate.captionSettings,
            font: { family: customFont, size: customFontSize, color: customFontColor, case: customFontCase },
            position: customPosition,
            animationStyle: selectedAnimation,
            highlightWords: manualHighlightWords.split(',').map(w => w.trim()).filter(Boolean),
            autoHighlight: autoHighlight,
        } : selectedTemplate.captionSettings;

        return {
            ...selectedTemplate,
            captionSettings: baseSettings,
            defaultLines: useCustomSettings ? customLines : selectedTemplate.defaultLines,
            animationConfig,
            shadowSettings: { color: shadowColor, x: shadowX, y: shadowY, blur: shadowBlur },
            fontStroke: { enabled: enableFontStroke, color: fontStrokeColor, width: fontStrokeWidth },
            keywordHighlight: { primaryColor: primaryHighlightColor, secondaryColor: secondaryHighlightColor, enabled: autoHighlight || manualHighlightWords.length > 0 },
        };
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setValidationErrors([]);
        const formErrors = validateForm();
        if (formErrors.length > 0) {
            setValidationErrors(formErrors);
            return;
        }

        const finalTemplate = buildTemplateSettings();
        if (!finalTemplate) {
            setValidationErrors(['Could not build template settings.']);
            return;
        }

        const finalClipLength = selectedPreset === 0 ? customClipLength : selectedPreset;
        
        const submissionData: VideoProcessRequestOpus & { layout: LayoutMode } = {
            videoUrl: videoUrl.trim(),
            clipDuration: finalClipLength,
            template: finalTemplate,
            layout: selectedLayout,
            outputFormat: 'mp4',
            session: `opus_${Date.now()}`,
            originalFilename: `opus_clip_${Date.now()}.mp4`,
            userId: 'user_123',
        };
        onSubmit(submissionData);
    };

    const handleTemplateSelect = (template: BrandTemplate | null) => {
        setSelectedTemplate(template);
        if (template) {
            const validation = validateOpusTemplate(template);
            if (!validation.isValid) {
                setValidationErrors(validation.errors);
            } else {
                setValidationErrors([]);
            }
        }
    };

    const handleAnimationChange = (style: AnimationStyle) => {
        setSelectedAnimation(style);
        setUseCustomSettings(true);
    };

    const handleAnimationConfigChange = (config: Partial<AnimationConfig>) => {
        setAnimationConfig(prev => ({ ...prev, ...config }));
        setUseCustomSettings(true);
    };

    const currentTemplateSettings = buildTemplateSettings();

    return (
        <div className="w-full max-w-md mx-auto p-6 space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Opus Clip Generator</h2>
                <p className="text-sm text-gray-400">Create viral-style clips with professional templates.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">

                    {/* YouTube URL Input */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Youtube className="h-5 w-5 text-red-500" />
                                YouTube Video
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="video-url">YouTube URL</Label>
                                <Input 
                                    id="video-url" 
                                    value={videoUrl} 
                                    onChange={(e) => setVideoUrl(e.target.value)} 
                                    placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ" 
                                    className="bg-gray-800 border-gray-700"
                                />
                                <p className="text-xs text-gray-500">Paste any YouTube video URL to get started</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Video Length Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
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
                                        onClick={() => {
                                            setSelectedPreset(preset.value);
                                            if (preset.value > 0) setClipLength(preset.value);
                                        }}
                                        className={`p-3 rounded-lg border text-left transition-all ${
                                            selectedPreset === preset.value
                                                ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="font-medium">{preset.label}</div>
                                        <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                                    </button>
                                ))}
                            </div>
                            
                            {selectedPreset === 0 && (
                                <div className="space-y-2 animate-in fade-in-50">
                                    <Label htmlFor="custom-length">Custom Duration (seconds)</Label>
                                    <Input 
                                        id="custom-length" 
                                        type="number" 
                                        value={customClipLength} 
                                        onChange={(e) => setCustomClipLength(Number(e.target.value))} 
                                        min="10" 
                                        max="300"
                                        className="bg-gray-800 border-gray-700"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Layout Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Layout className="h-5 w-5 text-purple-500" />
                                Video Layout
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                {LAYOUT_OPTIONS.map((layout) => (
                                    <button
                                        key={layout.id}
                                        type="button"
                                        onClick={() => setSelectedLayout(layout.id)}
                                        className={`p-3 rounded-lg border text-left transition-all relative ${
                                            selectedLayout === layout.id
                                                ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                                                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                        }`}
                                    >
                                        {layout.recommended && (
                                            <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1">
                                                Recommended
                                            </Badge>
                                        )}
                                        <div className="flex items-center gap-2 font-medium">
                                            <span className="text-lg">{layout.icon}</span>
                                            {layout.name}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">{layout.description}</div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Caption Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Scissors className="h-5 w-5 text-green-500" />
                                Caption Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="gen-captions" className="font-medium">Generate Captions</Label>
                                    <p className="text-xs text-gray-500 mt-1">AI-powered captions with animations</p>
                                </div>
                                <Switch id="gen-captions" checked={generateCaptions} onCheckedChange={setGenerateCaptions} />
                            </div>
                        </CardContent>
                    </Card>

                    <OpusTemplateSelector selectedTemplate={selectedTemplate} onTemplateSelect={handleTemplateSelect} />

                    {validationErrors.length > 0 && (
                        <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg space-y-1">
                            <div className="flex items-center gap-2 text-red-400">
                                <AlertCircle className="h-5 w-5" />
                                <h4 className="font-semibold">Errors</h4>
                            </div>
                            <ul className="list-disc list-inside text-red-400 text-sm">
                                {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </div>
                    )}

                    {selectedTemplate && (
                        <div className="space-y-4 pt-4 mt-4 border-t border-gray-700">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Palette className="h-5 w-5" /> Customize Template</h3>
                                <Switch id="custom-settings-toggle" checked={useCustomSettings} onCheckedChange={setUseCustomSettings} />
                            </div>
                            {useCustomSettings && <p className="text-xs text-gray-400 -mt-2">Custom settings are enabled.</p>}
                            {useCustomSettings && (
                                <div className="space-y-4 animate-in fade-in-50">
                                    <Card>
                                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Type className="h-4 w-4" /> Font & Layout</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Font Family</Label>
                                                    <Select value={customFont} onValueChange={setCustomFont}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>{fontOptions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Font Size</Label>
                                                    <Input type="number" value={customFontSize} onChange={e => setCustomFontSize(Number(e.target.value))} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Font Color</Label>
                                                <Input type="color" value={customFontColor} onChange={e => setCustomFontColor(e.target.value)} className="p-1 h-10" />
                                            </div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Case</Label>
                                                    <Select value={customFontCase} onValueChange={(v: FontCase) => setCustomFontCase(v)}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="uppercase">Uppercase</SelectItem>
                                                            <SelectItem value="lowercase">Lowercase</SelectItem>
                                                            <SelectItem value="capitalize">Capitalize</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Position</Label>
                                                    <Select value={customPosition} onValueChange={(v: CaptionPosition) => setCustomPosition(v)}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="top">Top</SelectItem>
                                                            <SelectItem value="middle">Middle</SelectItem>
                                                            <SelectItem value="bottom">Bottom</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Max Lines</Label>
                                                    <Input type="number" value={customLines} onChange={e => setCustomLines(Number(e.target.value))} min="1" max="3" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Animation</CardTitle></CardHeader>
                                        <CardContent>
                                            <AnimationSelector value={selectedAnimation} onChange={handleAnimationChange} onConfigChange={handleAnimationConfigChange} config={animationConfig} />
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}

                    <Button type="submit" color="primary" className="w-full font-bold" disabled={isLoading || validationErrors.length > 0}>
                        {isLoading ? 'Processing...' : 'Generate Clips'}
                    </Button>
                {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
            </form>
        </div>
    );
};

export default VideoInputForm;
