import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BrandTemplate, AspectRatio, AutoLayoutOption } from '@/types';

interface AspectRatioControlsProps {
  template: BrandTemplate;
  onTemplateChange: (newTemplate: Partial<BrandTemplate>) => void;
}

export const AspectRatioControls: React.FC<AspectRatioControlsProps> = ({
  template,
  onTemplateChange,
}) => {
  const aspectRatios: { value: AspectRatio; label: string }[] = [
    { value: '9:16', label: 'Vertical (9:16)' },
    { value: '16:9', label: 'Horizontal (16:9)' },
    { value: '1:1', label: 'Square (1:1)' },
    { value: '4:3', label: 'Standard (4:3)' },
    { value: '3:4', label: 'Portrait (3:4)' },
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

  const handleAspectRatioChange = useCallback(
    (value: string) => {
      onTemplateChange({ aspectRatio: value as AspectRatio });
    },
    [onTemplateChange]
  );

  const handleAutoLayoutChange = useCallback(
    (value: string) => {
      onTemplateChange({ autoLayout: value as AutoLayoutOption });
    },
    [onTemplateChange]
  );

  const handleCropAspectRatioChange = useCallback(
    (value: string) => {
      onTemplateChange({
        cropAspectRatio: value === 'original' ? undefined : (value as AspectRatio),
      });
    },
    [onTemplateChange]
  );

  return (
    <div className="space-y-4">
      {/* Aspect Ratio Select */}
      <div>
        <Select value={template.aspectRatio} onValueChange={handleAspectRatioChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select aspect ratio" />
          </SelectTrigger>
          <SelectContent>
            {aspectRatios.map((ratio) => (
              <SelectItem key={ratio.value} value={ratio.value}>
                {ratio.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Aspect Ratio Buttons */}
      <div className="flex flex-col gap-4">
        {aspectRatios.map((ratio) => (
          <Button
            key={ratio.value}
            variant={template.aspectRatio === ratio.value ? 'default' : 'outline'}
            onClick={() => handleAspectRatioChange(ratio.value)}
            className="flex items-center justify-center gap-2"
          >
            <span className="text-sm">{ratio.label}</span>
            {template.aspectRatio === ratio.value && (
              <span className="text-primary">✓</span>
            )}
          </Button>
        ))}
      </div>

      {/* Auto Layout Options */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Auto Layout</h3>
        <div className="flex flex-wrap gap-2">
          {autoLayoutOptions.map((option) => (
            <Button
              key={option.value}
              variant={template.autoLayout === option.value ? 'default' : 'outline'}
              onClick={() => handleAutoLayoutChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Crop Aspect Ratio Selection */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Crop Aspect Ratio</h3>
        <div className="flex flex-wrap gap-2">
          {cropAspectRatios.map((ratio) => (
            <Button
              key={ratio.value}
              variant={
                (!template.cropAspectRatio && ratio.value === 'original') ||
                template.cropAspectRatio === ratio.value
                  ? 'default'
                  : 'outline'
              }
              onClick={() => handleCropAspectRatioChange(ratio.value)}
            >
              {ratio.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};