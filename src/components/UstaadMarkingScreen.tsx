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
  Sparkles,
  BookOpen,
  Info
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
  // Filter existing marks for this student, date, and part if any already exist
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
    // Check if word already marked
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
    <div className="flex flex-col min-h-screen bg-stone-50 pb-24">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200 px-4 py-2.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs md:text-sm font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.backToDashboard}</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 text-base md:text-lg">
                  {state.language === 'ur' ? student.urduName : student.name}
                </span>
                <span className="text-stone-400 text-xs hidden md:inline">·</span>
                <span className="text-stone-500 text-xs hidden md:inline">
                  {student.halqaName}
                </span>
              </div>
              <div className="text-xs text-stone-500">
                {state.currentDate} · {t.dayCounter} {state.dayCount}
              </div>
            </div>
          </div>

          {/* Part Switcher Tabs */}
          <div className="flex items-center p-1 bg-stone-100 rounded-lg border border-stone-200">
            {(['sabaq', 'sabqi', 'manzil'] as PartType[]).map(partKey => {
              const isActive = activePart === partKey;
              const partStatus = todayPlan ? todayPlan[partKey]?.status : 'pending';
              
              let statusIndicatorColor = 'bg-stone-300';
              if (partStatus === 'passed') statusIndicatorColor = 'bg-emerald-500';
              if (partStatus === 'repeat') statusIndicatorColor = 'bg-rose-500';

              return (
                <button
                  key={partKey}
                  type="button"
                  onClick={() => setActivePart(partKey)}
                  className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-white text-stone-900 shadow-xs font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusIndicatorColor}`} />
                  <span>{t.parts[partKey]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Subheader: Assignment Range & Live Counter */}
      <div className="bg-stone-100 border-b border-stone-200 px-4 py-2">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Assigned Range summary */}
          {currentPartPlan ? (
            <div className="flex items-center gap-2 text-xs md:text-sm text-stone-700">
              <span className="font-semibold text-stone-900">{t.assignedRange}:</span>
              <span className="font-mono text-stone-800">
                {t.page} {currentPartPlan.range.start.page} {t.line} {currentPartPlan.range.start.line} {t.to} {t.page} {currentPartPlan.range.end.page} {t.line} {currentPartPlan.range.end.line}
              </span>
              <span className="text-stone-400">·</span>
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {currentPartPlan.range.linesCount} {t.linesCount}
              </span>
            </div>
          ) : (
            <div className="text-xs text-stone-500 italic">No plan set for {t.parts[activePart]} today</div>
          )}

          {/* Live Counter & Limit Indicator */}
          <div
            className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border text-xs md:text-sm transition-colors ${
              isLimitReached
                ? 'bg-rose-100 border-rose-300 text-rose-950 font-bold animate-pulse'
                : 'bg-white border-stone-200 text-stone-800'
            }`}
          >
            <div className="flex items-center gap-2 font-mono">
              <span className={ghaltiCount >= ghaltiLimit ? 'text-rose-700 font-extrabold' : 'text-stone-700'}>
                {t.ghaltiShort}: <strong className="text-sm">{ghaltiCount}</strong>/{ghaltiLimit}
              </span>
              <span className="text-stone-300">|</span>
              <span className={atkanCount >= atkanLimit ? 'text-amber-700 font-extrabold' : 'text-stone-700'}>
                {t.atkanShort}: <strong className="text-sm">{atkanCount}</strong>/{atkanLimit}
              </span>
            </div>

            <span className="text-stone-300">·</span>

            {/* Suggested Result Notice */}
            <div className="flex items-center gap-1">
              {isLimitReached ? (
                <span className="flex items-center gap-1 text-rose-700 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  {t.limitReachedWarning}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {t.withinLimitNotice}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Mushaf Listening Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-2 md:p-4 flex flex-col items-center">
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
          <div className="p-12 text-center text-stone-500 bg-white rounded-xl border border-stone-200 my-8">
            <BookOpen className="w-12 h-12 text-stone-400 mx-auto mb-3" />
            <p className="text-base font-medium">Please assign work for this student first.</p>
          </div>
        )}

        {/* List of Marked Words in this session */}
        {sessionMarks.length > 0 && (
          <div className="w-full max-w-4xl mt-4 bg-white border border-stone-200 rounded-xl p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
                {t.markedWordsList} ({sessionMarks.length})
              </span>
              <span className="text-[11px] text-stone-500">
                {t.tapWordToMarkHelp}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sessionMarks.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    // Navigate to this page and select
                    setCurrentPage(m.page);
                  }}
                  className={`px-2 py-1 rounded text-xs border font-mono flex items-center gap-1.5 cursor-pointer transition-colors ${
                    m.type === 'ghalti'
                      ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                      : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
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
                    className="ml-1 text-stone-400 hover:text-stone-700 font-bold"
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

      {/* Floating Bottom Marking Workbench (Large Touch Targets for Tablet & Phone) */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-stone-300 shadow-xl px-4 py-3 z-40">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Active Tool Selector Buttons: Ghalti (Red) & Atkan (Orange) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTool('ghalti')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer shadow-xs min-h-[44px] ${
                activeTool === 'ghalti'
                  ? 'bg-rose-600 text-white ring-3 ring-rose-300 scale-105'
                  : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-current" />
              <span>{t.ghaltiButton}</span>
              <span className="text-xs opacity-80 font-mono">({ghaltiCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('atkan')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer shadow-xs min-h-[44px] ${
                activeTool === 'atkan'
                  ? 'bg-amber-500 text-white ring-3 ring-amber-300 scale-105'
                  : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-current" />
              <span>{t.atkanButton}</span>
              <span className="text-xs opacity-80 font-mono">({atkanCount})</span>
            </button>

            {/* Undo Button */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={sessionMarks.length === 0}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 disabled:opacity-40 transition-colors cursor-pointer text-xs md:text-sm font-medium min-h-[44px]"
              title={t.undo}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">{t.undo}</span>
            </button>
          </div>

          {/* Finalize Action Buttons: Pass & Repeat */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 hidden md:inline">
              {t.systemSuggested}: <strong>{suggestedResult === 'passed' ? t.passButton : t.repeatButton}</strong>
            </span>

            {/* Repeat Button */}
            <button
              type="button"
              onClick={() => handleFinalize('repeat')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer shadow-xs min-h-[44px] ${
                suggestedResult === 'repeat'
                  ? 'bg-rose-600 text-white hover:bg-rose-700 ring-2 ring-rose-400'
                  : 'bg-white border border-rose-300 text-rose-700 hover:bg-rose-50'
              }`}
            >
              <XCircle className="w-4 h-4" />
              <span>{t.repeatButton}</span>
            </button>

            {/* Pass Button */}
            <button
              type="button"
              onClick={() => handleFinalize('passed')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer shadow-xs min-h-[44px] ${
                suggestedResult === 'passed'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-400'
                  : 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t.passButton}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
