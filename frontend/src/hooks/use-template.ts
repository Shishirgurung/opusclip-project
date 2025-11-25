import { useState, useCallback, useEffect } from 'react';
import {
  BrandTemplate,
  AssetType,
  Asset,
} from '@/types';
import {
  getTemplates as getTemplatesFromStorage,
  saveTemplates as saveTemplatesToStorage,
  defaultTemplate,
  addTemplate as addTemplateToStorage,
  updateTemplate as updateTemplateInStorage,
  removeTemplate as removeTemplateFromStorage,
  validateTemplate,
} from '@/lib/template-storage';

export function useTemplate() {
  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<BrandTemplate>(defaultTemplate);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    const loadedTemplates = getTemplatesFromStorage();
    setTemplates(loadedTemplates);
    if (loadedTemplates.length > 0) {
      setCurrentTemplate(loadedTemplates[0]);
    }
  }, []);

  const saveAndSetTemplates = (newTemplates: BrandTemplate[]) => {
    setTemplates(newTemplates);
    saveTemplatesToStorage(newTemplates);
  };

  const addTemplate = (template: Omit<BrandTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTemplate = addTemplateToStorage(template);
    const newTemplates = [...templates, newTemplate];
    saveAndSetTemplates(newTemplates);
    setCurrentTemplate(newTemplate);
  };

  const updateTemplate = useCallback((id: string, updates: Partial<BrandTemplate>) => {
    const updatedTemplate = updateTemplateInStorage(id, updates);
    if (updatedTemplate) {
      const newTemplates = templates.map(t => t.id === id ? updatedTemplate : t);
      saveAndSetTemplates(newTemplates);
      if (currentTemplate.id === id) {
        setCurrentTemplate(updatedTemplate);
      }
    }
  }, [templates, currentTemplate.id]);

  const removeTemplate = (id: string) => {
    removeTemplateFromStorage(id);
    const newTemplates = templates.filter(t => t.id !== id);
    saveAndSetTemplates(newTemplates);
    if (currentTemplate.id === id) {
      setCurrentTemplate(newTemplates.length > 0 ? newTemplates[0] : defaultTemplate);
    }
  };

  const uploadAsset = useCallback(async (assetType: AssetType, file: File) => {
    setIsUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assetType', assetType);

    try {
      const response = await fetch('/api/upload-asset', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Asset upload failed');
      }

      const newAsset: Asset = await response.json();
      
      const updatedTemplate = { 
        ...currentTemplate, 
        assets: { ...currentTemplate.assets, [assetType]: newAsset }
      };

      updateTemplate(currentTemplate.id, { assets: updatedTemplate.assets });

    } catch (error: any) {
      setUploadError(error.message);
    } finally {
      setIsUploading(false);
    }
  }, [currentTemplate, updateTemplate]);

  const removeAsset = useCallback((assetType: AssetType) => {
    const updatedAssets = { ...currentTemplate.assets };
    delete updatedAssets[assetType];
    updateTemplate(currentTemplate.id, { assets: updatedAssets });
  }, [currentTemplate, updateTemplate]);

  return {
    templates,
    currentTemplate,
    setCurrentTemplate,
    addTemplate,
    updateTemplate,
    removeTemplate,
    validateTemplate,
    uploadAsset,
    removeAsset,
    isUploading,
    uploadError,
    validationErrors,
  };
}
