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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-700" />
              <span>{t.historyModalTitle}</span>
            </h2>
            <div className="text-xs text-stone-500 mt-0.5">
              {state.language === 'ur' ? student.urduName : student.name} · {student.halqaName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Tabs / Split view */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 1: Weak Words & Recurring Mistakes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>{t.frequentMistakes}</span>
              </h3>
              <span className="text-xs text-stone-500">
                {t.tapWordToViewOnPage}
              </span>
            </div>

            {weakWordsList.length === 0 ? (
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-center text-xs text-stone-500">
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
                    className="p-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-mono font-bold text-stone-900 flex items-center gap-1">
                        <span>P{item.page} : L{item.line}</span>
                        <span className="text-stone-400 font-normal">W{item.wordIndex}</span>
                      </div>
                      <div className="text-[11px] text-stone-600 mt-0.5">
                        <span className="text-rose-700 font-semibold">{item.ghaltiCount} {t.ghaltiShort}</span>
                        <span className="text-stone-300 mx-1">·</span>
                        <span className="text-amber-700 font-semibold">{item.atkanCount} {t.atkanShort}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-700">
                        {item.total}×
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-800 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Recent Listening Sessions */}
          <div>
            <h3 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-700" />
              <span>{t.recentSessions}</span>
            </h3>

            {studentSessions.length === 0 ? (
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-center text-xs text-stone-500">
                {t.noSessionsYet}
              </div>
            ) : (
              <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl overflow-hidden bg-white">
                {studentSessions.map(session => {
                  const isPassed = session.finalResult === 'passed';
                  return (
                    <div key={session.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-800 capitalize">
                            {t.parts[session.part]}
                          </span>
                          <span className="text-stone-400 text-xs">·</span>
                          <span className="text-xs font-mono text-stone-500">
                            {session.date}
                          </span>
                          {session.isOverridden && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-medium">
                              {t.overriddenBadge}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-stone-600 font-mono mt-1">
                          Range: P{session.range.start.page}:L{session.range.start.line} to P{session.range.end.page}:L{session.range.end.line} ({session.range.linesCount} {t.linesCount})
                        </div>
                      </div>

                      {/* Marks vs Limit badge */}
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-mono text-right">
                          <div className={session.ghaltiCount >= session.ghaltiLimit ? 'text-rose-700 font-bold' : 'text-stone-700'}>
                            {t.ghaltiShort}: {session.ghaltiCount} (limit {session.ghaltiLimit})
                          </div>
                          <div className={session.atkanCount >= session.atkanLimit ? 'text-amber-700 font-bold' : 'text-stone-600'}>
                            {t.atkanShort}: {session.atkanCount} (limit {session.atkanLimit})
                          </div>
                        </div>

                        {/* Result Badge */}
                        <div
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                            isPassed
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {isPassed ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{t.passButton}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
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
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-stone-300 rounded-xl text-stone-700 hover:bg-white text-xs md:text-sm font-medium transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
