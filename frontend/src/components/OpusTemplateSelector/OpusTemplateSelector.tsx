'use client';

import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { loadOpusTemplates, validateOpusTemplate } from '@/lib/opus-templates';
import { BrandTemplate } from '@/types';

interface OpusTemplateSelectorProps {
  selectedTemplate?: BrandTemplate | null;
  onTemplateSelect: (template: BrandTemplate) => void;
  className?: string;
}

const OpusTemplateSelector: React.FC<OpusTemplateSelectorProps> = ({
  selectedTemplate,
  onTemplateSelect,
  className = ''
}) => {
  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const loadedTemplates = await loadOpusTemplates();
        
        const validTemplates = loadedTemplates.filter(template => {
          const isValid = validateOpusTemplate(template);
          if (!isValid) {
            console.warn(`Invalid or incomplete template removed: ${template.name}`, template);
          }
          return isValid;
        });

        setTemplates(validTemplates);
      } catch (err) {
        console.error('Failed to load Opus templates:', err);
        setError('Failed to load templates. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const handleSelectChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      onTemplateSelect(template);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Label>Opus Template</Label>
        <div className="flex items-center justify-center p-2 border rounded-md h-[40px]">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-2 ${className}`}>
         <Label className="text-red-500">Opus Template</Label>
        <div className="text-center p-2 border border-red-500/50 rounded-md bg-red-500/10">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="destructive"
            size="sm"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
       <div className={`space-y-2 ${className}`}>
        <Label>Opus Template</Label>
        <div className="text-center p-2 border rounded-md h-[40px]">
          <p className="text-sm text-gray-500">No templates found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor="opus-template-select">Choose Your Opus Template</Label>
      <Select
        value={selectedTemplate?.id || ''}
        onValueChange={handleSelectChange}
      >
        <SelectTrigger id="opus-template-select">
          <SelectValue placeholder="Select a professional template..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              <div className="flex flex-col">
                <span className="font-semibold">{template.name}</span>
                <span className="text-xs text-gray-500">{template.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default OpusTemplateSelector;
export { OpusTemplateSelector };
export type { OpusTemplateSelectorProps };