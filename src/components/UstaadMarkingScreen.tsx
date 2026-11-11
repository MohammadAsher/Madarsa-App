/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  BookOpen
} from 'lucide-react';
import { 
  MadrasaState, 
  StudentProfile, 
  PartType, 
  MistakeMark, 
  MistakeType, 
  SessionResult 
} from '../types/hifz';
import { getEffectiveLimits } from '../services/storageService';
import { MushafViewer } from './MushafViewer';
import { MushafWord } from '../data/quranData';
import { translations } from '../i18n/translations';

interface UstaadMarkingScreenProps {
  state: MadrasaState;
  student: StudentProfile;
  initialPart?: PartType;
  onBack: () => void;
  onSaveSession: (result: SessionResult, updatedMarks: MistakeMark[]) => void;
}

export const UstaadMarkingScreen: React.FC<UstaadMarkingScreenProps> = ({
  state,
  student,
  initialPart = 'sabaq',
  onBack,
  onSaveSession,
}) => {
  const [activePart, setActivePart] = useState<PartType>(initialPart);
  const [activeTool, setActiveTool] = useState<MistakeType>('ghalti');
  const t = translations[state.language];

  // Retrieve today's plan for this student
  const todayPlan = state.dailyPlans[student.id]?.[state.currentDate];
  const currentPartPlan = todayPlan ? todayPlan[activePart] : null;

  // Active page state in Mushaf viewer
  const [currentPage, setCurrentPage] = useState<number>(
    currentPartPlan?.range.start.page || 1
  );

  // Sync current page when active part changes
  useEffect(() => {
    if (currentPartPlan) {
      setCurrentPage(currentPartPlan.range.start.page);
    }
  }, [activePart]);

  // Session marks created during this grading session
  const existingMarks = state.marksHistory.filter(
    m => m.studentId === student.id && m.date === state.currentDate && m.part === activePart
  );

  const [sessionMarks, setSessionMarks] = useState<MistakeMark[]>(existingMarks);

  // When switching parts, reload existing marks
  useEffect(() => {
    const marksForPart = state.marksHistory.filter(
      m => m.studentId === student.id && m.date === state.currentDate && m.part === activePart
    );
    setSessionMarks(marksForPart);
  }, [activePart, student.id, state.currentDate, state.marksHistory]);

  // Calculate live limits and counts
  const limits = getEffectiveLimits(student.id, state);
  const ghaltiLimit = limits[`${activePart}GhaltiLimit` as keyof typeof limits];
  const atkanLimit = limits[`${activePart}AtkanLimit` as keyof typeof limits];

  const ghaltiCount = sessionMarks.filter(m => m.type === 'ghalti').length;
  const atkanCount = sessionMarks.filter(m => m.type === 'atkan').length;

  const isLimitReached = ghaltiCount >= ghaltiLimit || atkanCount >= atkanLimit;
  const suggestedResult: 'passed' | 'repeat' = isLimitReached ? 'repeat' : 'passed';

  // Toggle word mark
  const handleWordClick = (word: MushafWord) => {
    const existingIndex = sessionMarks.findIndex(m => m.wordId === word.id);

    if (existingIndex >= 0) {
      const existing = sessionMarks[existingIndex];
      // If tapping with the same tool, remove it!
      if (existing.type === activeTool) {
        setSessionMarks(prev => prev.filter((_, idx) => idx !== existingIndex));
      } else {
        // Change type (e.g. from atkan to ghalti)
        setSessionMarks(prev =>
          prev.map((m, idx) => (idx === existingIndex ? { ...m, type: activeTool } : m))
        );
      }
    } else {
      // Add new mark
      const newMark: MistakeMark = {
        id: `mark_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        studentId: student.id,
        date: state.currentDate,
        part: activePart,
        wordId: word.id,
        page: word.pageNumber,
        line: word.lineNumber,
        wordIndex: word.wordIndex,
        type: activeTool,
        timestamp: Date.now(),
      };
      setSessionMarks(prev => [...prev, newMark]);
    }
  };

  // Undo button handler
  const handleUndo = () => {
    if (sessionMarks.length === 0) return;
    setSessionMarks(prev => prev.slice(0, prev.length - 1));
  };

  // Finalize session with result (Pass or Repeat)
  const handleFinalize = (chosenResult: 'passed' | 'repeat') => {
    if (!currentPartPlan) return;

    const sessionResult: SessionResult = {
      id: `res_${student.id}_${state.currentDate}_${activePart}_${Date.now()}`,
      studentId: student.id,
      date: state.currentDate,
      part: activePart,
      ghaltiCount,
      atkanCount,
      ghaltiLimit,
      atkanLimit,
      suggestedResult,
      finalResult: chosenResult,
      isOverridden: chosenResult !== suggestedResult,
      marks: sessionMarks,
      range: currentPartPlan.range,
      timestamp: Date.now(),
    };

    onSaveSession(sessionResult, sessionMarks);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF6EF] bg-islamic-pattern pb-14 sm:pb-16">
      {/* Top Navigation & Student Header Bar - Slim, non-intrusive */}
      <header className="sticky top-0 z-30 bg-[#241811] text-[#FCFAF6] border-b border-[#C5A059] px-3 sm:px-4 py-2 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Direct Back to Halqa button */}
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#C5A059]/40 bg-[#2E2017] hover:bg-[#3A291E] active:scale-95 text-[#FCFAF6] text-xs font-semibold transition-colors cursor-pointer shadow-xs min-h-[34px]"
              title={t.backToDashboard}
            >
              <ArrowLeft className="w-4 h-4 text-[#C5A059] shrink-0" />
              <span>{t.backToDashboard}</span>
            </button>

            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-[#FCFAF6] text-sm sm:text-base truncate">
                {state.language === 'ur' ? student.urduName : student.name}
              </span>
              <span className="text-[#C5A059] hidden sm:inline">۞</span>
              <span className="text-[#DFCFA8] text-xs hidden sm:inline truncate">
                {student.halqaName}
              </span>
            </div>
          </div>

          {/* Part Switcher Tabs */}
          <div className="flex items-center p-0.5 bg-[#2E2017] rounded-lg border border-[#C5A059]/40">
            {(['sabaq', 'sabqi', 'manzil'] as PartType[]).map(partKey => {
              const isActive = activePart === partKey;
              const partStatus = todayPlan ? todayPlan[partKey]?.status : 'pending';
              
              let statusIndicatorColor = 'bg-[#7A6C60]';
              if (partStatus === 'passed') statusIndicatorColor = 'bg-[#2E6A54]';
              if (partStatus === 'repeat') statusIndicatorColor = 'bg-[#B91C1C]';

              return (
                <button
                  key={partKey}
                  type="button"
                  onClick={() => setActivePart(partKey)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[#FCFAF6] text-[#241811] shadow-xs'
                      : 'text-[#DFCFA8] hover:text-[#FCFAF6]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusIndicatorColor}`} />
                  <span className="capitalize">{t.parts[partKey]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Subheader: Assignment Range & Live Counter - Compact height */}
      <div className="bg-[#F8F4EC] border-b border-[#DFCFA8] px-3 sm:px-4 py-1.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Assigned Range summary */}
          {currentPartPlan ? (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-[#42362E] truncate">
              <span className="font-bold text-[#241811]">{t.assignedRange}:</span>
              <span className="font-mono text-[#241811]">
                {t.page} {currentPartPlan.range.start.page} {t.line} {currentPartPlan.range.start.line} {t.to} {t.page} {currentPartPlan.range.end.page} {t.line} {currentPartPlan.range.end.line}
              </span>
              <span className="text-[#C5A059]">·</span>
              <span className="font-bold text-[#1F4E3D] bg-[#E8F0EC] px-1.5 py-0.2 rounded border border-[#1F4E3D]/30 text-[11px]">
                {currentPartPlan.range.linesCount} {t.linesCount}
              </span>
            </div>
          ) : (
            <div className="text-xs text-[#7A6C60] italic">No plan set for {t.parts[activePart]} today</div>
          )}

          {/* Live Counter & Limit Indicator */}
          <div
            className={`flex items-center gap-2 sm:gap-2.5 px-2.5 py-1 rounded-lg border text-xs transition-colors shadow-2xs ${
              isLimitReached
                ? 'bg-rose-100 border-rose-400 text-rose-950 font-bold animate-pulse'
                : 'bg-[#FCFAF6] border-[#DFCFA8] text-[#241811]'
            }`}
          >
            <div className="flex items-center gap-2 font-mono text-[11px] sm:text-xs">
              <span className={ghaltiCount >= ghaltiLimit ? 'text-[#B91C1C] font-extrabold' : 'text-[#241811]'}>
                {t.ghaltiShort}: <strong className="text-xs sm:text-sm">{ghaltiCount}</strong>/{ghaltiLimit}
              </span>
              <span className="text-[#C5A059]">|</span>
              <span className={atkanCount >= atkanLimit ? 'text-[#D97706] font-extrabold' : 'text-[#241811]'}>
                {t.atkanShort}: <strong className="text-xs sm:text-sm">{atkanCount}</strong>/{atkanLimit}
              </span>
            </div>

            <span className="text-[#C5A059] text-[10px]">۞</span>

            {/* Suggested Result Notice */}
            <div className="flex items-center gap-1 text-[11px]">
              {isLimitReached ? (
                <span className="flex items-center gap-1 text-[#B91C1C] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#B91C1C]" />
                  <span>{t.limitReachedWarning}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#1F4E3D] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1F4E3D]" />
                  <span>{t.withinLimitNotice}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Mushaf Listening Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-2 sm:p-3 flex flex-col items-center">
        {currentPartPlan ? (
          <MushafViewer
            pageNumber={currentPage}
            onPageChange={setCurrentPage}
            highlightRange={currentPartPlan.range}
            interactiveMode="marking"
            activeMarkTool={activeTool}
            currentMarks={sessionMarks}
            onWordClick={handleWordClick}
            language={state.language}
          />
        ) : (
          <div className="p-8 text-center text-[#7A6C60] bg-[#FCFAF6] rounded-2xl border border-[#DFCFA8] my-8 shadow-xs">
            <BookOpen className="w-10 h-10 text-[#C5A059] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#241811]">Please assign work for this student first.</p>
          </div>
        )}

        {/* List of Marked Words in this session */}
        {sessionMarks.length > 0 && (
          <div className="w-full max-w-4xl mt-3 bg-[#FCFAF6] border border-[#DFCFA8] rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#241811] uppercase tracking-wide flex items-center gap-1.5">
                <span className="text-[#C5A059]">✦</span>
                <span>{t.markedWordsList} ({sessionMarks.length})</span>
              </span>
              <span className="text-[11px] text-[#7A6C60]">
                {t.tapWordToMarkHelp}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sessionMarks.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setCurrentPage(m.page)}
                  className={`px-2 py-1 rounded text-xs border font-mono flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                    m.type === 'ghalti'
                      ? 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100'
                      : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  <span className="font-bold">
                    {m.type === 'ghalti' ? (state.language === 'ur' ? 'غلطی' : 'Ghalti') : (state.language === 'ur' ? 'اٹکن' : 'Atkan')}
                  </span>
                  <span>P{m.page}:L{m.line}:W{m.wordIndex}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSessionMarks(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="ml-0.5 text-stone-400 hover:text-stone-900 font-bold px-1"
                    title="Remove mark"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Compact Sticky Bottom Marking Toolbar - Sleek single-row layout that does not cover the Mushaf */}
      <div className="fixed bottom-0 inset-x-0 bg-[#241811]/95 backdrop-blur-md border-t border-[#C5A059] shadow-xl px-2.5 sm:px-4 py-1.5 sm:py-2 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Left Group: Marking Tools (Ghalti, Atkan, Undo) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Ghalti Button */}
            <button
              type="button"
              onClick={() => setActiveTool('ghalti')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer shadow-2xs min-h-[34px] sm:min-h-[36px] ${
                activeTool === 'ghalti'
                  ? 'bg-[#B91C1C] text-white ring-2 ring-rose-400 scale-[1.02]'
                  : 'bg-[#3E2B20] text-rose-200 border border-rose-800 hover:bg-rose-950/80'
              }`}
              title="Mark Ghalti (Mistake)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-current shrink-0" />
              <span className="whitespace-nowrap">{t.ghaltiButton}</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-black/35 font-extrabold text-white">
                {ghaltiCount}
              </span>
            </button>

            {/* Atkan Button */}
            <button
              type="button"
              onClick={() => setActiveTool('atkan')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer shadow-2xs min-h-[34px] sm:min-h-[36px] ${
                activeTool === 'atkan'
                  ? 'bg-[#D97706] text-white ring-2 ring-amber-400 scale-[1.02]'
                  : 'bg-[#3E2B20] text-amber-200 border border-amber-800 hover:bg-amber-950/80'
              }`}
              title="Mark Atkan (Hesitation)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-current shrink-0" />
              <span className="whitespace-nowrap">{t.atkanButton}</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-black/35 font-extrabold text-white">
                {atkanCount}
              </span>
            </button>

            {/* Undo Last Mark Button */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={sessionMarks.length === 0}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg border border-[#C5A059]/40 bg-[#2E2017] text-[#DFCFA8] hover:bg-[#3A291E] hover:text-[#FCFAF6] disabled:opacity-30 transition-colors cursor-pointer text-xs font-semibold min-h-[34px] sm:min-h-[36px]"
              title={t.undo}
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">{t.undo}</span>
            </button>
          </div>

          {/* Center divider */}
          <div className="h-5 w-px bg-[#C5A059]/30 hidden xs:block" />

          {/* Right Group: Finalize Actions (Repeat, Passed) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Mark Repeat Button */}
            <button
              type="button"
              onClick={() => handleFinalize('repeat')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs min-h-[34px] sm:min-h-[36px] ${
                suggestedResult === 'repeat'
                  ? 'bg-[#B91C1C] text-white hover:bg-[#991B1B] ring-2 ring-rose-400'
                  : 'bg-[#2E2017] border border-rose-700/80 text-rose-300 hover:bg-rose-950/60'
              }`}
              title="Mark Repeat"
            >
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{t.repeatButton}</span>
              {suggestedResult === 'repeat' && (
                <span className="hidden md:inline text-[10px] text-rose-200 font-normal">
                  (Suggested)
                </span>
              )}
            </button>

            {/* Mark Passed Button */}
            <button
              type="button"
              onClick={() => handleFinalize('passed')}
              className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs min-h-[34px] sm:min-h-[36px] ${
                suggestedResult === 'passed'
                  ? 'bg-[#1F4E3D] text-white hover:bg-[#16382C] ring-2 ring-emerald-400 border border-[#C5A059]'
                  : 'bg-[#2E2017] border border-[#2E6A54] text-emerald-300 hover:bg-emerald-950/60'
              }`}
              title="Mark Passed"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#DFCFA8] shrink-0" />
              <span className="whitespace-nowrap">{t.passButton}</span>
              {suggestedResult === 'passed' && (
                <span className="hidden md:inline text-[10px] text-emerald-200 font-normal">
                  (Suggested)
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
