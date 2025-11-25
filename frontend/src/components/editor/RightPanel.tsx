import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ColorPicker } from '@/components/ui/color-picker';
import {
  BrandTemplate,
  TimelineClip,
  CaptionSettings,
  CaptionPosition,
  AnimationStyle,
  FontCase,
  AutoLayoutOption,
  AspectRatio,
} from '@/types';

interface RightPanelProps {
  template: BrandTemplate;
  clip: TimelineClip;
  onTemplateChange: (template: Partial<BrandTemplate>) => void;
  onClipChange: (clip: Partial<TimelineClip>) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  template,
  clip,
  onTemplateChange,
  onClipChange,
}) => {
  const [uploadError, setUploadError] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const handleTemplateChange = useCallback(
    (newTemplate: Partial<BrandTemplate>) => {
      onTemplateChange(newTemplate);
    },
    [onTemplateChange]
  );

  const handleClipChange = useCallback(
    (newClip: Partial<TimelineClip>) => {
      onClipChange(newClip);
    },
    [onClipChange]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label>Video URL</Label>
            <Input
              value={clip.videoUrl}
              onChange={(e) => handleClipChange({ videoUrl: e.target.value })}
            />
          </div>

          <div>
            <Label>Start Time</Label>
            <Input
              type="number"
              value={clip.startTime}
              onChange={(e) => handleClipChange({ startTime: parseFloat(e.target.value) })}
            />
          </div>

          <div>
            <Label>End Time</Label>
            <Input
              type="number"
              value={clip.endTime}
              onChange={(e) => handleClipChange({ endTime: parseFloat(e.target.value) })}
            />
          </div>

          <div>
            <Label>Caption</Label>
            <Input
              value={clip.caption || ''}
              onChange={(e) => handleClipChange({ caption: e.target.value })}
            />
          </div>

          {clip.caption && (
            <div className="space-y-4">
              <div>
                <Label>Animation Style</Label>
                <Select
                  value={clip.captionSettings?.animationStyle || template.captionSettings.animationStyle}
                  onValueChange={(value) =>
                    handleClipChange({
                      captionSettings: {
                        ...template.captionSettings,
                        ...clip.captionSettings,
                        animationStyle: value as AnimationStyle,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select animation style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="karaoke">Karaoke</SelectItem>
                    <SelectItem value="bounce">Bounce</SelectItem>
                    <SelectItem value="pop">Pop</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="scale">Scale</SelectItem>
                    <SelectItem value="slide_left">Slide Left</SelectItem>
                    <SelectItem value="slide_up">Slide Up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Font Settings</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Font Family</Label>
                    <Input
                      value={clip.captionSettings?.font?.family || template.captionSettings.font.family}
                      onChange={(e) =>
                        handleClipChange({
                          captionSettings: {
                            ...template.captionSettings,
                            ...clip.captionSettings,
                            font: {
                              ...template.captionSettings.font,
                              ...clip.captionSettings?.font,
                              family: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Font Size</Label>
                    <Input
                      type="number"
                      value={clip.captionSettings?.font?.size || template.captionSettings.font.size}
                      onChange={(e) =>
                        handleClipChange({
                          captionSettings: {
                            ...template.captionSettings,
                            ...clip.captionSettings,
                            font: {
                              ...template.captionSettings.font,
                              ...clip.captionSettings?.font,
                              size: parseInt(e.target.value),
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Font Color</Label>
                <ColorPicker
                  value={clip.captionSettings?.font?.color || template.captionSettings.font.color}
                  onChange={(color) =>
                    handleClipChange({
                      captionSettings: {
                        ...template.captionSettings,
                        ...clip.captionSettings,
                        font: {
                          ...template.captionSettings.font,
                          ...clip.captionSettings?.font,
                          color,
                        },
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label>Font Case</Label>
                <Select
                  value={clip.captionSettings?.font?.case || template.captionSettings.font.case}
                  onValueChange={(value) =>
                    handleClipChange({
                      captionSettings: {
                        ...template.captionSettings,
                        ...clip.captionSettings,
                        font: {
                          ...template.captionSettings.font,
                          ...clip.captionSettings?.font,
                          case: value as FontCase,
                        },
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select font case" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="uppercase">Uppercase</SelectItem>
                    <SelectItem value="lowercase">Lowercase</SelectItem>
                    <SelectItem value="capitalize">Capitalize</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Caption Position</Label>
                <Select
                  value={clip.captionSettings?.position || template.captionSettings.position}
                  onValueChange={(value) =>
                    handleClipChange({
                      captionSettings: {
                        ...template.captionSettings,
                        ...clip.captionSettings,
                        position: value as CaptionPosition,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="middle">Middle</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label>Aspect Ratio</Label>
            <Select
              value={template.aspectRatio}
              onValueChange={(value) =>
                handleTemplateChange({
                  aspectRatio: value as AspectRatio,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select aspect ratio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="9:16">9:16</SelectItem>
                <SelectItem value="1:1">1:1</SelectItem>
                <SelectItem value="4:3">4:3</SelectItem>
                <SelectItem value="3:4">3:4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Auto Layout</Label>
            <Select
              value={template.autoLayout}
              onValueChange={(value) =>
                handleTemplateChange({
                  autoLayout: value as AutoLayoutOption,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select layout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
