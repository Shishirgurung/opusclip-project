import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import styles from './CaptionPreview.module.css';
import 'libjass/libjass.css';

// Opus Clip Libraries
import { validateOpusTemplate, toOpusTemplate } from '@/lib/opus-templates';
import { generateASSAnimationTags } from '@/lib/animation-engine';
import { applyHighlightingForASS, createDefaultHighlightSettings, mergeHighlightWords } from '@/lib/keyword-highlighter';

// Types
import {
    BrandTemplate,
    OpusTemplate,
    AnimationStyle,
    KeywordHighlightSettings,
    FontSettings,
    CaptionPosition
} from '@/types';

// Type guard to check if an object is a BrandTemplate
const isBrandTemplate = (template: any): template is BrandTemplate => {
    return template && typeof template === 'object' && 'captionSettings' in template;
};

interface LibJassComponentProps {
    sampleText?: string;
    opusTemplate?: OpusTemplate | BrandTemplate;
    animationStyle?: AnimationStyle;
    keywordHighlight?: KeywordHighlightSettings;
    syncMode?: 'word' | 'line';
    animationConfig?: any; // Added to fix build error
    onPreviewUpdate?: () => void; // Added to fix build error
}

// Correct, centralized helper to get settings from any template type
const getTemplateSettings = (template: OpusTemplate | BrandTemplate | null | undefined) => {
    const defaults = {
        font: {
            family: 'Montserrat',
            size: 48,
            color: '#FFFFFF',
            shadowColor: '#000000',
            shadowX: 2,
            shadowY: 2,
            shadowBlur: 4,
        } as FontSettings,
        position: 'bottom' as CaptionPosition,
        animationStyle: 'none' as AnimationStyle,
    };

    if (!template) {
        return defaults;
    }

    // Handle BrandTemplate: settings are in `captionSettings`
    if ('captionSettings' in template && template.captionSettings) {
        const brand = template as BrandTemplate;
        return {
            font: { ...defaults.font, ...brand.captionSettings.font },
            position: brand.captionSettings.position || defaults.position,
            animationStyle: brand.captionSettings.animationStyle || defaults.animationStyle,
        };
    }

    // Handle OpusTemplate: settings are top-level or nested
    const opus = template as OpusTemplate;
    return {
        font: { ...defaults.font, ...opus.fontSettings },
        position: opus.positioning?.default || defaults.position,
        // Correctly access animation style from its nested property in OpusTemplate
        animationStyle: opus.defaultAnimation || defaults.animationStyle,
    };
};

const LibJassComponent: React.FC<LibJassComponentProps> = ({
    sampleText = 'Enter sample text to see your captions in action.',
    opusTemplate,
    animationStyle: propAnimationStyle, // Allow overriding animation style via props
    keywordHighlight: propKeywordHighlight,
    syncMode, // This prop is passed but not used in the preview's ASS generation.
    animationConfig,
    onPreviewUpdate,
}) => {
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // 1. Memoize the processed template to avoid recalculations
    const preparedTemplate = useMemo(() => {
        if (!opusTemplate) {
            setError('No template provided.');
            return null;
        }

        try {
            if (isBrandTemplate(opusTemplate)) {
                // Create a new variable that is correctly typed as BrandTemplate.
                const brandTemplate: BrandTemplate = opusTemplate;

                // If it's a BrandTemplate, we must validate it first.
                const validation = validateOpusTemplate(brandTemplate);
                if (!validation.isValid) {
                    setError(validation.errors.join(', '));
                    return null;
                }
                // After validation, convert it to a pure OpusTemplate for rendering.
                setError(null);
                return toOpusTemplate(brandTemplate);
            } else {
                // If it's already a pure OpusTemplate, we assume it's valid and use it directly.
                setError(null);
                return opusTemplate;
            }
        } catch (err) {
            setError('Failed to process template.');
            console.error(err);
            return null;
        }
    }, [opusTemplate]);

    // 2. Centralized settings management from the prepared template
    const settings = useMemo(() => {
        // The `preparedTemplate` is already a validated OpusTemplate, so we can use it directly.
        return getTemplateSettings(preparedTemplate);
    }, [preparedTemplate]);
    const finalAnimationStyle = propAnimationStyle || settings.animationStyle;
    const finalKeywordHighlight = propKeywordHighlight || preparedTemplate?.keywordHighlight || createDefaultHighlightSettings();

    // 3. Construct the ASS script based on final settings
    const constructASS = useCallback(() => {
        const { font, position } = settings;
        const wordsToHighlight = mergeHighlightWords(sampleText, [], true, finalKeywordHighlight);
        const dialogue = applyHighlightingForASS(sampleText, wordsToHighlight);
        const animationTags = generateASSAnimationTags(finalAnimationStyle, { intensity: 1 });

        // Convert hex color to BGR for ASS format
        const bgrColor = font.color ? `${font.color.substring(5, 7)}${font.color.substring(3, 5)}${font.color.substring(1, 3)}` : 'FFFFFF';

        return `
[Script Info]
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font.family},${font.size},&H00${bgrColor},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,${position === 'top' ? 8 : (position === 'middle' ? 5 : 2)},10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,{${animationTags}}${dialogue}
        `;
    }, [sampleText, settings, finalAnimationStyle, finalKeywordHighlight]);

    // 4. Effect to initialize and manage the libjass renderer
    useEffect(() => {
        const initLibjass = async () => {
            if (!previewContainerRef.current || !preparedTemplate) return;

            setIsLoading(true);
            try {
                const { default: JASS } = await import('libjass');
                const assScript = constructASS();

                // libjass automatically handles destroying the old renderer when a new one
                // is created on the same element. The object created by new JASS.ASS()
                // does not have a .destroy() method, which was the cause of the crash.
                const newRenderer = new JASS.ASS(assScript, previewContainerRef.current);
                rendererRef.current = newRenderer;

            } catch (err) {
                console.error('Error initializing libjass:', err);
                setError('Could not render preview.');
            } finally {
                setIsLoading(false);
            }
        };

        initLibjass();

        // Cleanup function to destroy the renderer when the component unmounts.
        return () => {
            if (previewContainerRef.current && (previewContainerRef.current as any).renderer) {
                (previewContainerRef.current as any).renderer.destroy();
            }
            rendererRef.current = null;
        };
    }, [preparedTemplate, constructASS]);

    return (
        <div className={styles.previewContainer}>
            {error && <div className={styles.errorOverlay}>{error}</div>}
            {isLoading && <div className={styles.loadingOverlay}>Loading Preview...</div>}
            <div ref={previewContainerRef} className={styles.libjassRoot} />
        </div>
    );
};

// Use next/dynamic to ensure this component only renders on the client-side.
const CaptionPreview = dynamic(() => Promise.resolve(LibJassComponent), {
    ssr: false,
    loading: () => (
        <div className={styles.previewWrapper}>
            <div className={styles.loadingOverlay}>
                <div className={styles.loadingSpinner} />
                <p>Loading preview...</p>
            </div>
        </div>
    )
});

export default CaptionPreview;
