/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Contrast, AlertCircle } from 'lucide-react';
import { getPage, MushafWord, WordLocation, isWordInRange, QURAN_DATA_INFO, VERBATIM_BISMILLAH } from '../data/quranData';
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
}

function toArabicNumerals(num: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map(d => arabicDigits[parseInt(d, 10)] ?? d)
    .join('');
}

// Quranic Waqf / Pause symbols (Unicode Quranic annotations + IndoPak font PUA waqf glyphs)
// Kept verbatim in original string; only wrapped visually in dark red without modifying or stripping text.
const WAQF_CHAR_REGEX = /([\u06D6-\u06DC\u06E9\uE003\uE004\uE01A-\uE022]+)/g;
const WAQF_SINGLE_TEST = /^[\u06D6-\u06DC\u06E9\uE003\uE004\uE01A-\uE022]+$/;

function renderVerbatimWithWaqfHighlight(rawText: string, highContrast: boolean) {
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
          className={
            highContrast
              ? 'text-[#8B0000] text-[1.15em] inline-block'
              : 'text-[#991B1B] text-[1.12em] inline-block'
          }
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
  const page = getPage(safePageNumber);
  const isOpeningSpread = safePageNumber === 1 || safePageNumber === 2;

  const [revealedLines, setRevealedLines] = useState<Set<number>>(new Set());
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
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
    if (!start || e.changedTouches.length !== 1) return;

    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;

    // Only turn page on deliberate horizontal swipe; never call preventDefault so vertical scroll always works
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      // RTL Mushaf: swipe left-to-right (dx > 0) turns forward to next page; right-to-left (dx < 0) turns back
      if (dx > 0 && safePageNumber < totalPages) {
        onPageChange(safePageNumber + 1);
      } else if (dx < 0 && safePageNumber > 1) {
        onPageChange(safePageNumber - 1);
      }
    }
  };

  // Dynamic single-row page font size calculated from container width & widest line on the page
  const textColWidthRef = useRef<HTMLDivElement | null>(null);
  const measureListRef = useRef<HTMLDivElement | null>(null);
  const [fittedFontSize, setFittedFontSize] = useState<number>(18);

  const recomputeFontSize = useCallback(() => {
    const colEl = textColWidthRef.current;
    const measureEl = measureListRef.current;
    if (!colEl || !measureEl) return;

    const availableWidth = colEl.clientWidth;
    if (availableWidth <= 0) return;

    const lineNodes = measureEl.querySelectorAll<HTMLElement>('[data-measure-line]');
    let maxMeasuredWidth = 0;
    lineNodes.forEach(node => {
      const w = node.getBoundingClientRect().width;
      if (w > maxMeasuredWidth) maxMeasuredWidth = w;
    });

    const maxDesktopOrMobile = availableWidth >= 560 ? 27 : 21;
    const minReadable = 9.5;

    if (maxMeasuredWidth <= 0) {
      setFittedFontSize(maxDesktopOrMobile);
      return;
    }

    // Leave a 6% buffer for subpixel glyph shaping / Nastaleeq overhangs / mark tags
    const exactScale = (availableWidth * 0.94) / maxMeasuredWidth;
    const calculated = Math.floor(REF_FONT_SIZE * exactScale * 10) / 10;
    const clamped = Math.max(minReadable, Math.min(maxDesktopOrMobile, calculated));
    setFittedFontSize(clamped);
  }, []);

  useLayoutEffect(() => {
    recomputeFontSize();
  }, [safePageNumber, script, hideAndRevealActive, recomputeFontSize]);

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

  const toggleRevealLine = (lineNum: number) => {
    setRevealedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineNum)) next.delete(lineNum);
      else next.add(lineNum);
      return next;
    });
  };

  const toggleRevealWord = (wordId: string) => {
    setRevealedWords(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  const handleWordTap = (word: MushafWord) => {
    if (hideAndRevealActive) {
      toggleRevealWord(word.id);
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

  const hasRangeActive = Boolean(
    (selectionStart && selectionEnd) ||
      (highlightRanges && highlightRanges.length > 0) ||
      highlightRange
  );

  // Collect Juz start & Para quarter marks across the page so they appear in the Page Header Band, NOT inside lines
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

  return (
    <div
      onTouchStart={handleTouchStartSwipe}
      onTouchEnd={handleTouchEndSwipe}
      className="flex flex-col items-center w-full min-w-0 shrink-0 select-none relative"
    >
      {/* Offscreen line-width measurer (matches active script font & Ayah markers at 24px reference) */}
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
              className="inline-flex items-baseline whitespace-nowrap"
              style={{ gap: '4px' }}
            >
              {ln.words.map(w => {
                const txt = script === 'indopak' ? w.text : w.textUthmani;
                return (
                  <span key={w.id} className="inline-block whitespace-nowrap">
                    {txt}
                    {w.isAyahEnd && w.ayahMarker ? ` ﴿${w.ayahMarker}﴾` : ''}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Top Mushaf Navigation & Display Controls Bar */}
      <div
        className={`w-full max-w-4xl border-2 border-b-0 rounded-t-2xl text-sm font-medium shadow-xs ${
          highContrast
            ? 'bg-white border-black text-black'
            : 'bg-[#F8F4EC] border-[#C5A059] text-[#241811]'
        }`}
      >
        {/* Row 1: Page Navigation & Juz/Surah Info */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 border-b border-[#DFCFA8]/70">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePageNumber - 1))}
            disabled={safePageNumber <= 1}
            className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 rounded-lg bg-[#FAF6EF] border border-[#DFCFA8] text-[#111111] hover:bg-[#F3ECE1] disabled:opacity-40 transition-colors cursor-pointer min-h-[34px] font-semibold text-xs sm:text-sm"
          >
            <ChevronLeft className="w-4 h-4 text-[#8F6E2B]" />
            <span className="hidden sm:inline">{language === 'ur' ? 'پچھلا صفحہ' : 'Previous'}</span>
          </button>

          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 text-xs md:text-sm min-w-0">
            <span className="font-bold text-[#8F6E2B]">
              {language === 'ur' ? `الجزء ${toArabicNumerals(page.juzNumber)}` : `Para ${page.juzNumber}`}
            </span>
            <span className="text-[#C5A059]" aria-hidden="true">·</span>
            <span className="font-bold text-[#111111] text-xs sm:text-sm md:text-base truncate max-w-[110px] sm:max-w-none">
              {page.surahName}
            </span>
            {page.startAyah && page.endAyah && (
              <span className="text-[#5A4333] font-mono text-xs hidden sm:inline tabular-nums">
                ({toArabicNumerals(page.startAyah)}–{toArabicNumerals(page.endAyah)})
              </span>
            )}
            <span className="text-[#C5A059]" aria-hidden="true">·</span>
            <div className="flex items-center gap-1">
              <span className="text-[#5A4333] hidden xs:inline">{language === 'ur' ? 'صفحہ' : 'Page'}</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={safePageNumber}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= totalPages) {
                    onPageChange(val);
                  }
                }}
                className="w-12 sm:w-14 text-center py-0.5 sm:py-1 px-1 border border-[#DFCFA8] rounded-md bg-white font-mono text-xs font-bold text-[#111111] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              />
              <span className="text-[#5A4333] font-mono text-xs tabular-nums">/ {totalPages}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safePageNumber + 1))}
            disabled={safePageNumber >= totalPages}
            className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 rounded-lg bg-[#FAF6EF] border border-[#DFCFA8] text-[#111111] hover:bg-[#F3ECE1] disabled:opacity-40 transition-colors cursor-pointer min-h-[34px] font-semibold text-xs sm:text-sm"
          >
            <span className="hidden sm:inline">{language === 'ur' ? 'اگلا صفحہ' : 'Next'}</span>
            <ChevronRight className="w-4 h-4 text-[#8F6E2B]" />
          </button>
        </div>

        {/* Row 2: Layout Switch (Hafizi / Madinah), Script Switch (IndoPak / Uthmani), High Contrast Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 text-xs">
          {/* Layout Switch */}
          <div className="flex items-center gap-1">
            <span className="text-[#5A4333] font-medium hidden sm:inline">
              {language === 'ur' ? 'مصحف:' : 'Layout:'}
            </span>
            <div className="flex items-center p-0.5 bg-[#EAE0CE] rounded-lg">
              <button
                type="button"
                onClick={() => setLayout('madinah')}
                className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  layout === 'madinah'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#5A4333] hover:text-[#111111]'
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
                    : 'text-[#5A4333] hover:text-[#111111]'
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
                    : 'text-[#5A4333] hover:text-[#111111]'
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
                    : 'text-[#5A4333] hover:text-[#111111]'
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
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-[#111111] border-[#C5A059]/70 hover:bg-[#F3ECE1]'
              }`}
              title="Toggle high-contrast black-on-white Quran text"
            >
              <Contrast className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{language === 'ur' ? 'تیز کنٹراسٹ' : 'Contrast'}</span>
            </button>
          </div>
        </div>

        {/* Notice if user selected Hafizi 610p layout (explaining honest temporary fallback) */}
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

      {/* Real Mushaf Page: Opening Pages (1 & 2) use Illuminated Border & Vertically Centered 8 Lines; Pages 3..604 use 15-Line Frame */}
      {(() => {
        const innerPageContent = (
          <>
            {/* Page Header Margin Band (Surah name, Juz name, Page + Juz/Quarter marks moved out of lines) */}
            <div
              className={`border-b-2 pb-1.5 mb-2 space-y-1 text-xs md:text-sm ${
                highContrast
                  ? 'border-black text-black'
                  : isOpeningSpread
                    ? 'border-[#1B4D3E]/30 text-[#1B4D3E]'
                    : 'border-[#DFCFA8] text-[#5A4333]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold flex items-center gap-1">
                  <span>الجزء</span>
                  <span>{toArabicNumerals(page.juzNumber)}</span>
                </div>
                <div className="font-semibold text-sm md:text-base flex items-center gap-2 text-[#111111]">
                  <span>{page.surahArabicName || page.surahName}</span>
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
                          ? 'bg-black text-white border-black'
                          : 'bg-[#F3ECE1] text-[#241811] border-[#C5A059]'
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
              <div className="w-4 sm:w-6 shrink-0" />
              {hideAndRevealActive && <div className="w-6 shrink-0" />}
              <div ref={textColWidthRef} className="flex-1 min-w-0" />
              <div className="w-4 sm:w-5 shrink-0" />
            </div>

            {/* Mushaf Lines Canvas — 8 vertically centered lines on Pages 1 & 2, 15 lines on Pages 3..604 */}
            <div
              className={
                isOpeningSpread
                  ? 'flex-1 flex flex-col justify-center py-2 sm:py-4'
                  : 'flex-1 flex flex-col justify-between'
              }
            >
              <div
                className={
                  isOpeningSpread
                    ? 'flex flex-col gap-2.5 sm:gap-4 divide-y divide-[#C5A059]/25'
                    : 'flex flex-col divide-y divide-[#DFCFA8]/35'
                }
              >
                {page.lines.map(line => {
                  const isLineRevealed = revealedLines.has(line.lineNumber);

                  const rukuEndsInLine = line.words
                    .filter(w => typeof w.rukuEndNumber === 'number')
                    .map(w => w.rukuEndNumber!);

                  const lineMarginBadge = (
                    <span
                      className={`w-4 sm:w-6 shrink-0 text-[9px] sm:text-[10px] font-mono text-center tabular-nums select-none ${
                        highContrast ? 'text-neutral-700' : 'text-[#7A6C60]'
                      }`}
                      title={`Line ${line.lineNumber}`}
                    >
                      {line.lineNumber}
                    </span>
                  );

                  const leftRukuMargin = (
                    <div className="w-4 sm:w-5 shrink-0 flex items-center justify-center select-none">
                      {rukuEndsInLine.length > 0 && (
                        <span
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center text-[10px] sm:text-xs font-sans ${
                            highContrast
                              ? 'border-black bg-black text-white'
                              : 'border-[#8F6E2B] bg-[#F8F4EC] text-[#241811]'
                          }`}
                          title={`Ruku #${rukuEndsInLine.join(', ')} Ends on Line ${line.lineNumber}`}
                        >
                          ع
                        </span>
                      )}
                    </div>
                  );

                  // 1. Surah Header Line — ornamental cartouche on Pages 1 & 2, clean banner elsewhere
                  if (line.isHeaderLine) {
                    return (
                      <div
                        key={`p${page.pageNumber}_l${line.lineNumber}`}
                        className={`flex items-center py-0.5 ${
                          isOpeningSpread ? 'min-h-[46px] sm:min-h-[58px] mb-1 sm:mb-2' : 'min-h-[34px] sm:min-h-[42px]'
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
                                ? 'border-black bg-neutral-100 text-black'
                                : 'border-[#C5A059] bg-gradient-to-r from-[#F8F4EC] via-[#F1E8D5] to-[#F8F4EC] text-[#111111]'
                            }`}
                          >
                            <span className="text-[#8F6E2B] text-xs" aria-hidden="true">۞</span>
                            <span
                              className={`whitespace-nowrap ${
                                script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'
                              }`}
                              style={{ fontSize: `${Math.min(22, Math.max(14, fittedFontSize * 1.05))}px`, lineHeight: 1.4 }}
                            >
                              {line.headerSurahArabicName || line.headerSurahName}
                            </span>
                            {line.headerSurahMeta && (
                              <span className="text-[10px] text-[#5A4333] hidden sm:inline whitespace-nowrap">
                                ({line.headerSurahMeta})
                              </span>
                            )}
                            <span className="text-[#8F6E2B] text-xs" aria-hidden="true">۞</span>
                          </div>
                        )}
                        {leftRukuMargin}
                      </div>
                    );
                  }

                  // 2. Bismillah Line — strictly 1 row with verbatim source Bismillah
                  if (line.isBismillahLine) {
                    return (
                      <div
                        key={`p${page.pageNumber}_l${line.lineNumber}`}
                        className={`flex items-center py-0.5 ${
                          isOpeningSpread ? 'min-h-[38px] sm:min-h-[50px] pb-1.5 sm:pb-2' : 'min-h-[34px] sm:min-h-[42px]'
                        }`}
                      >
                        {lineMarginBadge}
                        {hideAndRevealActive && <div className="w-6 shrink-0" />}
                        <div
                          className={`flex-1 min-w-0 text-center whitespace-nowrap overflow-hidden select-none ${
                            highContrast ? 'text-black' : 'text-[#111111]'
                          } ${script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'}`}
                          style={{
                            fontSize: `${Math.min(25, Math.max(14, fittedFontSize * 1.02))}px`,
                            lineHeight: 1.6,
                          }}
                        >
                          {VERBATIM_BISMILLAH[script]}
                        </div>
                        {leftRukuMargin}
                      </div>
                    );
                  }

                  // 3. Normal Quranic Text Line — single non-wrapping justified row
                  const isSingleWord = line.words.length === 1;

                  return (
                    <div
                      key={`p${page.pageNumber}_l${line.lineNumber}`}
                      className={`flex items-center py-0.5 transition-colors ${
                        isOpeningSpread ? 'min-h-[38px] sm:min-h-[50px]' : 'min-h-[34px] sm:min-h-[44px]'
                      } ${highContrast ? 'hover:bg-neutral-100' : 'hover:bg-[#FAF6EF]'}`}
                    >
                  {/* Right-Side Margin: Line # */}
                  {lineMarginBadge}

                  {/* Hide & Reveal Toggle icon per line */}
                  {hideAndRevealActive && (
                    <button
                      type="button"
                      onClick={() => toggleRevealLine(line.lineNumber)}
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

                  {/* Single-row non-wrapping justified Quranic Arabic line (NO faux bold, near-black) */}
                  <div
                    className={`flex-1 min-w-0 flex flex-nowrap items-baseline whitespace-nowrap overflow-hidden ${
                      isSingleWord ? 'justify-start' : 'justify-between'
                    } ${highContrast ? 'text-black' : 'text-[#111111]'} ${
                      script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'
                    }`}
                    style={{
                      fontSize: `${fittedFontSize}px`,
                      lineHeight: 1.85,
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

                      // Clean highlight rules:
                      // - Assigned range: light background wash + thin underline ONLY (zero boxes), near-black text.
                      // - Box ONLY appears on words tapped by the Ustaad in marking mode (Ghalti / Atkan).
                      let wordAnnotationClasses = '';
                      let markTag = null;

                      if (mark?.type === 'ghalti') {
                        wordAnnotationClasses =
                          'bg-rose-100 ring-1 ring-[#B91C1C] text-black px-0.5 rounded-xs';
                        markTag = (
                          <span className="text-[0.55em] font-sans font-bold bg-[#B91C1C] text-white rounded-full px-1 mx-0.5 align-super leading-none">
                            {language === 'ur' ? 'غ' : 'G'}
                          </span>
                        );
                      } else if (mark?.type === 'atkan') {
                        wordAnnotationClasses =
                          'bg-amber-100 ring-1 ring-[#D97706] text-black px-0.5 rounded-xs';
                        markTag = (
                          <span className="text-[0.55em] font-sans font-bold bg-[#D97706] text-white rounded-full px-1 mx-0.5 align-super leading-none">
                            {language === 'ur' ? 'ا' : 'A'}
                          </span>
                        );
                      } else if (interactiveMode === 'assigning' && (isStartWord || isEndWord)) {
                        wordAnnotationClasses =
                          'bg-[#FEF3C7] text-[#111111] shadow-[inset_0_-2px_0_0_#B45309]';
                      } else if (inRange) {
                        wordAnnotationClasses = highContrast
                          ? 'bg-emerald-50 text-black shadow-[inset_0_-1.5px_0_0_#065F46]'
                          : 'bg-[#EDF6F0] text-[#111111] shadow-[inset_0_-1.5px_0_0_rgba(46,106,84,0.65)]';
                      } else if (
                        hasRangeActive ||
                        interactiveMode === 'marking' ||
                        interactiveMode === 'assigning'
                      ) {
                        wordAnnotationClasses = highContrast
                          ? 'text-neutral-500'
                          : 'text-[#5A4333]/75';
                      }

                      const pulseClass = isPulsing
                        ? 'ring-2 ring-[#B91C1C] bg-rose-100 text-black rounded-xs'
                        : '';
                      const hiddenClass = isWordHidden
                        ? 'blur-xs text-transparent select-none bg-[#E6D9BE]/70'
                        : '';

                      return (
                        <span
                          key={word.id}
                          onClick={() => handleWordTap(word)}
                          className={`inline-block whitespace-nowrap cursor-pointer px-[1px] transition-colors duration-100 ${
                            interactiveMode === 'marking'
                              ? highContrast
                                ? 'hover:bg-neutral-200'
                                : 'hover:bg-[#F3ECE1]'
                              : ''
                          } ${wordAnnotationClasses} ${pulseClass} ${hiddenClass}`}
                          title={`${displayWordText} (P${page.pageNumber}:L${line.lineNumber}:W${word.wordIndex} · Ayah ${word.ayahNumber})`}
                        >
                          <span>{renderVerbatimWithWaqfHighlight(displayWordText, highContrast)}</span>
                          {markTag}
                          {word.isAyahEnd && word.ayahMarker && (
                            <span
                              className={`mx-[2px] text-[0.82em] select-none ${
                                highContrast ? 'text-black' : 'text-[#5A4333]'
                              }`}
                              title={`End of Ayah ${word.ayahNumber}`}
                            >
                              ﴿{word.ayahMarker}﴾
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* Left-Side Margin: Ruku End Sign (ع) */}
                  {leftRukuMargin}
                </div>
              );
                })}
              </div>
            </div>

            {/* Footer Margin: Page Number + Verification Note for Quarter Marks */}
            <div
              className={`border-t-2 pt-2 mt-2 flex flex-wrap items-center justify-between gap-2 text-xs ${
                highContrast
                  ? 'border-black text-black'
                  : isOpeningSpread
                    ? 'border-[#1B4D3E]/30 text-[#1B4D3E]'
                    : 'border-[#DFCFA8] text-[#5A4333]'
              }`}
            >
              <div>
                الجزء {toArabicNumerals(page.juzNumber)}
              </div>
              <div className="font-semibold text-sm md:text-base text-[#111111] flex items-center gap-1 tabular-nums">
                <span>-</span>
                <span>{toArabicNumerals(page.pageNumber)}</span>
                <span>-</span>
              </div>
              <div>
                {page.surahArabicName || page.surahName}
              </div>
            </div>

            {hasQuarterMarksOnPage && (
              <div className="mt-2 pt-1.5 border-t border-dashed border-[#DFCFA8] text-[11px] text-[#7A6C60] flex items-center justify-center gap-1.5 text-center">
                <AlertCircle className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
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
                ? 'bg-white border-black text-black'
                : 'bg-[#FFFDF9] border-[#C5A059] text-[#111111]'
            }`}
          >
            {/* Inner Frame matching opening pages' outer vertical proportions */}
            <div
              className={`border sm:border-2 p-1.5 sm:p-3.5 md:p-5 rounded-lg relative min-h-[520px] sm:min-h-[680px] flex flex-col justify-between ${
                highContrast ? 'border-black bg-white' : 'border-[#DFCFA8] bg-[#FFFDF9]'
              }`}
            >
              {innerPageContent}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
