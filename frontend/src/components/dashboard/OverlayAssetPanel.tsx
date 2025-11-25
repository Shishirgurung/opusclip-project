import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { ColorPicker } from '@/components/ui/color-picker';
import { Label } from '@/components/ui/label';
import { Layers, Upload } from 'lucide-react';
import { BrandTemplate, OverlayAsset } from '@/types';

interface OverlayAssetPanelProps {
  template: BrandTemplate;
  onTemplateChange: (template: BrandTemplate) => void;
  isUploading?: boolean;
  uploadError?: string;
}

export const OverlayAssetPanel: React.FC<OverlayAssetPanelProps> = ({
  template,
  onTemplateChange,
  isUploading = false,
  uploadError = '',
}) => {
  const [overlayEnabled, setOverlayEnabled] = useState(!!template.assets.overlay);
  const [primaryColor, setPrimaryColor] = useState('#04f827FF');
  const [secondaryColor, setSecondaryColor] = useState('#FFFDO3FF');

  const handleOverlayToggle = (enabled: boolean) => {
    setOverlayEnabled(enabled);
    
    if (!enabled) {
      // Remove overlay asset when disabled
      const updatedTemplate = {
        ...template,
        assets: {
          ...template.assets,
          overlay: undefined,
        },
      };
      onTemplateChange(updatedTemplate);
    }
  };

  const handleOverlayFileChange = (file: File | null) => {
    if (!file) {
      // Remove overlay asset
      const updatedTemplate = {
        ...template,
        assets: {
          ...template.assets,
          overlay: undefined,
        },
      };
      onTemplateChange(updatedTemplate);
      return;
    }

    // Create a temporary URL for the file
    const url = URL.createObjectURL(file);
    
    // Create overlay asset with default settings
    const overlayAsset: OverlayAsset = {
      url,
      type: 'overlay',
      position: { x: 50, y: 50 }, // Center position as percentage
      size: { width: 200, height: 200 }, // Default size in pixels
      opacity: 1,
    };

    const updatedTemplate = {
      ...template,
      assets: {
        ...template.assets,
        overlay: overlayAsset,
      },
    };
    
    onTemplateChange(updatedTemplate);
  };

  const handlePrimaryColorChange = (color: string) => {
    setPrimaryColor(color);
    // Update template's keyword highlight primary color
    const updatedTemplate = {
      ...template,
      keywordHighlight: {
        ...template.keywordHighlight,
        primaryColor: color,
        enabled: true,
      },
    };
    onTemplateChange(updatedTemplate);
  };

  const handleSecondaryColorChange = (color: string) => {
    setSecondaryColor(color);
    // Update template's keyword highlight secondary color
    const updatedTemplate = {
      ...template,
      keywordHighlight: {
        ...template.keywordHighlight,
        secondaryColor: color,
        enabled: true,
      },
    };
    onTemplateChange(updatedTemplate);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Overlay Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overlay Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="overlay-toggle" className="text-sm font-medium">
            Enable Overlays
          </Label>
          <Switch
            id="overlay-toggle"
            checked={overlayEnabled}
            onCheckedChange={handleOverlayToggle}
          />
        </div>

        {/* Overlay Controls - Only show when enabled */}
        {overlayEnabled && (
          <div className="space-y-4 animate-in fade-in-50">
            {/* Color Pickers */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Primary Color</Label>
                <ColorPicker
                  value={primaryColor}
                  onChange={handlePrimaryColorChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Secondary Color</Label>
                <ColorPicker
                  value={secondaryColor}
                  onChange={handleSecondaryColorChange}
                />
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Overlay File</Label>
              <FileUpload
                assetType="overlay"
                asset={template.assets.overlay}
                onFileChange={handleOverlayFileChange}
                isUploading={isUploading}
                uploadError={uploadError}
                maxSize={10 * 1024 * 1024} // 10MB for overlay files
                className="w-full"
              />
            </div>

            {/* Upload Button Alternative */}
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  // Trigger file input click
                  const fileInput = document.createElement('input');
                  fileInput.type = 'file';
                  fileInput.accept = 'image/*,video/*';
                  fileInput.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      handleOverlayFileChange(file);
                    }
                  };
                  fileInput.click();
                }}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Overlay File
              </Button>
            </div>

            {/* Current Overlay Info */}
            {template.assets.overlay && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Current overlay: {template.assets.overlay.url.split('/').pop()}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Position: {template.assets.overlay.position.x}%, {template.assets.overlay.position.y}%</span>
                  <span>Size: {template.assets.overlay.size.width}×{template.assets.overlay.size.height}px</span>
                  <span>Opacity: {Math.round(template.assets.overlay.opacity * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground">
          {overlayEnabled 
            ? "Upload an image or video file to use as an overlay. Adjust colors for keyword highlighting."
            : "Enable overlays to add custom graphics and set highlight colors for your clips."
          }
        </div>
      </CardContent>
    </Card>
  );
};