import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, X } from 'lucide-react';
import { BrandTemplate, IntroAsset, OutroAsset } from '@/types';

interface IntroOutroPanelProps {
  template: BrandTemplate;
  onTemplateChange: (template: BrandTemplate) => void;
  isUploading?: boolean;
  uploadError?: string;
}

export const IntroOutroPanel: React.FC<IntroOutroPanelProps> = ({
  template,
  onTemplateChange,
  isUploading = false,
  uploadError = '',
}) => {
  const [introUploading, setIntroUploading] = useState(false);
  const [outroUploading, setOutroUploading] = useState(false);

  const handleIntroFileChange = async (file: File | null) => {
    if (!file) {
      // Remove intro asset
      const updatedTemplate = {
        ...template,
        assets: {
          ...template.assets,
          intro: undefined,
        },
      };
      onTemplateChange(updatedTemplate);
      return;
    }

    setIntroUploading(true);
    try {
      // Create a temporary URL for the uploaded file
      const url = URL.createObjectURL(file);
      
      const introAsset: IntroAsset = {
        url,
        type: 'intro',
        duration: 3, // Default 3 seconds duration
      };

      const updatedTemplate = {
        ...template,
        assets: {
          ...template.assets,
          intro: introAsset,
        },
      };
      
      onTemplateChange(updatedTemplate);
    } catch (error) {
      console.error('Error uploading intro file:', error);
    } finally {
      setIntroUploading(false);
    }
  };

  const handleOutroFileChange = async (file: File | null) => {
    if (!file) {
      // Remove outro asset
      const updatedTemplate = {
        ...template,
        assets: {
          ...template.assets,
          outro: undefined,
        },
      };
      onTemplateChange(updatedTemplate);
      return;
    }

    setOutroUploading(true);
    try {
      // Create a temporary URL for the uploaded file
      const url = URL.createObjectURL(file);
      
      const outroAsset: OutroAsset = {
        url,
        type: 'outro',
        duration: 3, // Default 3 seconds duration
      };

      const updatedTemplate = {
        ...template,
        assets: {
          ...template.assets,
          outro: outroAsset,
        },
      };
      
      onTemplateChange(updatedTemplate);
    } catch (error) {
      console.error('Error uploading outro file:', error);
    } finally {
      setOutroUploading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Intro & Outro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Intro Upload Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Intro Video
            </label>
            {template.assets.intro && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleIntroFileChange(null)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
          
          {!template.assets.intro ? (
            <Button
              variant="outline"
              className="w-full h-12 border-dashed border-2 hover:border-purple-400"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    handleIntroFileChange(file);
                  }
                };
                input.click();
              }}
              disabled={introUploading || isUploading}
            >
              {introUploading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                  Uploading...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Intro
                </div>
              )}
            </Button>
          ) : (
            <FileUpload
              assetType="intro"
              asset={template.assets.intro}
              onFileChange={handleIntroFileChange}
              isUploading={introUploading}
              uploadError={uploadError}
              className="w-full"
            />
          )}
        </div>

        {/* Outro Upload Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Outro Video
            </label>
            {template.assets.outro && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOutroFileChange(null)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
          
          {!template.assets.outro ? (
            <Button
              variant="outline"
              className="w-full h-12 border-dashed border-2 hover:border-purple-400"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    handleOutroFileChange(file);
                  }
                };
                input.click();
              }}
              disabled={outroUploading || isUploading}
            >
              {outroUploading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                  Uploading...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Outro
                </div>
              )}
            </Button>
          ) : (
            <FileUpload
              assetType="outro"
              asset={template.assets.outro}
              onFileChange={handleOutroFileChange}
              isUploading={outroUploading}
              uploadError={uploadError}
              className="w-full"
            />
          )}
        </div>

        {/* Display current files info */}
        {(template.assets.intro || template.assets.outro) && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Current Files:</h4>
            <div className="space-y-2 text-sm text-gray-600">
              {template.assets.intro && (
                <div className="flex items-center justify-between">
                  <span>Intro: {template.assets.intro.url.split('/').pop()}</span>
                  <span className="text-xs text-gray-500">
                    Duration: {template.assets.intro.duration}s
                  </span>
                </div>
              )}
              {template.assets.outro && (
                <div className="flex items-center justify-between">
                  <span>Outro: {template.assets.outro.url.split('/').pop()}</span>
                  <span className="text-xs text-gray-500">
                    Duration: {template.assets.outro.duration}s
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};