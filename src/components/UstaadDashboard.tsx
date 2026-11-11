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
  AlertCircle,
  Sparkles,
  Layers,
  BookmarkCheck
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
  activeMarkingSession?: { student: StudentProfile; part: PartType } | null;
  onStartMarking?: (student: StudentProfile, part: PartType) => void;
  onCloseMarking?: () => void;
}

export const UstaadDashboard: React.FC<UstaadDashboardProps> = ({
  state,
  ustaad,
  onUpdateState,
  onJumpToMushafWord,
  activeMarkingSession,
  onStartMarking,
  onCloseMarking,
}) => {
  const t = translations[state.language];

  // Active sub-views & modals
  const [internalMarkingStudent, setInternalMarkingStudent] = useState<{
    student: StudentProfile;
    part: PartType;
  } | null>(null);

  const currentMarking = activeMarkingSession !== undefined ? activeMarkingSession : internalMarkingStudent;

  const handleStartMarkingStudent = (student: StudentProfile, part: PartType) => {
    if (onStartMarking) {
      onStartMarking(student, part);
    } else {
      setInternalMarkingStudent({ student, part });
    }
  };

  const handleCloseMarkingScreen = () => {
    if (onCloseMarking) {
      onCloseMarking();
    }
    setInternalMarkingStudent(null);
  };

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
    handleCloseMarkingScreen();
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
  if (currentMarking) {
    return (
      <UstaadMarkingScreen
        state={state}
        student={currentMarking.student}
        initialPart={currentMarking.part}
        onBack={handleCloseMarkingScreen}
        onSaveSession={handleSaveSession}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Halqa Banner & Rule Controls with Islamic arch styling */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg md:text-xl text-[#241811]">
                {state.language === 'ur' ? ustaad.urduName : ustaad.name}
              </span>
              <span className="text-[#C5A059]">۞</span>
              <span className="text-[#8F6E2B] font-semibold text-xs md:text-sm bg-[#F5EFEB] px-2.5 py-1 rounded-lg border border-[#DFCFA8]">
                {ustaad.halqaName}
              </span>
            </div>
            <p className="text-xs text-[#7A6C60] mt-1.5 flex items-center gap-1.5">
              <span>{halqaStudents.length} {state.language === 'ur' ? 'طلبہ زیرِ نگرانی' : 'Students enrolled'}</span>
              <span>·</span>
              <span className="font-mono text-[#5A4333]">{state.currentDate} ({t.dayCounter} {state.dayCount})</span>
            </p>
          </div>

          {/* Ustaad Rule Toggle: Freeze new Sabaq if Sabqi or Manzil fails */}
          <div className="flex items-center gap-4 bg-[#F8F4EC] border border-[#DFCFA8] p-3 rounded-xl">
            <div className="text-right">
              <div className="text-xs font-bold text-[#241811]">
                {t.freezeRuleLabel}
              </div>
              <div className="text-[11px] text-[#7A6C60] max-w-xs">
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
                  ? 'bg-[#1F4E3D] justify-end'
                  : 'bg-[#CDBE9F] justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-[#FCFAF6] shadow-md" />
            </button>
          </div>
        </div>
      </div>

      {/* Halqa Students List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#241811] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8F6E2B]" />
            <span>{t.halqaTitle}</span>
          </h2>
          <span className="text-xs text-[#7A6C60]">
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
                className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] shadow-xs hover:shadow-md hover:border-[#C5A059]/60 transition-all p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden"
              >
                {/* Subtle top arch indicator */}
                <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-[#C5A059]/30 to-transparent" />

                {/* Student Info */}
                <div className="md:w-1/4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2A1D15] text-[#DFCFA8] font-bold flex items-center justify-center text-sm shrink-0 border border-[#C5A059] shadow-2xs">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#241811] text-sm md:text-base">
                        {state.language === 'ur' ? student.urduName : student.name}
                      </h3>
                      <div className="text-xs text-[#7A6C60] flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[#3E2B20] font-medium">{state.language === 'ur' ? `پارہ ${student.currentJuz}` : `Current: Para ${student.currentJuz}`}</span>
                        <span className="text-[#C5A059]">·</span>
                        <span className="text-[#1F4E3D] font-bold bg-[#E8F0EC] px-1.5 py-0.5 rounded text-[11px]">
                          {student.completedParas?.length || 0} {state.language === 'ur' ? 'پارے مکمل' : 'Paras Done'}
                        </span>
                        {hasOverriddenLimits && (
                          <span className="text-[10px] text-[#8F6E2B] font-semibold bg-[#F5EFEB] px-1.5 py-0.5 rounded">
                            Custom Limits
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
                      <span className="text-[11px] font-medium text-[#7A6C60] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#7A6C60]" />
                        {t.status.pending}
                      </span>
                    );

                    if (status === 'passed') {
                      statusBadge = (
                        <span className="text-[11px] font-bold text-[#1F4E3D] flex items-center gap-1 bg-[#E8F0EC] px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-[#1F4E3D]" />
                          {t.status.passed}
                        </span>
                      );
                    } else if (status === 'repeat') {
                      statusBadge = (
                        <span className="text-[11px] font-bold text-[#991B1B] flex items-center gap-1 bg-[#FEE2E2] px-1.5 py-0.5 rounded">
                          <XCircle className="w-3 h-3 text-[#991B1B]" />
                          {t.status.repeat}
                        </span>
                      );
                    } else if (status === 'in_progress') {
                      statusBadge = (
                        <span className="text-[11px] font-bold text-[#B45309] flex items-center gap-1 bg-[#FEF3C7] px-1.5 py-0.5 rounded">
                          <Clock className="w-3 h-3 text-[#B45309]" />
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
                        className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 flex flex-col justify-between hover:bg-[#F3ECE1] transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#241811] capitalize flex items-center gap-1">
                            {partKey === 'sabaq' && <Sparkles className="w-3 h-3 text-[#C5A059]" />}
                            {partKey === 'sabqi' && <Layers className="w-3 h-3 text-[#8F6E2B]" />}
                            {partKey === 'manzil' && <BookmarkCheck className="w-3 h-3 text-[#1F4E3D]" />}
                            <span>{t.parts[partKey]}</span>
                          </span>
                          {statusBadge}
                        </div>

                        {plan ? (
                          <div className="text-[11px] font-mono text-[#42362E] truncate font-medium mt-1">
                            {subtitle}
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#A69888] italic mt-1">Not set</div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStartMarkingStudent(student, partKey)}
                          className="mt-2.5 text-xs font-bold text-[#241811] hover:text-[#8F6E2B] flex items-center gap-1 cursor-pointer pt-1.5 border-t border-[#DFCFA8]/80 transition-colors"
                        >
                          <Play className="w-3 h-3 fill-current text-[#C5A059]" />
                          <span>{t.listenAndMark}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons for Student */}
                <div className="flex items-center gap-2 md:w-auto shrink-0 justify-end pt-2 md:pt-0 border-t md:border-t-0 border-[#E8DCC4]">
                  <button
                    type="button"
                    onClick={() => setAssigningStudent(student)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C5A059]/80 bg-[#2A1D15] hover:bg-[#38271D] text-[#FCFAF6] text-xs font-semibold transition-colors cursor-pointer shadow-xs min-h-[38px]"
                    title={t.assignWork}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#DFCFA8]" />
                    <span>{t.assignWork}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLimitsStudent(student)}
                    className="p-2 rounded-xl border border-[#DFCFA8] bg-[#FAF6EF] hover:bg-[#F3ECE1] text-[#42362E] transition-colors cursor-pointer shadow-2xs min-h-[38px]"
                    title={t.limitsSettings}
                  >
                    <Sliders className="w-4 h-4 text-[#8F6E2B]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryStudent(student)}
                    className="p-2 rounded-xl border border-[#DFCFA8] bg-[#FAF6EF] hover:bg-[#F3ECE1] text-[#42362E] transition-colors cursor-pointer shadow-2xs min-h-[38px]"
                    title={t.studentHistory}
                  >
                    <History className="w-4 h-4 text-[#8F6E2B]" />
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
