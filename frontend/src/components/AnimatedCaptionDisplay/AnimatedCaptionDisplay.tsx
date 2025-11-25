// src/components/AnimatedCaptionDisplay/AnimatedCaptionDisplay.tsx
import React, { useEffect, useRef } from 'react';
import styles from './AnimatedCaptionDisplay.module.css';

import {
  generateCSSAnimation,
  injectAnimationCSS,
  executeGSAPAnimation,
  DEFAULT_ANIMATION_CONFIG
} from '../../lib/animation-engine';
import {
  mergeHighlightWords,
  processWordTimestamps,
  applyHighlightingForReact
} from '../../lib/keyword-highlighter';
import { OpusTemplate, CaptionSegment } from '../../types';

// Represents a dialogue event from the ASS file
interface AssDialogueEvent {
  Start: string; // e.g., "0:00:01.23"
  End: string;
  Style: string;
  Text: string;
  // ... other fields like Layer, Name, MarginL, MarginR, MarginV, Effect
  MarginV: string;
  Encoding: string;
}

// Represents a generic item in a section's body
interface AssBodyItem {
  type: 'descriptor' | 'dialogue' | 'comment' | 'style' | string;
  key?: string;
  value: any;
}

// Represents a section in the ASS file (e.g., [Script Info], [Events])
interface AssSection {
  section: string;
  body: AssBodyItem[];
}

// The root type for parsed ASS data, now an array of sections
type ParsedAssData = AssSection[];

interface AssStyle {
  Name: string;
  Fontname: string;
  Fontsize: string;
  PrimaryColour: string;
  SecondaryColour: string;
  OutlineColour: string;
  BackColour: string;
  Bold: string; // "0" or "-1"
  Italic: string;
  Underline: string;
  StrikeOut: string;
  ScaleX: string;
  ScaleY: string;
  Spacing: string;
  Angle: string;
  BorderStyle: string; // e.g., "1" (Outline), "3" (Opaque box)
  Outline: string; // Outline thickness
  Shadow: string; // Shadow offset
  Alignment: string; // Numpad alignment (1-9)
  // ... other fields
}

interface AnimatedCaptionDisplayProps {
  parsedAss?: ParsedAssData | null;
  segments: CaptionSegment[];
  currentTime: number;
  opusTemplate?: OpusTemplate;
  enableGSAP?: boolean;
}

// Convert ASS time string (h:mm:ss.cc) to seconds
const assTimeToSeconds = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':') || !timeStr.includes('.')) return 0;
  try {
    const [hms, csStr] = timeStr.split('.');
    const [h, m, s] = hms.split(':').map(Number);
    const cs = parseInt(csStr);
    if (isNaN(h) || isNaN(m) || isNaN(s) || isNaN(cs)) return 0;
    return h * 3600 + m * 60 + s + cs / 100;
  } catch (error) {
    console.error("Error converting ASS time to seconds:", timeStr, error);
    return 0;
  }
};

// Convert ASS &HBBGGRR or &HAABBGGRR to CSS rgba()
const convertAssColorToRGBA = (assColor: string, opacityOverride?: number): string => {
  if (!assColor || !assColor.startsWith('&H')) {
    return 'rgba(255,255,255,1)';
  }
  const hexColor = assColor.substring(2);
  let alpha = 255;
  let blue: number, green: number, red: number;
  if (hexColor.length === 8) {
    const aa = parseInt(hexColor.substring(0, 2), 16);
    alpha = 255 - aa;
    blue = parseInt(hexColor.substring(2, 4), 16);
    green = parseInt(hexColor.substring(4, 6), 16);
    red = parseInt(hexColor.substring(6, 8), 16);
  } else if (hexColor.length === 6) {
    blue = parseInt(hexColor.substring(0, 2), 16);
    green = parseInt(hexColor.substring(2, 4), 16);
    red = parseInt(hexColor.substring(4, 6), 16);
  } else {
    return 'rgba(255,255,255,1)';
  }
  if (opacityOverride !== undefined) {
    alpha = opacityOverride * 255;
  }
  const a = Math.min(Math.max(alpha / 255, 0), 1);
  return `rgba(${red}, ${green}, ${blue}, ${a.toFixed(2)})`;
};

// Find a style definition in the Styles section by name
const getStyleByName = (name: string, stylesSection?: AssSection): AssStyle | undefined => {
  if (!stylesSection) return undefined;
  const styleItem = stylesSection.body.find(
    (item: AssBodyItem) => item.key === 'Style' && (item.value as AssStyle).Name === name
  );
  return styleItem?.value as AssStyle;
};

// Convert ASS style definitions to React CSSProperties
const assStyleToReactCss = (assStyle?: AssStyle): React.CSSProperties => {
  const css: React.CSSProperties = {};
  if (!assStyle) return css;
  css.fontFamily = assStyle.Fontname || 'Arial';
  if (assStyle.Fontsize) css.fontSize = `${assStyle.Fontsize}px`;
  css.color = convertAssColorToRGBA(assStyle.PrimaryColour);

  const outline = parseFloat(assStyle.Outline || '0');
  if (outline > 0) {
    const oc = convertAssColorToRGBA(assStyle.OutlineColour);
    (css as any).WebkitTextStroke = `${outline}px ${oc}`;
    (css as any).textStroke = `${outline}px ${oc}`;
  }
  if (parseInt(assStyle.Bold || '0') !== 0) css.fontWeight = 'bold';
  if (parseInt(assStyle.Italic || '0') !== 0) css.fontStyle = 'italic';
  const decorations = new Set<string>();
  if (parseInt(assStyle.Underline || '0') !== 0) decorations.add('underline');
  if (parseInt(assStyle.StrikeOut || '0') !== 0) decorations.add('line-through');
  if (decorations.size) css.textDecoration = Array.from(decorations).join(' ');

  if (assStyle.BorderStyle === '3') {
    css.backgroundColor = convertAssColorToRGBA(assStyle.BackColour);
    css.padding = '0.1em 0.25em';
  }
  return css;
};

// Parse inline ASS override tags (\b, \i, \c, \r) to segments
const parseAssLineText = (
  lineText: string,
  baseStyleProps: React.CSSProperties,
  baseAssStyleDefinition?: AssStyle,
  allStylesSection?: AssSection
): Array<{ text: string; style: React.CSSProperties }> => {
  const segments: { text: string; style: React.CSSProperties }[] = [];
  let currentIndex = 0;
  let currentStyle = { ...baseStyleProps };
  let currentTextDecoration = new Set<string>(
    (baseStyleProps.textDecoration as string || '').split(' ').filter(Boolean)
  );
  const resetStyle = baseAssStyleDefinition ? assStyleToReactCss(baseAssStyleDefinition) : { ...baseStyleProps };
  const resetDecorations = new Set<string>(
    (resetStyle.textDecoration as string || '').split(' ').filter(Boolean)
  );
  const tagRegex = /{\\([^}]+)}/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(lineText)) !== null) {
    if (match.index > currentIndex) {
      segments.push({ text: lineText.substring(currentIndex, match.index), style: { ...currentStyle } });
    }
    const content = match[1];
    const commands = content.split('\\').filter(s => s);
    for (let cmd of commands) {
      cmd = '\\' + cmd;
      if (cmd.startsWith('\\c') || cmd.startsWith('\\1c')) {
        const col = cmd.replace(/\\1?c/, '');
        currentStyle.color = convertAssColorToRGBA(col.endsWith('&') ? col.slice(0, -1) : col);
      } else if (cmd.startsWith('\\b')) {
        const val = parseInt(cmd.slice(2)) || 0;
        currentStyle.fontWeight = val ? 'bold' : resetStyle.fontWeight;
      } else if (cmd.startsWith('\\i')) {
        const val = parseInt(cmd.slice(2)) || 0;
        currentStyle.fontStyle = val ? 'italic' : resetStyle.fontStyle;
      } else if (cmd.startsWith('\\u')) {
        const val = parseInt(cmd.slice(2)) || 0;
        if (val) currentTextDecoration.add('underline');
        else currentTextDecoration.delete('underline');
      } else if (cmd.startsWith('\\s')) {
        const val = parseInt(cmd.slice(2)) || 0;
        if (val) currentTextDecoration.add('line-through');
        else currentTextDecoration.delete('line-through');
      } else if (cmd.startsWith('\\fs')) {
        const val = parseFloat(cmd.slice(3)) || undefined;
        if (val) currentStyle.fontSize = `${val}px`;
      } else if (cmd.startsWith('\\fn')) {
        currentStyle.fontFamily = cmd.slice(3);
      } else if (cmd.startsWith('\\r')) {
        const nm = cmd.slice(2).trim();
        if (nm && allStylesSection) {
          const named = getStyleByName(nm, allStylesSection);
          currentStyle = named ? assStyleToReactCss(named) : { ...resetStyle };
        } else {
          currentStyle = { ...resetStyle };
        }
        currentTextDecoration = new Set(resetDecorations);
      }
      currentStyle.textDecoration = Array.from(currentTextDecoration).join(' ') || undefined;
    }
    currentIndex = tagRegex.lastIndex;
  }
  if (currentIndex < lineText.length) {
    segments.push({ text: lineText.substring(currentIndex), style: { ...currentStyle } });
  }
  if (!segments.length && lineText === '' && currentIndex > 0) {
    segments.push({ text: '', style: { ...currentStyle } });
  }
  return segments;
};

const AnimatedCaptionDisplay: React.FC<AnimatedCaptionDisplayProps> = ({
  parsedAss,
  segments,
  currentTime,
  opusTemplate,
  enableGSAP = false
}) => {
  // Ensure CSS keyframes for Opus animations are injected once
  useEffect(() => {
    injectAnimationCSS();
  }, []);

  const useGSAP = enableGSAP && typeof window !== 'undefined' && !!(window as any).gsap;

  // Word-by-word synchronization detection
  const isWordSync = Array.isArray(segments) && segments.length > 0 && Array.isArray(segments[0].words);

  // ==== Opus Template Rendering ====
  if (opusTemplate) {
    const {
      syncMode,
      defaultAnimation,
      keywordHighlight,
      fontSettings,
      positioning
    } = opusTemplate;

    // Word sync mode with Opus template
    if (syncMode === 'word' && isWordSync) {
      const active = segments.find(seg => currentTime >= seg.start && currentTime < seg.end);
      if (!active) return null;

      const highlighted = mergeHighlightWords(
        active.text,
        [],
        keywordHighlight.enabled,
        keywordHighlight
      );
      const wordData = processWordTimestamps(active.text, active.words || [], highlighted);
      const visibleWords = wordData.filter(w => currentTime >= w.start);

      // Inner component for each word to handle GSAP if enabled
      const OpusWord: React.FC<{
        w: typeof visibleWords[number];
        idx: number;
        activeStart: number;
      }> = ({ w, idx, activeStart }) => {
        const ref = useRef<HTMLSpanElement>(null);

        useEffect(() => {
          if (useGSAP && ref.current) {
            executeGSAPAnimation(
              ref.current,
              defaultAnimation,
              {
                ...DEFAULT_ANIMATION_CONFIG,
                delay: w.start - activeStart
              }
            );
          }
        }, [w.start, activeStart]);

        const { className: animClass, style: animStyle } = generateCSSAnimation(
          defaultAnimation,
          {
            ...DEFAULT_ANIMATION_CONFIG,
            delay: w.start - activeStart
          }
        );

        const highlightColor = w.highlight?.color;
        const weight = w.highlight ? 'bold' : undefined;
        const shadow = w.highlight ? '0 0 4px rgba(0,0,0,0.5)' : undefined;

        return (
          <span
            ref={ref}
            data-idx={idx}
            className={`${styles.word} ${animClass} ${styles['opus-word-animation']}`}
            style={{
              ...animStyle,
              color: highlightColor,
              fontWeight: weight,
              textShadow: shadow
            }}
          >
            {w.word}
          </span>
        );
      };

      const containerClass = `opus-caption-${positioning.default}`;
      const containerStyle: React.CSSProperties = {
        fontFamily: fontSettings.family,
        fontSize: `${fontSettings.size}px`,
        color: fontSettings.color,
        textShadow: `${fontSettings.shadowX}px ${fontSettings.shadowY}px ${fontSettings.shadowBlur}px ${fontSettings.shadowColor}`
      };

      return (
        <div
          className={`${styles.captionContainer} ${styles.wordContainer} ${containerClass}`}
          style={containerStyle}
        >
          {visibleWords.map((w, idx) => (
            <OpusWord key={idx} w={w} idx={idx} activeStart={active.start || 0} />
          ))}
        </div>
      );
    }

    // Line sync mode with Opus template
    if (syncMode === 'line') {
      const activeLine = segments.find(seg => currentTime >= seg.start && currentTime < seg.end);
      if (!activeLine) return null;

      const highlighted = mergeHighlightWords(
        activeLine.text,
        [],
        keywordHighlight.enabled,
        keywordHighlight
      );
      const rendered = applyHighlightingForReact(activeLine.text, highlighted);

      const containerClass = `opus-caption-${positioning.default}`;
      const containerStyle: React.CSSProperties = {
        fontFamily: fontSettings.family,
        fontSize: `${fontSettings.size}px`,
        color: fontSettings.color,
        textShadow: `${fontSettings.shadowX}px ${fontSettings.shadowY}px ${fontSettings.shadowBlur}px ${fontSettings.shadowColor}`
      };

      const { className: lineAnimClass, style: lineAnimStyle } = generateCSSAnimation(
        defaultAnimation,
        DEFAULT_ANIMATION_CONFIG
      );

      return (
        <div
          className={`${styles.captionContainer} ${lineAnimClass} ${containerClass}`}
          style={{ ...containerStyle, ...lineAnimStyle }}
        >
          {rendered}
        </div>
      );
    }
  }

  // ==== Fallback to Word-by-Word Sync (Whisper) ====
  if (isWordSync) {
    const active = segments.find(seg => currentTime >= seg.start && currentTime < seg.end);
    if (!active) return null;

    const highlighted = mergeHighlightWords(active.text, [], true);
    const wordData = processWordTimestamps(active.text, active.words || [], highlighted);
    const visibleWords = wordData.filter(w => currentTime >= w.start);

    return (
      <div className={`${styles.captionContainer} ${styles.wordContainer}`}>
        {visibleWords.map((w, idx) => {
          const delaySec = w.start - (active.start || 0);
          const { className: animClass, style: animStyle } = generateCSSAnimation(
            'fade',
            { delay: delaySec, duration: 0.4, intensity: 1, easing: 'ease-out' }
          );
          return (
            <span
              key={idx}
              className={`${styles.word} ${animClass} ${styles['opus-word-animation']}`}
              style={{
                ...animStyle,
                color: w.highlight?.color,
                fontWeight: w.highlight ? 'bold' : undefined,
                textShadow: w.highlight ? '0 0 4px rgba(0,0,0,0.5)' : undefined
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    );
  }

  // ==== Fallback to ASS-based line-by-line rendering ====
  const eventsSection = parsedAss?.find(s => s.section === 'Events');
  const dialogues: AssDialogueEvent[] | undefined = eventsSection?.body
    .filter((item: AssBodyItem) => item.key === 'Dialogue')
    .map(item => item.value as AssDialogueEvent);

  if (!dialogues || dialogues.length === 0) {
    return null;
  }
  const activeDialogues = dialogues.filter(d => {
    const start = assTimeToSeconds(d.Start);
    const end = assTimeToSeconds(d.End);
    return currentTime >= start && currentTime < end;
  });
  if (!activeDialogues.length) {
    return null;
  }

  return (
    <div className={styles.captionContainer}>
      {activeDialogues.map((dialogue, dIdx) => {
        const stylesSection = parsedAss?.find(
          s => s.section === 'V4+ Styles' || s.section === 'Styles'
        );
        const styleDef = getStyleByName(dialogue.Style, stylesSection);
        const baseStyle = assStyleToReactCss(styleDef);
        const lines = dialogue.Text.split('\\N').slice(0, 3); // support up to 3 lines

        return (
          <div
            key={dIdx}
            className={`${styles.captionLine} ${styles['opus-line-animation']}`}
            style={baseStyle}
          >
            {lines.map((ln, lIdx) => {
              const segments = parseAssLineText(
                ln,
                baseStyle,
                styleDef,
                stylesSection || undefined
              );
              return (
                <React.Fragment key={lIdx}>
                  {segments.map((seg, sIdx) => (
                    <span key={sIdx} style={seg.style}>
                      {seg.text}
                    </span>
                  ))}
                  {lIdx < lines.length - 1 && <br />}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default AnimatedCaptionDisplay;