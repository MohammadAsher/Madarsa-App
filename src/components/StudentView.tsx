/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  EyeOff, 
  RotateCcw, 
  Plus, 
  AlertTriangle,
  Award,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  BookmarkCheck
} from 'lucide-react';
import { 
  MadrasaState, 
  StudentProfile, 
  PartType, 
  SessionResult, 
  MistakeMark 
} from '../types/hifz';
import { MushafViewer } from './MushafViewer';
import { translations } from '../i18n/translations';

interface StudentViewProps {
  state: MadrasaState;
  student: StudentProfile;
  onUpdateState: (updater: (prev: MadrasaState) => MadrasaState) => void;
  targetJumpWord?: { page: number; wordId: string } | null;
  onClearTargetJumpWord?: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  state,
  student,
  onUpdateState,
  targetJumpWord,
  onClearTargetJumpWord,
}) => {
  const t = translations[state.language];

  // Retrieve today's plan
  const todayPlan = state.dailyPlans[student.id]?.[state.currentDate];
  
  // Selected part for viewing on the Mushaf
  const [activePart, setActivePart] = useState<PartType>('sabaq');

  // Mushaf page navigation
  const currentPartPlan = todayPlan ? todayPlan[activePart] : null;
  const [currentPage, setCurrentPage] = useState<number>(
    targetJumpWord?.page || currentPartPlan?.range.start.page || 1
  );

  // Hide & reveal practice mode state
  const [hideAndRevealActive, setHideAndRevealActive] = useState<boolean>(false);

  // Pulsing target word if jumped from results
  const [pulsingWordId, setPulsingWordId] = useState<string | null>(
    targetJumpWord?.wordId || null
  );

  // Jump to word helper
  const handleJumpToMistake = (page: number, wordId: string) => {
    setCurrentPage(page);
    setPulsingWordId(wordId);
    // Auto-clear pulse after 5 seconds
    setTimeout(() => {
      setPulsingWordId(null);
      if (onClearTargetJumpWord) onClearTargetJumpWord();
    }, 5000);
  };

  // Student practice counter increment handler
  const handleIncrementRepeat = () => {
    if (!currentPartPlan) return;
    onUpdateState(prev => {
      const studentHistory = { ...(prev.dailyPlans[student.id] || {}) };
      const dayPlan = studentHistory[prev.currentDate] ? { ...studentHistory[prev.currentDate] } : null;

      if (dayPlan) {
        const currentCount = dayPlan[activePart].repeatPracticeCount || 0;
        dayPlan[activePart] = {
          ...dayPlan[activePart],
          repeatPracticeCount: currentCount + 1,
          lastPracticedAt: new Date().toISOString(),
        };
        studentHistory[prev.currentDate] = dayPlan;
      }

      return {
        ...prev,
        dailyPlans: {
          ...prev.dailyPlans,
          [student.id]: studentHistory,
        },
      };
    });
  };

  // Reset practice counter
  const handleResetRepeat = () => {
    if (!currentPartPlan) return;
    onUpdateState(prev => {
      const studentHistory = { ...(prev.dailyPlans[student.id] || {}) };
      const dayPlan = studentHistory[prev.currentDate] ? { ...studentHistory[prev.currentDate] } : null;

      if (dayPlan) {
        dayPlan[activePart] = {
          ...dayPlan[activePart],
          repeatPracticeCount: 0,
        };
        studentHistory[prev.currentDate] = dayPlan;
      }

      return {
        ...prev,
        dailyPlans: {
          ...prev.dailyPlans,
          [student.id]: studentHistory,
        },
      };
    });
  };

  // Get today's completed session results for this student
  const todayResults = state.sessionResults.filter(
    s => s.studentId === student.id && s.date === state.currentDate
  );

  // Marks for the current active part to display on the Mushaf
  const activePartMarks = state.marksHistory.filter(
    m => m.studentId === student.id && m.date === state.currentDate && m.part === activePart
  );

  const repeatCount = currentPartPlan?.repeatPracticeCount || 0;
  const targetRepeats = currentPartPlan?.targetRepeats || 10;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Student Profile Banner */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-lg shadow-2xs">
            {student.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-stone-900">
              {state.language === 'ur' ? student.urduName : student.name}
            </h1>
            <div className="text-xs text-stone-500">
              {student.halqaName} · {state.language === 'ur' ? `پارہ ${student.currentJuz}` : `Juz ${student.currentJuz}`}
            </div>
          </div>
        </div>

        <div className="text-xs text-stone-500 sm:text-right">
          <div>{t.roleLabel} <strong className="text-stone-800">{state.language === 'ur' ? student.urduName : student.name}</strong></div>
          <div className="font-mono text-stone-400">{state.currentDate} ({t.dayCounter} {state.dayCount})</div>
        </div>
      </div>

      {/* Sabaq Frozen Notice Banner (if revision failed yesterday) */}
      {todayPlan?.sabaqFrozenDueToRevisionFail && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">
              {t.sabaqFrozenAlert}
            </h4>
            <p className="text-xs text-amber-800 mt-0.5">
              Focus today on perfecting your Sabqi and Manzil revision before advancing with new lines.
            </p>
          </div>
        </div>
      )}

      {/* 1. "Today's Plan" Cards: Sabaq, Sabqi, Manzil */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700" />
            <span>{t.todayPlan}</span>
          </h2>
          <span className="text-xs text-stone-500">
            Tap a plan to open and practice its lines
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['sabaq', 'sabqi', 'manzil'] as PartType[]).map(partKey => {
            const plan = todayPlan ? todayPlan[partKey] : null;
            const isSelected = activePart === partKey;
            const status = plan?.status || 'pending';

            let statusBadge = (
              <span className="text-xs font-medium text-stone-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {t.status.pending}
              </span>
            );

            if (status === 'passed') {
              statusBadge = (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {t.status.passed}
                </span>
              );
            } else if (status === 'repeat') {
              statusBadge = (
                <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  {t.status.repeat}
                </span>
              );
            }

            return (
              <button
                key={partKey}
                type="button"
                onClick={() => {
                  setActivePart(partKey);
                  if (plan) {
                    setCurrentPage(plan.range.start.page);
                  }
                }}
                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-300 shadow-sm'
                    : 'bg-white border-stone-200 hover:border-stone-300 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-bold text-stone-900 flex items-center gap-1.5">
                      {partKey === 'sabaq' && <Sparkles className="w-4 h-4 text-emerald-700" />}
                      {partKey === 'sabqi' && <Layers className="w-4 h-4 text-amber-700" />}
                      {partKey === 'manzil' && <BookmarkCheck className="w-4 h-4 text-emerald-800" />}
                      <span>{t.parts[partKey]}</span>
                    </span>
                    {statusBadge}
                  </div>

                  <div className="text-xs text-stone-500 mb-3">
                    {t.parts[`${partKey}Desc` as keyof typeof t.parts]}
                  </div>

                  {plan ? (
                    <div className="space-y-2">
                      {/* 1. SABAQ CARD DETAILS: Exact Lines Assigned */}
                      {partKey === 'sabaq' && (
                        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-semibold text-stone-900">
                            <span>Surah: <strong>{plan.range.surahName || plan.surahName || 'Al-Baqarah'}</strong></span>
                            <span className="text-emerald-800 font-bold bg-emerald-100/70 px-1.5 py-0.5 rounded">
                              Para {plan.range.juzNumber || plan.juzNumber || 1}
                            </span>
                          </div>

                          <div className="text-stone-700 font-mono text-[11px] pt-1 border-t border-stone-200/80">
                            <div>
                              Pages: <strong>{plan.range.startPage || plan.range.start.page}</strong> {plan.range.start.page !== plan.range.end.page ? `to ${plan.range.endPage || plan.range.end.page}` : ''}
                            </div>
                            <div className="text-emerald-900 font-bold mt-0.5">
                              Start: Line {plan.range.startLine || plan.range.start.line} · End: Line {plan.range.endLine || plan.range.end.line}
                            </div>
                            <div className="text-stone-500 text-[10px] mt-0.5">
                              Exact Length: <strong>{plan.range.linesCount} lines assigned</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. SABQI CARD DETAILS: Revision based on memorized Quran */}
                      {partKey === 'sabqi' && (
                        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs space-y-1.5">
                          <div className="text-[11px] text-stone-500">
                            Student Progress: <strong className="text-stone-800">{student.memorizedPortionDesc || 'Memorized Quran'}</strong>
                          </div>

                          <div className="font-semibold text-stone-900 pt-1 border-t border-stone-200/80">
                            Portion: <strong className="text-amber-800">{plan.portionLabel || 'Teacher Assigned Revision'}</strong>
                          </div>

                          <div className="text-stone-700 font-mono text-[11px]">
                            Pages {plan.range.start.page} to {plan.range.end.page} ({plan.range.linesCount} lines)
                          </div>
                        </div>
                      )}

                      {/* 3. MANZIL CARD DETAILS: Specifically assigned completed Paras */}
                      {partKey === 'manzil' && (
                        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-stone-500">
                            <span>Total Completed:</span>
                            <span className="font-bold text-stone-800">{student.completedParas?.length || 0} Paras</span>
                          </div>

                          <div className="pt-1 border-t border-stone-200/80">
                            <div className="text-[10px] text-stone-500 uppercase tracking-wide font-semibold">
                              Assigned for Today's Manzil:
                            </div>
                            <div className="text-sm font-bold text-emerald-900 mt-0.5">
                              {plan.assignedParas && plan.assignedParas.length > 0
                                ? `Para ${plan.assignedParas.join(', ')}`
                                : `Pages ${plan.range.start.page} - ${plan.range.end.page}`}
                            </div>
                          </div>

                          <div className="text-[11px] font-mono text-stone-600">
                            Pages {plan.range.start.page} - {plan.range.end.page} ({plan.range.linesCount} lines)
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-stone-400 italic">No assignment set</div>
                  )}
                </div>

                <div className="mt-4 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs text-emerald-800 font-semibold">
                  <span>{isSelected ? 'Currently Viewing on Mushaf' : 'Tap to Open on Mushaf'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Practice Toolbar: Repeat Counter & Hide-and-Reveal Mode */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        {/* Repeat Practice Counter (+1 Button) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleIncrementRepeat}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-xs active:scale-95 transition-all cursor-pointer min-h-[46px]"
            >
              <Plus className="w-5 h-5" />
              <span>{t.practiceIncrement}</span>
            </button>

            <button
              type="button"
              onClick={handleResetRepeat}
              className="p-2.5 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer min-h-[46px]"
              title={t.resetCounter}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs">
            <div className="font-mono text-base font-bold text-stone-900">
              {repeatCount} <span className="text-stone-400 text-xs font-normal">/ {targetRepeats} target</span>
            </div>
            <div className="text-stone-500 text-[11px]">
              {t.practiceCounter} for {t.parts[activePart]}
            </div>
          </div>
        </div>

        {/* Hide & Reveal Memorization Test Mode Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setHideAndRevealActive(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
              hideAndRevealActive
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300'
            }`}
          >
            {hideAndRevealActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{hideAndRevealActive ? 'Hide Mode Active' : t.hideAndRevealTitle}</span>
          </button>
        </div>
      </div>

      {hideAndRevealActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{t.hideRevealHelp}</span>
        </div>
      )}

      {/* 3. Interactive Mushaf Viewer with Assigned Range Highlighted */}
      <div className="flex flex-col items-center gap-2 w-full">
        {currentPartPlan && (
          <div className="w-full max-w-4xl bg-emerald-900 text-white px-4 py-2 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider bg-emerald-800 px-2 py-0.5 rounded text-[10px]">
                {t.parts[activePart]}
              </span>
              <span>
                {activePart === 'sabaq' && (
                  <>
                    {t.showingAssignedOnly}: <strong>{currentPartPlan.range.surahName || 'Al-Baqarah'}</strong>, Para {currentPartPlan.range.juzNumber || 1}, Page {currentPartPlan.range.startPage || currentPartPlan.range.start.page} (Line {currentPartPlan.range.startLine || currentPartPlan.range.start.line}) to Page {currentPartPlan.range.endPage || currentPartPlan.range.end.page} (Line {currentPartPlan.range.endLine || currentPartPlan.range.end.line}).
                  </>
                )}
                {activePart === 'sabqi' && (
                  <>
                    Teacher Revision Assignment ({currentPartPlan.portionLabel || 'Recent Revision'}): Pages {currentPartPlan.range.start.page} to {currentPartPlan.range.end.page} ({currentPartPlan.range.linesCount} lines).
                  </>
                )}
                {activePart === 'manzil' && (
                  <>
                    Teacher Assigned Manzil: <strong>Para {currentPartPlan.assignedParas && currentPartPlan.assignedParas.length > 0 ? currentPartPlan.assignedParas.join(', ') : currentPartPlan.range.juzNumber}</strong> (Pages {currentPartPlan.range.start.page} - {currentPartPlan.range.end.page}).
                  </>
                )}
              </span>
            </div>
            <span className="text-emerald-200 text-[11px] font-mono">
              {currentPartPlan.range.linesCount} {t.linesCount} assigned
            </span>
          </div>
        )}

        {currentPartPlan ? (
          <MushafViewer
            pageNumber={currentPage}
            onPageChange={setCurrentPage}
            highlightRange={currentPartPlan.range}
            interactiveMode="view"
            currentMarks={activePartMarks}
            hideAndRevealActive={hideAndRevealActive}
            targetPulseWordId={pulsingWordId}
            language={state.language}
          />
        ) : (
          <div className="p-8 bg-white border border-stone-200 rounded-xl text-center text-stone-500">
            No assignment for this part yet.
          </div>
        )}
      </div>

      {/* 4. Assessment Result Card (after Ustaad finishes grading) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-700" />
            <span>{t.resultCardTitle}</span>
          </h3>
          <span className="text-xs text-stone-500">
            {state.currentDate}
          </span>
        </div>

        {todayResults.length === 0 ? (
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-500 text-center">
            {t.noResultsYet}
          </div>
        ) : (
          <div className="space-y-4">
            {todayResults.map(result => {
              const isPassed = result.finalResult === 'passed';
              return (
                <div
                  key={result.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPassed
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-rose-50/60 border-rose-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-stone-900 capitalize">
                        {t.parts[result.part]} ({t.parts[`${result.part}Desc` as keyof typeof t.parts]})
                      </span>
                      {result.isOverridden && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-medium">
                          {t.overriddenBadge}
                        </span>
                      )}
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                        isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span>{isPassed ? t.status.passed : t.status.repeat}</span>
                    </div>
                  </div>

                  {/* Mistakes vs Limit breakdown */}
                  <div className="text-xs font-mono text-stone-800 mb-3 flex items-center gap-4">
                    <span>
                      {t.ghaltiShort}: <strong>{result.ghaltiCount}</strong> (limit {result.ghaltiLimit})
                    </span>
                    <span className="text-stone-300">·</span>
                    <span>
                      {t.atkanShort}: <strong>{result.atkanCount}</strong> (limit {result.atkanLimit})
                    </span>
                  </div>

                  {/* Marked words list with click-to-jump */}
                  {result.marks.length > 0 ? (
                    <div>
                      <div className="text-[11px] font-semibold text-stone-600 uppercase mb-1.5">
                        Marked Mistakes (tap to jump to page and inspect):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.marks.map(mark => (
                          <button
                            key={mark.id}
                            type="button"
                            onClick={() => handleJumpToMistake(mark.page, mark.wordId)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs border font-mono flex items-center gap-1.5 cursor-pointer hover:shadow-xs transition-all ${
                              mark.type === 'ghalti'
                                ? 'bg-rose-100 border-rose-300 text-rose-950 hover:bg-rose-200'
                                : 'bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200'
                            }`}
                          >
                            <span className="font-bold">
                              {mark.type === 'ghalti' ? t.ghaltiShort : t.atkanShort}
                            </span>
                            <span>P{mark.page} : L{mark.line} : W{mark.wordIndex}</span>
                            <ArrowRight className="w-3 h-3 text-stone-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-800 font-medium">
                      No mistakes recorded! Excellent recitation.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
