import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandTemplate, AspectRatio, AutoLayoutOption } from '@/types';

interface ClipLayoutSettingsProps {
  template: BrandTemplate;
  onTemplateChange: (template: BrandTemplate) => void;
}

const ClipLayoutSettings: React.FC<ClipLayoutSettingsProps> = ({
  template,
  onTemplateChange,
}) => {
  const aspectRatios: { value: AspectRatio; label: string; isPro?: boolean }[] = [
    { value: '9:16', label: '9:16' },
    { value: '1:1', label: '1:1', isPro: true },
    { value: '16:9', label: '16:9', isPro: true },
    { value: '4:5', label: '4:5', isPro: true },
  ];

  const autoLayoutOptions: { value: AutoLayoutOption; label: string }[] = [
    { value: 'fill', label: 'Fill' },
    { value: 'fit', label: 'Fit' },
    { value: 'split', label: 'Split' },
    { value: 'ScreenShare', label: 'ScreenShare' },
    { value: 'Gameplay', label: 'Gameplay' },
    { value: 'Three', label: 'Three' },
    { value: 'Four', label: 'Four' },
  ];

  const cropAspectRatios: { value: AspectRatio | 'original'; label: string }[] = [
    { value: 'original', label: 'Original Ratio' },
    { value: '4:3', label: '4:3' },
    { value: '1:1', label: '1:1' },
  ];

  const handleAspectRatioChange = (aspectRatio: AspectRatio) => {
    onTemplateChange({
      ...template,
      aspectRatio,
    });
  };

  const handleAutoLayoutChange = (autoLayout: AutoLayoutOption) => {
    onTemplateChange({
      ...template,
      autoLayout,
    });
  };

  const handleCropAspectRatioChange = (cropAspectRatio: AspectRatio | 'original') => {
    onTemplateChange({
      ...template,
      cropAspectRatio: cropAspectRatio === 'original' ? undefined : cropAspectRatio,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Clip Layout Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Aspect Ratio Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Aspect Ratio</h3>
          <div className="grid grid-cols-4 gap-2">
            {aspectRatios.map((ratio) => (
              <div key={ratio.value} className="relative">
                <Button
                  variant={template.aspectRatio === ratio.value ? 'default' : 'outline'}
                  size="sm"
                  className="w-full h-12 flex flex-col items-center justify-center gap-1"
                  onClick={() => handleAspectRatioChange(ratio.value)}
                >
                  <span className="text-xs font-medium">{ratio.label}</span>
                  {ratio.isPro && (
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      Pro
                    </Badge>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Auto Layout Grid */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Auto Layout</h3>
          <div className="grid grid-cols-4 gap-2">
            {autoLayoutOptions.map((option) => (
              <Button
                key={option.value}
                variant={template.autoLayout === option.value ? 'default' : 'outline'}
                size="sm"
                className="h-12 text-xs"
                onClick={() => handleAutoLayoutChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Crop Aspect Ratio */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Crop Aspect Ratio</h3>
          <div className="grid grid-cols-3 gap-2">
            {cropAspectRatios.map((ratio) => (
              <Button
                key={ratio.value}
                variant={
                  (ratio.value === 'original' && !template.cropAspectRatio) ||
                  template.cropAspectRatio === ratio.value
                    ? 'default'
                    : 'outline'
                }
                size="sm"
                className="h-10 text-xs"
                onClick={() => handleCropAspectRatioChange(ratio.value)}
              >
                {ratio.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClipLayoutSettings;