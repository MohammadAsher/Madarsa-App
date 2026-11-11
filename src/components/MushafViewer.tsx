/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { getPage, MushafWord, WordLocation, isWordInRange } from '../data/quranData';
import { MistakeMark, MistakeType } from '../types/hifz';

interface MushafViewerProps {
  pageNumber: number;
  onPageChange: (newPage: number) => void;
  // Range highlighting
  highlightRange?: {
    start: WordLocation;
    end: WordLocation;
  };
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
}

function toArabicNumerals(num: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).split('').map(d => arabicDigits[parseInt(d, 10)]).join('');
}

export const MushafViewer: React.FC<MushafViewerProps> = ({
  pageNumber,
  onPageChange,
  highlightRange,
  interactiveMode = 'view',
  activeMarkTool = 'ghalti',
  currentMarks = [],
  onWordClick,
  selectionStart,
  selectionEnd,
  hideAndRevealActive = false,
  targetPulseWordId = null,
  language = 'en',
}) => {
  const page = getPage(pageNumber);
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
    if (highlightRange) {
      return isWordInRange(word, highlightRange.start, highlightRange.end);
    }
    return false;
  };

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* Navigation Controls Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between px-4 py-2.5 bg-stone-100 border border-stone-200 rounded-t-2xl text-stone-700 text-sm font-medium">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, pageNumber - 1))}
          disabled={pageNumber <= 1}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer min-h-[38px]"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{language === 'ur' ? 'پچھلا صفحہ' : 'Previous'}</span>
        </button>

        <div className="flex items-center gap-3 text-xs md:text-sm">
          <span className="font-bold text-stone-900 font-serif">
            {language === 'ur' ? `الجزء ${toArabicNumerals(page.juzNumber)}` : `Juz ${page.juzNumber}`}
          </span>
          <span className="text-stone-300">·</span>
          <span className="font-bold text-emerald-900 font-serif text-sm md:text-base">
            {page.surahName}
          </span>
          {page.startAyah && page.endAyah && (
            <span className="text-stone-500 font-mono text-xs hidden sm:inline">
              (آیات {page.startAyah} - {page.endAyah})
            </span>
          )}
          <span className="text-stone-300">·</span>
          <div className="flex items-center gap-1">
            <span className="text-stone-500">{language === 'ur' ? 'صفحہ' : 'Page'}</span>
            <input
              type="number"
              min={1}
              max={604}
              value={pageNumber}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 604) {
                  onPageChange(val);
                }
              }}
              className="w-14 text-center py-1 px-1 border border-stone-300 rounded bg-white font-mono text-xs font-bold text-stone-800"
            />
            <span className="text-stone-400">/ 604</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(604, pageNumber + 1))}
          disabled={pageNumber >= 604}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer min-h-[38px]"
        >
          <span>{language === 'ur' ? 'اگلا صفحہ' : 'Next'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Real Mushaf Page: Continuous Arabic Text with 15 Lines */}
      <div 
        dir="rtl"
        className="w-full max-w-4xl bg-[#FFFDF7] border-4 border-[#C9B387] p-4 md:p-8 shadow-xl transition-all duration-150 relative"
        style={{
          boxShadow: '0 10px 30px -4px rgba(60, 45, 25, 0.12), 0 4px 10px -2px rgba(60, 45, 25, 0.08)',
        }}
      >
        {/* Inner Ornate Gold Border Line */}
        <div className="border border-[#DFCFA8] p-3 md:p-5 bg-[#FFFDF7]">
          
          {/* Header Margin (Surah name, Juz name) */}
          <div className="border-b-2 border-[#D4C3A3] pb-2 mb-4 flex items-center justify-between text-xs md:text-sm font-serif text-[#6D5838]">
            <div className="font-bold">
              الجزء {toArabicNumerals(page.juzNumber)}
            </div>
            <div className="font-bold text-stone-800 text-sm md:text-base">
              {page.surahName}
            </div>
            <div className="font-bold">
              صفحة {toArabicNumerals(page.pageNumber)}
            </div>
          </div>

          {/* 15 Lines Canvas */}
          <div className="flex flex-col space-y-1">
            {page.lines.map(line => {
              const isLineRevealed = revealedLines.has(line.lineNumber);
              const isFullLineHidden = hideAndRevealActive && !isLineRevealed;

              // If this is the Surah Header Line (e.g. Page 1 or Page 2)
              if (line.isHeaderLine) {
                return (
                  <div 
                    key={`p${page.pageNumber}_l${line.lineNumber}`}
                    className="my-2 py-2 px-4 rounded border-2 border-[#C2AE88] bg-[#F7F1E4] text-center shadow-2xs"
                  >
                    <div className="font-serif font-bold text-base md:text-lg text-[#554021]">
                      {page.surahName}
                    </div>
                    <div className="text-[11px] text-[#7C6647] font-serif mt-0.5">
                      {page.pageNumber === 1 ? 'مكية - آياتها ٧' : 'مدنية - آياتها ٢٨٦'}
                    </div>
                  </div>
                );
              }

              // If this is the Bismillah Line
              if (line.isBismillahLine) {
                return (
                  <div 
                    key={`p${page.pageNumber}_l${line.lineNumber}`}
                    className="my-1 py-1 text-center font-serif text-lg md:text-2xl text-[#2C2416] font-bold tracking-wide select-none"
                  >
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                  </div>
                );
              }

              return (
                <div
                  key={`p${page.pageNumber}_l${line.lineNumber}`}
                  className="flex items-center min-h-[38px] md:min-h-[44px] relative group hover:bg-[#F9F6EE] rounded px-1 transition-colors"
                >
                  {/* Subtle Line Margin Indicator */}
                  <div 
                    className="w-5 shrink-0 text-[10px] font-mono text-[#A8987E] select-none text-left pl-0.5 opacity-60 group-hover:opacity-100"
                    title={`Line ${line.lineNumber}`}
                  >
                    {line.lineNumber}
                  </div>

                  {/* Hide & Reveal Toggle icon per line */}
                  {hideAndRevealActive && (
                    <button
                      type="button"
                      onClick={() => toggleRevealLine(line.lineNumber)}
                      className="p-1 text-[#8F7956] hover:text-[#463820] hover:bg-[#EFE8D8] rounded transition-colors mr-1 cursor-pointer"
                      title={isLineRevealed ? 'Hide line' : 'Reveal line'}
                    >
                      {isLineRevealed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-amber-700" />}
                    </button>
                  )}

                  {/* Continuous Text Line Container */}
                  <div 
                    className="flex-1 flex flex-wrap items-baseline justify-between text-right font-serif text-lg md:text-[22px] leading-[2.6rem] text-[#1F1911] tracking-normal px-2"
                    style={{
                      fontFamily: "'Amiri', 'Traditional Arabic', serif",
                      textRendering: 'optimizeLegibility',
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

                      // Mark styles: natural ink annotation look
                      let wordAnnotationClasses = '';
                      let markTag = null;

                      if (mark?.type === 'ghalti') {
                        wordAnnotationClasses = 'bg-rose-200/90 text-rose-950 underline decoration-rose-600 decoration-2 font-bold px-1 rounded-xs';
                        markTag = (
                          <span className="text-[10px] font-sans font-bold bg-rose-600 text-white rounded-full px-1 mx-0.5 align-super">
                            {language === 'ur' ? 'غ' : 'G'}
                          </span>
                        );
                      } else if (mark?.type === 'atkan') {
                        wordAnnotationClasses = 'bg-amber-200/90 text-amber-950 underline decoration-amber-600 decoration-2 font-bold px-1 rounded-xs';
                        markTag = (
                          <span className="text-[10px] font-sans font-bold bg-amber-600 text-white rounded-full px-1 mx-0.5 align-super">
                            {language === 'ur' ? 'ا' : 'A'}
                          </span>
                        );
                      } else if (isStartWord || isEndWord) {
                        wordAnnotationClasses = 'bg-emerald-600 text-white px-1.5 py-0.5 rounded shadow-2xs font-bold';
                      } else if (inRange) {
                        wordAnnotationClasses = 'bg-emerald-100/90 text-emerald-950 px-1 rounded-xs font-semibold ring-1 ring-emerald-300/60 shadow-2xs';
                      } else if (highlightRange || interactiveMode === 'marking' || interactiveMode === 'assigning') {
                        // Dim unassigned lines so only the teacher assigned lesson stands out
                        wordAnnotationClasses = 'opacity-35 text-stone-400 hover:opacity-80 transition-opacity';
                      }

                      // Pulsing animation
                      const pulseClass = isPulsing ? 'animate-bounce ring-4 ring-rose-500 scale-110 z-20 bg-rose-100' : '';

                      // Hide mask
                      const hiddenClass = isWordHidden ? 'blur-xs text-transparent select-none bg-stone-300 rounded px-1' : '';

                      return (
                        <span
                          key={word.id}
                          onClick={() => handleWordTap(word)}
                          className={`inline-block relative cursor-pointer px-0.5 py-0.5 mx-0.5 transition-all duration-150 hover:bg-[#EFE8D8] rounded-xs ${wordAnnotationClasses} ${pulseClass} ${hiddenClass}`}
                          title={`${word.text} (P${page.pageNumber}:L${line.lineNumber}:W${word.wordIndex})`}
                        >
                          <span>{word.text}</span>
                          {markTag}
                          {word.isAyahEnd && word.ayahMarker && (
                            <span className="text-emerald-800 font-serif font-normal text-base md:text-lg mx-1 inline-block select-none">
                              {word.ayahMarker}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Margin: Page Number */}
          <div className="border-t-2 border-[#D4C3A3] pt-2 mt-4 flex items-center justify-between text-xs text-[#7A6746] font-serif">
            <div>
              الجزء {toArabicNumerals(page.juzNumber)}
            </div>
            <div className="font-bold text-sm md:text-base font-serif text-stone-800">
              - {toArabicNumerals(page.pageNumber)} -
            </div>
            <div>
              {page.surahName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
