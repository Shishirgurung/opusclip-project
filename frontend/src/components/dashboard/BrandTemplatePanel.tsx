import React, { useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ColorPicker } from '@/components/ui/color-picker';
import { FileUpload } from '@/components/ui/file-upload';
import {
  AssetType,
  AnimationStyle,
  FontCase,
  CaptionPosition,
  AspectRatio,
  AutoLayoutOption,
} from '@/types';
import { useTemplate } from '@/hooks/use-template';

export const BrandTemplatePanel: React.FC = () => {
  const {
    currentTemplate: template,
    updateTemplate,
    uploadAsset,
    removeAsset,
    isUploading,
    uploadError,
  } = useTemplate();

  const handleUpdate = useCallback((path: (string | number)[], value: any) => {
    if (!template) return;
    const newTemplate = JSON.parse(JSON.stringify(template));
    let current = newTemplate;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    updateTemplate(template.id, newTemplate);
  }, [template, updateTemplate]);

  const handleFileChange = async (assetType: AssetType, file: File | null) => {
    if (file) {
      await uploadAsset(assetType, file);
    } else {
      removeAsset(assetType);
    }
  };

  if (!template) {
    return (
      <div className="p-4 text-center text-gray-500">
        Select a template to edit.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Template</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Info */}
        <div className="space-y-4">
          <h3 className="font-medium">Template Info</h3>
          <div>
            <Label htmlFor="template-name">Name</Label>
            <Input id="template-name" value={template.name} onChange={(e) => handleUpdate(['name'], e.target.value)} />
          </div>
          <div>
            <Label htmlFor="template-description">Description</Label>
            <Input id="template-description" value={template.description} onChange={(e) => handleUpdate(['description'], e.target.value)} />
          </div>
        </div>

        {/* Assets */}
        <div className="space-y-4">
          <h3 className="font-medium">Assets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FileUpload
              assetType="logo"
              asset={template.assets?.logo}
              onFileChange={(file) => handleFileChange('logo', file)}
              isUploading={isUploading}
              uploadError={uploadError}
            />
            <FileUpload
              assetType="cta"
              asset={template.assets?.cta}
              onFileChange={(file) => handleFileChange('cta', file)}
              isUploading={isUploading}
              uploadError={uploadError}
            />
            <FileUpload
              assetType="background"
              asset={template.assets?.background}
              onFileChange={(file) => handleFileChange('background', file)}
              isUploading={isUploading}
              uploadError={uploadError}
            />
            <FileUpload
              assetType="overlay"
              asset={template.assets?.overlay}
              onFileChange={(file) => handleFileChange('overlay', file)}
              isUploading={isUploading}
              uploadError={uploadError}
            />
            <FileUpload
              assetType="intro"
              asset={template.assets?.intro}
              onFileChange={(file) => handleFileChange('intro', file)}
              isUploading={isUploading}
              uploadError={uploadError}
            />
            <FileUpload
              assetType="outro"
              asset={template.assets?.outro}
              onFileChange={(file) => handleFileChange('outro', file)}
              isUploading={isUploading}
              uploadError={uploadError}
            />
          </div>
        </div>

        {/* Caption Settings */}
        <div className="space-y-4">
          <h3 className="font-medium">Captions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Animation Style</Label>
              <Select value={template.captionSettings.animationStyle} onValueChange={(v) => handleUpdate(['captionSettings', 'animationStyle'], v as AnimationStyle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="karaoke">Karaoke</SelectItem>
                  <SelectItem value="highlight">Highlight</SelectItem>
                  <SelectItem value="pop-up">Pop-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Font Size</Label>
              <Input type="number" value={template.captionSettings.font.size} onChange={(e) => handleUpdate(['captionSettings', 'font', 'size'], parseInt(e.target.value, 10))} />
            </div>
            <div>
              <Label>Font Color</Label>
              <ColorPicker value={template.captionSettings.font.color} onChange={(c) => handleUpdate(['captionSettings', 'font', 'color'], c)} />
            </div>
            <div>
              <Label>Font Case</Label>
              <Select value={template.captionSettings.font.case} onValueChange={(v) => handleUpdate(['captionSettings', 'font', 'case'], v as FontCase)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Select value={template.captionSettings.position} onValueChange={(v) => handleUpdate(['captionSettings', 'position'], v as CaptionPosition)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="middle">Middle</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* General Settings */}
        <div className="space-y-4">
          <h3 className="font-medium">General Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Aspect Ratio</Label>
              <Select value={template.aspectRatio} onValueChange={(v) => handleUpdate(['aspectRatio'], v as AspectRatio)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                  <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  <SelectItem value="4:3">4:3</SelectItem>
                  <SelectItem value="3:4">3:4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Auto Layout</Label>
              <Select value={template.autoLayout} onValueChange={(v) => handleUpdate(['autoLayout'], v as AutoLayoutOption)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                  <SelectItem value="fill">Fill</SelectItem>
                  <SelectItem value="fit">Fit</SelectItem>
                  <SelectItem value="split">Split</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="ai-emojis" checked={template.aiEmojis} onCheckedChange={(c) => handleUpdate(['aiEmojis'], c)} />
              <Label htmlFor="ai-emojis">AI-Generated Emojis</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="auto-transitions" checked={template.autoTransitions} onCheckedChange={(c) => handleUpdate(['autoTransitions'], c)} />
              <Label htmlFor="auto-transitions">Automatic Transitions</Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};