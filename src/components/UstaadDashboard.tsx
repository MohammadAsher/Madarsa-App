/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  BookOpen, 
  Sliders, 
  History, 
  Play, 
  Settings2,
  Check,
  AlertCircle
} from 'lucide-react';
import { 
  MadrasaState, 
  UstaadProfile, 
  StudentProfile, 
  PartType, 
  SessionResult, 
  MistakeMark,
  StudentLimits,
  AssignmentRange
} from '../types/hifz';
import { translations } from '../i18n/translations';
import { UstaadMarkingScreen } from './UstaadMarkingScreen';
import { AssignWorkModal } from './AssignWorkModal';
import { LimitsModal } from './LimitsModal';
import { StudentHistoryModal } from './StudentHistoryModal';

interface UstaadDashboardProps {
  state: MadrasaState;
  ustaad: UstaadProfile;
  onUpdateState: (updater: (prev: MadrasaState) => MadrasaState) => void;
  onJumpToMushafWord?: (page: number, wordId: string) => void;
}

export const UstaadDashboard: React.FC<UstaadDashboardProps> = ({
  state,
  ustaad,
  onUpdateState,
  onJumpToMushafWord,
}) => {
  const t = translations[state.language];

  // Active sub-views & modals
  const [markingStudent, setMarkingStudent] = useState<{
    student: StudentProfile;
    part: PartType;
  } | null>(null);

  const [assigningStudent, setAssigningStudent] = useState<StudentProfile | null>(null);
  const [limitsStudent, setLimitsStudent] = useState<StudentProfile | null>(null);
  const [historyStudent, setHistoryStudent] = useState<StudentProfile | null>(null);

  // Get students assigned to this Ustaad
  const halqaStudents = ustaad.studentIds
    .map(id => state.students[id])
    .filter(Boolean);

  // Handle saving a completed grading session
  const handleSaveSession = (result: SessionResult, updatedMarks: MistakeMark[]) => {
    onUpdateState(prev => {
      // 1. Update session results
      const filteredResults = prev.sessionResults.filter(
        r => !(r.studentId === result.studentId && r.date === result.date && r.part === result.part)
      );
      const newResults = [result, ...filteredResults];

      // 2. Update marks history
      const otherMarks = prev.marksHistory.filter(
        m => !(m.studentId === result.studentId && m.date === result.date && m.part === result.part)
      );
      const newMarksHistory = [...otherMarks, ...updatedMarks];

      // 3. Update daily plan status
      const studentPlans = { ...(prev.dailyPlans[result.studentId] || {}) };
      const currentDayPlan = studentPlans[result.date] ? { ...studentPlans[result.date] } : null;

      if (currentDayPlan) {
        currentDayPlan[result.part] = {
          ...currentDayPlan[result.part],
          status: result.finalResult,
          completedAt: new Date().toISOString(),
          sessionResultId: result.id,
        };
        studentPlans[result.date] = currentDayPlan;
      }

      return {
        ...prev,
        sessionResults: newResults,
        marksHistory: newMarksHistory,
        dailyPlans: {
          ...prev.dailyPlans,
          [result.studentId]: studentPlans,
        },
      };
    });

    // Close marking screen
    setMarkingStudent(null);
  };

  // Handle saving assignments
  const handleSaveAssignment = (
    targetStudentId: string,
    part: PartType,
    range: AssignmentRange,
    applyToAllHalqa: boolean,
    extraMetadata?: {
      assignedParas?: number[];
      portionType?: 'custom' | 'quarter_para' | 'half_para' | 'full_para';
      portionLabel?: string;
      updatedCompletedParas?: number[];
    }
  ) => {
    onUpdateState(prev => {
      const studentIdsToUpdate = applyToAllHalqa ? ustaad.studentIds : [targetStudentId];
      const newDailyPlans = { ...prev.dailyPlans };
      const newStudents = { ...prev.students };

      studentIdsToUpdate.forEach(sid => {
        const studentHistory = { ...(newDailyPlans[sid] || {}) };
        const dayPlan = studentHistory[prev.currentDate] ? { ...studentHistory[prev.currentDate] } : null;

        if (dayPlan) {
          dayPlan[part] = {
            ...dayPlan[part],
            range,
            status: 'pending',
            surahName: range.surahName,
            juzNumber: range.juzNumber,
            startPage: range.startPage,
            endPage: range.endPage,
            startLine: range.startLine,
            endLine: range.endLine,
            assignedParas: extraMetadata?.assignedParas,
            portionType: extraMetadata?.portionType,
            portionLabel: extraMetadata?.portionLabel,
          };
          studentHistory[prev.currentDate] = dayPlan;
          newDailyPlans[sid] = studentHistory;
        }

        if (extraMetadata?.updatedCompletedParas && newStudents[sid]) {
          newStudents[sid] = {
            ...newStudents[sid],
            completedParas: extraMetadata.updatedCompletedParas,
          };
        }
      });

      return {
        ...prev,
        dailyPlans: newDailyPlans,
        students: newStudents,
      };
    });
  };

  // Handle student limit override
  const handleSaveStudentLimits = (studentId: string, limits: Partial<StudentLimits>) => {
    onUpdateState(prev => ({
      ...prev,
      studentLimitsOverride: {
        ...prev.studentLimitsOverride,
        [studentId]: limits,
      },
    }));
  };

  // Handle halqa default limits
  const handleSaveHalqaDefaults = (limits: StudentLimits) => {
    onUpdateState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        halqaDefaultLimits: limits,
      },
    }));
  };

  // Handle resetting student limits to halqa defaults
  const handleResetToDefaults = (studentId: string) => {
    onUpdateState(prev => {
      const copy = { ...prev.studentLimitsOverride };
      delete copy[studentId];
      return {
        ...prev,
        studentLimitsOverride: copy,
      };
    });
  };

  // If currently in the dedicated Marking screen, render that view
  if (markingStudent) {
    return (
      <UstaadMarkingScreen
        state={state}
        student={markingStudent.student}
        initialPart={markingStudent.part}
        onBack={() => setMarkingStudent(null)}
        onSaveSession={handleSaveSession}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Halqa Banner & Rule Controls */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg md:text-xl text-stone-900">
              {state.language === 'ur' ? ustaad.urduName : ustaad.name}
            </span>
            <span className="text-stone-300">·</span>
            <span className="text-emerald-800 font-semibold text-sm">
              {ustaad.halqaName}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            {halqaStudents.length} {state.language === 'ur' ? 'طلبہ زیرِ نگرانی' : 'Students enrolled in this halqa'} · {state.currentDate} ({t.dayCounter} {state.dayCount})
          </p>
        </div>

        {/* Ustaad Rule Toggle: Freeze new Sabaq if Sabqi or Manzil fails */}
        <div className="flex items-center gap-4 bg-stone-50 border border-stone-200 p-3 rounded-xl">
          <div className="text-right">
            <div className="text-xs font-bold text-stone-900">
              {t.freezeRuleLabel}
            </div>
            <div className="text-[11px] text-stone-500 max-w-xs">
              {t.freezeRuleDescription}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdateState(prev => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  freezeSabaqOnSabqiOrManzilFail: !prev.settings.freezeSabaqOnSabqiOrManzilFail,
                },
              }));
            }}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
              state.settings.freezeSabaqOnSabqiOrManzilFail
                ? 'bg-emerald-600 justify-end'
                : 'bg-stone-300 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-md" />
          </button>
        </div>
      </div>

      {/* Halqa Students List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-700" />
            <span>{t.halqaTitle}</span>
          </h2>
          <span className="text-xs text-stone-500">
            {t.halqaSubtitle}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {halqaStudents.map(student => {
            const todayPlan = state.dailyPlans[student.id]?.[state.currentDate];
            const hasOverriddenLimits = Boolean(state.studentLimitsOverride[student.id]);

            return (
              <div
                key={student.id}
                className="bg-white rounded-2xl border border-stone-200 shadow-2xs hover:shadow-sm transition-shadow p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                {/* Student Info */}
                <div className="md:w-1/4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm shrink-0 border border-emerald-200">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm md:text-base">
                        {state.language === 'ur' ? student.urduName : student.name}
                      </h3>
                      <div className="text-xs text-stone-500 flex flex-wrap items-center gap-1">
                        <span>{state.language === 'ur' ? `پارہ ${student.currentJuz}` : `Current: Para ${student.currentJuz}`}</span>
                        <span className="text-stone-300">·</span>
                        <span className="text-emerald-800 font-semibold">
                          {student.completedParas?.length || 0} {state.language === 'ur' ? 'پارے مکمل' : 'Paras Done'}
                        </span>
                        {hasOverriddenLimits && (
                          <span className="text-[10px] text-amber-700 font-medium">
                            · Custom Limits
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daily Work Status: Sabaq, Sabqi, Manzil */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['sabaq', 'sabqi', 'manzil'] as PartType[]).map(partKey => {
                    const plan = todayPlan ? todayPlan[partKey] : null;
                    const status = plan?.status || 'pending';

                    let statusBadge = (
                      <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t.status.pending}
                      </span>
                    );

                    if (status === 'passed') {
                      statusBadge = (
                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {t.status.passed}
                        </span>
                      );
                    } else if (status === 'repeat') {
                      statusBadge = (
                        <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          {t.status.repeat}
                        </span>
                      );
                    } else if (status === 'in_progress') {
                      statusBadge = (
                        <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          {t.status.in_progress}
                        </span>
                      );
                    }

                    // Specialized subtitle per part
                    let subtitle = '';
                    if (plan) {
                      if (partKey === 'sabaq') {
                        subtitle = `P${plan.range.start.page}:L${plan.range.start.line} - P${plan.range.end.page}:L${plan.range.end.line} (${plan.range.linesCount}L)`;
                      } else if (partKey === 'sabqi') {
                        subtitle = plan.portionLabel || `P${plan.range.start.page} - P${plan.range.end.page} (${plan.range.linesCount}L)`;
                      } else if (partKey === 'manzil') {
                        subtitle = plan.assignedParas && plan.assignedParas.length > 0
                          ? `Assigned: Para ${plan.assignedParas.join(', ')}`
                          : `P${plan.range.start.page} - P${plan.range.end.page}`;
                      }
                    }

                    return (
                      <div
                        key={partKey}
                        className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-stone-800 capitalize">
                            {t.parts[partKey]}
                          </span>
                          {statusBadge}
                        </div>

                        {plan ? (
                          <div className="text-[11px] font-mono text-stone-700 truncate font-medium">
                            {subtitle}
                          </div>
                        ) : (
                          <div className="text-[11px] text-stone-400 italic">Not set</div>
                        )}

                        <button
                          type="button"
                          onClick={() => setMarkingStudent({ student, part: partKey })}
                          className="mt-2 text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer pt-1 border-t border-stone-200/60"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{t.listenAndMark}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons for Student */}
                <div className="flex items-center gap-2 md:w-auto shrink-0 justify-end pt-2 md:pt-0 border-t md:border-t-0 border-stone-100">
                  <button
                    type="button"
                    onClick={() => setAssigningStudent(student)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-medium transition-colors cursor-pointer shadow-2xs min-h-[38px]"
                    title={t.assignWork}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-stone-600" />
                    <span>{t.assignWork}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLimitsStudent(student)}
                    className="p-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 transition-colors cursor-pointer shadow-2xs min-h-[38px]"
                    title={t.limitsSettings}
                  >
                    <Sliders className="w-4 h-4 text-stone-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryStudent(student)}
                    className="p-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 transition-colors cursor-pointer shadow-2xs min-h-[38px]"
                    title={t.studentHistory}
                  >
                    <History className="w-4 h-4 text-stone-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assign Work Modal */}
      {assigningStudent && (
        <AssignWorkModal
          state={state}
          student={assigningStudent}
          onClose={() => setAssigningStudent(null)}
          onSave={handleSaveAssignment}
        />
      )}

      {/* Limits Modal */}
      {limitsStudent && (
        <LimitsModal
          state={state}
          student={limitsStudent}
          onClose={() => setLimitsStudent(null)}
          onSaveStudentLimits={handleSaveStudentLimits}
          onSaveHalqaDefaultLimits={handleSaveHalqaDefaults}
          onResetToDefaults={handleResetToDefaults}
        />
      )}

      {/* History Modal */}
      {historyStudent && (
        <StudentHistoryModal
          state={state}
          student={historyStudent}
          onClose={() => setHistoryStudent(null)}
          onJumpToWord={onJumpToMushafWord}
        />
      )}
    </div>
  );
};
