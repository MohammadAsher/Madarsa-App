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
      {/* Student Profile Banner with Islamic styling */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />
        
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3E2B20] to-[#241811] text-[#DFCFA8] font-bold flex items-center justify-center text-lg shadow-xs border border-[#C5A059]">
            {student.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-[#241811] flex items-center gap-2">
              <span>{state.language === 'ur' ? student.urduName : student.name}</span>
              <span className="text-[#C5A059] text-xs">۞</span>
            </h1>
            <div className="text-xs text-[#7A6C60] mt-0.5">
              {student.halqaName} · {state.language === 'ur' ? `پارہ ${student.currentJuz}` : `Juz ${student.currentJuz}`} · <span className="text-[#1F4E3D] font-bold">{student.completedParas?.length || 0} Paras Done</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-[#7A6C60] sm:text-right">
          <div>{t.roleLabel} <strong className="text-[#241811]">{state.language === 'ur' ? student.urduName : student.name}</strong></div>
          <div className="font-mono text-[#8F6E2B] mt-0.5">{state.currentDate} ({t.dayCounter} {state.dayCount})</div>
        </div>
      </div>

      {/* Sabaq Frozen Notice Banner (if revision failed yesterday) */}
      {todayPlan?.sabaqFrozenDueToRevisionFail && (
        <div className="bg-[#FEF3C7] border-2 border-[#D97706] rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-[#78350F]">
              {t.sabaqFrozenAlert}
            </h4>
            <p className="text-xs text-[#92400E] mt-0.5">
              Focus today on perfecting your Sabqi and Manzil revision before advancing with new lines.
            </p>
          </div>
        </div>
      )}

      {/* 1. "Today's Plan" Cards: Sabaq, Sabqi, Manzil */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#241811] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#8F6E2B]" />
            <span>{t.todayPlan}</span>
          </h2>
          <span className="text-xs text-[#7A6C60]">
            Tap a plan to open and practice its lines
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['sabaq', 'sabqi', 'manzil'] as PartType[]).map(partKey => {
            const plan = todayPlan ? todayPlan[partKey] : null;
            const isSelected = activePart === partKey;
            const status = plan?.status || 'pending';

            let statusBadge = (
              <span className="text-xs font-medium text-[#7A6C60] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {t.status.pending}
              </span>
            );

            if (status === 'passed') {
              statusBadge = (
                <span className="text-xs font-bold text-[#1F4E3D] flex items-center gap-1 bg-[#E8F0EC] px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1F4E3D]" />
                  {t.status.passed}
                </span>
              );
            } else if (status === 'repeat') {
              statusBadge = (
                <span className="text-xs font-bold text-[#991B1B] flex items-center gap-1 bg-[#FEE2E2] px-2 py-0.5 rounded">
                  <XCircle className="w-3.5 h-3.5 text-[#991B1B]" />
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
                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? 'bg-[#FDFCF9] border-[#C5A059] ring-2 ring-[#C5A059]/40 shadow-md'
                    : 'bg-[#FCFAF6] border-[#E8DCC4] hover:border-[#C5A059]/60 shadow-xs'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[#C5A059]" />
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-bold text-[#241811] flex items-center gap-1.5">
                      {partKey === 'sabaq' && <Sparkles className="w-4 h-4 text-[#C5A059]" />}
                      {partKey === 'sabqi' && <Layers className="w-4 h-4 text-[#8F6E2B]" />}
                      {partKey === 'manzil' && <BookmarkCheck className="w-4 h-4 text-[#1F4E3D]" />}
                      <span>{t.parts[partKey]}</span>
                    </span>
                    {statusBadge}
                  </div>

                  <div className="text-xs text-[#7A6C60] mb-3">
                    {t.parts[`${partKey}Desc` as keyof typeof t.parts]}
                  </div>

                  {plan ? (
                    <div className="space-y-2">
                      {/* 1. SABAQ CARD DETAILS: Exact Lines Assigned */}
                      {partKey === 'sabaq' && (
                        <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-semibold text-[#241811]">
                            <span>Surah: <strong>{plan.range.surahName || plan.surahName || 'Al-Baqarah'}</strong></span>
                            <span className="text-[#1F4E3D] font-bold bg-[#E8F0EC] px-2 py-0.5 rounded">
                              Para {plan.range.juzNumber || plan.juzNumber || 1}
                            </span>
                          </div>

                          <div className="text-[#42362E] font-mono text-[11px] pt-1.5 border-t border-[#DFCFA8]">
                            <div>
                              Pages: <strong>{plan.range.startPage || plan.range.start.page}</strong> {plan.range.start.page !== plan.range.end.page ? `to ${plan.range.endPage || plan.range.end.page}` : ''}
                            </div>
                            <div className="text-[#1F4E3D] font-bold mt-0.5">
                              Start: Line {plan.range.startLine || plan.range.start.line} · End: Line {plan.range.endLine || plan.range.end.line}
                            </div>
                            <div className="text-[#7A6C60] text-[10px] mt-0.5">
                              Exact Length: <strong>{plan.range.linesCount} lines assigned</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. SABQI CARD DETAILS: Revision based on memorized Quran */}
                      {partKey === 'sabqi' && (
                        <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs space-y-1.5">
                          <div className="text-[11px] text-[#7A6C60]">
                            Student Progress: <strong className="text-[#241811]">{student.memorizedPortionDesc || 'Memorized Quran'}</strong>
                          </div>

                          <div className="font-semibold text-[#241811] pt-1.5 border-t border-[#DFCFA8]">
                            Portion: <strong className="text-[#8F6E2B]">{plan.portionLabel || 'Teacher Assigned Revision'}</strong>
                          </div>

                          <div className="text-[#42362E] font-mono text-[11px]">
                            Pages {plan.range.start.page} to {plan.range.end.page} ({plan.range.linesCount} lines)
                          </div>
                        </div>
                      )}

                      {/* 3. MANZIL CARD DETAILS: Specifically assigned completed Paras */}
                      {partKey === 'manzil' && (
                        <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-[#7A6C60]">
                            <span>Total Completed:</span>
                            <span className="font-bold text-[#241811]">{student.completedParas?.length || 0} Paras</span>
                          </div>

                          <div className="pt-1.5 border-t border-[#DFCFA8]">
                            <div className="text-[10px] text-[#7A6C60] uppercase tracking-wide font-semibold">
                              Assigned for Today's Manzil:
                            </div>
                            <div className="text-sm font-bold text-[#1F4E3D] mt-0.5">
                              {plan.assignedParas && plan.assignedParas.length > 0
                                ? `Para ${plan.assignedParas.join(', ')}`
                                : `Pages ${plan.range.start.page} - ${plan.range.end.page}`}
                            </div>
                          </div>

                          <div className="text-[11px] font-mono text-[#5A4333]">
                            Pages {plan.range.start.page} - {plan.range.end.page} ({plan.range.linesCount} lines)
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-[#A69888] italic">No assignment set</div>
                  )}
                </div>

                <div className="mt-4 pt-2.5 border-t border-[#DFCFA8] flex items-center justify-between text-xs text-[#8F6E2B] font-bold">
                  <span>{isSelected ? 'Currently Viewing on Mushaf' : 'Tap to Open on Mushaf'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Practice Toolbar: Repeat Counter & Hide-and-Reveal Mode */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Repeat Practice Counter (+1 Button) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleIncrementRepeat}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#241811] hover:bg-[#38271D] text-[#FCFAF6] text-sm font-bold shadow-xs active:scale-95 transition-all cursor-pointer min-h-[46px] border border-[#C5A059]"
            >
              <Plus className="w-5 h-5 text-[#C5A059]" />
              <span>{t.practiceIncrement}</span>
            </button>

            <button
              type="button"
              onClick={handleResetRepeat}
              className="p-2.5 rounded-xl border border-[#DFCFA8] text-[#7A6C60] hover:text-[#241811] hover:bg-[#F3ECE1] transition-colors cursor-pointer min-h-[46px]"
              title={t.resetCounter}
            >
              <RotateCcw className="w-4 h-4 text-[#8F6E2B]" />
            </button>
          </div>

          <div className="text-xs">
            <div className="font-mono text-base font-bold text-[#241811]">
              {repeatCount} <span className="text-[#7A6C60] text-xs font-normal">/ {targetRepeats} target</span>
            </div>
            <div className="text-[#7A6C60] text-[11px]">
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
                ? 'bg-[#C5A059] text-[#241811] shadow-xs ring-2 ring-[#DFCFA8]'
                : 'bg-[#F8F4EC] hover:bg-[#F3ECE1] text-[#241811] border border-[#DFCFA8]'
            }`}
          >
            {hideAndRevealActive ? <EyeOff className="w-4 h-4 text-[#241811]" /> : <Eye className="w-4 h-4 text-[#8F6E2B]" />}
            <span>{hideAndRevealActive ? 'Hide Mode Active' : t.hideAndRevealTitle}</span>
          </button>
        </div>
      </div>

      {hideAndRevealActive && (
        <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-xl p-3 text-xs text-[#92400E] flex items-center gap-2 shadow-2xs">
          <Info className="w-4 h-4 text-[#B45309] shrink-0" />
          <span>{t.hideRevealHelp}</span>
        </div>
      )}

      {/* 3. Interactive Mushaf Viewer with Assigned Range Highlighted */}
      <div className="flex flex-col items-center gap-2 w-full">
        {currentPartPlan && (
          <div className="w-full max-w-4xl bg-[#241811] text-[#FCFAF6] border-2 border-[#C5A059] px-4 py-2.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider bg-[#C5A059] text-[#241811] px-2 py-0.5 rounded text-[10px]">
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
            <span className="text-[#DFCFA8] text-[11px] font-mono">
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
          <div className="p-8 bg-[#FCFAF6] border border-[#DFCFA8] rounded-2xl text-center text-[#7A6C60] shadow-xs">
            No assignment for this part yet.
          </div>
        )}
      </div>

      {/* 4. Assessment Result Card (after Ustaad finishes grading) */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#241811] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#8F6E2B]" />
            <span>{t.resultCardTitle}</span>
          </h3>
          <span className="text-xs text-[#7A6C60] font-mono">
            {state.currentDate}
          </span>
        </div>

        {todayResults.length === 0 ? (
          <div className="p-4 bg-[#F8F4EC] rounded-xl border border-[#DFCFA8] text-xs text-[#7A6C60] text-center">
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
                      ? 'bg-[#EBF3EE] border-[#2E6A54]'
                      : 'bg-[#FDF2F2] border-[#B91C1C]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#241811] capitalize">
                        {t.parts[result.part]} ({t.parts[`${result.part}Desc` as keyof typeof t.parts]})
                      </span>
                      {result.isOverridden && (
                        <span className="text-[10px] bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B] px-1.5 py-0.5 rounded font-medium">
                          {t.overriddenBadge}
                        </span>
                      )}
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                        isPassed
                          ? 'bg-[#1F4E3D] text-white'
                          : 'bg-[#B91C1C] text-white'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      <span>{isPassed ? t.status.passed : t.status.repeat}</span>
                    </div>
                  </div>

                  {/* Mistakes vs Limit breakdown */}
                  <div className="text-xs font-mono text-[#241811] mb-3 flex items-center gap-4">
                    <span>
                      {t.ghaltiShort}: <strong>{result.ghaltiCount}</strong> (limit {result.ghaltiLimit})
                    </span>
                    <span className="text-[#C5A059]">·</span>
                    <span>
                      {t.atkanShort}: <strong>{result.atkanCount}</strong> (limit {result.atkanLimit})
                    </span>
                  </div>

                  {/* Marked words list with click-to-jump */}
                  {result.marks.length > 0 ? (
                    <div>
                      <div className="text-[11px] font-semibold text-[#5A4333] uppercase mb-1.5">
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
                            <ArrowRight className="w-3 h-3 text-[#5A4333]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-[#1F4E3D] font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>No mistakes recorded! Excellent recitation.</span>
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
