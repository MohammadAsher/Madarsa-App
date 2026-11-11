/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, History, AlertCircle, CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';
import { MadrasaState, StudentProfile, SessionResult, MistakeMark } from '../types/hifz';
import { translations } from '../i18n/translations';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 md:p-4 overflow-y-auto">
      <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header with Islamic dark coffee identity */}
        <div className="px-5 py-4 border-b-2 border-[#C5A059] flex items-center justify-between bg-[#241811] text-[#FCFAF6]">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-[#C5A059]" />
              <span>{t.historyModalTitle}</span>
              <span className="text-[#C5A059] text-xs">۞</span>
            </h2>
            <div className="text-xs text-[#DFCFA8] mt-0.5">
              {state.language === 'ur' ? student.urduName : student.name} · {student.halqaName}
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

        {/* Content Tabs / Split view */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 1: Weak Words & Recurring Mistakes */}
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

          {/* Section 2: Recent Listening Sessions */}
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
