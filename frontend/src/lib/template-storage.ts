import { BrandTemplate, LogoAsset, CtaAsset, BackgroundAsset, IntroAsset, OutroAsset, OverlayAsset, Asset } from "@/types/index";
import { v4 as uuidv4 } from "uuid";

// In a real application, these paths would point to assets in /public
const DEFAULT_ASSETS = {
  logo: { url: '/assets/default_logo.png', type: 'logo', position: { x: 10, y: 10 }, size: { width: 150, height: 50 }, opacity: 1 } as LogoAsset,
  cta: { url: '/assets/default_cta.png', type: 'cta', position: { x: 80, y: 80 }, size: { width: 200, height: 75 }, opacity: 1 } as CtaAsset,
  background: { url: '/assets/default_background.mp4', type: 'background', opacity: 0.5, loop: true } as BackgroundAsset,
  intro: { url: '/assets/default_intro.mp4', type: 'intro', duration: 3 } as IntroAsset,
  outro: { url: '/assets/default_outro.mp4', type: 'outro', duration: 3 } as OutroAsset,
  overlay: { url: '/assets/default_overlay.png', type: 'overlay', position: { x: 50, y: 50 }, size: { width: 300, height: 150 }, opacity: 0.8 } as OverlayAsset,
};

const DEFAULT_TEMPLATES: BrandTemplate[] = [
  {
    id: "default-template",
    name: "Default Template",
    description: "A versatile default template for most use cases.",
    aspectRatio: "9:16",
    autoLayout: "fill",
    captionSettings: {
      animationStyle: "karaoke",
      font: {
        family: "Arial",
        size: 24,
        color: "#FFFFFF",
        case: "normal"
      },
      position: "bottom",
      syncMode: "word",
      highlightWords: [],
      autoHighlight: true
    },
    // These are deprecated but kept for type compatibility until the type is updated.
    overlaySettings: { url: '', position: {x: 0, y: 0}, size: {width: 100, height: 100}, opacity: 1},
    introOutroSettings: { url: '', duration: 0 },
    aiEmojis: true,
    autoTransitions: true,
    defaultLines: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assets: {
      logo: DEFAULT_ASSETS.logo,
      background: DEFAULT_ASSETS.background,
      intro: DEFAULT_ASSETS.intro,
      outro: DEFAULT_ASSETS.outro,
    }
  }
];

const TEMPLATE_STORAGE_KEY = "video_dashboard_templates";

export const defaultTemplate: BrandTemplate = {
  id: 'default',
  name: 'Default Template',
  description: 'A default template for creating new videos.',
  aspectRatio: '9:16',
  autoLayout: 'fill',
  captionSettings: {
    animationStyle: 'karaoke',
    font: {
      family: 'Arial',
      size: 24,
      color: '#FFFFFF',
      case: 'uppercase',
    },
    position: 'bottom',
    syncMode: 'word',
    highlightWords: [],
    autoHighlight: true
  },
  assets: {},
  overlaySettings: { url: '', position: {x: 0, y: 0}, size: {width: 100, height: 100}, opacity: 1},
  introOutroSettings: { url: '', duration: 0 },
  aiEmojis: false,
  autoTransitions: true,
  defaultLines: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const getTemplates = (): BrandTemplate[] => {
  if (typeof window === 'undefined') return [defaultTemplate];
  try {
    const savedTemplates = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    return savedTemplates ? JSON.parse(savedTemplates) : [...DEFAULT_TEMPLATES];
  } catch (error) {
    console.error('Failed to load templates from localStorage:', error);
    return [...DEFAULT_TEMPLATES];
  }
};

export const saveTemplates = (templates: BrandTemplate[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save templates to localStorage:', error);
  }
};

export const validateTemplate = (template: BrandTemplate): string[] => {
  const errors: string[] = [];
  if (!template.name || template.name.length < 3) {
    errors.push('Template name must be at least 3 characters long.');
  }
  if (!['9:16', '16:9', '1:1', '4:3', '3:4'].includes(template.aspectRatio)) {
    errors.push('Invalid aspect ratio.');
  }
  // Add more validation rules here
  return errors;
};

export const addTemplate = (template: Omit<BrandTemplate, 'id' | 'createdAt' | 'updatedAt'>): BrandTemplate => {
  const newTemplate: BrandTemplate = {
    ...template,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const templates = getTemplates();
  templates.push(newTemplate);
  saveTemplates(templates);
  return newTemplate;
}

export const updateTemplate = (id: string, updates: Partial<BrandTemplate>): BrandTemplate | null => {
  const templates = getTemplates();
  const templateIndex = templates.findIndex(t => t.id === id);
  if (templateIndex === -1) return null;

  const updatedTemplate = {
    ...templates[templateIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  templates[templateIndex] = updatedTemplate;
  saveTemplates(templates);
  return updatedTemplate;
}

export const removeTemplate = (id: string): void => {
  const templates = getTemplates();
  const updatedTemplates = templates.filter(t => t.id !== id);
  saveTemplates(updatedTemplates);
}

export const exportTemplates = (): void => {
  try {
    const dataStr = JSON.stringify(getTemplates(), null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brand_templates.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to export templates:", error);
  }
}

export const importTemplates = async (file: File): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        if (typeof content !== 'string') {
          throw new Error('File content is not valid text.');
        }
        const importedTemplates = JSON.parse(content) as BrandTemplate[];
        
        // Basic validation for imported templates
        if (!Array.isArray(importedTemplates)) {
          throw new Error('Imported file is not an array of templates.');
        }

        for (const template of importedTemplates) {
          const errors = validateTemplate(template);
          if (errors.length > 0) {
            throw new Error(`Invalid template found: ${template.name} - ${errors.join(', ')}`);
          }
        }

        const templates = getTemplates();
        saveTemplates([...templates, ...importedTemplates]);
        resolve({ success: true });
      } catch (e: any) {
        resolve({ success: false, error: e.message || "Failed to parse or validate the imported file." });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read the file.' });
    };
    reader.readAsText(file);
  });
}

// Hook for easy access to the template storage singleton in React components
export function useTemplate() {
  return {
    // This is a snapshot. It won't update automatically.
    getTemplates: getTemplates,
    addTemplate: addTemplate,
    updateTemplate: updateTemplate,
    removeTemplate: removeTemplate,
    validateTemplate: validateTemplate,
    exportTemplates: exportTemplates,
    importTemplates: importTemplates,
  };
}
