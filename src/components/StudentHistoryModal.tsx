/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight,
  BookOpen,
  Sparkles,
  Layers,
  BookmarkCheck,
  Calendar,
  ExternalLink,
  Clock
} from 'lucide-react';
import { MadrasaState, StudentProfile, SessionResult, MistakeMark, DayPlan, PartStatus } from '../types/hifz';
import { translations } from '../i18n/translations';
import { getFutureDatedRecordsSummary } from '../services/storageService';
import { StudentTypeBadge } from './StudentTypeBadge';

interface StudentHistoryModalProps {
  state: MadrasaState;
  student: StudentProfile;
  onClose: () => void;
  onJumpToWord?: (page: number, wordId: string) => void;
}

export const StudentHistoryModal: React.FC<StudentHistoryModalProps> = ({
  state,
  student,
  onClose,
  onJumpToWord,
}) => {
  const t = translations[state.language];
  const isNazra = student.studentType === 'nazra';
  const [activeTab, setActiveTab] = useState<'lessons' | 'weak_words' | 'sessions'>('lessons');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');

  // Daily plans for this student sorted descending by date
  const studentDailyPlans = Object.values(state.dailyPlans[student.id] || {}).sort(
    (a, b) => b.date.localeCompare(a.date)
  );
  const filteredDailyPlans = selectedDateFilter
    ? studentDailyPlans.filter(d => d.date === selectedDateFilter)
    : studentDailyPlans;
  const futureDatedPlansCount = studentDailyPlans.filter(
    d => d.date > state.currentDate
  ).length;
  const halqaFutureSummary = getFutureDatedRecordsSummary(state, state.currentDate);

  // Sessions for this student
  const studentSessions = state.sessionResults
    .filter(s => s.studentId === student.id)
    .sort((a, b) => b.timestamp - a.timestamp);

  // Weak words aggregation: count occurrences of each marked word across history
  const studentMarks = state.marksHistory.filter(m => m.studentId === student.id);
  
  const wordFrequencyMap: Record<
    string,
    {
      wordId: string;
      page: number;
      line: number;
      wordIndex: number;
      ghaltiCount: number;
      atkanCount: number;
      total: number;
      lastMarkedDate: string;
    }
  > = {};

  studentMarks.forEach(m => {
    if (!wordFrequencyMap[m.wordId]) {
      wordFrequencyMap[m.wordId] = {
        wordId: m.wordId,
        page: m.page,
        line: m.line,
        wordIndex: m.wordIndex,
        ghaltiCount: 0,
        atkanCount: 0,
        total: 0,
        lastMarkedDate: m.date,
      };
    }
    if (m.type === 'ghalti') wordFrequencyMap[m.wordId].ghaltiCount += 1;
    if (m.type === 'atkan') wordFrequencyMap[m.wordId].atkanCount += 1;
    wordFrequencyMap[m.wordId].total += 1;
    if (m.date > wordFrequencyMap[m.wordId].lastMarkedDate) {
      wordFrequencyMap[m.wordId].lastMarkedDate = m.date;
    }
  });

  const weakWordsList = Object.values(wordFrequencyMap).sort((a, b) => b.total - a.total);

  const getStatusBadge = (status: PartStatus) => {
    if (status === 'passed') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#EBF3EE] text-[#143429] border border-[#2E6A54]">
          <CheckCircle2 className="w-3 h-3 text-[#1F4E3D]" />
          <span>{t.status.passed}</span>
        </span>
      );
    }
    if (status === 'repeat') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FDF2F2] text-[#7F1D1D] border border-[#B91C1C]">
          <XCircle className="w-3 h-3 text-[#B91C1C]" />
          <span>{t.status.repeat}</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F8F4EC] text-[#7A6C60] border border-[#DFCFA8]">
        <Clock className="w-3 h-3 text-[#7A6C60]" />
        <span>{t.status.pending}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 md:p-4 overflow-y-auto">
      <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header with Islamic dark coffee identity */}
        <div className="px-5 py-4 border-b-2 border-[#C5A059] flex items-center justify-between bg-[#241811] text-[#FCFAF6]">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-[#C5A059]" />
              <span>{t.historyModalTitle}</span>
              <span className="text-[#C5A059] text-xs">۞</span>
            </h2>
            <div className="text-xs text-[#DFCFA8] mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>{state.language === 'ur' ? student.urduName : student.name}</span>
              <StudentTypeBadge
                type={student.studentType || 'hifz'}
                language={state.language}
                size="xs"
              />
              <span>· {student.halqaName}</span>
              {student.memorizedPortionDesc && (
                <span className="text-[#DFCFA8] font-bold">
                  · {student.memorizedPortionDesc}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#DFCFA8] hover:text-[#FCFAF6] hover:bg-[#3E2B20] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 py-2.5 border-b border-[#DFCFA8] bg-[#F8F4EC] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('lessons')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'lessons'
                ? 'bg-[#241811] text-[#FCFAF6] border border-[#C5A059] shadow-xs'
                : 'bg-[#FCFAF6] text-[#42362E] hover:bg-[#F3ECE1] border border-[#DFCFA8]'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#C5A059]" />
            <span>{t.allLessonsTab}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#3E2B20] text-[#DFCFA8]">
              {studentDailyPlans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('weak_words')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'weak_words'
                ? 'bg-[#241811] text-[#FCFAF6] border border-[#C5A059] shadow-xs'
                : 'bg-[#FCFAF6] text-[#42362E] hover:bg-[#F3ECE1] border border-[#DFCFA8]'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-[#D97706]" />
            <span>{t.weakWordsTab}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#3E2B20] text-[#DFCFA8]">
              {weakWordsList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'sessions'
                ? 'bg-[#241811] text-[#FCFAF6] border border-[#C5A059] shadow-xs'
                : 'bg-[#FCFAF6] text-[#42362E] hover:bg-[#F3ECE1] border border-[#DFCFA8]'
            }`}
          >
            <History className="w-4 h-4 text-[#8F6E2B]" />
            <span>{t.sessionsTab}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#3E2B20] text-[#DFCFA8]">
              {studentSessions.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: Daily Lessons Log (Review Sabaq & Sabqi Ayat Selections) */}
          {activeTab === 'lessons' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#241811] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#8F6E2B]" />
                  <span>{t.dailyLessonHistory}</span>
                </h3>

                {/* Student-card Date Picker (inspect any saved date without changing Today) */}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-[#5A4333]">
                    <span className="font-semibold">
                      {state.language === 'ur' ? 'تاریخ منتخب کریں:' : 'View Date:'}
                    </span>
                    <input
                      type="date"
                      value={selectedDateFilter}
                      onChange={e => setSelectedDateFilter(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-[#DFCFA8] bg-white font-mono text-xs text-[#241811]"
                    />
                  </label>
                  {selectedDateFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedDateFilter('')}
                      className="px-2.5 py-1 rounded-lg border border-[#DFCFA8] bg-[#F8F4EC] hover:bg-[#F3ECE1] text-xs font-bold text-[#241811] cursor-pointer"
                    >
                      {state.language === 'ur' ? 'تمام تاریخیں' : 'All Dates'}
                    </button>
                  )}
                </div>
              </div>

              {student.typeChangeHistory && student.typeChangeHistory.length > 0 && (
                <div className="p-3 rounded-xl bg-[#F8F4EC] border border-[#DFCFA8] space-y-1.5">
                  <div className="text-xs font-bold text-[#241811] flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#8F6E2B]" />
                    <span>
                      {state.language === 'ur' ? 'قسم تبدیلی کا ریکارڈ' : 'Student Type Change Audit Log'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {[...student.typeChangeHistory].reverse().map(log => (
                      <div
                        key={log.id}
                        className="text-[11px] text-[#42362E] flex flex-wrap items-center justify-between gap-2 bg-white/80 px-2.5 py-1.5 rounded-lg border border-[#E8DCC4]"
                      >
                        <div>
                          <span className="font-bold uppercase text-[#1F4E3D]">{log.fromType}</span>
                          <span className="mx-1.5 text-[#8F6E2B]">→</span>
                          <span className="font-bold uppercase text-[#16365D]">{log.toType}</span>
                          <span className="text-[#7A6C60] ml-2">
                            by <strong>{state.language === 'ur' && log.changedByUrdu ? log.changedByUrdu : log.changedBy}</strong>
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-[#7A6C60]">
                          {new Date(log.changedAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(futureDatedPlansCount > 0 || halqaFutureSummary.totalCount > 0) && (
                <div className="px-3 py-2 rounded-xl bg-[#F8F4EC] border border-[#DFCFA8] text-[11px] text-[#5A4333] space-y-0.5">
                  <div>
                    Preserved from earlier demo clock (not deleted):{' '}
                    <strong>{halqaFutureSummary.totalCount}</strong> future-dated record(s) across the Halqa (
                    {halqaFutureSummary.dailyPlanEntriesCount} daily plans, {halqaFutureSummary.sessionResultsCount} exam sessions,{' '}
                    {halqaFutureSummary.marksCount} marks on {halqaFutureSummary.futureDates.join(', ')}).
                  </div>
                  {futureDatedPlansCount > 0 && (
                    <div>
                      This student has <strong>{futureDatedPlansCount}</strong> future-dated daily plan(s) listed below.
                    </div>
                  )}
                </div>
              )}

              {filteredDailyPlans.length === 0 ? (
                <div className="p-6 bg-[#F8F4EC] rounded-2xl border border-[#DFCFA8] text-center text-xs text-[#7A6C60]">
                  {selectedDateFilter
                    ? `No saved lesson record for ${selectedDateFilter}.`
                    : t.noLessonRecordsYet}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDailyPlans.map(day => {
                    const isToday = day.date === state.currentDate;
                    const isFutureDated = day.date > state.currentDate;
                    const sabaq = day.sabaq;
                    const sabqi = day.sabqi;
                    const manzil = day.manzil;

                    const sabaqStartAyah = sabaq.range?.startAyah || sabaq.startAyah;
                    const sabaqEndAyah = sabaq.range?.endAyah || sabaq.endAyah;
                    const sabqiStartAyah = sabqi.range?.startAyah || sabqi.startAyah;
                    const sabqiEndAyah = sabqi.range?.endAyah || sabqi.endAyah;

                    const showSabqiInDay =
                      !isNazra || Boolean(sabqi.range) || sabqi.status !== 'pending';
                    const showManzilInDay =
                      !isNazra || Boolean(manzil.range) || manzil.status !== 'pending';

                    return (
                      <div
                        key={day.date}
                        className={`rounded-2xl border transition-all p-4 ${
                          isToday
                            ? 'bg-[#FCFAF6] border-[#C5A059] ring-2 ring-[#C5A059]/30 shadow-xs'
                            : 'bg-[#FAF7F0] border-[#E8DCC4]'
                        }`}
                      >
                        {/* Date Header */}
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E8DCC4]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-[#241811] flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#8F6E2B]" />
                              <span>{day.date}</span>
                            </span>
                            {isToday && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1F4E3D] text-[#FCFAF6]">
                                {state.language === 'ur' ? 'آج' : 'Today'}
                              </span>
                            )}
                            {isFutureDated && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]">
                                Future-dated
                              </span>
                            )}
                          </div>
                          {!isNazra && day.sabaqFrozenDueToRevisionFail && (
                            <span className="text-[10px] font-bold text-[#92400E] bg-[#FEF3C7] border border-[#F59E0B] px-2 py-0.5 rounded">
                              Sabaq Frozen (Revision Focus)
                            </span>
                          )}
                        </div>

                        {/* Part Cards Grid: Sabaq | Sabqi | Manzil */}
                        <div
                          className={
                            showSabqiInDay || showManzilInDay
                              ? 'grid grid-cols-1 md:grid-cols-3 gap-3'
                              : 'grid grid-cols-1 gap-3'
                          }
                        >
                          {/* 1. SABAQ RECORD */}
                          <div className="bg-[#FCFAF6] border border-[#DFCFA8] rounded-xl p-3 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-[#241811] flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                                  <span>{t.parts.sabaq}</span>
                                </span>
                                {getStatusBadge(sabaq.status)}
                              </div>

                              {sabaq.range ? (
                                <>
                                  <div className="text-xs text-[#241811] font-semibold">
                                    {sabaq.range.surahName || sabaq.surahName || 'Quran'}
                                    <span className="text-[#8F6E2B] font-normal ml-1">
                                      (Para {sabaq.range.juzNumber || sabaq.juzNumber || 1})
                                    </span>
                                  </div>

                                  {sabaqStartAyah && sabaqEndAyah && (
                                    <div className="mt-1 text-xs font-mono text-[#1F4E3D] bg-[#EBF3EE] px-2 py-0.5 rounded font-bold inline-block">
                                      {sabaqStartAyah === sabaqEndAyah
                                        ? `Ayah ${sabaqStartAyah}`
                                        : `Ayat ${sabaqStartAyah} – ${sabaqEndAyah}`}
                                    </div>
                                  )}

                                  <div className="text-[11px] font-mono text-[#5A4333] mt-1.5">
                                    P{sabaq.range.start.page}:L{sabaq.range.start.line} to P{sabaq.range.end.page}:L{sabaq.range.end.line}
                                    <span className="text-[#8F6E2B] font-bold ml-1">({sabaq.range.linesCount} lines)</span>
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-[#78350F] italic mt-1">
                                  {t.sabaqNotAssignedYet}
                                </div>
                              )}
                            </div>

                            {onJumpToWord && sabaq.range && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!sabaq.range) return;
                                  onJumpToWord(sabaq.range.start.page, sabaq.range.start.wordId);
                                  onClose();
                                }}
                                className="mt-3 flex items-center justify-center gap-1 text-[11px] font-bold text-[#8F6E2B] hover:text-[#241811] bg-[#F8F4EC] hover:bg-[#F3ECE1] py-1 px-2 rounded-lg border border-[#DFCFA8] transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>{t.viewOnMushaf}</span>
                              </button>
                            )}
                          </div>

                          {/* 2. SABQI RECORD */}
                          {showSabqiInDay && (
                          <div className="bg-[#FCFAF6] border border-[#DFCFA8] rounded-xl p-3 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-[#241811] flex items-center gap-1">
                                  <Layers className="w-3.5 h-3.5 text-[#8F6E2B]" />
                                  <span>{t.parts.sabqi}</span>
                                </span>
                                {getStatusBadge(sabqi.status)}
                              </div>

                              <div className="text-xs text-[#241811] font-semibold">
                                {sabqi.portionLabel || 'Teacher Assigned Revision'}
                              </div>

                              {sabqiStartAyah && sabqiEndAyah && (
                                <div className="mt-1 text-xs font-mono text-[#1F4E3D] bg-[#EBF3EE] px-2 py-0.5 rounded font-bold inline-block">
                                  {sabqiStartAyah === sabqiEndAyah
                                    ? `Ayah ${sabqiStartAyah}`
                                    : `Ayat ${sabqiStartAyah} – ${sabqiEndAyah}`}
                                </div>
                              )}

                              {sabqi.range && (
                                <div className="text-[11px] font-mono text-[#5A4333] mt-1.5">
                                  P{sabqi.range.start.page}:L{sabqi.range.start.line} to P{sabqi.range.end.page}:L{sabqi.range.end.line}
                                  <span className="text-[#8F6E2B] font-bold ml-1">({sabqi.range.linesCount} lines)</span>
                                </div>
                              )}
                            </div>

                            {onJumpToWord && sabqi.range && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!sabqi.range) return;
                                  onJumpToWord(sabqi.range.start.page, sabqi.range.start.wordId);
                                  onClose();
                                }}
                                className="mt-3 flex items-center justify-center gap-1 text-[11px] font-bold text-[#8F6E2B] hover:text-[#241811] bg-[#F8F4EC] hover:bg-[#F3ECE1] py-1 px-2 rounded-lg border border-[#DFCFA8] transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>{t.viewOnMushaf}</span>
                              </button>
                            )}
                          </div>
                          )}

                          {/* 3. MANZIL RECORD */}
                          {showManzilInDay && (
                          <div className="bg-[#FCFAF6] border border-[#DFCFA8] rounded-xl p-3 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-[#241811] flex items-center gap-1">
                                  <BookmarkCheck className="w-3.5 h-3.5 text-[#1F4E3D]" />
                                  <span>{t.parts.manzil}</span>
                                </span>
                                {getStatusBadge(manzil.status)}
                              </div>

                              <div className="text-xs text-[#241811] font-semibold">
                                {manzil.assignedParas && manzil.assignedParas.length > 0
                                  ? `Para ${manzil.assignedParas.join(', ')}`
                                  : manzil.range
                                  ? `Pages ${manzil.range.start.page} – ${manzil.range.end.page}`
                                  : 'Not assigned'}
                              </div>

                              {manzil.range && (
                                <div className="text-[11px] font-mono text-[#5A4333] mt-1.5">
                                  Pages {manzil.range.start.page} to {manzil.range.end.page}
                                  <span className="text-[#8F6E2B] font-bold ml-1">({manzil.range.linesCount} lines)</span>
                                </div>
                              )}
                            </div>

                            {onJumpToWord && manzil.range && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!manzil.range) return;
                                  onJumpToWord(manzil.range.start.page, manzil.range.start.wordId);
                                  onClose();
                                }}
                                className="mt-3 flex items-center justify-center gap-1 text-[11px] font-bold text-[#8F6E2B] hover:text-[#241811] bg-[#F8F4EC] hover:bg-[#F3ECE1] py-1 px-2 rounded-lg border border-[#DFCFA8] transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>{t.viewOnMushaf}</span>
                              </button>
                            )}
                          </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Weak Words & Recurring Mistakes */}
          {activeTab === 'weak_words' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#241811] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-[#D97706]" />
                  <span>{t.frequentMistakes}</span>
                </h3>
                <span className="text-xs text-[#7A6C60]">
                  {t.tapWordToViewOnPage}
                </span>
              </div>

              {weakWordsList.length === 0 ? (
                <div className="p-4 bg-[#F8F4EC] rounded-xl border border-[#DFCFA8] text-center text-xs text-[#7A6C60]">
                  {t.noWeakWordsYet}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {weakWordsList.map(item => (
                    <div
                      key={item.wordId}
                      onClick={() => {
                        if (onJumpToWord) {
                          onJumpToWord(item.page, item.wordId);
                          onClose();
                        }
                      }}
                      className="p-3 bg-[#F8F4EC] hover:bg-[#F3ECE1] border border-[#DFCFA8] hover:border-[#C5A059] rounded-xl transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
                    >
                      <div>
                        <div className="text-xs font-mono font-bold text-[#241811] flex items-center gap-1">
                          <span>P{item.page} : L{item.line}</span>
                          <span className="text-[#8F6E2B] font-normal">W{item.wordIndex}</span>
                        </div>
                        <div className="text-[11px] text-[#42362E] mt-0.5">
                          <span className="text-[#B91C1C] font-bold">{item.ghaltiCount} {t.ghaltiShort}</span>
                          <span className="text-[#C5A059] mx-1">·</span>
                          <span className="text-[#D97706] font-bold">{item.atkanCount} {t.atkanShort}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FAF6EF] text-[#241811] border border-[#DFCFA8]">
                          {item.total}×
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#8F6E2B] group-hover:text-[#241811] transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Recent Listening Sessions */}
          {activeTab === 'sessions' && (
            <div>
              <h3 className="text-sm font-bold text-[#241811] mb-3 flex items-center gap-1.5">
                <History className="w-4 h-4 text-[#8F6E2B]" />
                <span>{t.recentSessions}</span>
              </h3>

              {studentSessions.length === 0 ? (
                <div className="p-4 bg-[#F8F4EC] rounded-xl border border-[#DFCFA8] text-center text-xs text-[#7A6C60]">
                  {t.noSessionsYet}
                </div>
              ) : (
                <div className="divide-y divide-[#DFCFA8] border border-[#DFCFA8] rounded-xl overflow-hidden bg-[#FCFAF6]">
                  {studentSessions.map(session => {
                    const isPassed = session.finalResult === 'passed';
                    return (
                      <div key={session.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF6EF] transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#241811] capitalize">
                              {t.parts[session.part]}
                            </span>
                            <span className="text-[#C5A059] text-xs">·</span>
                            <span className="text-xs font-mono text-[#8F6E2B]">
                              {session.date}
                            </span>
                            {session.isOverridden && (
                              <span className="text-[10px] bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B] px-1.5 py-0.2 rounded font-semibold">
                                {t.overriddenBadge}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-[#5A4333] font-mono mt-1">
                            Range: P{session.range.start.page}:L{session.range.start.line} to P{session.range.end.page}:L{session.range.end.line} ({session.range.linesCount} {t.linesCount})
                          </div>
                        </div>

                        {/* Marks vs Limit badge */}
                        <div className="flex items-center gap-3">
                          <div className="text-xs font-mono text-right">
                            <div className={session.ghaltiCount >= session.ghaltiLimit ? 'text-[#B91C1C] font-bold' : 'text-[#241811]'}>
                              {t.ghaltiShort}: {session.ghaltiCount} (limit {session.ghaltiLimit})
                            </div>
                            <div className={session.atkanCount >= session.atkanLimit ? 'text-[#D97706] font-bold' : 'text-[#5A4333]'}>
                              {t.atkanShort}: {session.atkanCount} (limit {session.atkanLimit})
                            </div>
                          </div>

                          {/* Result Badge */}
                          <div
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                              isPassed
                                ? 'bg-[#EBF3EE] text-[#143429] border border-[#2E6A54]'
                                : 'bg-[#FDF2F2] text-[#7F1D1D] border border-[#B91C1C]'
                            }`}
                          >
                            {isPassed ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#1F4E3D]" />
                                <span>{t.passButton}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-[#B91C1C]" />
                                <span>{t.repeatButton}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#DFCFA8] bg-[#FCFAF6] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#DFCFA8] rounded-xl text-[#42362E] hover:bg-[#F3ECE1] text-xs md:text-sm font-semibold transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
