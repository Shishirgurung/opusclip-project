import { BrandTemplate, OpusTemplate, KeywordHighlightSettings, AnimationStyle, CaptionPosition, TemplateValidationResult, CaptionSettings } from '@/types';

// Opus Clip template names
export type OpusTemplateName = 'Karaoke' | 'Beasty' | 'Mozi' | 'Deep Driver' | 'Popline';

// Template cache for performance
let templateCache: BrandTemplate[] | null = null;

/**
 * Load all Opus templates from the JSON file
 */
export async function loadOpusTemplates(): Promise<BrandTemplate[]> {
  if (templateCache) {
    return templateCache;
  }

  try {
    const response = await fetch('/templates/opus-templates.json');
    if (!response.ok) {
      throw new Error(`Failed to load templates: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate and migrate loaded templates
    const validatedTemplates = data.templates.map((template: BrandTemplate) => {
      const validation = validateOpusTemplate(template);
      if (!validation.isValid) {
        console.warn(`Template ${template.id} has validation issues:`, validation.errors);
        // Apply migration/fixes for missing required fields
        return ensureRequiredFields(template);
      }
      return template;
    });
    
    templateCache = validatedTemplates;
    return templateCache;
  } catch (error) {
    console.error('Error loading Opus templates:', error);
    return getDefaultOpusTemplates();
  }
}

/**
 * Get a specific Opus template by name
 */
export async function getOpusTemplateByName(name: OpusTemplateName): Promise<BrandTemplate | null> {
  const templates = await loadOpusTemplates();
  return templates.find(template => template.name === name) || null;
}

/**
 * Get a specific Opus template by ID
 */
export async function getOpusTemplateById(id: string): Promise<BrandTemplate | null> {
  const templates = await loadOpusTemplates();
  return templates.find(template => template.id === id) || null;
}

/**
 * Get all available Opus template names
 */
export function getOpusTemplateNames(): OpusTemplateName[] {
  return ['Karaoke', 'Beasty', 'Mozi', 'Deep Driver', 'Popline'];
}

/**
 * Validate if a template meets Opus Clip requirements
 */
export function validateOpusTemplate(template: BrandTemplate): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check required basic fields
    if (!template.id) {
      errors.push('Template ID is required');
    }
    if (!template.name) {
      errors.push('Template name is required');
    }
    if (!template.captionSettings) {
      errors.push('Caption settings are required');
      return { isValid: false, errors, warnings };
    }

    // Check if it's a valid Opus template name
    const validNames = getOpusTemplateNames();
    if (!validNames.includes(template.name as OpusTemplateName)) {
      warnings.push(`Template name "${template.name}" is not a standard Opus template name`);
    }

    // Validate caption settings structure
    const captionValidation = validateCaptionSettings(template.captionSettings);
    errors.push(...captionValidation.errors);
    warnings.push(...captionValidation.warnings);

    // Check default lines
    if (!template.defaultLines) {
      errors.push('Default lines count is required');
    } else if (template.defaultLines < 1 || template.defaultLines > 3) {
      errors.push('Default lines must be between 1 and 3');
    }

    // Check aspect ratio
    if (!template.aspectRatio) {
      errors.push('Aspect ratio is required');
    }

    // Check auto layout
    if (!template.autoLayout) {
      errors.push('Auto layout setting is required');
    }

    // Validate keyword highlight settings if present
    if (template.keywordHighlight) {
      if (!template.keywordHighlight.primaryColor) {
        errors.push('Primary highlight color is required when keyword highlighting is enabled');
      }
      if (!template.keywordHighlight.secondaryColor) {
        errors.push('Secondary highlight color is required when keyword highlighting is enabled');
      }
      if (typeof template.keywordHighlight.enabled !== 'boolean') {
        warnings.push('Keyword highlight enabled flag should be explicitly set');
      }
    }

    // Validate font settings if present
    if (template.fontSettings) {
      if (!template.fontSettings.family) {
        errors.push('Font family is required in font settings');
      }
      if (!template.fontSettings.size || template.fontSettings.size <= 0) {
        errors.push('Valid font size is required in font settings');
      }
      if (!template.fontSettings.color) {
        errors.push('Font color is required in font settings');
      }
    }

    // Validate positioning settings if present
    if (template.positioning) {
      if (!template.positioning.default) {
        errors.push('Default position is required in positioning settings');
      }
      if (typeof template.positioning.allowOverride !== 'boolean') {
        warnings.push('Position override flag should be explicitly set');
      }
    }

    // Check timestamps
    if (!template.createdAt) {
      warnings.push('Created timestamp is missing');
    }
    if (!template.updatedAt) {
      warnings.push('Updated timestamp is missing');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
    return {
      isValid: false,
      errors: [`Template validation failed: ${errorMessage}`],
      warnings
    };
  }
}

/**
 * Create a customized version of an Opus template
 */
export function customizeOpusTemplate(
  baseTemplate: BrandTemplate,
  customizations: Partial<BrandTemplate>
): BrandTemplate {
  // Ensure base template has required fields before customization
  const ensuredBase = ensureRequiredFields(baseTemplate);
  
  const customized = {
    ...ensuredBase,
    ...customizations,
    id: `${ensuredBase.id}-custom-${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };

  // Deep merge caption settings while preserving required fields
  if (customizations.captionSettings) {
    customized.captionSettings = {
      ...ensuredBase.captionSettings,
      ...customizations.captionSettings,
      // Ensure syncMode is always preserved
      syncMode: customizations.captionSettings.syncMode || ensuredBase.captionSettings.syncMode,
    };

    // Deep merge font settings
    if (customizations.captionSettings.font) {
      customized.captionSettings.font = {
        ...ensuredBase.captionSettings.font,
        ...customizations.captionSettings.font,
      };
    }
  }

  // Deep merge keyword highlight settings
  if (customizations.keywordHighlight) {
    customized.keywordHighlight = {
      ...ensuredBase.keywordHighlight,
      ...customizations.keywordHighlight,
    };
  }

  // Deep merge font settings
  if (customizations.fontSettings) {
    customized.fontSettings = {
      ...ensuredBase.fontSettings,
      ...customizations.fontSettings,
    };
  }

  // Deep merge positioning settings
  if (customizations.positioning) {
    customized.positioning = {
      ...ensuredBase.positioning,
      ...customizations.positioning,
    };
  }

  // Validate the customized template
  const validation = validateOpusTemplate(customized);
  if (!validation.isValid) {
    console.warn('Customized template has validation issues:', validation.errors);
    // Apply fixes for any missing required fields
    return ensureRequiredFields(customized);
  }

  return customized;
}

/**
 * Get default template settings for a specific sync mode
 */
export function getDefaultSettingsForSyncMode(syncMode: 'word' | 'line'): Partial<BrandTemplate> {
  const baseFont = {
    family: 'Montserrat',
    size: 48,
    color: '#FFFFFF',
    case: 'normal' as const,
  };

  const baseSettings = {
    aspectRatio: '9:16' as const,
    autoLayout: 'center' as const,
    captionSettings: {
      syncMode,
      highlightWords: [],
      autoHighlight: true,
      font: baseFont,
    } as CaptionSettings,
    keywordHighlight: {
      primaryColor: '#04f827FF',
      secondaryColor: '#FFFDO3FF',
      enabled: true,
    },
    fontSettings: {
      family: baseFont.family,
      size: baseFont.size,
      color: baseFont.color,
      shadowColor: '#000000',
      shadowX: 2,
      shadowY: 2,
      shadowBlur: 4,
    },
    overlaySettings: {
      url: '',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      opacity: 0,
    },
    introOutroSettings: {
      url: '',
      duration: 0,
    },
    aiEmojis: true,
    autoTransitions: true,
    assets: {},
  };

  if (syncMode === 'word') {
    return {
      ...baseSettings,
      defaultLines: 2,
      captionSettings: {
        ...baseSettings.captionSettings,
        animationStyle: 'bounce' as AnimationStyle,
        position: 'bottom' as CaptionPosition,
      },
      positioning: {
        default: 'bottom' as CaptionPosition,
        allowOverride: true,
      },
    };
  } else {
    return {
      ...baseSettings,
      defaultLines: 1,
      captionSettings: {
        ...baseSettings.captionSettings,
        animationStyle: 'pop' as AnimationStyle,
        position: 'middle' as CaptionPosition,
      },
      positioning: {
        default: 'middle' as CaptionPosition,
        allowOverride: true,
      },
    };
  }
}

/**
 * Check if a template supports word-level synchronization
 */
export function supportsWordSync(template: BrandTemplate): boolean {
  return template.captionSettings?.syncMode === 'word';
}

/**
 * Check if a template supports line-level synchronization
 */
export function supportsLineSync(template: BrandTemplate): boolean {
  return template.captionSettings?.syncMode === 'line';
}

/**
 * Get the recommended animation styles for each template
 */
export function getRecommendedAnimations(templateName: OpusTemplateName): AnimationStyle[] {
  const recommendations: Record<OpusTemplateName, AnimationStyle[]> = {
    'Karaoke': ['bounce', 'pop', 'scale'],
    'Beasty': ['pop', 'flash', 'shake'],
    'Mozi': ['scale', 'fade', 'slide-up'],
    'Deep Driver': ['underline', 'slide-left', 'box'],
    'Popline': ['slide-up', 'bounce', 'pop'],
  };

  return recommendations[templateName] || ['bounce', 'pop', 'scale'];
}

/**
 * Convert an Opus template to the OpusTemplate interface format
 */
export function toOpusTemplate(template: BrandTemplate): OpusTemplate {
  return {
    id: template.id,
    name: template.name as OpusTemplateName,
    description: template.description || '',
    syncMode: template.captionSettings?.syncMode || 'line',
    defaultLines: template.defaultLines || 2,
    defaultAnimation: template.captionSettings?.animationStyle || 'bounce',
    keywordHighlight: template.keywordHighlight || {
      primaryColor: '#04f827FF',
      secondaryColor: '#FFFDO3FF',
      enabled: true,
    },
    fontSettings: template.fontSettings || {
      family: template.captionSettings?.font?.family || 'Montserrat',
      size: template.captionSettings?.font?.size || 48,
      color: template.captionSettings?.font?.color || '#FFFFFF',
      shadowColor: '#000000',
      shadowX: 2,
      shadowY: 2,
      shadowBlur: 4,
    },
    positioning: template.positioning || {
      default: template.captionSettings?.position || 'bottom',
      allowOverride: true,
    },
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

/**
 * Get default Opus templates (fallback if JSON fails to load)
 */
function getDefaultOpusTemplates(): BrandTemplate[] {
  const now = new Date().toISOString();
  
  return [
    {
      id: 'karaoke',
      name: 'Karaoke',
      description: 'Word-by-word highlighting with bounce animation, perfect for sing-along style content',
      aspectRatio: '9:16',
      autoLayout: 'center',
      defaultLines: 2,
      captionSettings: {
        animationStyle: 'bounce',
        font: {
          family: 'Montserrat',
          size: 48,
          color: '#FFFFFF',
          case: 'uppercase',
        },
        position: 'bottom',
        syncMode: 'word',
        highlightWords: [],
        autoHighlight: true,
      },
      overlaySettings: {
        url: '',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        opacity: 0,
      },
      introOutroSettings: {
        url: '',
        duration: 0,
      },
      aiEmojis: true,
      autoTransitions: true,
      createdAt: now,
      updatedAt: now,
      assets: {},
      keywordHighlight: {
        primaryColor: '#04f827FF',
        secondaryColor: '#FFFDO3FF',
        enabled: true,
      },
      fontSettings: {
        family: 'Montserrat',
        size: 48,
        color: '#FFFFFF',
        shadowColor: '#000000',
        shadowX: 2,
        shadowY: 2,
        shadowBlur: 4,
      },
      positioning: {
        default: 'bottom',
        allowOverride: true,
      },
    },
    {
      id: 'beasty',
      name: 'Beasty',
      description: 'Bold and aggressive styling with pop animation, ideal for high-energy content',
      aspectRatio: '9:16',
      autoLayout: 'center',
      defaultLines: 1,
      captionSettings: {
        animationStyle: 'pop',
        font: {
          family: 'Anton',
          size: 56,
          color: '#FF4444',
          case: 'uppercase',
        },
        position: 'middle',
        syncMode: 'line',
        highlightWords: [],
        autoHighlight: true,
      },
      overlaySettings: {
        url: '',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        opacity: 0,
      },
      introOutroSettings: {
        url: '',
        duration: 0,
      },
      aiEmojis: true,
      autoTransitions: true,
      createdAt: now,
      updatedAt: now,
      assets: {},
      keywordHighlight: {
        primaryColor: '#04f827FF',
        secondaryColor: '#FFFDO3FF',
        enabled: true,
      },
      fontSettings: {
        family: 'Anton',
        size: 56,
        color: '#FF4444',
        shadowColor: '#000000',
        shadowX: 3,
        shadowY: 3,
        shadowBlur: 6,
      },
      positioning: {
        default: 'middle',
        allowOverride: true,
      },
    },
    {
      id: 'mozi',
      name: 'Mozi',
      description: 'Clean and modern design with scale animation, perfect for professional content',
      aspectRatio: '9:16',
      autoLayout: 'center',
      defaultLines: 2,
      captionSettings: {
        animationStyle: 'scale',
        font: {
          family: 'Georgia',
          size: 44,
          color: '#FFFFFF',
          case: 'normal',
        },
        position: 'bottom',
        syncMode: 'line',
        highlightWords: [],
        autoHighlight: true,
      },
      overlaySettings: {
        url: '',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        opacity: 0,
      },
      introOutroSettings: {
        url: '',
        duration: 0,
      },
      aiEmojis: false,
      autoTransitions: true,
      createdAt: now,
      updatedAt: now,
      assets: {},
      keywordHighlight: {
        primaryColor: '#04f827FF',
        secondaryColor: '#FFFDO3FF',
        enabled: true,
      },
      fontSettings: {
        family: 'Georgia',
        size: 44,
        color: '#FFFFFF',
        shadowColor: '#333333',
        shadowX: 1,
        shadowY: 1,
        shadowBlur: 2,
      },
      positioning: {
        default: 'bottom',
        allowOverride: true,
      },
    },
    {
      id: 'deep-driver',
      name: 'Deep Driver',
      description: 'Dramatic underline effect with word-by-word sync, great for storytelling',
      aspectRatio: '9:16',
      autoLayout: 'center',
      defaultLines: 3,
      captionSettings: {
        animationStyle: 'underline',
        font: {
          family: 'Impact',
          size: 42,
          color: '#FFFFFF',
          case: 'uppercase',
        },
        position: 'top',
        syncMode: 'word',
        highlightWords: [],
        autoHighlight: true,
      },
      overlaySettings: {
        url: '',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        opacity: 0,
      },
      introOutroSettings: {
        url: '',
        duration: 0,
      },
      aiEmojis: true,
      autoTransitions: true,
      createdAt: now,
      updatedAt: now,
      assets: {},
      keywordHighlight: {
        primaryColor: '#04f827FF',
        secondaryColor: '#FFFDO3FF',
        enabled: true,
      },
      fontSettings: {
        family: 'Impact',
        size: 42,
        color: '#FFFFFF',
        shadowColor: '#000000',
        shadowX: 2,
        shadowY: 2,
        shadowBlur: 5,
      },
      positioning: {
        default: 'top',
        allowOverride: true,
      },
    },
    {
      id: 'popline',
      name: 'Popline',
      description: 'Vibrant slide-up animation with colorful styling, perfect for trendy content',
      aspectRatio: '9:16',
      autoLayout: 'center',
      defaultLines: 2,
      captionSettings: {
        animationStyle: 'slide-up',
        font: {
          family: 'Bangers',
          size: 50,
          color: '#FF6B6B',
          case: 'uppercase',
        },
        position: 'middle',
        syncMode: 'line',
        highlightWords: [],
        autoHighlight: true,
      },
      overlaySettings: {
        url: '',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        opacity: 0,
      },
      introOutroSettings: {
        url: '',
        duration: 0,
      },
      aiEmojis: true,
      autoTransitions: true,
      createdAt: now,
      updatedAt: now,
      assets: {},
      keywordHighlight: {
        primaryColor: '#04f827FF',
        secondaryColor: '#FFFDO3FF',
        enabled: true,
      },
      fontSettings: {
        family: 'Bangers',
        size: 50,
        color: '#FF6B6B',
        shadowColor: '#000000',
        shadowX: 2,
        shadowY: 2,
        shadowBlur: 4,
      },
      positioning: {
        default: 'middle',
        allowOverride: true,
      },
    },
  ];
}

/**
 * Validate caption settings structure
 */
export function validateCaptionSettings(captionSettings: CaptionSettings): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!captionSettings.syncMode) {
    errors.push('Caption syncMode is required');
  } else if (!['word', 'line'].includes(captionSettings.syncMode)) {
    errors.push('Caption syncMode must be either "word" or "line"');
  }

  if (!captionSettings.animationStyle) {
    errors.push('Caption animation style is required');
  }

  if (!captionSettings.position) {
    errors.push('Caption position is required');
  } else if (!['top', 'middle', 'bottom'].includes(captionSettings.position)) {
    errors.push('Caption position must be "top", "middle", or "bottom"');
  }

  if (!captionSettings.font) {
    errors.push('Caption font settings are required');
  } else {
    if (!captionSettings.font.family) {
      errors.push('Font family is required');
    }
    if (!captionSettings.font.size || captionSettings.font.size <= 0) {
      errors.push('Valid font size is required');
    }
    if (!captionSettings.font.color) {
      errors.push('Font color is required');
    }
    if (!captionSettings.font.case) {
      warnings.push('Font case should be specified');
    }
  }

  if (typeof captionSettings.autoHighlight !== 'boolean') {
    warnings.push('Auto highlight flag should be explicitly set');
  }

  if (!Array.isArray(captionSettings.highlightWords)) {
    warnings.push('Highlight words should be an array');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Ensure all required fields are present in a template
 */
export function ensureRequiredFields(template: BrandTemplate): BrandTemplate {
  const now = new Date().toISOString();
  
  // Get default settings based on existing syncMode or fallback to 'line'
  const syncMode = template.captionSettings?.syncMode || 'line';
  const defaults = getDefaultSettingsForSyncMode(syncMode);
  
  return {
    id: template.id || `template-${Date.now()}`,
    name: template.name || 'Unnamed Template',
    description: template.description || '',
    aspectRatio: template.aspectRatio || defaults.aspectRatio!,
    autoLayout: template.autoLayout || defaults.autoLayout!,
    defaultLines: template.defaultLines || defaults.defaultLines!,
    captionSettings: {
      ...defaults.captionSettings!,
      ...template.captionSettings,
      syncMode: template.captionSettings?.syncMode || syncMode,
    },
    overlaySettings: template.overlaySettings || defaults.overlaySettings!,
    introOutroSettings: template.introOutroSettings || defaults.introOutroSettings!,
    aiEmojis: template.aiEmojis !== undefined ? template.aiEmojis : defaults.aiEmojis!,
    autoTransitions: template.autoTransitions !== undefined ? template.autoTransitions : defaults.autoTransitions!,
    createdAt: template.createdAt || now,
    updatedAt: template.updatedAt || now,
    assets: template.assets || defaults.assets!,
    keywordHighlight: template.keywordHighlight || defaults.keywordHighlight!,
    fontSettings: template.fontSettings || defaults.fontSettings!,
    positioning: template.positioning || defaults.positioning!,
  };
}

/**
 * Validate template structure comprehensively
 */
export function validateTemplateStructure(template: any): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if it's an object
  if (!template || typeof template !== 'object') {
    return {
      isValid: false,
      errors: ['Template must be a valid object'],
      warnings: []
    };
  }

  // Check required top-level properties
  const requiredProps = ['id', 'name', 'aspectRatio', 'autoLayout', 'defaultLines', 'captionSettings'];
  for (const prop of requiredProps) {
    if (!(prop in template)) {
      errors.push(`Missing required property: ${prop}`);
    }
  }

  // Check nested objects
  if (template.captionSettings && typeof template.captionSettings !== 'object') {
    errors.push('captionSettings must be an object');
  }

  if (template.overlaySettings && typeof template.overlaySettings !== 'object') {
    errors.push('overlaySettings must be an object');
  }

  if (template.introOutroSettings && typeof template.introOutroSettings !== 'object') {
    errors.push('introOutroSettings must be an object');
  }

  if (template.assets && typeof template.assets !== 'object') {
    errors.push('assets must be an object');
  }

  // Check data types
  if (template.defaultLines && (typeof template.defaultLines !== 'number' || template.defaultLines < 1)) {
    errors.push('defaultLines must be a positive number');
  }

  if (template.aiEmojis && typeof template.aiEmojis !== 'boolean') {
    warnings.push('aiEmojis should be a boolean');
  }

  if (template.autoTransitions && typeof template.autoTransitions !== 'boolean') {
    warnings.push('autoTransitions should be a boolean');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Clear the template cache (useful for testing or when templates are updated)
 */
export function clearTemplateCache(): void {
  templateCache = null;
}

/**
 * Get template statistics
 */
export async function getTemplateStats(): Promise<{
  total: number;
  wordSync: number;
  lineSync: number;
  animations: Record<AnimationStyle, number>;
}> {
  const templates = await loadOpusTemplates();
  
  const stats = {
    total: templates.length,
    wordSync: 0,
    lineSync: 0,
    animations: {} as Record<AnimationStyle, number>,
  };

  templates.forEach(template => {
    if (template.captionSettings?.syncMode === 'word') {
      stats.wordSync++;
    } else {
      stats.lineSync++;
    }

    const animation = template.captionSettings?.animationStyle;
    if (animation) {
      stats.animations[animation] = (stats.animations[animation] || 0) + 1;
    }
  });

  return stats;
}
