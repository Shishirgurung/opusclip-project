"use client"

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { CaptionSettings, FontSettings, CaptionPosition } from '@/types';

interface CaptionCustomizerProps {
  settings: CaptionSettings;
  onSettingsChange: (settings: CaptionSettings) => void;
  className?: string;
}

const GOOGLE_FONTS = [
  'Montserrat',
  'Anton',
  'Bangers',
  'Georgia',
  'Impact',
  'Roboto',
  'Open Sans',
  'Lato',
  'Oswald',
  'Poppins',
  'Bebas Neue',
  'Raleway',
  'Nunito',
  'Source Sans Pro',
  'Ubuntu'
];

const CAPTION_POSITIONS: { value: CaptionPosition; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' }
];

const LINE_OPTIONS = [
  { value: 1, label: '1 Line' },
  { value: 2, label: '2 Lines' },
  { value: 3, label: '3 Lines' }
];

export const CaptionCustomizer: React.FC<CaptionCustomizerProps> = ({
  settings,
  onSettingsChange,
  className = ''
}) => {
  const [localSettings, setLocalSettings] = useState<CaptionSettings>(settings);
  const [highlightWordsInput, setHighlightWordsInput] = useState<string>(
    settings.highlightWords.join(', ')
  );
  const [linesOverride, setLinesOverride] = useState<number>(2);

  // Sync local settings with parent when settings prop changes
  useEffect(() => {
    setLocalSettings(settings);
    setHighlightWordsInput(settings.highlightWords.join(', '));
  }, [settings]);

  // Update parent settings when local settings change
  const updateSettings = (newSettings: Partial<CaptionSettings>) => {
    const updatedSettings = { ...localSettings, ...newSettings };
    setLocalSettings(updatedSettings);
    onSettingsChange(updatedSettings);
  };

  // Update font settings
  const updateFontSettings = (newFontSettings: Partial<FontSettings>) => {
    const updatedFont = { ...localSettings.font, ...newFontSettings };
    updateSettings({ font: updatedFont });
  };

  // Handle highlight words input change
  const handleHighlightWordsChange = (value: string) => {
    setHighlightWordsInput(value);
    const words = value
      .split(',')
      .map(word => word.trim())
      .filter(word => word.length > 0);
    updateSettings({ highlightWords: words });
  };

  // Handle auto-highlight toggle
  const handleAutoHighlightToggle = () => {
    updateSettings({ autoHighlight: !localSettings.autoHighlight });
  };

  return (
    <div className={`space-y-6 p-6 bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Caption Customization</h3>
        
        {/* Font Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Font Family</label>
          <Select
            value={localSettings.font.family}
            onValueChange={(value) => updateFontSettings({ family: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select font" />
            </SelectTrigger>
            <SelectContent>
              {GOOGLE_FONTS.map((font) => (
                <SelectItem key={font} value={font}>
                  <span style={{ fontFamily: font }}>{font}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Font Size</label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              min="12"
              max="120"
              value={localSettings.font.size}
              onChange={(e) => updateFontSettings({ size: parseInt(e.target.value) || 24 })}
              className="w-20"
            />
            <span className="text-sm text-gray-500">px</span>
          </div>
        </div>

        {/* Font Color */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Font Color</label>
          <ColorPicker
            value={localSettings.font.color}
            onChange={(color) => updateFontSettings({ color })}
          />
        </div>

        {/* Text Shadow Controls */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Text Shadow</label>
          
          {/* Shadow Color */}
          <div className="space-y-2">
            <label className="text-xs text-gray-600">Shadow Color</label>
            <ColorPicker
              value="#000000"
              onChange={(color) => {
                // Note: We'll need to extend FontSettings to include shadow properties
                // For now, this is a placeholder for the shadow color
              }}
            />
          </div>

          {/* Shadow X, Y, Blur */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-600">X Offset</label>
              <Input
                type="number"
                min="-10"
                max="10"
                defaultValue="2"
                className="text-sm"
                placeholder="2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Y Offset</label>
              <Input
                type="number"
                min="-10"
                max="10"
                defaultValue="2"
                className="text-sm"
                placeholder="2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Blur</label>
              <Input
                type="number"
                min="0"
                max="20"
                defaultValue="4"
                className="text-sm"
                placeholder="4"
              />
            </div>
          </div>
        </div>

        {/* Caption Position */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Caption Position</label>
          <Select
            value={localSettings.position}
            onValueChange={(value: CaptionPosition) => updateSettings({ position: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              {CAPTION_POSITIONS.map((position) => (
                <SelectItem key={position.value} value={position.value}>
                  {position.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lines Override */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Number of Lines</label>
          <Select
            value={linesOverride.toString()}
            onValueChange={(value) => setLinesOverride(parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select lines" />
            </SelectTrigger>
            <SelectContent>
              {LINE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manual Highlight Words */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Highlight Words</label>
          <Input
            type="text"
            value={highlightWordsInput}
            onChange={(e) => handleHighlightWordsChange(e.target.value)}
            placeholder="Enter words separated by commas"
            className="w-full"
          />
          <p className="text-xs text-gray-500">
            Separate multiple words with commas (e.g., amazing, incredible, wow)
          </p>
        </div>

        {/* Auto-Highlight Toggle */}
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-gray-700">Auto-Highlight Keywords</label>
          <button
            type="button"
            onClick={handleAutoHighlightToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              localSettings.autoHighlight ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localSettings.autoHighlight ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Auto-Highlight Description */}
        {localSettings.autoHighlight && (
          <div className="p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              Auto-highlight will automatically detect and highlight:
            </p>
            <ul className="text-xs text-blue-700 mt-1 ml-4 list-disc">
              <li>Words longer than 6 characters</li>
              <li>Words in ALL CAPS</li>
              <li>Words ending with '!' or '?'</li>
              <li>Emotionally significant words</li>
            </ul>
          </div>
        )}

        {/* Live Preview Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Live Preview</label>
          <div className="p-4 bg-gray-900 rounded-lg min-h-[100px] flex items-center justify-center">
            <div
              style={{
                fontFamily: localSettings.font.family,
                fontSize: `${localSettings.font.size}px`,
                color: localSettings.font.color,
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                textAlign: 'center',
                lineHeight: 1.2,
                maxWidth: '90%'
              }}
            >
              This is a SAMPLE caption with amazing words!
              {linesOverride > 1 && (
                <>
                  <br />
                  Second line of the caption text
                </>
              )}
              {linesOverride > 2 && (
                <>
                  <br />
                  Third line for maximum impact
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sync Mode Display */}
        <div className="p-3 bg-gray-50 rounded-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Sync Mode</span>
            <span className="text-sm text-gray-600 capitalize">
              {localSettings.syncMode}-by-{localSettings.syncMode}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {localSettings.syncMode === 'word' 
              ? 'Captions will highlight each word as it\'s spoken'
              : 'Captions will appear line by line'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default CaptionCustomizer;