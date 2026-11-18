/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, UserPlus, BookMarked, BookOpenCheck, AlertCircle, Check } from 'lucide-react';
import { MadrasaState, StudentProfile, StudentType, UstaadProfile } from '../types/hifz';
import { translations } from '../i18n/translations';
import { getParaSurahName } from '../data/quranData';

interface AddStudentModalProps {
  state: MadrasaState;
  ustaad: UstaadProfile;
  onClose: () => void;
  onAddStudent: (newStudent: StudentProfile) => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  state,
  ustaad,
  onClose,
  onAddStudent,
}) => {
  const t = translations[state.language];
  const isUr = state.language === 'ur';

  // Rule 1: Student type is asked FIRST and NOTHING is pre-selected
  const [studentType, setStudentType] = useState<StudentType | null>(null);
  const [typeError, setTypeError] = useState<boolean>(false);

  // Existing student fields
  const [name, setName] = useState<string>('');
  const [urduName, setUrduName] = useState<string>('');
  const [nameError, setNameError] = useState<boolean>(false);
  const [selectedUstaadId, setSelectedUstaadId] = useState<'ustaad_a' | 'ustaad_b'>(ustaad.id);
  const [enrollmentDate, setEnrollmentDate] = useState<string>(state.currentDate);
  const [currentJuz, setCurrentJuz] = useState<number>(1);
  const [completedParas, setCompletedParas] = useState<number[]>([]);
  const [nazraCompletedParas, setNazraCompletedParas] = useState<number[]>([]);
  const [memorizedPortionDesc, setMemorizedPortionDesc] = useState<string>('');

  // Rule 6: Layout choice (Hifz/Hafizi or Madinah mushaf) in the same form
  const [mushafLayout, setMushafLayout] = useState<'hafizi' | 'madinah'>(
    state.settings.mushafLayout || 'madinah'
  );

  const toggleParaInList = (paraNum: number) => {
    if (studentType === 'nazra') {
      setNazraCompletedParas(prev =>
        prev.includes(paraNum)
          ? prev.filter(p => p !== paraNum)
          : [...prev, paraNum].sort((a, b) => a - b)
      );
    } else {
      setCompletedParas(prev =>
        prev.includes(paraNum)
          ? prev.filter(p => p !== paraNum)
          : [...prev, paraNum].sort((a, b) => a - b)
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let invalid = false;
    if (!studentType) {
      setTypeError(true);
      invalid = true;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(true);
      invalid = true;
    }
    if (invalid || !studentType) return;

    const targetUstaad = state.ustaads[selectedUstaadId] || ustaad;
    const halqaDisplay =
      selectedUstaadId === 'ustaad_a'
        ? `${targetUstaad.halqaName} (Ustaad A)`
        : `${targetUstaad.halqaName} (Ustaad B)`;

    const activeCompleted = studentType === 'hifz' ? completedParas : [];
    const activeNazraParas = studentType === 'nazra' ? nazraCompletedParas : [];
    const autoDesc =
      memorizedPortionDesc.trim() ||
      (studentType === 'hifz'
        ? activeCompleted.length > 0
          ? `Completed ${activeCompleted.length} Paras · In Para ${currentJuz}`
          : `In Para ${currentJuz} (${getParaSurahName(currentJuz)})`
        : activeNazraParas.length > 0
        ? `Nazra: Read ${activeNazraParas.length} Paras · Current Para ${currentJuz}`
        : `Nazra: Reading Para ${currentJuz} (${getParaSurahName(currentJuz)})`);

    const newStudent: StudentProfile = {
      id: `student_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      urduName: urduName.trim() || trimmedName,
      studentType,
      mushafLayout,
      ustaadId: selectedUstaadId,
      halqaName: halqaDisplay,
      enrollmentDate: enrollmentDate || state.currentDate,
      currentJuz,
      currentParaStartDate: state.currentDate,
      completedParas: activeCompleted,
      nazraCompletedParas: activeNazraParas,
      memorizedPortionDesc: autoDesc,
      typeChangeHistory: [],
    };

    onAddStudent(newStudent);
    onClose();
  };

  const activeParaPool = studentType === 'nazra' ? nazraCompletedParas : completedParas;

  return (
    <div className="fixed inset-0 z-50 flex items-start [@media(min-height:600px)]:items-center justify-center bg-black/65 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-2xl [@media(min-height:600px)]:max-h-[92vh] flex flex-col [@media(min-height:600px)]:overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-[#C5A059] bg-[#241811] text-[#FCFAF6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-[#C5A059]" />
            <div>
              <h2 className="text-base md:text-lg font-bold">{t.addStudentTitle}</h2>
              <p className="text-xs text-[#DFCFA8]">
                {isUr ? ustaad.urduName : ustaad.name} · {ustaad.halqaName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="p-1.5 text-[#DFCFA8] hover:text-[#FCFAF6] hover:bg-[#3E2B20] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 1. REQUIRED FIRST FIELD: Student Type (Hifz or Nazra) — nothing pre-selected */}
          <div
            className={`p-4 rounded-xl border-2 transition-colors ${
              typeError && !studentType
                ? 'bg-rose-50 border-[#B91C1C]'
                : 'bg-[#F8F4EC] border-[#DFCFA8]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <label className="text-xs sm:text-sm font-bold text-[#241811]">
                1. {t.studentTypeLabel} <span className="text-[#B91C1C]">*</span>
              </label>
              <span className="text-[11px] font-semibold text-[#7A6C60]">
                {isUr ? 'انتخاب ضروری ہے' : 'Required — select one'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setStudentType('hifz');
                  setTypeError(false);
                }}
                aria-pressed={studentType === 'hifz'}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  studentType === 'hifz'
                    ? 'bg-[#E8F0EC] border-[#1F4E3D] ring-2 ring-[#1F4E3D]/25 shadow-xs'
                    : 'bg-white border-[#DFCFA8] hover:border-[#C5A059]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    studentType === 'hifz'
                      ? 'bg-[#1F4E3D] text-white'
                      : 'bg-[#F8F4EC] text-[#1F4E3D]'
                  }`}
                >
                  <BookMarked className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-[#241811] flex items-center gap-1.5">
                    <span>{t.studentTypeHifz}</span>
                    {studentType === 'hifz' && <Check className="w-4 h-4 text-[#1F4E3D]" />}
                  </div>
                  <div className="text-[11px] text-[#5A4333] mt-0.5">{t.studentTypeHifzDesc}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStudentType('nazra');
                  setTypeError(false);
                }}
                aria-pressed={studentType === 'nazra'}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  studentType === 'nazra'
                    ? 'bg-[#E8EEF6] border-[#16365D] ring-2 ring-[#16365D]/25 shadow-xs'
                    : 'bg-white border-[#DFCFA8] hover:border-[#C5A059]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    studentType === 'nazra'
                      ? 'bg-[#16365D] text-white'
                      : 'bg-[#F8F4EC] text-[#16365D]'
                  }`}
                >
                  <BookOpenCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-[#241811] flex items-center gap-1.5">
                    <span>{t.studentTypeNazra}</span>
                    {studentType === 'nazra' && <Check className="w-4 h-4 text-[#16365D]" />}
                  </div>
                  <div className="text-[11px] text-[#5A4333] mt-0.5">{t.studentTypeNazraDesc}</div>
                </div>
              </button>
            </div>

            {typeError && !studentType && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-[#991B1B]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{t.studentTypeRequiredError}</span>
              </div>
            )}
          </div>

          {/* 2. Existing Student Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#241811] mb-1">
                {t.studentNameEnLabel} <span className="text-[#B91C1C]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (e.target.value.trim()) setNameError(false);
                }}
                placeholder={isUr ? 'مثال: انس بن مالک' : 'e.g. Anas ibn Malik'}
                className={`w-full px-3 py-2 rounded-xl border text-sm bg-white text-[#241811] focus:outline-none focus:ring-2 focus:ring-[#C5A059] ${
                  nameError ? 'border-[#B91C1C]' : 'border-[#DFCFA8]'
                }`}
              />
              {nameError && (
                <p className="text-[11px] text-[#991B1B] font-semibold mt-1">
                  {isUr ? 'طالب علم کا نام درج کریں' : 'Please enter the student name.'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#241811] mb-1">
                {t.studentNameUrLabel}
              </label>
              <input
                type="text"
                dir="rtl"
                value={urduName}
                onChange={e => setUrduName(e.target.value)}
                placeholder="مثال: انس بن مالک"
                className="w-full px-3 py-2 rounded-xl border border-[#DFCFA8] text-sm bg-white text-[#241811] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#241811] mb-1">
                {t.activeHalqa}
              </label>
              <select
                value={selectedUstaadId}
                onChange={e => setSelectedUstaadId(e.target.value as 'ustaad_a' | 'ustaad_b')}
                className="w-full px-3 py-2 rounded-xl border border-[#DFCFA8] text-sm bg-white text-[#241811] font-medium focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              >
                {(['ustaad_a', 'ustaad_b'] as const).map(uid => {
                  const u = state.ustaads[uid];
                  if (!u) return null;
                  return (
                    <option key={uid} value={uid}>
                      {u.halqaName} ({isUr ? u.urduName : u.name})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#241811] mb-1">
                {t.enrollmentDateLabel}
              </label>
              <input
                type="date"
                value={enrollmentDate}
                onChange={e => setEnrollmentDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DFCFA8] text-sm font-mono bg-white text-[#241811] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#241811] mb-1">
                {t.startingParaLabel}
              </label>
              <select
                value={currentJuz}
                onChange={e => setCurrentJuz(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl border border-[#DFCFA8] text-sm bg-white text-[#241811] font-medium focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map(p => (
                  <option key={p} value={p}>
                    {isUr ? `پارہ ${p}` : `Para ${p}`} — {getParaSurahName(p)}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Mushaf Layout choice (Hifz or Madinah mushaf) in the same form */}
            <div>
              <label className="block text-xs font-bold text-[#241811] mb-1">
                {t.mushafLayoutLabel}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMushafLayout('madinah')}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    mushafLayout === 'madinah'
                      ? 'bg-[#241811] text-[#FCFAF6] border-[#C5A059]'
                      : 'bg-white text-[#42362E] border-[#DFCFA8] hover:bg-[#F3ECE1]'
                  }`}
                >
                  {isUr ? 'مدنی (۶۰۴)' : 'Madinah (604p)'}
                </button>
                <button
                  type="button"
                  onClick={() => setMushafLayout('hafizi')}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    mushafLayout === 'hafizi'
                      ? 'bg-[#241811] text-[#FCFAF6] border-[#C5A059]'
                      : 'bg-white text-[#42362E] border-[#DFCFA8] hover:bg-[#F3ECE1]'
                  }`}
                >
                  {isUr ? 'حافظی / حفظ (۶۱۰)' : 'Hifz / Hafizi (610p)'}
                </button>
              </div>
            </div>
          </div>

          {/* Optional note / description */}
          <div>
            <label className="block text-xs font-bold text-[#241811] mb-1">
              {isUr ? 'موجودہ کیفیت / تفصیل (اختیاری)' : 'Portion / Progress Note (optional)'}
            </label>
            <input
              type="text"
              value={memorizedPortionDesc}
              onChange={e => setMemorizedPortionDesc(e.target.value)}
              placeholder={
                studentType === 'nazra'
                  ? isUr
                    ? 'مثال: پارہ ۱ ناظرہ شروع'
                    : 'e.g. Reading Para 1 fluently'
                  : isUr
                  ? 'مثال: ۲ پارے مکمل، تیسرا پارہ جاری'
                  : 'e.g. Completed 2 Paras · In Para 3'
              }
              className="w-full px-3 py-2 rounded-xl border border-[#DFCFA8] text-sm bg-white text-[#241811] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
            />
          </div>

          {/* Optional Prior Completed Paras (only shown once type is chosen) */}
          {studentType !== null && (
            <div className="p-3.5 rounded-xl border border-[#DFCFA8] bg-[#F8F4EC] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#241811]">
                  {studentType === 'nazra' ? t.parasReadInNazra : t.completedParas}{' '}
                  <span className="font-normal text-[#7A6C60]">
                    ({isUr ? 'اختیاری' : 'optional'})
                  </span>
                </span>
                <span className="font-mono font-bold text-[#1F4E3D]">
                  {activeParaPool.length} / 30
                </span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-10 gap-1">
                {Array.from({ length: 30 }, (_, i) => i + 1).map(pNum => {
                  const selected = activeParaPool.includes(pNum);
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => toggleParaInList(pNum)}
                      className={`py-1 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                        selected
                          ? studentType === 'nazra'
                            ? 'bg-[#16365D] text-white border-[#16365D]'
                            : 'bg-[#1F4E3D] text-white border-[#C5A059]'
                          : 'bg-white text-[#5A4333] border-[#DFCFA8] hover:bg-[#F3ECE1]'
                      }`}
                    >
                      P{pNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-[#DFCFA8] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#DFCFA8] text-[#42362E] hover:bg-[#F3ECE1] text-xs font-semibold cursor-pointer"
            >
              {t.close}
            </button>
            <button
              type="submit"
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl border text-xs font-bold shadow-xs transition-colors cursor-pointer ${
                studentType
                  ? 'bg-[#1F4E3D] hover:bg-[#16382C] text-white border-[#C5A059]'
                  : 'bg-[#5A4333] hover:bg-[#3E2B20] text-[#FCFAF6] border-[#C5A059]/60'
              }`}
            >
              <Check className="w-4 h-4 text-[#DFCFA8]" />
              <span>{t.saveStudentButton}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
