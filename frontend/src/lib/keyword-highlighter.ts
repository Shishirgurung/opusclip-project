import React from 'react';
import { KeywordHighlightSettings, WordTimestamp } from '../types';

// Default highlight colors from Opus Clip
export const DEFAULT_HIGHLIGHT_COLORS = {
  primary: '#04f827FF',
  secondary: '#FFFDO3FF'
} as const;

// Common emotional/power words for NLP scoring
const EMOTIONAL_WORDS = new Set([
  'amazing', 'incredible', 'awesome', 'fantastic', 'brilliant', 'outstanding',
  'perfect', 'excellent', 'wonderful', 'spectacular', 'magnificent', 'extraordinary',
  'shocking', 'unbelievable', 'stunning', 'breathtaking', 'mind-blowing', 'jaw-dropping',
  'devastating', 'crushing', 'explosive', 'powerful', 'intense', 'dramatic',
  'revolutionary', 'groundbreaking', 'game-changing', 'life-changing', 'transformative',
  'ultimate', 'supreme', 'legendary', 'epic', 'massive', 'enormous', 'gigantic',
  'critical', 'crucial', 'essential', 'vital', 'important', 'significant',
  'dangerous', 'risky', 'scary', 'terrifying', 'horrifying', 'nightmare',
  'beautiful', 'gorgeous', 'stunning', 'attractive', 'elegant', 'graceful',
  'successful', 'winning', 'victorious', 'triumphant', 'champion', 'leader',
  'secret', 'hidden', 'mysterious', 'unknown', 'exclusive', 'private',
  'instant', 'immediate', 'quick', 'fast', 'rapid', 'speedy',
  'guaranteed', 'proven', 'tested', 'verified', 'confirmed', 'certified',
  'free', 'bonus', 'special', 'limited', 'exclusive', 'premium',
  'money', 'profit', 'wealth', 'rich', 'expensive', 'valuable',
  'simple', 'easy', 'effortless', 'automatic', 'instant', 'quick'
]);

// High-frequency words that often carry emphasis
const HIGH_FREQUENCY_WORDS = new Set([
  'never', 'always', 'everyone', 'everything', 'nothing', 'nobody',
  'absolutely', 'completely', 'totally', 'definitely', 'certainly',
  'impossible', 'possible', 'probably', 'maybe', 'perhaps',
  'finally', 'suddenly', 'immediately', 'instantly', 'quickly',
  'seriously', 'literally', 'actually', 'really', 'truly',
  'obviously', 'clearly', 'apparently', 'supposedly', 'allegedly'
]);

export interface HighlightedWord {
  word: string;
  color: string;
  reason: 'manual' | 'length' | 'caps' | 'punctuation' | 'emotional' | 'frequency';
  confidence: number;
}

export interface HighlightResult {
  highlightedWords: HighlightedWord[];
  processedText: string;
}

/**
 * Calculates NLP score for a word based on emotional content and frequency
 */
function calculateNLPScore(word: string): number {
  const lowerWord = word.toLowerCase();
  let score = 0;

  // Emotional words get high score
  if (EMOTIONAL_WORDS.has(lowerWord)) {
    score += 0.8;
  }

  // High-frequency emphasis words get medium score
  if (HIGH_FREQUENCY_WORDS.has(lowerWord)) {
    score += 0.6;
  }

  // Words with repeated letters (like "sooo", "reallyyy") get bonus
  if (/(.)\1{2,}/.test(word)) {
    score += 0.4;
  }

  // Words with numbers often indicate statistics or important data
  if (/\d/.test(word)) {
    score += 0.3;
  }

  // Longer words tend to be more descriptive/important
  if (word.length > 8) {
    score += 0.2;
  }

  return Math.min(score, 1.0); // Cap at 1.0
}

/**
 * Auto-detects keywords based on Opus Clip criteria
 */
export function autoDetectKeywords(text: string): HighlightedWord[] {
  const words = text.split(/\s+/);
  const highlighted: HighlightedWord[] = [];

  for (const word of words) {
    const cleanWord = word.replace(/[^\w!?]/g, '');
    if (!cleanWord) continue;

    let shouldHighlight = false;
    let reason: HighlightedWord['reason'] = 'length';
    let confidence = 0;

    // Check for ALL CAPS (minimum 3 characters to avoid common words like "I", "A")
    if (cleanWord.length >= 3 && cleanWord === cleanWord.toUpperCase() && /[A-Z]/.test(cleanWord)) {
      shouldHighlight = true;
      reason = 'caps';
      confidence = 0.9;
    }
    // Check for words ending with ! or ?
    else if (/[!?]$/.test(word)) {
      shouldHighlight = true;
      reason = 'punctuation';
      confidence = 0.8;
    }
    // Check for words longer than 6 characters
    else if (cleanWord.length > 6) {
      shouldHighlight = true;
      reason = 'length';
      confidence = 0.5;
    }

    // Apply NLP scoring for emotional/frequency analysis
    const nlpScore = calculateNLPScore(cleanWord);
    if (nlpScore > 0.5) {
      shouldHighlight = true;
      if (nlpScore > confidence) {
        reason = EMOTIONAL_WORDS.has(cleanWord.toLowerCase()) ? 'emotional' : 'frequency';
        confidence = nlpScore;
      }
    }

    if (shouldHighlight) {
      // Use primary color for high confidence, secondary for lower confidence
      const color = confidence > 0.7 ? DEFAULT_HIGHLIGHT_COLORS.primary : DEFAULT_HIGHLIGHT_COLORS.secondary;
      
      highlighted.push({
        word: cleanWord,
        color,
        reason,
        confidence
      });
    }
  }

  return highlighted;
}

/**
 * Merges manual highlight words with auto-detected keywords
 */
export function mergeHighlightWords(
  text: string,
  manualWords: string[] = [],
  autoHighlight: boolean = true,
  settings?: KeywordHighlightSettings
): HighlightedWord[] {
  const highlighted: HighlightedWord[] = [];
  const primaryColor = settings?.primaryColor || DEFAULT_HIGHLIGHT_COLORS.primary;
  const secondaryColor = settings?.secondaryColor || DEFAULT_HIGHLIGHT_COLORS.secondary;

  // Add manual highlight words with highest priority
  for (const word of manualWords) {
    if (word.trim()) {
      highlighted.push({
        word: word.trim(),
        color: primaryColor,
        reason: 'manual',
        confidence: 1.0
      });
    }
  }

  // Add auto-detected words if enabled
  if (autoHighlight) {
    const autoDetected = autoDetectKeywords(text);
    
    // Filter out auto-detected words that are already manually specified
    const manualWordsLower = manualWords.map(w => w.toLowerCase().trim());
    const filteredAuto = autoDetected.filter(
      auto => !manualWordsLower.includes(auto.word.toLowerCase())
    );

    // Apply custom colors if provided
    const adjustedAuto = filteredAuto.map(word => ({
      ...word,
      color: word.confidence > 0.7 ? primaryColor : secondaryColor
    }));

    highlighted.push(...adjustedAuto);
  }

  return highlighted;
}

/**
 * Applies highlighting to text for React rendering
 */
export function applyHighlightingForReact(
  text: string,
  highlightedWords: HighlightedWord[]
): React.ReactElement[] {
  if (!highlightedWords.length) {
    return [React.createElement('span', { key: 0 }, text)];
  }

  // Create a map for quick lookup
  const highlightMap = new Map<string, HighlightedWord>();
  highlightedWords.forEach(hw => {
    highlightMap.set(hw.word.toLowerCase(), hw);
  });

  const words = text.split(/(\s+)/); // Keep whitespace in the split
  const elements: React.ReactElement[] = [];

  words.forEach((word, index) => {
    const cleanWord = word.replace(/[^\w!?]/g, '');
    const highlight = highlightMap.get(cleanWord.toLowerCase());

    if (highlight && cleanWord) {
      elements.push(
        React.createElement(
          'span',
          {
            key: index,
            style: {
              color: highlight.color,
              fontWeight: 'bold',
              textShadow: '0 0 4px rgba(0,0,0,0.5)'
            },
            'data-highlight-reason': highlight.reason,
            'data-confidence': highlight.confidence
          },
          word
        )
      );
    } else {
      elements.push(React.createElement('span', { key: index }, word));
    }
  });

  return elements;
}

/**
 * Applies highlighting to text for ASS subtitle generation
 */
export function applyHighlightingForASS(
  text: string,
  highlightedWords: HighlightedWord[]
): string {
  if (!highlightedWords.length) {
    return text;
  }

  // Create a map for quick lookup
  const highlightMap = new Map<string, HighlightedWord>();
  highlightedWords.forEach(hw => {
    highlightMap.set(hw.word.toLowerCase(), hw);
  });

  const words = text.split(/(\s+)/); // Keep whitespace in the split
  let result = '';

  words.forEach(word => {
    const cleanWord = word.replace(/[^\w!?]/g, '');
    const highlight = highlightMap.get(cleanWord.toLowerCase());

    if (highlight && cleanWord) {
      // Convert hex color to ASS format (remove alpha channel if present)
      const assColor = highlight.color.replace('#', '').replace(/FF$/, '');
      // ASS uses BGR format, so reverse RGB
      const bgr = assColor.length >= 6 
        ? assColor.slice(4, 6) + assColor.slice(2, 4) + assColor.slice(0, 2)
        : assColor;
      
      result += `{\\c&H${bgr}&\\b1}${word}{\\r}`;
    } else {
      result += word;
    }
  });

  return result;
}

/**
 * Processes text with word timestamps for word-by-word highlighting
 */
export function processWordTimestamps(
  text: string,
  timestamps: WordTimestamp[],
  highlightedWords: HighlightedWord[]
): Array<WordTimestamp & { highlight?: HighlightedWord }> {
  const highlightMap = new Map<string, HighlightedWord>();
  highlightedWords.forEach(hw => {
    highlightMap.set(hw.word.toLowerCase(), hw);
  });

  return timestamps.map(timestamp => {
    const cleanWord = timestamp.word.replace(/[^\w!?]/g, '');
    const highlight = highlightMap.get(cleanWord.toLowerCase());
    
    return {
      ...timestamp,
      highlight: highlight || undefined
    };
  });
}

/**
 * Gets all highlighted words from text with their positions
 */
export function getHighlightedWordsWithPositions(
  text: string,
  manualWords: string[] = [],
  autoHighlight: boolean = true,
  settings?: KeywordHighlightSettings
): Array<{ word: string; start: number; end: number; highlight: HighlightedWord }> {
  const highlighted = mergeHighlightWords(text, manualWords, autoHighlight, settings);
  const highlightMap = new Map<string, HighlightedWord>();
  highlighted.forEach(hw => {
    highlightMap.set(hw.word.toLowerCase(), hw);
  });

  const result: Array<{ word: string; start: number; end: number; highlight: HighlightedWord }> = [];
  const words = text.split(/\s+/);
  let currentPos = 0;

  words.forEach(word => {
    const wordStart = text.indexOf(word, currentPos);
    const wordEnd = wordStart + word.length;
    const cleanWord = word.replace(/[^\w!?]/g, '');
    const highlight = highlightMap.get(cleanWord.toLowerCase());

    if (highlight && cleanWord) {
      result.push({
        word,
        start: wordStart,
        end: wordEnd,
        highlight
      });
    }

    currentPos = wordEnd;
  });

  return result;
}

/**
 * Validates highlight settings
 */
export function validateHighlightSettings(settings: KeywordHighlightSettings): boolean {
  if (!settings) return false;
  
  // Check if colors are valid hex colors
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
  
  return (
    typeof settings.enabled === 'boolean' &&
    hexColorRegex.test(settings.primaryColor) &&
    hexColorRegex.test(settings.secondaryColor)
  );
}

/**
 * Creates default highlight settings
 */
export function createDefaultHighlightSettings(): KeywordHighlightSettings {
  return {
    primaryColor: DEFAULT_HIGHLIGHT_COLORS.primary,
    secondaryColor: DEFAULT_HIGHLIGHT_COLORS.secondary,
    enabled: true
  };
}

// Export types and constants for external use
// Note: KeywordHighlightSettings and WordTimestamp are already imported from '../types'
// and don't need to be re-exported here
