/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Contrast, AlertCircle } from 'lucide-react';
import { getPage, MushafPage, MushafWord, WordLocation, isWordInRange, QURAN_DATA_INFO, VERBATIM_BISMILLAH } from '../data/quranData';
import { MistakeMark, MistakeType } from '../types/hifz';
import { OpeningPageFrame, OrnamentalSurahCartouche } from './OpeningMushafDecor';

interface MushafViewerProps {
  pageNumber: number;
  onPageChange: (newPage: number) => void;
  // Range highlighting
  highlightRange?: {
    start: WordLocation;
    end: WordLocation;
  };
  highlightRanges?: {
    start: WordLocation;
    end: WordLocation;
  }[];
  // Marking props (for Ustaad marking screen)
  interactiveMode?: 'marking' | 'assigning' | 'view';
  activeMarkTool?: MistakeType;
  currentMarks?: MistakeMark[];
  onWordClick?: (word: MushafWord) => void;
  // Assignment selection state
  selectionStart?: WordLocation | null;
  selectionEnd?: WordLocation | null;
  // Student Hide & Reveal state
  hideAndRevealActive?: boolean;
  targetPulseWordId?: string | null;
  language?: 'en' | 'ur';
  // Display controls (optional controlled or internal)
  mushafLayout?: 'hafizi' | 'madinah';
  onLayoutChange?: (layout: 'hafizi' | 'madinah') => void;
  mushafScript?: 'indopak' | 'uthmani';
  onScriptChange?: (script: 'indopak' | 'uthmani') => void;
  highContrast?: boolean;
  onToggleHighContrast?: () => void;
  // When opening a specific Para (e.g. Para 4 starting mid-Page 62), disambiguate shared-page Para header
  activeParaNumber?: number | null;
  // Whole-para Manzil shows a subtle "Manzil: Para N" badge in the page header instead of highlighting text
  manzilHeaderPara?: number | null;
}

function resolvePageJuzList(page: MushafPage, activeParaNumber?: number | null): number[] {
  const list = page.juzNumbers && page.juzNumbers.length > 0 ? page.juzNumbers : [page.juzNumber];
  if (activeParaNumber && list.includes(activeParaNumber)) {
    return [activeParaNumber];
  }
  return list;
}

function toArabicNumerals(num: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map(d => arabicDigits[parseInt(d, 10)] ?? d)
    .join('');
}

// Quranic Waqf / Pause symbols (Unicode Quranic annotations including Waqf Mutlaq U+0615 + IndoPak font PUA waqf/ruku glyphs)
// Kept verbatim in original string; wrapped inline in dark red without modifying or stripping text.
const WAQF_CHAR_REGEX = /([\u0615\u06D6-\u06DC\u06E9\uE01A-\uE022]+)/g;
const WAQF_SINGLE_TEST = /^[\u0615\u06D6-\u06DC\u06E9\uE01A-\uE022]+$/;

function renderVerbatimWithWaqfHighlight(rawText: string) {
  if (!rawText) return null;
  const parts = rawText.split(WAQF_CHAR_REGEX);
  if (parts.length === 1) {
    return rawText;
  }
  return parts.map((segment, idx) => {
    if (!segment) return null;
    if (WAQF_SINGLE_TEST.test(segment)) {
      return (
        <span
          key={idx}
          className="inline text-[#8B0000]"
          style={{ textShadow: 'none' }}
          title="Waqf / Pause Sign"
        >
          {segment}
        </span>
      );
    }
    return <React.Fragment key={idx}>{segment}</React.Fragment>;
  });
}

function getQuarterBadgeLabel(rubQuarter: number, juzNumber: number): { ar: string; en: string } | null {
  switch (rubQuarter) {
    case 1:
      return {
        ar: `بداية الجزء ${toArabicNumerals(juzNumber)}`,
        en: `Para ${juzNumber} Start`,
      };
    case 3:
      return { ar: 'ربع', en: 'Quarter (ربع)' };
    case 5:
      return { ar: 'نصف', en: 'Half (نصف)' };
    case 7:
      return { ar: 'ثلاثة أرباع', en: 'Three Quarters (ثلاثة أرباع)' };
    default:
      return null;
  }
}

const REF_FONT_SIZE = 24;
const REF_NORMAL_GAP = REF_FONT_SIZE * 0.26;
const FLIP_DURATION_MS = 580;
const FADE_DURATION_MS = 220;

interface AyahEndMarkerProps {
  ayahNumber: number;
  highContrast: boolean;
}

const AyahEndMarker: React.FC<AyahEndMarkerProps> = ({ ayahNumber, highContrast }) => {
  const digits = toArabicNumerals(ayahNumber);
  const digitCount = digits.length;
  const sizeClasses =
    digitCount >= 3
      ? 'min-w-[1.22em] h-[0.94em] px-[0.18em]'
      : digitCount === 2
      ? 'min-w-[0.98em] h-[0.94em] px-[0.14em]'
      : 'w-[0.94em] h-[0.94em]';
  const digitTextClass =
    digitCount >= 3
      ? 'text-[0.44em] leading-none'
      : digitCount === 2
      ? 'text-[0.49em] leading-none'
      : 'text-[0.55em] leading-none';

  return (
    <span
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      aria-label={`End of Ayah ${ayahNumber}`}
      className={`relative inline-flex items-center justify-center select-none ms-[0.16em] me-[0.04em] rounded-full border leading-none cursor-default ${sizeClasses} ${
        highContrast
          ? 'border-[#8C6112] bg-[#FFFBEB] text-black'
          : 'border-[#A87620] bg-[#FAF0D2]/50 text-[#111111]'
      }`}
      style={{
        fontFamily: "'Amiri', 'Noto Nastaliq Urdu', system-ui, sans-serif",
        fontWeight: 700,
        lineHeight: 1,
        verticalAlign: '-0.08em',
        textShadow: 'none',
      }}
      title={`End of Ayah ${ayahNumber}`}
    >
      <span className={digitTextClass}>{digits}</span>
    </span>
  );
};

interface MushafPageSheetProps {
  page: MushafPage;
  script: 'indopak' | 'uthmani';
  highContrast: boolean;
  language: 'en' | 'ur';
  interactiveMode: 'marking' | 'assigning' | 'view';
  currentMarks: MistakeMark[];
  onWordClick?: (word: MushafWord) => void;
  highlightRange?: { start: WordLocation; end: WordLocation };
  highlightRanges?: { start: WordLocation; end: WordLocation }[];
  selectionStart?: WordLocation | null;
  selectionEnd?: WordLocation | null;
  hideAndRevealActive: boolean;
  targetPulseWordId: string | null;
  revealedLines: Set<number>;
  revealedWords: Set<string>;
  onToggleRevealLine: (lineNum: number) => void;
  onToggleRevealWord: (wordId: string) => void;
  isOverlay?: boolean;
  activeParaNumber?: number | null;
  manzilHeaderPara?: number | null;
}

const MushafPageSheet: React.FC<MushafPageSheetProps> = ({
  page,
  script,
  highContrast,
  language,
  interactiveMode,
  currentMarks,
  onWordClick,
  highlightRange,
  highlightRanges,
  selectionStart,
  selectionEnd,
  hideAndRevealActive,
  targetPulseWordId,
  revealedLines,
  revealedWords,
  onToggleRevealLine,
  onToggleRevealWord,
  isOverlay = false,
  activeParaNumber = null,
  manzilHeaderPara = null,
}) => {
  const isOpeningSpread = page.pageNumber === 1 || page.pageNumber === 2;

  const textColWidthRef = useRef<HTMLDivElement | null>(null);
  const measureListRef = useRef<HTMLDivElement | null>(null);
  const [fittedFontSize, setFittedFontSize] = useState<number>(isOpeningSpread ? 28 : 18);
  const [lineFontSizes, setLineFontSizes] = useState<Map<number, number>>(new Map());
  const [bismillahFontSize, setBismillahFontSize] = useState<number>(isOpeningSpread ? 27 : 18);
  const [unjustifiedLines, setUnjustifiedLines] = useState<Set<number>>(new Set());

  const recomputeFontSize = useCallback(() => {
    const colEl = textColWidthRef.current;
    const measureEl = measureListRef.current;
    if (!colEl || !measureEl) return;

    const availableWidth = colEl.clientWidth;
    if (availableWidth <= 0) return;

    const lineNodes = measureEl.querySelectorAll<HTMLElement>('[data-measure-line]');
    let maxMeasuredWidth = 0;
    const measuredNormalLines = new Map<number, { width: number; wordCount: number }>();
    let bismillahMeasuredWidth = 0;

    lineNodes.forEach(node => {
      const w = node.getBoundingClientRect().width;
      const lineNum = parseInt(node.dataset.measureLine || '0', 10);
      const wordCount = parseInt(node.dataset.wordCount || '0', 10);
      const isBismillah = node.dataset.isBismillah === '1';

      if (isBismillah) {
        if (w > bismillahMeasuredWidth) bismillahMeasuredWidth = w;
      } else if (lineNum > 0 && wordCount > 0) {
        measuredNormalLines.set(lineNum, { width: w, wordCount });
      }
      if (w > maxMeasuredWidth) maxMeasuredWidth = w;
    });

    if (isOpeningSpread) {
      // First two pages: larger font size (~1.43x normal) and keep short lines centered without huge gaps
      const maxDesktopOrMobile = availableWidth >= 560 ? 39 : 30;
      const minReadable = 11;

      let clamped = maxDesktopOrMobile;
      if (maxMeasuredWidth > 0) {
        const exactScale = (availableWidth * 0.94) / maxMeasuredWidth;
        const calculated = Math.floor(REF_FONT_SIZE * exactScale * 10) / 10;
        clamped = Math.max(minReadable, Math.min(maxDesktopOrMobile, calculated));
      }
      setFittedFontSize(clamped);
      setLineFontSizes(new Map());
      setBismillahFontSize(Math.min(39, Math.max(16, Math.round(clamped * 0.96 * 10) / 10)));

      const nextUnjustified = new Set<number>();
      measuredNormalLines.forEach(({ width, wordCount }, lineNum) => {
        if (wordCount <= 1) {
          nextUnjustified.add(lineNum);
          return;
        }
        const sumOfWordWidthsAtFitted =
          Math.max(0, width - (wordCount - 1) * REF_NORMAL_GAP) * (clamped / REF_FONT_SIZE);
        const resultingGap = (availableWidth - sumOfWordWidthsAtFitted) / (wordCount - 1);
        if (resultingGap > clamped * 1.5) {
          nextUnjustified.add(lineNum);
        }
      });
      setUnjustifiedLines(nextUnjustified);
      return;
    }

    // Normal pages (3..604): per-line font scaling within [-12%, +15%] of base size, all normal lines flush both edges
    const maxPageCap = availableWidth >= 560 ? 27 : 21;
    const minReadable = 9.5;

    const idealFonts: number[] = [];
    const idealFontByLine = new Map<number, number>();
    measuredNormalLines.forEach(({ width }, lineNum) => {
      if (width > 0) {
        const ideal = (REF_FONT_SIZE * (availableWidth * 0.96)) / width;
        idealFonts.push(ideal);
        idealFontByLine.set(lineNum, ideal);
      }
    });

    let baseFontSize = maxPageCap;
    if (idealFonts.length > 0) {
      const sorted = [...idealFonts].sort((a, b) => a - b);
      const minIdeal = sorted[0];
      const medianIdeal = sorted[Math.floor(sorted.length / 2)];
      // Ensure even the widest line can fit within -12% of baseFontSize without wrapping
      const maxBaseForWidest = minIdeal / 0.88;
      baseFontSize = Math.floor(
        Math.max(minReadable, Math.min(maxPageCap, medianIdeal, maxBaseForWidest)) * 10
      ) / 10;
    }
    setFittedFontSize(baseFontSize);

    const nextLineFontSizes = new Map<number, number>();
    idealFontByLine.forEach((ideal, lineNum) => {
      const scaled = Math.min(baseFontSize * 1.15, Math.max(baseFontSize * 0.88, ideal));
      // Never exceed ideal width so line never wraps or clips
      const safe = Math.floor(Math.min(scaled, ideal) * 10) / 10;
      nextLineFontSizes.set(lineNum, Math.max(minReadable * 0.88, safe));
    });
    setLineFontSizes(nextLineFontSizes);

    if (bismillahMeasuredWidth > 0) {
      const idealBis = (REF_FONT_SIZE * (availableWidth * 0.95)) / bismillahMeasuredWidth;
      setBismillahFontSize(Math.floor(Math.min(25, baseFontSize, idealBis) * 10) / 10);
    } else {
      setBismillahFontSize(Math.min(25, Math.max(14, baseFontSize)));
    }

    // Never apply the short-line skip rule to normal lines on pages 3..604
    setUnjustifiedLines(new Set());
  }, [isOpeningSpread]);

  useLayoutEffect(() => {
    recomputeFontSize();
  }, [page.pageNumber, script, hideAndRevealActive, recomputeFontSize]);

  useEffect(() => {
    const colEl = textColWidthRef.current;
    if (!colEl) return;

    let rafId = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        recomputeFontSize();
      });
    });
    observer.observe(colEl);

    let cancelled = false;
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        if (!cancelled) recomputeFontSize();
      });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [recomputeFontSize]);

  const handleWordTap = (word: MushafWord) => {
    if (isOverlay) return;
    if (hideAndRevealActive) {
      onToggleRevealWord(word.id);
      return;
    }
    if (onWordClick) {
      onWordClick(word);
    }
  };

  const getWordMark = (wordId: string): MistakeMark | undefined => {
    return currentMarks.find(m => m.wordId === wordId);
  };

  const isSelectedOrInRange = (word: MushafWord) => {
    if (selectionStart && selectionEnd) {
      return isWordInRange(word, selectionStart, selectionEnd);
    }
    if (highlightRanges && highlightRanges.length > 0) {
      return highlightRanges.some(r => isWordInRange(word, r.start, r.end));
    }
    if (highlightRange) {
      return isWordInRange(word, highlightRange.start, highlightRange.end);
    }
    return false;
  };

  // Collect Juz start & Para quarter marks across the page for Page Header Band
  const pageHeaderQuarterBadges: { key: string; lineNumber: number; ar: string; en: string }[] = [];
  const seenHeaderKeys = new Set<string>();
  page.lines.forEach(ln => {
    ln.words.forEach(w => {
      if (w.rubQuarter) {
        const lbl = getQuarterBadgeLabel(w.rubQuarter, w.juzNumber);
        if (lbl) {
          const key = `${ln.lineNumber}_${w.rubQuarter}_${w.juzNumber}`;
          if (!seenHeaderKeys.has(key)) {
            seenHeaderKeys.add(key);
            pageHeaderQuarterBadges.push({
              key,
              lineNumber: ln.lineNumber,
              ar: lbl.ar,
              en: lbl.en,
            });
          }
        }
      }
    });
  });

  const hasQuarterMarksOnPage = page.lines.some(ln =>
    ln.words.some(w => w.rubQuarter === 3 || w.rubQuarter === 5 || w.rubQuarter === 7)
  );

  const normalWordGapPx = Math.round(fittedFontSize * 0.28 * 10) / 10;
  // Steady 15-row grid height on normal pages (3..604)
  const steadyRowHeightPx = Math.max(38, Math.round(fittedFontSize * 2.12));

  const innerPageContent = (
    <>
      {/* Offscreen line-width measurer (matches active script font, word padding & Amiri gold Ayah markers at 24px reference) */}
      <div
        ref={measureListRef}
        aria-hidden="true"
        dir="rtl"
        className={`fixed top-0 left-0 pointer-events-none opacity-0 whitespace-nowrap -z-50 ${
          script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'
        }`}
        style={{ fontSize: `${REF_FONT_SIZE}px`, visibility: 'hidden' }}
      >
        {page.lines.map(ln => {
          if (ln.isHeaderLine) return null;
          if (ln.isBismillahLine) {
            return (
              <div
                key={`measure_${page.pageNumber}_${ln.lineNumber}`}
                data-measure-line={ln.lineNumber}
                data-word-count={0}
                data-is-bismillah="1"
                className="inline-flex items-baseline whitespace-nowrap"
              >
                {VERBATIM_BISMILLAH[script]}
              </div>
            );
          }
          if (ln.words.length === 0) return null;
          return (
            <div
              key={`measure_${page.pageNumber}_${ln.lineNumber}`}
              data-measure-line={ln.lineNumber}
              data-word-count={ln.words.length}
              className="inline-flex items-baseline whitespace-nowrap"
              style={{ gap: `${isOpeningSpread ? REF_NORMAL_GAP : REF_FONT_SIZE * 0.2}px` }}
            >
              {ln.words.map(w => {
                const txt = script === 'indopak' ? w.text : w.textUthmani;
                const digits = toArabicNumerals(w.ayahNumber);
                const digitCount = digits.length;
                const sizeClasses =
                  digitCount >= 3
                    ? 'min-w-[1.22em] h-[0.94em] px-[0.18em]'
                    : digitCount === 2
                    ? 'min-w-[0.98em] h-[0.94em] px-[0.14em]'
                    : 'w-[0.94em] h-[0.94em]';
                const digitTextClass =
                  digitCount >= 3
                    ? 'text-[0.44em] leading-none'
                    : digitCount === 2
                    ? 'text-[0.49em] leading-none'
                    : 'text-[0.55em] leading-none';
                return (
                  <span key={w.id} className="inline-block whitespace-nowrap">
                    <span className="inline-block px-[1px] whitespace-nowrap align-baseline">{txt}</span>
                    {w.isAyahEnd && (
                      <span
                        className={`inline-flex items-center justify-center ms-[0.16em] me-[0.04em] rounded-full border leading-none ${sizeClasses}`}
                        style={{
                          fontFamily: "'Amiri', 'Noto Nastaliq Urdu', system-ui, sans-serif",
                          fontWeight: 700,
                          lineHeight: 1,
                          verticalAlign: '-0.08em',
                        }}
                      >
                        <span className={digitTextClass}>{digits}</span>
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Page Header Margin Band */}
      <div
        className={`border-b-2 pb-1.5 mb-2 space-y-1 text-xs md:text-sm ${
          highContrast
            ? 'border-[#0E3B2C] text-black'
            : isOpeningSpread
            ? 'border-[#164A3B]/45 text-[#143429]'
            : 'border-[#B88A36]/60 text-[#143429]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold flex items-center gap-1">
            <span>الجزء</span>
            <span>{resolvePageJuzList(page, activeParaNumber).map(toArabicNumerals).join(' / ')}</span>
          </div>
          <div
            className={`font-semibold text-sm md:text-base flex flex-wrap items-center justify-center gap-2 ${
              highContrast ? 'text-black' : 'text-[#111111]'
            }`}
          >
            <span>{page.surahArabicName || page.surahName}</span>
            {manzilHeaderPara != null && (
              <span
                dir={language === 'ur' ? 'rtl' : 'ltr'}
                className={`px-2 py-0.5 rounded border text-[10px] sm:text-[11px] font-sans font-bold whitespace-nowrap ${
                  highContrast
                    ? 'bg-[#0E3B2C] text-white border-[#0E3B2C]'
                    : 'bg-[#E8F0EC] text-[#143429] border-[#2E6A54]/60'
                }`}
              >
                {language === 'ur'
                  ? `منزل: پارہ ${manzilHeaderPara}`
                  : `Manzil: Para ${manzilHeaderPara}`}
              </span>
            )}
          </div>
          <div className="font-semibold flex items-center gap-1">
            <span>صفحة</span>
            <span>{toArabicNumerals(page.pageNumber)}</span>
          </div>
        </div>

        {pageHeaderQuarterBadges.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
            {pageHeaderQuarterBadges.map(badge => (
              <span
                key={badge.key}
                className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] border whitespace-nowrap ${
                  highContrast
                    ? 'bg-[#122C4F] text-white border-[#0E3B2C]'
                    : 'bg-[#F3E8CB] text-[#111111] border-[#B88A36]'
                }`}
                title={`${badge.en} (Line ${badge.lineNumber}) — Needs Qari check against printed copy`}
              >
                {badge.ar} · س{toArabicNumerals(badge.lineNumber)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Width Calibration Reference Row (matches exact margin structure of all lines) */}
      <div className="flex items-center h-0 overflow-hidden" aria-hidden="true">
        <div className="w-5 sm:w-6 shrink-0" />
        {hideAndRevealActive && <div className="w-6 shrink-0" />}
        <div ref={textColWidthRef} className="flex-1 min-w-0" />
        <div className="w-5 sm:w-6 shrink-0" />
      </div>

      {/* Mushaf Lines Canvas — 8 vertically centered lines on Pages 1 & 2, steady 15-row grid on Pages 3..604 */}
      <div
        className={
          isOpeningSpread
            ? 'flex-1 flex flex-col justify-center py-2 sm:py-4'
            : 'flex-1 flex flex-col justify-center'
        }
      >
        <div
          className={
            isOpeningSpread
              ? 'flex flex-col gap-2.5 sm:gap-4 divide-y divide-[#C5A059]/30'
              : 'flex flex-col divide-y divide-[#C5A059]/30'
          }
        >
          {page.lines.map(line => {
            const isLineRevealed = revealedLines.has(line.lineNumber);

            const rukuEndsInLine = line.words
              .filter(w => typeof w.rukuEndNumber === 'number')
              .map(w => w.rukuEndNumber!);

            const quarterMarksInLine = line.words
              .filter(w => w.rubQuarter === 1 || w.rubQuarter === 3 || w.rubQuarter === 5 || w.rubQuarter === 7)
              .map(w => getQuarterBadgeLabel(w.rubQuarter!, w.juzNumber))
              .filter((lbl): lbl is { ar: string; en: string } => Boolean(lbl));

            const lineMarginBadge = (
              <span
                className={`w-5 sm:w-6 shrink-0 text-[9px] sm:text-[10px] font-mono text-center tabular-nums select-none leading-none ${
                  highContrast ? 'text-[#171717]' : 'text-[#4A3D31]'
                }`}
                title={`Line ${line.lineNumber}`}
              >
                {line.lineNumber}
              </span>
            );

            const leftMarginMarks = (
              <div className="w-5 sm:w-6 shrink-0 flex items-center justify-center gap-0.5 select-none">
                {rukuEndsInLine.length > 0 && (
                  <span
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-[1.5px] flex items-center justify-center text-[10px] sm:text-xs font-bold font-sans leading-none ${
                      highContrast
                        ? 'border-[#8B0000] bg-white text-[#8B0000]'
                        : 'border-[#8B0000] bg-[#FDF2F2] text-[#8B0000]'
                    }`}
                    title={`Ruku #${rukuEndsInLine.join(', ')} Ends on Line ${line.lineNumber}`}
                  >
                    ع
                  </span>
                )}
                {quarterMarksInLine.length > 0 && (
                  <span
                    className={`text-[11px] sm:text-xs font-bold leading-none ${
                      highContrast ? 'text-[#0E3B2C]' : 'text-[#164A3B]'
                    }`}
                    title={`${quarterMarksInLine[0].en} (Line ${line.lineNumber})`}
                  >
                    ۞
                  </span>
                )}
              </div>
            );

            const rowGridStyle = !isOpeningSpread
              ? { height: `${steadyRowHeightPx}px` }
              : undefined;

            // 1. Surah Header Line — ornamental cartouche on Pages 1 & 2, clean green/gold/blue banner elsewhere
            if (line.isHeaderLine) {
              return (
                <div
                  key={`p${page.pageNumber}_l${line.lineNumber}`}
                  style={rowGridStyle}
                  className={`flex items-center ${
                    isOpeningSpread ? 'min-h-[46px] sm:min-h-[58px] mb-1 sm:mb-2 py-0.5' : ''
                  }`}
                >
                  {lineMarginBadge}
                  {hideAndRevealActive && <div className="w-6 shrink-0" />}
                  {isOpeningSpread ? (
                    <OrnamentalSurahCartouche
                      surahArabicName={line.headerSurahArabicName || line.headerSurahName || ''}
                      surahMeta={line.headerSurahMeta}
                      fontClass={script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'}
                      fontSizePx={fittedFontSize}
                      highContrast={highContrast}
                    />
                  ) : (
                    <div
                      className={`flex-1 min-w-0 py-0.5 px-2 rounded border text-center whitespace-nowrap overflow-hidden flex items-center justify-center gap-2 ${
                        highContrast
                          ? 'border-[#0E3B2C] bg-[#F3F7F5] text-black'
                          : 'border-[#164A3B]/80 bg-gradient-to-r from-[#E6EFEA] via-[#FBF3DE] to-[#E6EFEA] text-[#111111]'
                      }`}
                    >
                      <span className={highContrast ? 'text-[#9E6F1B] text-xs' : 'text-[#B88A36] text-xs'} aria-hidden="true">
                        ۞
                      </span>
                      <span
                        className={`whitespace-nowrap ${
                          script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'
                        }`}
                        style={{ fontSize: `${Math.min(22, Math.max(13, fittedFontSize * 1.02))}px`, lineHeight: 1.35 }}
                      >
                        {line.headerSurahArabicName || line.headerSurahName}
                      </span>
                      {line.headerSurahMeta && (
                        <span
                          className={`text-[10px] hidden sm:inline whitespace-nowrap ${
                            highContrast ? 'text-[#122C4F]' : 'text-[#16365D]'
                          }`}
                        >
                          ({line.headerSurahMeta})
                        </span>
                      )}
                      <span className={highContrast ? 'text-[#9E6F1B] text-xs' : 'text-[#B88A36] text-xs'} aria-hidden="true">
                        ۞
                      </span>
                    </div>
                  )}
                  {leftMarginMarks}
                </div>
              );
            }

            // 2. Bismillah Line — strictly 1 row with verbatim source Bismillah
            if (line.isBismillahLine) {
              return (
                <div
                  key={`p${page.pageNumber}_l${line.lineNumber}`}
                  style={rowGridStyle}
                  className={`flex items-center ${
                    isOpeningSpread ? 'min-h-[38px] sm:min-h-[50px] pb-1.5 sm:pb-2 py-0.5' : ''
                  }`}
                >
                  {lineMarginBadge}
                  {hideAndRevealActive && <div className="w-6 shrink-0" />}
                  <div
                    className={`flex-1 min-w-0 text-center whitespace-nowrap overflow-x-clip overflow-y-visible select-none ${
                      highContrast ? 'quran-ink-hc' : 'quran-ink'
                    } ${script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'}`}
                    style={{
                      fontSize: `${bismillahFontSize}px`,
                      lineHeight: 1.65,
                    }}
                  >
                    {VERBATIM_BISMILLAH[script]}
                  </div>
                  {leftMarginMarks}
                </div>
              );
            }

            // 3. Normal Quranic Text Line
            // - Pages 1 & 2: short lines stay centered with normal spacing
            // - Pages 3..604: every normal line scales within [-12%, +15%] and justifies flush both edges
            const isUnjustified =
              line.words.length <= 1 || (isOpeningSpread && unjustifiedLines.has(line.lineNumber));
            const lineAlignClass = isUnjustified
              ? isOpeningSpread
                ? 'justify-center'
                : 'justify-start'
              : 'justify-between';
            const lineFontSize = isOpeningSpread
              ? fittedFontSize
              : lineFontSizes.get(line.lineNumber) ?? fittedFontSize;

            return (
              <div
                key={`p${page.pageNumber}_l${line.lineNumber}`}
                style={rowGridStyle}
                className={`flex items-center transition-colors ${
                  isOpeningSpread ? 'min-h-[38px] sm:min-h-[50px] py-0.5' : ''
                } ${highContrast ? 'hover:bg-neutral-100/70' : 'hover:bg-[#F5EBD6]/45'}`}
              >
                {/* Right-Side Margin: Line # */}
                {lineMarginBadge}

                {/* Hide & Reveal Toggle icon per line */}
                {hideAndRevealActive && (
                  <button
                    type="button"
                    onClick={() => onToggleRevealLine(line.lineNumber)}
                    className="w-6 shrink-0 flex items-center justify-center p-0.5 text-[#8F6E2B] hover:text-[#111111] rounded transition-colors cursor-pointer"
                    title={isLineRevealed ? 'Hide line' : 'Reveal line'}
                  >
                    {isLineRevealed ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-[#B45309]" />
                    )}
                  </button>
                )}

                {/* Single-row non-wrapping Quranic Arabic line (deep ink black, no faux bold) */}
                <div
                  className={`flex-1 min-w-0 flex flex-nowrap items-baseline whitespace-nowrap overflow-x-clip overflow-y-visible ${lineAlignClass} ${
                    highContrast ? 'quran-ink-hc' : 'quran-ink'
                  } ${script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'}`}
                  style={{
                    fontSize: `${lineFontSize}px`,
                    lineHeight: isOpeningSpread ? 1.78 : 1.75,
                    gap: isUnjustified ? `${normalWordGapPx}px` : undefined,
                  }}
                >
                  {line.words.map(word => {
                    const mark = getWordMark(word.id);
                    const inRange = isSelectedOrInRange(word);
                    const isStartWord = selectionStart?.wordId === word.id;
                    const isEndWord = selectionEnd?.wordId === word.id;
                    const isPulsing = targetPulseWordId === word.id;
                    const isWordRevealed = revealedWords.has(word.id);
                    const isWordHidden = hideAndRevealActive && !isLineRevealed && !isWordRevealed;

                    const displayWordText = script === 'indopak' ? word.text : word.textUthmani;

                    let wordAnnotationClasses = '';
                    let markTag = null;

                    if (mark?.type === 'ghalti') {
                      wordAnnotationClasses =
                        'bg-rose-100 ring-1 ring-[#B91C1C] text-black px-0.5 rounded-xs';
                      markTag = (
                        <span
                          className="text-[0.55em] font-sans font-bold bg-[#B91C1C] text-white rounded-full px-1 mx-0.5 align-super leading-none"
                          style={{ textShadow: 'none' }}
                        >
                          {language === 'ur' ? 'غ' : 'G'}
                        </span>
                      );
                    } else if (mark?.type === 'atkan') {
                      wordAnnotationClasses =
                        'bg-amber-100 ring-1 ring-[#D97706] text-black px-0.5 rounded-xs';
                      markTag = (
                        <span
                          className="text-[0.55em] font-sans font-bold bg-[#D97706] text-white rounded-full px-1 mx-0.5 align-super leading-none"
                          style={{ textShadow: 'none' }}
                        >
                          {language === 'ur' ? 'ا' : 'A'}
                        </span>
                      );
                    } else if (interactiveMode === 'assigning' && (isStartWord || isEndWord)) {
                      wordAnnotationClasses =
                        'bg-[#FEF3C7] text-[#111111] shadow-[inset_0_-2px_0_0_#B45309]';
                    } else if (inRange) {
                      wordAnnotationClasses = highContrast
                        ? 'bg-[#E6F4EC] text-black shadow-[inset_0_-1.5px_0_0_#0E3B2C]'
                        : 'bg-[#E3F1E8] text-[#111111] shadow-[inset_0_-1.5px_0_0_#164A3B]';
                    }

                    const pulseClass = isPulsing
                      ? 'ring-2 ring-[#B91C1C] bg-rose-100 text-black rounded-xs'
                      : '';
                    const hiddenClass = isWordHidden
                      ? 'blur-xs text-transparent select-none bg-[#E6D9BE]/70'
                      : '';

                    return (
                      <span key={word.id} className="inline-block whitespace-nowrap">
                        <span
                          onClick={() => handleWordTap(word)}
                          className={`inline-block whitespace-nowrap align-baseline cursor-pointer px-[1px] transition-colors duration-100 ${
                            interactiveMode === 'marking'
                              ? highContrast
                                ? 'hover:bg-neutral-200'
                                : 'hover:bg-[#EFE4CC]'
                              : ''
                          } ${wordAnnotationClasses} ${pulseClass} ${hiddenClass}`}
                          title={`${displayWordText} (P${page.pageNumber}:L${line.lineNumber}:W${word.wordIndex} · Ayah ${word.ayahNumber})`}
                        >
                          <span>{renderVerbatimWithWaqfHighlight(displayWordText)}</span>
                          {markTag}
                        </span>
                        {word.isAyahEnd && (
                          <AyahEndMarker
                            ayahNumber={word.ayahNumber}
                            highContrast={highContrast}
                          />
                        )}
                      </span>
                    );
                  })}
                </div>

                {/* Left-Side Margin: Ruku End Sign (ع) & Quarter Mark (۞) */}
                {leftMarginMarks}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Margin */}
      <div
        className={`border-t-2 pt-2 mt-2 flex flex-wrap items-center justify-between gap-2 text-xs ${
          highContrast
            ? 'border-[#0E3B2C] text-black'
            : isOpeningSpread
            ? 'border-[#164A3B]/45 text-[#143429]'
            : 'border-[#B88A36]/60 text-[#143429]'
        }`}
      >
        <div className="font-semibold">
          الجزء {resolvePageJuzList(page, activeParaNumber).map(toArabicNumerals).join(' / ')}
        </div>
        <div
          className={`font-semibold text-sm md:text-base flex items-center gap-1 tabular-nums ${
            highContrast ? 'text-black' : 'text-[#111111]'
          }`}
        >
          <span>-</span>
          <span>{toArabicNumerals(page.pageNumber)}</span>
          <span>-</span>
        </div>
        <div className="font-semibold">
          {page.surahArabicName || page.surahName}
        </div>
      </div>

      {hasQuarterMarksOnPage && (
        <div
          className={`mt-2 pt-1.5 border-t border-dashed border-[#B88A36]/60 text-[11px] flex items-center justify-center gap-1.5 text-center ${
            highContrast ? 'text-black' : 'text-[#4A3D31]'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-[#9E6F1B] shrink-0" />
          <span>
            {language === 'ur'
              ? 'پارے کے ربع / نصف / ثلاثة أرباع کے نشانات: مطبوعہ نسخے سے قاری صاحب کی تصدیق درکار ہے'
              : 'Para quarter marks (ربع / نصف / ثلاثة أرباع) placed from rub-el-hizb boundaries — needs Qari check against the printed copy.'}
          </span>
        </div>
      )}
    </>
  );

  if (isOpeningSpread) {
    return (
      <OpeningPageFrame highContrast={highContrast}>
        {innerPageContent}
      </OpeningPageFrame>
    );
  }

  return (
    <div
      dir="rtl"
      className={`w-full max-w-4xl shrink-0 border-2 sm:border-4 p-1.5 sm:p-4 md:p-6 shadow-2xl transition-colors duration-150 relative rounded-b-2xl ${
        highContrast
          ? 'bg-[#FBF5E4] border-[#0E3B2C] text-black'
          : 'bg-[#F3E8CB] border-[#164A3B] text-[#111111]'
      }`}
    >
      {/* Inner Frame with warm ivory paper & deep green/gold/blue accents */}
      <div
        className={`border sm:border-2 p-1.5 sm:p-3.5 md:p-5 rounded-lg relative min-h-[520px] sm:min-h-[680px] flex flex-col justify-between ${
          highContrast
            ? 'mushaf-paper-hc border-[#0E3B2C] ring-1 ring-[#9E6F1B]'
            : 'mushaf-paper border-[#B88A36] ring-1 ring-[#16365D]/20'
        }`}
      >
        {innerPageContent}
      </div>
    </div>
  );
};

interface FlipSession {
  overlayPageNumber: number;
  direction: 'next' | 'prev';
  phase: 'prepare' | 'animating';
}

export const MushafViewer: React.FC<MushafViewerProps> = ({
  pageNumber,
  onPageChange,
  highlightRange,
  highlightRanges,
  interactiveMode = 'view',
  currentMarks = [],
  onWordClick,
  selectionStart,
  selectionEnd,
  hideAndRevealActive = false,
  targetPulseWordId = null,
  language = 'en',
  mushafLayout: controlledLayout,
  onLayoutChange,
  mushafScript: controlledScript,
  onScriptChange,
  highContrast: controlledHighContrast,
  onToggleHighContrast,
  activeParaNumber = null,
  manzilHeaderPara = null,
}) => {
  const [internalLayout, setInternalLayout] = useState<'hafizi' | 'madinah'>('madinah');
  const [internalScript, setInternalScript] = useState<'indopak' | 'uthmani'>('indopak');
  const [internalHighContrast, setInternalHighContrast] = useState<boolean>(false);

  const layout = controlledLayout ?? internalLayout;
  const script = controlledScript ?? internalScript;
  const highContrast = controlledHighContrast ?? internalHighContrast;

  const setLayout = (val: 'hafizi' | 'madinah') => {
    if (onLayoutChange) onLayoutChange(val);
    else setInternalLayout(val);
  };
  const setScript = (val: 'indopak' | 'uthmani') => {
    if (onScriptChange) onScriptChange(val);
    else setInternalScript(val);
  };
  const toggleContrast = () => {
    if (onToggleHighContrast) onToggleHighContrast();
    else setInternalHighContrast(p => !p);
  };

  const totalPages = QURAN_DATA_INFO.totalPages;
  const safePageNumber = Math.max(1, Math.min(totalPages, pageNumber));

  const [revealedLines, setRevealedLines] = useState<Set<number>>(new Set());
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());

  // Reduced motion preference detection
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Page-turn animation state
  const [basePageNumber, setBasePageNumber] = useState<number>(safePageNumber);
  const [flipSession, setFlipSession] = useState<FlipSession | null>(null);
  const viewerRootRef = useRef<HTMLDivElement | null>(null);
  const lastTargetRef = useRef<number>(safePageNumber);
  const animTimerRef = useRef<number | null>(null);
  const raf1Ref = useRef<number | null>(null);
  const raf2Ref = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  const [pageInput, setPageInput] = useState<string>(String(safePageNumber));
  const isEditingPageInputRef = useRef<boolean>(false);

  const isAnimating = flipSession !== null;

  // Preload adjacent pages into cache for instant zero-lag page turns
  useEffect(() => {
    if (safePageNumber < totalPages) getPage(safePageNumber + 1);
    if (safePageNumber > 1) getPage(safePageNumber - 1);
  }, [safePageNumber, totalPages]);

  const clearAnimationTimers = useCallback(() => {
    if (animTimerRef.current !== null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    if (raf1Ref.current !== null) {
      cancelAnimationFrame(raf1Ref.current);
      raf1Ref.current = null;
    }
    if (raf2Ref.current !== null) {
      cancelAnimationFrame(raf2Ref.current);
      raf2Ref.current = null;
    }
  }, []);

  const clearPendingScroll = useCallback(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  // Scroll smoothly (or instantly when reduced motion is enabled) to the top of the Mushaf page,
  // leaving clearance under sticky app headers or inside scrollable modal containers.
  const scrollToMushafTop = useCallback(() => {
    const root = viewerRootRef.current;
    if (!root || typeof window === 'undefined') return;

    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
    const padding = 8;

    // 1. Check if MushafViewer sits inside a dedicated scrollable container (e.g. modal body)
    let scrollContainer: HTMLElement | null = null;
    let ancestor = root.parentElement;
    while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
      const style = window.getComputedStyle(ancestor);
      const overflowY = style.overflowY;
      if (
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        ancestor.scrollHeight > ancestor.clientHeight + 2
      ) {
        scrollContainer = ancestor;
        break;
      }
      ancestor = ancestor.parentElement;
    }

    const rootRect = root.getBoundingClientRect();

    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetTop = Math.max(
        0,
        scrollContainer.scrollTop + (rootRect.top - containerRect.top) - padding
      );
      if (Math.abs(scrollContainer.scrollTop - targetTop) > 1) {
        if (typeof scrollContainer.scrollTo === 'function') {
          scrollContainer.scrollTo({ top: targetTop, behavior });
        } else {
          scrollContainer.scrollTop = targetTop;
        }
      }
      return;
    }

    // 2. Window scrolling: measure sticky/fixed top headers so the Mushaf page header is never covered
    let stickyTopClearance = 0;
    const stickyCandidates = document.querySelectorAll<HTMLElement>(
      'header, [data-sticky-top="true"]'
    );
    stickyCandidates.forEach(el => {
      if (root.contains(el)) return;
      const style = window.getComputedStyle(el);
      if (style.position !== 'sticky' && style.position !== 'fixed') return;
      const rect = el.getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0) return;
      if (rect.height > window.innerHeight * 0.45) return;

      if (style.position === 'fixed') {
        if (rect.top <= 4 && rect.bottom > 0 && rect.bottom < window.innerHeight * 0.5) {
          stickyTopClearance = Math.max(stickyTopClearance, rect.bottom);
        }
      } else {
        const topOffset = Number.parseFloat(style.top);
        const precedesRoot = Boolean(
          el.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING
        );
        if (!Number.isNaN(topOffset) && topOffset >= 0 && topOffset <= 120 && precedesRoot) {
          stickyTopClearance = Math.max(stickyTopClearance, topOffset + rect.height);
        }
      }
    });

    const targetY = Math.max(0, window.scrollY + rootRect.top - stickyTopClearance - padding);
    if (Math.abs(window.scrollY - targetY) > 1) {
      window.scrollTo({ top: targetY, behavior });
    }
  }, [prefersReducedMotion]);

  const scheduleScrollToMushafTop = useCallback(() => {
    clearPendingScroll();
    if (typeof window === 'undefined') return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      scrollToMushafTop();
    });
  }, [clearPendingScroll, scrollToMushafTop]);

  useEffect(() => {
    return () => {
      clearAnimationTimers();
      clearPendingScroll();
    };
  }, [clearAnimationTimers, clearPendingScroll]);

  const startFlipAnimation = useCallback(
    (fromPage: number, toPage: number, notifyParent: boolean) => {
      if (toPage === fromPage || toPage < 1 || toPage > totalPages) return;

      // 1. Pre-load target page data synchronously before any animation starts
      getPage(toPage);
      getPage(fromPage);
      clearAnimationTimers();

      const direction: 'next' | 'prev' = toPage > fromPage ? 'next' : 'prev';
      lastTargetRef.current = toPage;

      if (direction === 'next') {
        // Pre-mount destination page underneath at z-10 while fromPage stays at z-20 covering it
        setBasePageNumber(toPage);
        setFlipSession({ overlayPageNumber: fromPage, direction: 'next', phase: 'prepare' });
      } else {
        // Keep current page underneath at z-10 while target (toPage) pre-mounts & measures at z-20
        setBasePageNumber(fromPage);
        setFlipSession({ overlayPageNumber: toPage, direction: 'prev', phase: 'prepare' });
      }

      if (notifyParent) {
        onPageChange(toPage);
      }

      const durationMs = prefersReducedMotion ? FADE_DURATION_MS : FLIP_DURATION_MS;

      // Double rAF ensures the pre-loaded destination page has laid out & painted before transform starts
      // Start scrolling to the Mushaf top right as the committed page begins its flip animation
      clearPendingScroll();
      raf1Ref.current = requestAnimationFrame(() => {
        scrollToMushafTop();
        raf2Ref.current = requestAnimationFrame(() => {
          setFlipSession(prev => (prev ? { ...prev, phase: 'animating' } : null));
          animTimerRef.current = window.setTimeout(() => {
            setBasePageNumber(toPage);
            setFlipSession(null);
            animTimerRef.current = null;
          }, durationMs + 20);
        });
      });
    },
    [
      clearAnimationTimers,
      clearPendingScroll,
      onPageChange,
      prefersReducedMotion,
      scrollToMushafTop,
      totalPages,
    ]
  );

  // Unified page turn request (blocks double taps during animation)
  const requestPageTurn = useCallback(
    (targetPage: number) => {
      const clamped = Math.max(1, Math.min(totalPages, targetPage));
      if (isAnimating || clamped === safePageNumber) return;
      startFlipAnimation(safePageNumber, clamped, true);
    },
    [isAnimating, safePageNumber, startFlipAnimation, totalPages]
  );

  // Sync page input string when safePageNumber changes externally
  useEffect(() => {
    if (!isEditingPageInputRef.current) {
      setPageInput(String(safePageNumber));
    }
  }, [safePageNumber]);

  // Direct jump (used by Page Number input box so multi-page or mid-flip jumps never get blocked)
  const jumpToPageDirect = useCallback(
    (targetPage: number) => {
      const clamped = Math.max(1, Math.min(totalPages, Math.floor(targetPage)));
      setPageInput(String(clamped));
      if (clamped === safePageNumber) return;
      if (!isAnimating && Math.abs(clamped - safePageNumber) === 1) {
        startFlipAnimation(safePageNumber, clamped, true);
        return;
      }
      clearAnimationTimers();
      setFlipSession(null);
      lastTargetRef.current = clamped;
      setBasePageNumber(clamped);
      onPageChange(clamped);
      scheduleScrollToMushafTop();
    },
    [
      clearAnimationTimers,
      isAnimating,
      onPageChange,
      safePageNumber,
      scheduleScrollToMushafTop,
      startFlipAnimation,
      totalPages,
    ]
  );

  const commitPageInput = useCallback(() => {
    const parsed = parseInt(pageInput.trim(), 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      jumpToPageDirect(parsed);
    } else {
      setPageInput(String(safePageNumber));
    }
  }, [jumpToPageDirect, pageInput, safePageNumber, totalPages]);

  // Sync when pageNumber prop changes externally (e.g., Jump to Mistake, Para Grid Tap, Part Tab switch)
  useEffect(() => {
    if (safePageNumber === lastTargetRef.current) return;
    const prev = lastTargetRef.current;
    lastTargetRef.current = safePageNumber;

    if (!isAnimating && Math.abs(safePageNumber - prev) === 1) {
      startFlipAnimation(prev, safePageNumber, false);
    } else {
      clearAnimationTimers();
      setFlipSession(null);
      setBasePageNumber(safePageNumber);
      scheduleScrollToMushafTop();
    }
  }, [
    safePageNumber,
    isAnimating,
    startFlipAnimation,
    clearAnimationTimers,
    scheduleScrollToMushafTop,
  ]);

  // Keyboard arrow navigation (Arabic book reading order: ArrowLeft = Next, ArrowRight = Previous)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        if (safePageNumber < totalPages) {
          e.preventDefault();
          requestPageTurn(safePageNumber + 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (safePageNumber > 1) {
          e.preventDefault();
          requestPageTurn(safePageNumber - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [safePageNumber, totalPages, requestPageTurn]);

  // Touch swipe navigation (Arabic book: swipe left-to-right turns forward to Next; vertical scroll untouched)
  const touchSwipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStartSwipe = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) {
      touchSwipeStartRef.current = null;
      return;
    }
    touchSwipeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEndSwipe = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchSwipeStartRef.current;
    touchSwipeStartRef.current = null;
    if (!start || e.changedTouches.length !== 1 || isAnimating) return;

    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;

    // Deliberate horizontal swipe only; never call preventDefault so vertical scrolling stays native
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      if (dx > 0 && safePageNumber < totalPages) {
        requestPageTurn(safePageNumber + 1);
      } else if (dx < 0 && safePageNumber > 1) {
        requestPageTurn(safePageNumber - 1);
      }
    }
  };

  const toggleRevealLine = useCallback((lineNum: number) => {
    setRevealedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineNum)) next.delete(lineNum);
      else next.add(lineNum);
      return next;
    });
  }, []);

  const toggleRevealWord = useCallback((wordId: string) => {
    setRevealedWords(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  }, []);

  const headerPage = getPage(safePageNumber);
  const basePage = getPage(basePageNumber);
  const overlayPage = flipSession ? getPage(flipSession.overlayPageNumber) : null;

  const nextDisabled = isAnimating || safePageNumber >= totalPages;
  const prevDisabled = isAnimating || safePageNumber <= 1;

  return (
    <div
      ref={viewerRootRef}
      onTouchStart={handleTouchStartSwipe}
      onTouchEnd={handleTouchEndSwipe}
      className="flex flex-col items-center w-full min-w-0 shrink-0 select-none relative overflow-x-clip"
    >
      {/* Top Mushaf Navigation & Display Controls Bar */}
      <div
        className={`w-full max-w-4xl border-2 border-b-0 rounded-t-2xl text-sm font-medium shadow-xs ${
          highContrast
            ? 'bg-white border-[#0E3B2C] text-black'
            : 'bg-[#F8F4EC] border-[#164A3B] text-[#111111]'
        }`}
      >
        {/* Row 1: Arabic Reading Order Navigation (Left = Next, Center = Page Info, Right = Previous) */}
        <div
          dir="ltr"
          className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 border-b border-[#C5A059]/60"
        >
          <button
            type="button"
            onClick={() => requestPageTurn(safePageNumber + 1)}
            disabled={nextDisabled}
            className={`flex items-center justify-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-lg border transition-colors cursor-pointer min-h-[44px] min-w-[44px] font-semibold text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              highContrast
                ? 'bg-white border-[#0E3B2C] text-black hover:bg-neutral-100'
                : 'bg-[#FBF4E4] border-[#B88A36] text-[#111111] hover:bg-[#F2E5C2]'
            }`}
            aria-label={language === 'ur' ? 'اگلا صفحہ' : 'Next page'}
          >
            <ChevronLeft className={`w-4 h-4 shrink-0 ${highContrast ? 'text-[#0E3B2C]' : 'text-[#164A3B]'}`} />
            <span className="hidden sm:inline">{language === 'ur' ? 'اگلا صفحہ' : 'Next'}</span>
          </button>

          <div
            dir={language === 'ur' ? 'rtl' : 'ltr'}
            className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs md:text-sm min-w-0"
          >
            <span className={`font-bold ${highContrast ? 'text-[#0E3B2C]' : 'text-[#164A3B]'}`}>
              {(() => {
                const displayJuzs = resolvePageJuzList(headerPage, activeParaNumber);
                return language === 'ur'
                  ? `الجزء ${displayJuzs.map(toArabicNumerals).join(' / ')}`
                  : `Para ${displayJuzs.join(' / ')}`;
              })()}
            </span>
            {manzilHeaderPara != null && (
              <span
                className={`px-2 py-0.5 rounded-md border text-[11px] font-bold whitespace-nowrap ${
                  highContrast
                    ? 'bg-[#0E3B2C] text-white border-[#0E3B2C]'
                    : 'bg-[#E8F0EC] text-[#143429] border-[#2E6A54]/60'
                }`}
              >
                {language === 'ur'
                  ? `منزل: پارہ ${manzilHeaderPara}`
                  : `Manzil: Para ${manzilHeaderPara}`}
              </span>
            )}
            <span className="text-[#B88A36]" aria-hidden="true">·</span>
            <span className="font-bold text-[#111111] text-xs sm:text-sm md:text-base truncate max-w-[100px] sm:max-w-none">
              {headerPage.surahName}
            </span>
            {headerPage.startAyah && headerPage.endAyah && (
              <span className="text-[#4A3D31] font-mono text-xs hidden sm:inline tabular-nums">
                ({toArabicNumerals(headerPage.startAyah)}–{toArabicNumerals(headerPage.endAyah)})
              </span>
            )}
            <span className="text-[#B88A36]" aria-hidden="true">·</span>
            <form
              onSubmit={e => {
                e.preventDefault();
                isEditingPageInputRef.current = false;
                commitPageInput();
              }}
              className="flex items-center gap-1"
            >
              <span className="text-[#4A3D31] hidden sm:inline">{language === 'ur' ? 'صفحہ' : 'Page'}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={language === 'ur' ? 'صفحہ نمبر' : 'Go to page'}
                value={pageInput}
                onFocus={e => {
                  isEditingPageInputRef.current = true;
                  e.target.select();
                }}
                onChange={e => {
                  const digitsOnly = e.target.value.replace(/[^\d]/g, '');
                  setPageInput(digitsOnly);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    isEditingPageInputRef.current = false;
                    commitPageInput();
                    (e.currentTarget as HTMLInputElement).blur();
                  } else if (e.key === 'Escape') {
                    isEditingPageInputRef.current = false;
                    setPageInput(String(safePageNumber));
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                onBlur={() => {
                  isEditingPageInputRef.current = false;
                  commitPageInput();
                }}
                className="w-12 sm:w-14 text-center py-1 px-1 border border-[#B88A36] rounded-md bg-white font-mono text-xs font-bold text-[#111111] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#164A3B]"
              />
              <span className="text-[#4A3D31] font-mono text-xs tabular-nums">/ {totalPages}</span>
            </form>
          </div>

          <button
            type="button"
            onClick={() => requestPageTurn(safePageNumber - 1)}
            disabled={prevDisabled}
            className={`flex items-center justify-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-lg border transition-colors cursor-pointer min-h-[44px] min-w-[44px] font-semibold text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              highContrast
                ? 'bg-white border-[#0E3B2C] text-black hover:bg-neutral-100'
                : 'bg-[#FBF4E4] border-[#B88A36] text-[#111111] hover:bg-[#F2E5C2]'
            }`}
            aria-label={language === 'ur' ? 'پچھلا صفحہ' : 'Previous page'}
          >
            <span className="hidden sm:inline">{language === 'ur' ? 'پچھلا صفحہ' : 'Previous'}</span>
            <ChevronRight className={`w-4 h-4 shrink-0 ${highContrast ? 'text-[#0E3B2C]' : 'text-[#164A3B]'}`} />
          </button>
        </div>

        {/* Row 2: Layout Switch (Hafizi / Madinah), Script Switch (IndoPak / Uthmani), High Contrast Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 text-xs">
          {/* Layout Switch */}
          <div className="flex items-center gap-1">
            <span className="text-[#4A3D31] font-medium hidden sm:inline">
              {language === 'ur' ? 'مصحف:' : 'Layout:'}
            </span>
            <div className="flex items-center p-0.5 bg-[#EAE0CE] rounded-lg">
              <button
                type="button"
                onClick={() => setLayout('madinah')}
                className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  layout === 'madinah'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#4A3D31] hover:text-[#111111]'
                }`}
              >
                {language === 'ur' ? 'مدنی (۶۰۴)' : 'Madinah (604p)'}
              </button>
              <button
                type="button"
                onClick={() => setLayout('hafizi')}
                className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  layout === 'hafizi'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#4A3D31] hover:text-[#111111]'
                }`}
              >
                {language === 'ur' ? 'حافظی (۶۱۰)' : 'Hafizi (610p)'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Script Toggle */}
            <div className="flex items-center p-0.5 bg-[#EAE0CE] rounded-lg">
              <button
                type="button"
                onClick={() => setScript('indopak')}
                className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  script === 'indopak'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#4A3D31] hover:text-[#111111]'
                }`}
              >
                Indo-Pak
              </button>
              <button
                type="button"
                onClick={() => setScript('uthmani')}
                className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  script === 'uthmani'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#4A3D31] hover:text-[#111111]'
                }`}
              >
                Uthmani
              </button>
            </div>

            {/* High Contrast Mode Toggle */}
            <button
              type="button"
              onClick={toggleContrast}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                highContrast
                  ? 'bg-[#0E3B2C] text-white border-[#0E3B2C]'
                  : 'bg-white text-[#111111] border-[#B88A36] hover:bg-[#F3ECE1]'
              }`}
              title="Toggle high-contrast black-on-white Quran text"
            >
              <Contrast className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'ur' ? 'تیز کنٹراسٹ' : 'Contrast'}</span>
            </button>
          </div>
        </div>

        {/* Notice if user selected Hafizi 610p layout */}
        {layout === 'hafizi' && (
          <div className="px-3 sm:px-4 py-2 bg-[#FEF3C7] border-t border-[#D97706]/40 text-[#78350F] text-[11px] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
            <div>
              {language === 'ur' ? (
                <span>
                  ۱۵ سطری حافظی (۶۱۰ صفحات) لے آؤٹ کے لیے Quran Foundation API کلائنٹ کیز (`mushaf=6`) یا QUL لاگ اِن درکار ہے۔ فرضی سطریں بنانے کے بجائے عارضی طور پر مستند ۶۰۴ صفحاتی مدنی لے آؤٹ مع انڈو-پاک رسم الخط دکھایا جا رہا ہے۔
                </span>
              ) : (
                <span>
                  <strong>Fallback active:</strong> The 610-page 15-line Hafizi line-by-line data requires Quran Foundation OAuth2 credentials (<code>mushaf=6</code>) or a signed-in QUL export (<code>qul.tarteel.ai/resources/mushaf-layout/12</code>). Showing the verified 604-page Madinah layout without inventing line breaks.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3D Book Stage (Perspective container, zero layout jumps during flips) */}
      <div className="w-full max-w-4xl relative mushaf-book-stage">
        {/* Base Stationary Page */}
        <MushafPageSheet
          page={basePage}
          script={script}
          highContrast={highContrast}
          language={language}
          interactiveMode={interactiveMode}
          currentMarks={currentMarks}
          onWordClick={onWordClick}
          highlightRange={highlightRange}
          highlightRanges={highlightRanges}
          selectionStart={selectionStart}
          selectionEnd={selectionEnd}
          hideAndRevealActive={hideAndRevealActive}
          targetPulseWordId={targetPulseWordId}
          revealedLines={revealedLines}
          revealedWords={revealedWords}
          onToggleRevealLine={toggleRevealLine}
          onToggleRevealWord={toggleRevealWord}
          activeParaNumber={activeParaNumber}
          manzilHeaderPara={manzilHeaderPara}
        />

        {/* Soft moving page-turn cast shadow over the underlying page */}
        {flipSession && flipSession.phase === 'animating' && !prefersReducedMotion && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-b-2xl"
          >
            <div
              className={`absolute inset-y-0 w-2/3 ${
                flipSession.direction === 'next' ? 'animate-mushaf-shadow-next' : 'animate-mushaf-shadow-prev'
              }`}
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(36, 24, 17, 0.22) 48%, rgba(36, 24, 17, 0.08) 78%, transparent 100%)',
              }}
            />
          </div>
        )}

        {/* 3D Turning Page Leaf (turns around right-hand spine) */}
        {flipSession && overlayPage && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 z-30 ${
              prefersReducedMotion
                ? flipSession.phase === 'animating'
                  ? flipSession.direction === 'next'
                    ? 'animate-mushaf-fade-out'
                    : 'animate-mushaf-fade-in'
                  : flipSession.direction === 'next'
                  ? 'opacity-100'
                  : 'opacity-0'
                : `mushaf-turning-leaf ${
                    flipSession.phase === 'animating'
                      ? flipSession.direction === 'next'
                        ? 'animate-mushaf-flip-next'
                        : 'animate-mushaf-flip-prev'
                      : flipSession.direction === 'next'
                      ? ''
                      : 'opacity-0'
                  }`
            }`}
            style={
              !prefersReducedMotion && flipSession.phase === 'prepare' && flipSession.direction === 'prev'
                ? { transform: 'rotateY(168deg)' }
                : undefined
            }
          >
            {/* Front Face of Turning Leaf */}
            <div className="w-full h-full relative" style={{ backfaceVisibility: 'hidden' }}>
              <MushafPageSheet
                page={overlayPage}
                script={script}
                highContrast={highContrast}
                language={language}
                interactiveMode="view"
                currentMarks={currentMarks}
                highlightRange={highlightRange}
                highlightRanges={highlightRanges}
                selectionStart={selectionStart}
                selectionEnd={selectionEnd}
                hideAndRevealActive={hideAndRevealActive}
                targetPulseWordId={targetPulseWordId}
                revealedLines={revealedLines}
                revealedWords={revealedWords}
                onToggleRevealLine={() => {}}
                onToggleRevealWord={() => {}}
                isOverlay
                activeParaNumber={activeParaNumber}
                manzilHeaderPara={manzilHeaderPara}
              />
              {/* Subtle curl lighting gradient across turning leaf */}
              {!prefersReducedMotion && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-b-2xl"
                  style={{
                    background:
                      'linear-gradient(to left, rgba(36,24,17,0.14) 0%, rgba(255,253,249,0.18) 25%, rgba(255,253,249,0) 60%, rgba(36,24,17,0.12) 100%)',
                  }}
                />
              )}
            </div>

            {/* Ivory Back Face of Turning Leaf (visible as page passes 90 deg) */}
            {!prefersReducedMotion && (
              <div
                className={`mushaf-turning-back absolute inset-0 rounded-b-2xl border-2 ${
                  highContrast
                    ? 'bg-[#FBF5E4] border-[#0E3B2C]'
                    : 'mushaf-paper border-[#164A3B]'
                }`}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom Mushaf Page Navigation Bar (Centered, >=44px touch targets, Arabic book order: Next on left, Previous on right) */}
      <nav
        dir="ltr"
        aria-label={language === 'ur' ? 'صفحہ تبدیل کریں' : 'Mushaf page navigation'}
        className={`w-full max-w-4xl mt-3 px-2 sm:px-4 py-2 rounded-2xl border-2 flex items-center justify-center gap-2 sm:gap-5 shadow-xs ${
          highContrast
            ? 'bg-white border-[#0E3B2C] text-black'
            : 'bg-[#F8F4EC] border-[#B88A36] text-[#111111]'
        }`}
      >
        <button
          type="button"
          onClick={() => requestPageTurn(safePageNumber + 1)}
          disabled={nextDisabled}
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-5 py-2 rounded-xl border font-bold text-xs sm:text-sm transition-colors cursor-pointer min-h-[44px] min-w-[44px] whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
            highContrast
              ? 'bg-[#0E3B2C] text-white border-[#0E3B2C] hover:bg-[#164A3B]'
              : 'bg-[#164A3B] text-[#FAF3E3] border-[#B88A36] hover:bg-[#1E5E4B]'
          }`}
          aria-label={language === 'ur' ? 'اگلا صفحہ' : 'Next page'}
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
          <span>{language === 'ur' ? 'اگلا صفحہ' : 'Next'}</span>
        </button>

        <div
          dir={language === 'ur' ? 'rtl' : 'ltr'}
          className="px-1.5 sm:px-3 py-1 font-mono text-xs sm:text-sm font-bold tabular-nums text-center whitespace-nowrap"
        >
          {language === 'ur' ? (
            <span>
              صفحہ {toArabicNumerals(safePageNumber)} / {toArabicNumerals(totalPages)}
            </span>
          ) : (
            <span>
              Page {safePageNumber} <span className="text-[#4A3D31] font-normal">/ {totalPages}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => requestPageTurn(safePageNumber - 1)}
          disabled={prevDisabled}
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-5 py-2 rounded-xl border font-bold text-xs sm:text-sm transition-colors cursor-pointer min-h-[44px] min-w-[44px] whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
            highContrast
              ? 'bg-white text-black border-[#0E3B2C] hover:bg-neutral-100'
              : 'bg-[#FBF4E4] text-[#111111] border-[#B88A36] hover:bg-[#F2E5C2]'
          }`}
          aria-label={language === 'ur' ? 'پچھلا صفحہ' : 'Previous page'}
        >
          <span>{language === 'ur' ? 'پچھلا صفحہ' : 'Previous'}</span>
          <ChevronRight className={`w-4 h-4 shrink-0 ${highContrast ? 'text-[#0E3B2C]' : 'text-[#164A3B]'}`} />
        </button>
      </nav>
    </div>
  );
};
