import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrandTemplate, AspectRatio } from '@/types';

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

  const handleAspectRatioChange = useCallback((value: string) => {
    onTemplateChange({ aspectRatio: value as AspectRatio });
  }, [onTemplateChange]);

  return (
    <div className="space-y-4">
      <div>
        <Select
          value={template.aspectRatio}
          onValueChange={handleAspectRatioChange}
        >
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
    </div>
  );
};
