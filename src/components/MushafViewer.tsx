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
      {/* Navigation Controls Bar with Islamic-inspired palette */}
      <div className="w-full max-w-4xl flex items-center justify-between px-4 py-2.5 bg-[#F8F4EC] border-2 border-b-0 border-[#C5A059] rounded-t-2xl text-[#241811] text-sm font-medium shadow-xs">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, pageNumber - 1))}
          disabled={pageNumber <= 1}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF6EF] border border-[#DFCFA8] text-[#241811] hover:bg-[#F3ECE1] disabled:opacity-40 transition-colors shadow-2xs cursor-pointer min-h-[38px] font-semibold"
        >
          <ChevronLeft className="w-4 h-4 text-[#C5A059]" />
          <span>{language === 'ur' ? 'پچھلا صفحہ' : 'Previous'}</span>
        </button>

        <div className="flex items-center gap-3 text-xs md:text-sm">
          <span className="font-bold text-[#8F6E2B] font-serif">
            {language === 'ur' ? `الجزء ${toArabicNumerals(page.juzNumber)}` : `Juz ${page.juzNumber}`}
          </span>
          <span className="text-[#C5A059]">۞</span>
          <span className="font-bold text-[#241811] font-serif text-sm md:text-base">
            {page.surahName}
          </span>
          {page.startAyah && page.endAyah && (
            <span className="text-[#7A6C60] font-mono text-xs hidden sm:inline">
              (آیات {toArabicNumerals(page.startAyah)} - {toArabicNumerals(page.endAyah)})
            </span>
          )}
          <span className="text-[#C5A059]">۞</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#7A6C60]">{language === 'ur' ? 'صفحہ' : 'Page'}</span>
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
              className="w-14 text-center py-1 px-1 border border-[#DFCFA8] rounded-md bg-[#FAF6EF] font-mono text-xs font-bold text-[#241811] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
            />
            <span className="text-[#7A6C60] font-mono">/ 604</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(604, pageNumber + 1))}
          disabled={pageNumber >= 604}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF6EF] border border-[#DFCFA8] text-[#241811] hover:bg-[#F3ECE1] disabled:opacity-40 transition-colors shadow-2xs cursor-pointer min-h-[38px] font-semibold"
        >
          <span>{language === 'ur' ? 'اگلا صفحہ' : 'Next'}</span>
          <ChevronRight className="w-4 h-4 text-[#C5A059]" />
        </button>
      </div>

      {/* Real Mushaf Page: Continuous Arabic Text with 15 Lines */}
      <div 
        dir="rtl"
        className="w-full max-w-4xl bg-[#FFFDF8] border-4 border-[#C5A059] p-4 md:p-8 shadow-2xl transition-all duration-150 relative rounded-b-2xl"
        style={{
          boxShadow: '0 12px 35px -5px rgba(42, 29, 21, 0.15), 0 4px 12px -2px rgba(42, 29, 21, 0.08)',
        }}
      >
        {/* Inner Ornate Gold Border Line */}
        <div className="border-2 border-[#DFCFA8] p-3 md:p-6 bg-[#FFFDF8] rounded-lg relative">
          
          {/* Header Margin (Surah name, Juz name) */}
          <div className="border-b-2 border-[#DFCFA8] pb-2 mb-4 flex items-center justify-between text-xs md:text-sm font-serif text-[#8F6E2B]">
            <div className="font-bold flex items-center gap-1">
              <span>الجزء</span>
              <span>{toArabicNumerals(page.juzNumber)}</span>
            </div>
            <div className="font-bold text-[#241811] text-sm md:text-base flex items-center gap-2">
              <span className="text-[#C5A059]">✦</span>
              <span>{page.surahName}</span>
              <span className="text-[#C5A059]">✦</span>
            </div>
            <div className="font-bold flex items-center gap-1">
              <span>صفحة</span>
              <span>{toArabicNumerals(page.pageNumber)}</span>
            </div>
          </div>

          {/* 15 Lines Canvas */}
          <div className="flex flex-col space-y-1">
            {page.lines.map(line => {
              const isLineRevealed = revealedLines.has(line.lineNumber);

              // If this is the Surah Header Line (e.g. Page 1 or Page 2)
              if (line.isHeaderLine) {
                return (
                  <div 
                    key={`p${page.pageNumber}_l${line.lineNumber}`}
                    className="my-3 py-2.5 px-4 rounded-lg border-2 border-[#C5A059] bg-gradient-to-r from-[#F8F4EC] via-[#F1E8D5] to-[#F8F4EC] text-center shadow-xs relative overflow-hidden"
                  >
                    <div className="font-serif font-bold text-base md:text-xl text-[#241811] flex items-center justify-center gap-3">
                      <span className="text-[#C5A059]">۞</span>
                      <span>{page.surahName}</span>
                      <span className="text-[#C5A059]">۞</span>
                    </div>
                    <div className="text-[11px] text-[#7A6C60] font-serif mt-0.5">
                      {page.pageNumber === 1 ? 'مَكِّيَّةٌ · آيَاتُهَا ٧' : 'مَدَنِيَّةٌ · آيَاتُهَا ٢٨٦'}
                    </div>
                  </div>
                );
              }

              // If this is the Bismillah Line
              if (line.isBismillahLine) {
                return (
                  <div 
                    key={`p${page.pageNumber}_l${line.lineNumber}`}
                    className="my-2 py-1.5 text-center font-serif text-xl md:text-3xl text-[#241811] font-bold tracking-wide select-none"
                    style={{
                      fontFamily: "'Amiri', 'Traditional Arabic', serif",
                    }}
                  >
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                  </div>
                );
              }

              return (
                <div
                  key={`p${page.pageNumber}_l${line.lineNumber}`}
                  className="flex items-center min-h-[38px] md:min-h-[44px] relative group hover:bg-[#FAF6EF] rounded px-1 transition-colors"
                >
                  {/* Subtle Line Margin Indicator */}
                  <div 
                    className="w-5 shrink-0 text-[10px] font-mono text-[#A69888] select-none text-left pl-0.5 opacity-60 group-hover:opacity-100"
                    title={`Line ${line.lineNumber}`}
                  >
                    {line.lineNumber}
                  </div>

                  {/* Hide & Reveal Toggle icon per line */}
                  {hideAndRevealActive && (
                    <button
                      type="button"
                      onClick={() => toggleRevealLine(line.lineNumber)}
                      className="p-1 text-[#8F6E2B] hover:text-[#241811] hover:bg-[#F3ECE1] rounded transition-colors mr-1 cursor-pointer"
                      title={isLineRevealed ? 'Hide line' : 'Reveal line'}
                    >
                      {isLineRevealed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-[#B45309]" />}
                    </button>
                  )}

                  {/* Continuous Text Line Container */}
                  <div 
                    className="flex-1 flex flex-wrap items-baseline justify-between text-right font-serif text-lg md:text-[22px] leading-[2.6rem] text-[#241811] tracking-normal px-2"
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
                          <span className="text-[10px] font-sans font-bold bg-[#B91C1C] text-white rounded-full px-1 mx-0.5 align-super">
                            {language === 'ur' ? 'غ' : 'G'}
                          </span>
                        );
                      } else if (mark?.type === 'atkan') {
                        wordAnnotationClasses = 'bg-amber-200/90 text-amber-950 underline decoration-amber-600 decoration-2 font-bold px-1 rounded-xs';
                        markTag = (
                          <span className="text-[10px] font-sans font-bold bg-[#D97706] text-white rounded-full px-1 mx-0.5 align-super">
                            {language === 'ur' ? 'ا' : 'A'}
                          </span>
                        );
                      } else if (isStartWord || isEndWord) {
                        wordAnnotationClasses = 'bg-[#1F4E3D] text-[#FCFAF6] px-1.5 py-0.5 rounded shadow-2xs font-bold border border-[#C5A059]';
                      } else if (inRange) {
                        wordAnnotationClasses = 'bg-[#EBF3EE] text-[#143429] px-1 rounded-xs font-semibold border-b-2 border-[#2E6A54]';
                      } else if (highlightRange || interactiveMode === 'marking' || interactiveMode === 'assigning') {
                        // Dim unassigned lines so only the teacher assigned lesson stands out
                        wordAnnotationClasses = 'opacity-35 text-[#8A7C70] hover:opacity-80 transition-opacity';
                      }

                      // Pulsing animation
                      const pulseClass = isPulsing ? 'animate-bounce ring-4 ring-[#B91C1C] scale-110 z-20 bg-rose-100' : '';

                      // Hide mask
                      const hiddenClass = isWordHidden ? 'blur-xs text-transparent select-none bg-[#CDBE9F] rounded px-1' : '';

                      return (
                        <span
                          key={word.id}
                          onClick={() => handleWordTap(word)}
                          className={`inline-block relative cursor-pointer px-0.5 py-0.5 mx-0.5 transition-all duration-150 hover:bg-[#F3ECE1] rounded-xs ${wordAnnotationClasses} ${pulseClass} ${hiddenClass}`}
                          title={`${word.text} (P${page.pageNumber}:L${line.lineNumber}:W${word.wordIndex})`}
                        >
                          <span>{word.text}</span>
                          {markTag}
                          {word.isAyahEnd && word.ayahMarker && (
                            <span className="text-[#8F6E2B] font-serif font-normal text-base md:text-lg mx-1 inline-block select-none">
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
          <div className="border-t-2 border-[#DFCFA8] pt-2 mt-4 flex items-center justify-between text-xs text-[#8F6E2B] font-serif">
            <div>
              الجزء {toArabicNumerals(page.juzNumber)}
            </div>
            <div className="font-bold text-sm md:text-base font-serif text-[#241811] flex items-center gap-1">
              <span>-</span>
              <span>{toArabicNumerals(page.pageNumber)}</span>
              <span>-</span>
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
