/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Award, Check, BookOpen, ArrowRight } from 'lucide-react';
import { MadrasaState, StudentProfile } from '../types/hifz';
import { getJuzMetadata, getParaSurahName } from '../data/quranData';
import { translations } from '../i18n/translations';

interface StartNewParaModalProps {
  state: MadrasaState;
  student: StudentProfile;
  onClose: () => void;
  onConfirm: (studentId: string, chosenNextPara: number) => void;
}

export const StartNewParaModal: React.FC<StartNewParaModalProps> = ({
  state,
  student,
  onClose,
  onConfirm,
}) => {
  const t = translations[state.language];
  const finishedPara = student.currentJuz;
  const defaultNextPara = finishedPara < 30 ? finishedPara + 1 : 1;

  // Pick first uncompleted Para if defaultNextPara is already completed
  const completedSet = new Set([...(student.completedParas || []), finishedPara]);
  const firstAvailable =
    !completedSet.has(defaultNextPara)
      ? defaultNextPara
      : Array.from({ length: 30 }, (_, i) => i + 1).find(p => !completedSet.has(p)) || defaultNextPara;

  const [selectedNextPara, setSelectedNextPara] = useState<number>(firstAvailable);
  const chosenMeta = getJuzMetadata(selectedNextPara);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-[#C5A059] bg-[#241811] text-[#FCFAF6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-[#C5A059]" />
            <div>
              <h2 className="text-base md:text-lg font-bold">
                {t.startNewParaTitle}
              </h2>
              <p className="text-xs text-[#DFCFA8]">
                {state.language === 'ur' ? student.urduName : student.name}
              </p>
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

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Completed Para Summary */}
          <div className="p-3.5 rounded-xl bg-[#EBF3EE] border border-[#2E6A54] text-[#143429] text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#1F4E3D]" />
              <span>
                {state.language === 'ur'
                  ? `پارہ ${finishedPara} (${getParaSurahName(finishedPara)}) کے تمام اسباق پاس ہو چکے ہیں`
                  : `All Sabaqs in Para ${finishedPara} (${getParaSurahName(finishedPara)}) are passed!`}
              </span>
            </div>
            <p className="text-[11px] opacity-90">
              {state.language === 'ur'
                ? `پارہ ${finishedPara} اب طالب علم کے مکمل شدہ پاروں (منزل) میں شامل کر دیا جائے گا اور نئے پارے کا پہلا سبق مقرر ہو جائے گا۔`
                : `Para ${finishedPara} will move to ${student.name.split(' ')[0]}'s completed Paras pool (Manzil), Sabqi will reset for the new Para, and the first Sabaq of the selected Para will be assigned.`}
            </p>
          </div>

          {/* 30-Para Grid Picker */}
          <div>
            <label className="block text-xs font-bold text-[#241811] mb-2">
              {t.pickNextParaLabel}
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
              {Array.from({ length: 30 }, (_, i) => i + 1).map(pNum => {
                const isJustFinished = pNum === finishedPara;
                const isAlreadyDone = student.completedParas?.includes(pNum);
                const isSelected = selectedNextPara === pNum;

                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setSelectedNextPara(pNum)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-[#241811] text-[#FCFAF6] border-[#C5A059] ring-2 ring-[#C5A059] scale-[1.03]'
                        : isJustFinished || isAlreadyDone
                        ? 'bg-[#E8F0EC] text-[#1F4E3D] border-[#2E6A54]/40 hover:border-[#C5A059]'
                        : 'bg-[#F8F4EC] text-[#241811] border-[#DFCFA8] hover:bg-[#F3ECE1]'
                    }`}
                    title={`Para ${pNum} (${getParaSurahName(pNum)})`}
                  >
                    <span>P{pNum}</span>
                    {(isJustFinished || isAlreadyDone) && (
                      <span className="text-[9px] font-normal opacity-80">Done</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected New Para Preview */}
          <div className="p-3.5 rounded-xl bg-[#F8F4EC] border border-[#DFCFA8] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-[#8F6E2B] shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-[#241811]">
                  Next: Para {selectedNextPara} — {getParaSurahName(selectedNextPara)}
                </div>
                <div className="text-[11px] text-[#5A4333] font-mono mt-0.5">
                  Starts at Page {chosenMeta.startLoc.page}, Line {chosenMeta.startLoc.line} (Pages {chosenMeta.startPage}–{chosenMeta.endPage})
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#8F6E2B] shrink-0" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#DFCFA8] bg-[#FAF6EF] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#DFCFA8] text-[#42362E] hover:bg-[#F3ECE1] text-xs font-semibold cursor-pointer"
          >
            {t.close}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(student.id, selectedNextPara);
              onClose();
            }}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1F4E3D] hover:bg-[#16382C] text-white border border-[#C5A059] text-xs font-bold shadow-xs cursor-pointer"
          >
            <Check className="w-4 h-4 text-[#DFCFA8]" />
            <span>{t.confirmStartNewPara} (Para {selectedNextPara})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
