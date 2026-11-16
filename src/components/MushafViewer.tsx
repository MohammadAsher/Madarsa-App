/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Contrast, AlertCircle } from 'lucide-react';
import { getPage, MushafWord, WordLocation, isWordInRange, QURAN_DATA_INFO } from '../data/quranData';
import { MistakeMark, MistakeType } from '../types/hifz';

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
              ? 'text-[#8B0000] text-[1.16em] inline-block'
              : 'text-[#991B1B] text-[1.14em] inline-block'
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

  const [revealedLines, setRevealedLines] = useState<Set<number>>(new Set());
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());

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

  // Check if any Para quarter mark appears on this page so we display the Qari verification flag cleanly
  const hasQuarterMarksOnPage = page.lines.some(ln =>
    ln.words.some(w => w.rubQuarter === 3 || w.rubQuarter === 5 || w.rubQuarter === 7)
  );

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* Top Mushaf Navigation & Display Controls Bar */}
      <div
        className={`w-full max-w-4xl border-2 border-b-0 rounded-t-2xl text-sm font-medium shadow-xs ${
          highContrast
            ? 'bg-white border-black text-black'
            : 'bg-[#F8F4EC] border-[#C5A059] text-[#241811]'
        }`}
      >
        {/* Row 1: Page Navigation & Juz/Surah Info */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-[#DFCFA8]/70">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePageNumber - 1))}
            disabled={safePageNumber <= 1}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#FAF6EF] border border-[#DFCFA8] text-[#111111] hover:bg-[#F3ECE1] disabled:opacity-40 transition-colors cursor-pointer min-h-[36px] font-semibold text-xs sm:text-sm"
          >
            <ChevronLeft className="w-4 h-4 text-[#8F6E2B]" />
            <span>{language === 'ur' ? 'پچھلا صفحہ' : 'Previous'}</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 text-xs md:text-sm">
            <span className="font-bold text-[#8F6E2B]">
              {language === 'ur' ? `الجزء ${toArabicNumerals(page.juzNumber)}` : `Para ${page.juzNumber}`}
            </span>
            <span className="text-[#C5A059]" aria-hidden="true">·</span>
            <span className="font-bold text-[#111111] text-sm md:text-base">
              {page.surahName}
            </span>
            {page.startAyah && page.endAyah && (
              <span className="text-[#5A4333] font-mono text-xs hidden sm:inline tabular-nums">
                ({toArabicNumerals(page.startAyah)}–{toArabicNumerals(page.endAyah)})
              </span>
            )}
            <span className="text-[#C5A059]" aria-hidden="true">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#5A4333]">{language === 'ur' ? 'صفحہ' : 'Page'}</span>
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
                className="w-14 text-center py-1 px-1 border border-[#DFCFA8] rounded-md bg-white font-mono text-xs font-bold text-[#111111] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              />
              <span className="text-[#5A4333] font-mono tabular-nums">/ {totalPages}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safePageNumber + 1))}
            disabled={safePageNumber >= totalPages}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#FAF6EF] border border-[#DFCFA8] text-[#111111] hover:bg-[#F3ECE1] disabled:opacity-40 transition-colors cursor-pointer min-h-[36px] font-semibold text-xs sm:text-sm"
          >
            <span>{language === 'ur' ? 'اگلا صفحہ' : 'Next'}</span>
            <ChevronRight className="w-4 h-4 text-[#8F6E2B]" />
          </button>
        </div>

        {/* Row 2: Layout Switch (Hafizi / Madinah), Script Switch (IndoPak / Uthmani), High Contrast Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-1.5 text-xs">
          {/* Layout Switch */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#5A4333] font-medium hidden sm:inline">
              {language === 'ur' ? 'مصحف:' : 'Layout:'}
            </span>
            <div className="flex items-center p-0.5 bg-[#EAE0CE] rounded-lg">
              <button
                type="button"
                onClick={() => setLayout('madinah')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  layout === 'madinah'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#5A4333] hover:text-[#111111]'
                }`}
              >
                {language === 'ur' ? 'مدنی ۱۵ سطری (۶۰۴)' : 'Madinah 15-Line (604p)'}
              </button>
              <button
                type="button"
                onClick={() => setLayout('hafizi')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  layout === 'hafizi'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#5A4333] hover:text-[#111111]'
                }`}
              >
                {language === 'ur' ? 'حافظی ۱۵ سطری (۶۱۰)' : 'Hafizi 15-Line (610p)'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Script Toggle */}
            <div className="flex items-center p-0.5 bg-[#EAE0CE] rounded-lg">
              <button
                type="button"
                onClick={() => setScript('indopak')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
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
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
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
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                highContrast
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-[#111111] border-[#C5A059]/70 hover:bg-[#F3ECE1]'
              }`}
              title="Toggle high-contrast black-on-white Quran text"
            >
              <Contrast className="w-3.5 h-3.5" />
              <span>{language === 'ur' ? 'تیز کنٹراسٹ' : 'High Contrast'}</span>
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

      {/* Real Mushaf Page: Near-black crisp Arabic on light background, zero faux bold */}
      <div
        dir="rtl"
        className={`w-full max-w-4xl border-4 p-3 sm:p-5 md:p-7 shadow-2xl transition-colors duration-150 relative rounded-b-2xl ${
          highContrast
            ? 'bg-white border-black text-black'
            : 'bg-[#FFFDF9] border-[#C5A059] text-[#111111]'
        }`}
      >
        {/* Inner Frame */}
        <div
          className={`border-2 p-2.5 sm:p-4 md:p-6 rounded-lg relative ${
            highContrast ? 'border-black bg-white' : 'border-[#DFCFA8] bg-[#FFFDF9]'
          }`}
        >
          {/* Page Header Margin (Surah name, Juz name, Page) */}
          <div
            className={`border-b-2 pb-2 mb-3 flex items-center justify-between text-xs md:text-sm ${
              highContrast ? 'border-black text-black' : 'border-[#DFCFA8] text-[#5A4333]'
            }`}
          >
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

          {/* 15 Lines Canvas */}
          <div className="flex flex-col space-y-1.5">
            {page.lines.map(line => {
              const isLineRevealed = revealedLines.has(line.lineNumber);

              // Collect Ruku & Quarter markers occurring on this line from verified API data
              const rukuEndsInLine = line.words
                .filter(w => typeof w.rukuEndNumber === 'number')
                .map(w => w.rukuEndNumber!);

              const quarterMarksInLine = line.words
                .map(w => (w.rubQuarter ? getQuarterBadgeLabel(w.rubQuarter, w.juzNumber) : null))
                .filter(Boolean) as { ar: string; en: string }[];

              // 1. Surah Header Line (NO faux bold on Arabic script)
              if (line.isHeaderLine) {
                return (
                  <div
                    key={`p${page.pageNumber}_l${line.lineNumber}`}
                    className={`my-2 py-2 px-4 rounded-lg border-2 text-center relative overflow-hidden ${
                      highContrast
                        ? 'border-black bg-neutral-100 text-black'
                        : 'border-[#C5A059] bg-gradient-to-r from-[#F8F4EC] via-[#F1E8D5] to-[#F8F4EC] text-[#111111]'
                    }`}
                  >
                    <div
                      className={`text-lg md:text-2xl flex items-center justify-center gap-3 ${
                        script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'
                      }`}
                    >
                      <span className="text-[#8F6E2B]" aria-hidden="true">۞</span>
                      <span>{line.headerSurahArabicName || line.headerSurahName}</span>
                      <span className="text-[#8F6E2B]" aria-hidden="true">۞</span>
                    </div>
                    {line.headerSurahMeta && (
                      <div className="text-[11px] text-[#5A4333] mt-0.5">
                        {line.headerSurahMeta}
                      </div>
                    )}
                  </div>
                );
              }

              // 2. Bismillah Line (NO faux bold)
              if (line.isBismillahLine) {
                return (
                  <div
                    key={`p${page.pageNumber}_l${line.lineNumber}`}
                    className={`my-1.5 py-1 text-center text-2xl md:text-3xl tracking-normal select-none ${
                      highContrast ? 'text-black' : 'text-[#111111]'
                    } ${script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'}`}
                  >
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                  </div>
                );
              }

              return (
                <div
                  key={`p${page.pageNumber}_l${line.lineNumber}`}
                  className={`flex items-center min-h-[44px] md:min-h-[50px] relative group rounded px-1 transition-colors ${
                    highContrast ? 'hover:bg-neutral-100' : 'hover:bg-[#FAF6EF]'
                  }`}
                >
                  {/* Right-Side Margin Indicator: Line # + Para Quarter Marks */}
                  <div className="flex items-center gap-1 shrink-0 select-none pl-1">
                    <span
                      className={`w-5 text-[10px] font-mono text-center tabular-nums ${
                        highContrast ? 'text-neutral-700' : 'text-[#7A6C60]'
                      }`}
                      title={`Line ${line.lineNumber}`}
                    >
                      {line.lineNumber}
                    </span>

                    {quarterMarksInLine.map((q, qIdx) => (
                      <span
                        key={qIdx}
                        className={`px-1.5 py-0.5 rounded text-[11px] border whitespace-nowrap ${
                          highContrast
                            ? 'bg-black text-white border-black'
                            : 'bg-[#F3ECE1] text-[#241811] border-[#C5A059]'
                        }`}
                        title={`${q.en} — Needs Qari check against printed copy`}
                      >
                        {q.ar}
                      </span>
                    ))}
                  </div>

                  {/* Hide & Reveal Toggle icon per line */}
                  {hideAndRevealActive && (
                    <button
                      type="button"
                      onClick={() => toggleRevealLine(line.lineNumber)}
                      className="p-1 text-[#8F6E2B] hover:text-[#111111] hover:bg-[#F3ECE1] rounded transition-colors mr-1 cursor-pointer"
                      title={isLineRevealed ? 'Hide line' : 'Reveal line'}
                    >
                      {isLineRevealed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-[#B45309]" />}
                    </button>
                  )}

                  {/* Continuous Quranic Arabic Line (NO faux bold, high contrast near-black) */}
                  <div
                    className={`flex-1 flex flex-wrap items-baseline justify-between text-right text-[22px] sm:text-[26px] md:text-[28px] leading-[2.9rem] md:leading-[3.3rem] tracking-normal px-2 ${
                      highContrast ? 'text-black' : 'text-[#111111]'
                    } ${script === 'indopak' ? 'font-quran' : 'font-quran-uthmani'}`}
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

                      // NEVER apply font-bold or font-semibold to Arabic letters (prevents distortion)
                      let wordAnnotationClasses = '';
                      let markTag = null;

                      if (mark?.type === 'ghalti') {
                        wordAnnotationClasses =
                          'bg-rose-200 text-black underline decoration-rose-700 decoration-2 px-1 rounded-xs';
                        markTag = (
                          <span className="text-[10px] font-sans font-bold bg-[#B91C1C] text-white rounded-full px-1 mx-0.5 align-super">
                            {language === 'ur' ? 'غ' : 'G'}
                          </span>
                        );
                      } else if (mark?.type === 'atkan') {
                        wordAnnotationClasses =
                          'bg-amber-200 text-black underline decoration-amber-700 decoration-2 px-1 rounded-xs';
                        markTag = (
                          <span className="text-[10px] font-sans font-bold bg-[#D97706] text-white rounded-full px-1 mx-0.5 align-super">
                            {language === 'ur' ? 'ا' : 'A'}
                          </span>
                        );
                      } else if (isStartWord || isEndWord) {
                        wordAnnotationClasses =
                          'bg-[#1F4E3D] text-white px-1.5 py-0.5 rounded shadow-2xs ring-2 ring-[#C5A059]';
                      } else if (inRange) {
                        wordAnnotationClasses = highContrast
                          ? 'bg-emerald-100 text-black px-1 rounded-xs border-b-2 border-emerald-800'
                          : 'bg-[#E5F2EA] text-[#0B1F17] px-1 rounded-xs border-b-2 border-[#2E6A54]';
                      } else if (highlightRange || interactiveMode === 'marking' || interactiveMode === 'assigning') {
                        wordAnnotationClasses = highContrast
                          ? 'opacity-45 text-neutral-700 hover:opacity-100 transition-opacity'
                          : 'opacity-45 text-[#5A4333] hover:opacity-90 transition-opacity';
                      }

                      const pulseClass = isPulsing
                        ? 'animate-bounce ring-4 ring-[#B91C1C] scale-105 z-20 bg-rose-100'
                        : '';
                      const hiddenClass = isWordHidden
                        ? 'blur-xs text-transparent select-none bg-[#CDBE9F] rounded px-1'
                        : '';

                      return (
                        <span
                          key={word.id}
                          onClick={() => handleWordTap(word)}
                          className={`inline-block relative cursor-pointer px-0.5 py-0.5 mx-0.5 transition-colors duration-150 rounded-xs ${
                            highContrast ? 'hover:bg-neutral-200' : 'hover:bg-[#F3ECE1]'
                          } ${wordAnnotationClasses} ${pulseClass} ${hiddenClass}`}
                          title={`${displayWordText} (P${page.pageNumber}:L${line.lineNumber}:W${word.wordIndex} · Ayah ${word.ayahNumber})`}
                        >
                          <span>{renderVerbatimWithWaqfHighlight(displayWordText, highContrast)}</span>
                          {markTag}
                          {word.isAyahEnd && word.ayahMarker && (
                            <span
                              className={`mx-1 inline-flex items-center justify-center text-[0.72em] px-1.5 py-0 rounded-full border select-none font-sans ${
                                highContrast
                                  ? 'border-black text-black bg-neutral-100'
                                  : 'border-[#C5A059] text-[#5A4333] bg-[#F8F4EC]'
                              }`}
                              title={`End of Ayah ${word.ayahNumber}`}
                            >
                              ﴿{word.ayahMarker}﴾
                            </span>
                          )}
                          {word.rukuEndNumber !== undefined && (
                            <span
                              className={`mx-0.5 inline-flex items-center justify-center px-1.5 py-0.2 rounded text-[0.75em] border select-none font-sans ${
                                highContrast
                                  ? 'border-black bg-black text-white'
                                  : 'border-[#8F6E2B] bg-[#241811] text-[#DFCFA8]'
                              }`}
                              title={`End of Ruku #${word.rukuEndNumber}`}
                            >
                              ع
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* Left-Side Margin Indicator: Ruku End Sign (ع) */}
                  {rukuEndsInLine.length > 0 && (
                    <div className="shrink-0 pr-1 flex items-center gap-1 select-none">
                      {rukuEndsInLine.map(rk => (
                        <span
                          key={rk}
                          className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-sans ${
                            highContrast
                              ? 'border-black bg-black text-white'
                              : 'border-[#8F6E2B] bg-[#F8F4EC] text-[#241811]'
                          }`}
                          title={`Ruku #${rk} Ends on Line ${line.lineNumber}`}
                        >
                          ع
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Margin: Page Number + Verification Note for Quarter Marks */}
          <div
            className={`border-t-2 pt-2.5 mt-4 flex flex-wrap items-center justify-between gap-2 text-xs ${
              highContrast ? 'border-black text-black' : 'border-[#DFCFA8] text-[#5A4333]'
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
        </div>
      </div>
    </div>
  );
};
