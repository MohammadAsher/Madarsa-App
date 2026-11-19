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
  BookOpen,
  X
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
import { StudentTypeBadge } from './StudentTypeBadge';
import { MushafWord, getParaSurahName, getParaPageRange } from '../data/quranData';
import {
  getManzilParasFromPlan,
  getMarkParaNumber,
  getValidatedManzilParasForStudent,
  isWholeParaManzilPlan,
} from '../services/hifzService';
import { translations } from '../i18n/translations';

interface UstaadMarkingScreenProps {
  state: MadrasaState;
  student: StudentProfile;
  initialPart?: PartType;
  targetDate?: string;
  onBack: () => void;
  onSaveSession: (result: SessionResult, updatedMarks: MistakeMark[]) => void;
  onUpdateMushafSettings?: (patch: {
    mushafLayout?: 'hafizi' | 'madinah';
    mushafScript?: 'indopak' | 'uthmani';
    highContrastMushaf?: boolean;
  }) => void;
}

export const UstaadMarkingScreen: React.FC<UstaadMarkingScreenProps> = ({
  state,
  student,
  initialPart = 'sabaq',
  targetDate,
  onBack,
  onSaveSession,
  onUpdateMushafSettings,
}) => {
  const isNazra = student.studentType === 'nazra';
  const [activePart, setActivePart] = useState<PartType>(isNazra ? 'sabaq' : initialPart);
  const effectivePart: PartType = isNazra ? 'sabaq' : activePart;
  const [activeTool, setActiveTool] = useState<MistakeType>('ghalti');
  const t = translations[state.language];
  const activeDate = targetDate || state.currentDate;

  // Retrieve plan for this student on activeDate
  const todayPlan = state.dailyPlans[student.id]?.[activeDate];
  const currentPartPlan = todayPlan ? todayPlan[effectivePart] : null;

  const activeLayout = student.mushafLayout || state.settings.mushafLayout || 'madinah';

  // Active page state in Mushaf viewer
  const [currentPage, setCurrentPage] = useState<number>(
    currentPartPlan?.range?.start.page || getParaPageRange(student.currentJuz || 1, activeLayout).startPage
  );
  const [activeManzilPara, setActiveManzilPara] = useState<number | null>(null);

  // Sync current page when active part, student, or date changes
  useEffect(() => {
    setActiveManzilPara(null);
    if (currentPartPlan?.range) {
      setCurrentPage(currentPartPlan.range.start.page);
    } else {
      setCurrentPage(getParaPageRange(student.currentJuz || 1, activeLayout).startPage);
    }
  }, [effectivePart, student.id, activeDate]);

  // Session marks created during this grading session
  const existingMarks = state.marksHistory.filter(
    m => m.studentId === student.id && m.date === activeDate && m.part === effectivePart
  );

  const [sessionMarks, setSessionMarks] = useState<MistakeMark[]>(existingMarks);

  // When switching parts, reload existing marks
  useEffect(() => {
    const marksForPart = state.marksHistory.filter(
      m => m.studentId === student.id && m.date === activeDate && m.part === effectivePart
    );
    setSessionMarks(marksForPart);
  }, [effectivePart, student.id, activeDate, state.marksHistory]);

  // Calculate live limits and counts
  const limits = getEffectiveLimits(student.id, state);
  const ghaltiLimit = limits[`${effectivePart}GhaltiLimit` as keyof typeof limits];
  const atkanLimit = limits[`${effectivePart}AtkanLimit` as keyof typeof limits];

  const ghaltiCount = sessionMarks.filter(m => m.type === 'ghalti').length;
  const atkanCount = sessionMarks.filter(m => m.type === 'atkan').length;

  const isLimitReached = ghaltiCount >= ghaltiLimit || atkanCount >= atkanLimit;
  const suggestedResult: 'passed' | 'repeat' = isLimitReached ? 'repeat' : 'passed';

  // Per-para breakdown when grading Manzil (strictly validated against completedParas)
  const manzilParas =
    effectivePart === 'manzil'
      ? getValidatedManzilParasForStudent(student, currentPartPlan)
      : [];
  const isWholeParaManzil =
    effectivePart === 'manzil' && isWholeParaManzilPlan(currentPartPlan);
  const isMultiParaManzil = effectivePart === 'manzil' && manzilParas.length > 1;
  const hasValidCurrentPartRange =
    effectivePart === 'manzil'
      ? Boolean(currentPartPlan?.range) && manzilParas.length > 0
      : Boolean(currentPartPlan?.range);

  const getParaStats = (paraNum: number) => {
    const marksInPara = sessionMarks.filter(m => getMarkParaNumber(m) === paraNum);
    const paraGhalti = marksInPara.filter(m => m.type === 'ghalti').length;
    const paraAtkan = marksInPara.filter(m => m.type === 'atkan').length;
    const suggested: 'passed' | 'repeat' =
      paraGhalti >= ghaltiLimit || paraAtkan >= atkanLimit ? 'repeat' : 'passed';
    return {
      paraNum,
      ghaltiCount: paraGhalti,
      atkanCount: paraAtkan,
      suggested,
    };
  };

  const [showManzilSummaryModal, setShowManzilSummaryModal] = useState(false);
  const [draftParaResults, setDraftParaResults] = useState<Record<number, 'passed' | 'repeat'>>({});

  useEffect(() => {
    setShowManzilSummaryModal(false);
  }, [effectivePart, student.id, activeDate]);

  const handleOpenManzilSummary = () => {
    const initialDraft: Record<number, 'passed' | 'repeat'> = {};
    for (const p of manzilParas) {
      initialDraft[p] = getParaStats(p).suggested;
    }
    setDraftParaResults(initialDraft);
    setShowManzilSummaryModal(true);
  };

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
        date: activeDate,
        part: effectivePart,
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

  // Finalize session with result (Pass or Repeat) for Sabaq, Sabqi, or 1-Para Manzil
  const handleFinalize = (chosenResult: 'passed' | 'repeat') => {
    if (!currentPartPlan || !currentPartPlan.range) return;

    const singleParaResults: Record<number, 'passed' | 'repeat'> | undefined =
      effectivePart === 'manzil' && manzilParas.length === 1
        ? { [manzilParas[0]]: chosenResult }
        : undefined;

    const sessionResult: SessionResult = {
      id: `res_${student.id}_${activeDate}_${effectivePart}_${Date.now()}`,
      studentId: student.id,
      date: activeDate,
      part: effectivePart,
      ghaltiCount,
      atkanCount,
      ghaltiLimit,
      atkanLimit,
      suggestedResult,
      finalResult: chosenResult,
      isOverridden: chosenResult !== suggestedResult,
      marks: sessionMarks,
      range: currentPartPlan.range,
      ...(singleParaResults ? { paraResults: singleParaResults } : {}),
      timestamp: Date.now(),
    };

    onSaveSession(sessionResult, sessionMarks);
  };

  // Finalize multi-para Manzil with per-para Pass / Repeat decisions
  const handleConfirmManzilResults = () => {
    if (!currentPartPlan || !currentPartPlan.range || manzilParas.length === 0) return;

    const perParaStats = manzilParas.map(getParaStats);
    const overallSuggested: 'passed' | 'repeat' = perParaStats.some(
      s => s.suggested === 'repeat'
    )
      ? 'repeat'
      : 'passed';

    const finalizedParaResults: Record<number, 'passed' | 'repeat'> = {};
    for (const p of manzilParas) {
      finalizedParaResults[p] = draftParaResults[p] || 'passed';
    }

    const anyRepeat = manzilParas.some(p => finalizedParaResults[p] === 'repeat');
    const chosenResult: 'passed' | 'repeat' = anyRepeat ? 'repeat' : 'passed';
    const isOverridden = perParaStats.some(
      s => finalizedParaResults[s.paraNum] !== s.suggested
    );

    const sessionResult: SessionResult = {
      id: `res_${student.id}_${activeDate}_${effectivePart}_${Date.now()}`,
      studentId: student.id,
      date: activeDate,
      part: effectivePart,
      ghaltiCount,
      atkanCount,
      ghaltiLimit,
      atkanLimit,
      suggestedResult: overallSuggested,
      finalResult: chosenResult,
      isOverridden,
      marks: sessionMarks,
      range: currentPartPlan.range,
      paraResults: finalizedParaResults,
      timestamp: Date.now(),
    };

    setShowManzilSummaryModal(false);
    onSaveSession(sessionResult, sessionMarks);
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#FAF6EF] bg-islamic-pattern pb-32 md:pb-20">
      {/* Top Navigation & Student Header Bar - wraps cleanly on mobile */}
      <header className="sticky top-0 z-30 w-full bg-[#241811] text-[#FCFAF6] border-b border-[#C5A059] px-2.5 sm:px-4 py-2 shadow-sm">
        <div className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Direct Back to Halqa button */}
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-[#C5A059]/40 bg-[#2E2017] hover:bg-[#3A291E] active:scale-95 text-[#FCFAF6] text-xs font-semibold transition-colors cursor-pointer shadow-xs min-h-[34px] shrink-0"
              title={t.backToDashboard}
              aria-label={t.backToDashboard}
            >
              <ArrowLeft className="w-4 h-4 text-[#C5A059] shrink-0" />
              <span className="hidden sm:inline">{t.backToDashboard}</span>
            </button>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-[#FCFAF6] text-xs sm:text-base truncate">
                {state.language === 'ur' ? student.urduName : student.name}
              </span>
              <StudentTypeBadge
                type={student.studentType || 'hifz'}
                language={state.language}
                size="xs"
              />
              <span className="text-[#C5A059] hidden sm:inline">۞</span>
              <span className="text-[#DFCFA8] text-xs hidden md:inline truncate">
                {student.halqaName}
              </span>
              <span className="font-mono text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-[#2E2017] border border-[#C5A059]/40 text-[#DFCFA8] shrink-0">
                {activeDate}
              </span>
            </div>
          </div>

          {/* Part Switcher Tabs */}
          <div className="flex items-center p-0.5 bg-[#2E2017] rounded-lg border border-[#C5A059]/40 shrink-0">
            {(isNazra ? (['sabaq'] as PartType[]) : (['sabaq', 'sabqi', 'manzil'] as PartType[])).map(partKey => {
              const isActive = effectivePart === partKey;
              const partStatus = todayPlan ? todayPlan[partKey]?.status : 'pending';
              
              let statusIndicatorColor = 'bg-[#7A6C60]';
              if (partStatus === 'passed') statusIndicatorColor = 'bg-[#2E6A54]';
              if (partStatus === 'repeat') statusIndicatorColor = 'bg-[#B91C1C]';

              return (
                <button
                  key={partKey}
                  type="button"
                  onClick={() => setActivePart(partKey)}
                  className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                    isActive
                      ? 'bg-[#FCFAF6] text-[#241811] shadow-xs'
                      : 'text-[#DFCFA8] hover:text-[#FCFAF6]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${statusIndicatorColor}`} />
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
          {currentPartPlan?.range ? (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-[#42362E] truncate">
              <span className="font-bold text-[#241811]">{t.assignedRange}:</span>
              <span className="font-mono text-[#241811]">
                {effectivePart === 'manzil' &&
                currentPartPlan.assignedParas &&
                currentPartPlan.assignedParas.length > 1
                  ? `Para ${currentPartPlan.assignedParas.join(', ')}`
                  : `${t.page} ${currentPartPlan.range.start.page} ${t.line} ${currentPartPlan.range.start.line} ${t.to} ${t.page} ${currentPartPlan.range.end.page} ${t.line} ${currentPartPlan.range.end.line}`}
              </span>
              <span className="text-[#C5A059]">·</span>
              <span className="font-bold text-[#1F4E3D] bg-[#E8F0EC] px-1.5 py-0.2 rounded border border-[#1F4E3D]/30 text-[11px]">
                {currentPartPlan.range.linesCount} {t.linesCount}
              </span>
            </div>
          ) : (
            <div className="text-xs text-[#78350F] font-semibold">
              {effectivePart === 'sabaq' ? t.sabaqNotAssignedYet : `No plan set for ${t.parts[effectivePart]} today`}
            </div>
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

      {/* Subheader quick bar for Multi-Para Manzil navigation & per-para live count */}
      {isMultiParaManzil && (
        <div className="bg-[#FAF6EF] border-b border-[#DFCFA8] px-3 sm:px-4 py-1.5">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold text-[#5A4333] mr-1">
              {state.language === 'ur' ? 'مقررہ پارے:' : 'Assigned Paras:'}
            </span>
            {manzilParas.map(pNum => {
              const stats = getParaStats(pNum);
              const { startPage, endPage } = getParaPageRange(pNum, activeLayout);
              const isInPara =
                activeManzilPara !== null
                  ? activeManzilPara === pNum
                  : currentPage >= startPage && currentPage <= endPage;
              return (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => {
                    setActiveManzilPara(pNum);
                    setCurrentPage(startPage);
                  }}
                  className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    isInPara
                      ? 'bg-[#241811] text-[#FCFAF6] border-[#C5A059]'
                      : stats.suggested === 'repeat'
                      ? 'bg-rose-50 text-[#991B1B] border-rose-300 hover:bg-rose-100'
                      : 'bg-[#FCFAF6] text-[#1F4E3D] border-[#DFCFA8] hover:bg-[#F3ECE1]'
                  }`}
                >
                  <span>
                    {state.language === 'ur' ? `پارہ ${pNum}` : `Para ${pNum}`}
                  </span>
                  <span className="opacity-80">
                    ({stats.ghaltiCount}G · {stats.atkanCount}A)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Mushaf Listening Workspace */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-1.5 sm:px-3 py-2 flex flex-col items-center">
        {currentPartPlan?.range && hasValidCurrentPartRange ? (
          <MushafViewer
            pageNumber={currentPage}
            onPageChange={setCurrentPage}
            highlightRange={isWholeParaManzil ? undefined : currentPartPlan.range}
            highlightRanges={undefined}
            manzilHeaderPara={
              isWholeParaManzil ? activeManzilPara ?? manzilParas[0] ?? null : null
            }
            activeParaNumber={
              effectivePart === 'manzil' ? activeManzilPara ?? manzilParas[0] ?? null : null
            }
            interactiveMode="marking"
            activeMarkTool={activeTool}
            currentMarks={sessionMarks}
            onWordClick={handleWordClick}
            language={state.language}
            mushafLayout={activeLayout}
            onLayoutChange={l => onUpdateMushafSettings?.({ mushafLayout: l })}
            mushafScript={state.settings.mushafScript || 'indopak'}
            onScriptChange={s => onUpdateMushafSettings?.({ mushafScript: s })}
            highContrast={Boolean(state.settings.highContrastMushaf)}
            onToggleHighContrast={() =>
              onUpdateMushafSettings?.({ highContrastMushaf: !state.settings.highContrastMushaf })
            }
          />
        ) : (
          <div className="p-8 text-center text-[#7A6C60] bg-[#FCFAF6] rounded-2xl border border-[#DFCFA8] my-8 shadow-xs">
            <BookOpen className="w-10 h-10 text-[#C5A059] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#241811]">
              {effectivePart === 'sabaq'
                ? t.sabaqNotAssignedYet
                : effectivePart === 'manzil' && (student.completedParas?.length || 0) === 0
                ? t.noCompletedParasYet
                : 'No assignment set for this part yet.'}
            </p>
            <p className="text-xs text-[#7A6C60] mt-1">
              Return to the Halqa dashboard to assign completed work on the Mushaf first.
            </p>
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

      {/* Compact Sticky Bottom Marking Toolbar - Fits cleanly at 360px+ without overflow */}
      <div className="fixed bottom-0 inset-x-0 w-full bg-[#241811]/95 backdrop-blur-md border-t border-[#C5A059] shadow-xl px-2 sm:px-4 py-1.5 sm:py-2 z-40">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-1.5 sm:gap-3">
          {/* Left Group: Marking Tools (Ghalti, Atkan, Undo) */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Ghalti Button */}
            <button
              type="button"
              onClick={() => setActiveTool('ghalti')}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg font-bold text-[11px] sm:text-xs transition-all cursor-pointer shadow-2xs min-h-[34px] sm:min-h-[36px] ${
                activeTool === 'ghalti'
                  ? 'bg-[#B91C1C] text-white ring-2 ring-rose-400 scale-[1.02]'
                  : 'bg-[#3E2B20] text-rose-200 border border-rose-800 hover:bg-rose-950/80'
              }`}
              title="Mark Ghalti (Mistake)"
            >
              <span className="w-2 h-2 rounded-full bg-current shrink-0" />
              <span className="sm:hidden whitespace-nowrap">{t.ghaltiShort}</span>
              <span className="hidden sm:inline whitespace-nowrap">{t.ghaltiButton}</span>
              <span className="text-[10px] sm:text-[11px] font-mono px-1 rounded bg-black/35 font-extrabold text-white">
                {ghaltiCount}
              </span>
            </button>

            {/* Atkan Button */}
            <button
              type="button"
              onClick={() => setActiveTool('atkan')}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg font-bold text-[11px] sm:text-xs transition-all cursor-pointer shadow-2xs min-h-[34px] sm:min-h-[36px] ${
                activeTool === 'atkan'
                  ? 'bg-[#D97706] text-white ring-2 ring-amber-400 scale-[1.02]'
                  : 'bg-[#3E2B20] text-amber-200 border border-amber-800 hover:bg-amber-950/80'
              }`}
              title="Mark Atkan (Hesitation)"
            >
              <span className="w-2 h-2 rounded-full bg-current shrink-0" />
              <span className="sm:hidden whitespace-nowrap">{t.atkanShort}</span>
              <span className="hidden sm:inline whitespace-nowrap">{t.atkanButton}</span>
              <span className="text-[10px] sm:text-[11px] font-mono px-1 rounded bg-black/35 font-extrabold text-white">
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
              aria-label={t.undo}
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">{t.undo}</span>
            </button>
          </div>

          {/* Right Group: Finalize Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {isMultiParaManzil ? (
              <button
                type="button"
                disabled={!currentPartPlan?.range}
                onClick={handleOpenManzilSummary}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs min-h-[34px] sm:min-h-[36px] bg-[#1F4E3D] text-white hover:bg-[#16382C] ring-2 ring-[#C5A059]"
                title={t.finishManzilButton}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#DFCFA8] shrink-0" />
                <span className="whitespace-nowrap">
                  {t.finishManzilButton} ({manzilParas.length})
                </span>
              </button>
            ) : (
              <>
                {/* Mark Repeat Button */}
                <button
                  type="button"
                  disabled={!currentPartPlan?.range}
                  onClick={() => handleFinalize('repeat')}
                  className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs min-h-[34px] sm:min-h-[36px] ${
                    suggestedResult === 'repeat'
                      ? 'bg-[#B91C1C] text-white hover:bg-[#991B1B] ring-2 ring-rose-400'
                      : 'bg-[#2E2017] border border-rose-700/80 text-rose-300 hover:bg-rose-950/60'
                  }`}
                  title="Mark Repeat"
                >
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="sm:hidden whitespace-nowrap">{t.status.repeat}</span>
                  <span className="hidden sm:inline whitespace-nowrap">{t.repeatButton}</span>
                </button>

                {/* Mark Passed Button */}
                <button
                  type="button"
                  disabled={!currentPartPlan?.range}
                  onClick={() => handleFinalize('passed')}
                  className={`flex items-center gap-1 px-2 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs min-h-[34px] sm:min-h-[36px] ${
                    suggestedResult === 'passed'
                      ? 'bg-[#1F4E3D] text-white hover:bg-[#16382C] ring-2 ring-emerald-400 border border-[#C5A059]'
                      : 'bg-[#2E2017] border border-[#2E6A54] text-emerald-300 hover:bg-emerald-950/60'
                  }`}
                  title="Mark Passed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#DFCFA8] shrink-0" />
                  <span className="sm:hidden whitespace-nowrap">{state.language === 'ur' ? 'پاس' : 'Pass'}</span>
                  <span className="hidden sm:inline whitespace-nowrap">{t.passButton}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Para Manzil Para-by-Para Grading Modal */}
      {showManzilSummaryModal && isMultiParaManzil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-xl overflow-hidden my-auto">
            <div className="px-5 py-3.5 bg-[#241811] text-[#FCFAF6] border-b-2 border-[#C5A059] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span>{t.manzilPerParaTitle}</span>
                  <span className="text-[#C5A059] text-xs">۞</span>
                </h3>
                <p className="text-[11px] text-[#DFCFA8] mt-0.5">{t.manzilPerParaHelp}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowManzilSummaryModal(false)}
                className="p-1.5 text-[#DFCFA8] hover:text-[#FCFAF6] hover:bg-[#3E2B20] rounded-xl cursor-pointer"
                aria-label={t.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-2.5 max-h-[65vh] overflow-y-auto">
              {manzilParas.map(pNum => {
                const stats = getParaStats(pNum);
                const chosen = draftParaResults[pNum] || stats.suggested;
                const isRepeatChosen = chosen === 'repeat';

                return (
                  <div
                    key={pNum}
                    className={`p-3 rounded-xl border-2 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                      isRepeatChosen
                        ? 'bg-[#FDF2F2] border-[#B91C1C]/60'
                        : 'bg-[#EBF3EE] border-[#2E6A54]/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-[#241811]">
                          {state.language === 'ur' ? `پارہ ${pNum}` : `Para ${pNum}`}
                        </span>
                        <span className="text-xs text-[#5A4333]">
                          ({getParaSurahName(pNum)})
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            stats.suggested === 'repeat'
                              ? 'bg-rose-100 text-[#991B1B] border-rose-300'
                              : 'bg-emerald-100 text-[#143429] border-emerald-300'
                          }`}
                        >
                          {t.systemSuggested}:{' '}
                          {stats.suggested === 'repeat'
                            ? state.language === 'ur'
                              ? 'دہرائیں'
                              : 'Repeat'
                            : state.language === 'ur'
                            ? 'پاس'
                            : 'Pass'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-[#42362E] mt-1">
                        {t.ghaltiShort}: <strong>{stats.ghaltiCount}</strong>/{ghaltiLimit} ·{' '}
                        {t.atkanShort}: <strong>{stats.atkanCount}</strong>/{atkanLimit}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setDraftParaResults(prev => ({ ...prev, [pNum]: 'passed' }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all min-h-[36px] ${
                          chosen === 'passed'
                            ? 'bg-[#1F4E3D] text-white border border-[#143429] shadow-xs ring-2 ring-emerald-400/70'
                            : 'bg-white text-[#1F4E3D] border border-[#2E6A54]/40 hover:bg-emerald-50'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{state.language === 'ur' ? 'پاس' : 'Pass'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDraftParaResults(prev => ({ ...prev, [pNum]: 'repeat' }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all min-h-[36px] ${
                          chosen === 'repeat'
                            ? 'bg-[#B91C1C] text-white border border-[#7F1D1D] shadow-xs ring-2 ring-rose-400/70'
                            : 'bg-white text-[#B91C1C] border border-[#B91C1C]/40 hover:bg-rose-50'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{t.status.repeat}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3.5 border-t border-[#DFCFA8] bg-[#F8F4EC] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowManzilSummaryModal(false)}
                className="px-4 py-2 rounded-xl border border-[#DFCFA8] bg-[#FCFAF6] hover:bg-[#F3ECE1] text-xs font-semibold text-[#42362E] cursor-pointer"
              >
                {t.close}
              </button>
              <button
                type="button"
                onClick={handleConfirmManzilResults}
                className="px-5 py-2 rounded-xl bg-[#241811] hover:bg-[#38271D] text-[#FCFAF6] border border-[#C5A059] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4 text-[#C5A059]" />
                <span>{t.saveManzilResults}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
