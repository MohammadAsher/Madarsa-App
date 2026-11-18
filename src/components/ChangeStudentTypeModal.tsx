/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, ArrowLeftRight, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { StudentProfile, StudentType, UstaadProfile } from '../types/hifz';
import { translations } from '../i18n/translations';
import { StudentTypeBadge } from './StudentTypeBadge';

interface ChangeStudentTypeModalProps {
  student: StudentProfile;
  ustaad: UstaadProfile;
  language: 'en' | 'ur';
  currentDate: string;
  onClose: () => void;
  onConfirm: (studentId: string, newType: StudentType) => void;
}

export const ChangeStudentTypeModal: React.FC<ChangeStudentTypeModalProps> = ({
  student,
  ustaad,
  language,
  currentDate,
  onClose,
  onConfirm,
}) => {
  const t = translations[language];
  const isUr = language === 'ur';
  const fromType: StudentType = student.studentType || 'hifz';
  const toType: StudentType = fromType === 'hifz' ? 'nazra' : 'hifz';

  const hasStoredHifz =
    Boolean(student.hasStoredHifzProgress) ||
    (student.completedParas && student.completedParas.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-[#C5A059] bg-[#241811] text-[#FCFAF6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ArrowLeftRight className="w-5 h-5 text-[#C5A059]" />
            <div>
              <h2 className="text-base font-bold">{t.changeTypeModalTitle}</h2>
              <p className="text-xs text-[#DFCFA8]">
                {isUr ? student.urduName : student.name}
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

        {/* Body */}
        <div className="p-5 space-y-4 text-xs sm:text-sm">
          <div className="p-3.5 rounded-xl bg-[#F8F4EC] border border-[#DFCFA8] flex flex-wrap items-center justify-center gap-3">
            <StudentTypeBadge type={fromType} language={language} size="sm" />
            <span className="font-bold text-[#8F6E2B]">→</span>
            <StudentTypeBadge type={toType} language={language} size="sm" />
          </div>

          <div className="p-3.5 rounded-xl bg-[#EBF3EE] border border-[#2E6A54]/50 text-[#143429] text-xs flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#1F4E3D] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">
                {isUr
                  ? 'تمام سابقہ ریکارڈ محفوظ رہے گا'
                  : 'All student history is always kept'}
              </div>
              <p className="mt-0.5 opacity-90">
                {isUr
                  ? 'اسباق، غلطیوں کے نشانات، اور امتحانی نتائج میں سے کچھ بھی حذف نہیں کیا جائے گا۔'
                  : 'All past assignments, mistake marks, and exam results remain intact.'}
              </p>
            </div>
          </div>

          {toType === 'nazra' ? (
            <div className="p-3.5 rounded-xl bg-[#E8EEF6] border border-[#16365D]/40 text-[#16365D] text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  {isUr
                    ? 'ناظرہ میں تبدیلی کا طریقہ کار'
                    : 'Switching from Hifz to Nazra'}
                </div>
                <p className="mt-0.5">
                  {isUr
                    ? 'سبقی اور منزل کو صرف چھپایا جائے گا، حذف نہیں کیا جائے گا۔ اگر آپ دوبارہ حفظ میں تبدیل کریں گے تو سب کچھ محفوظ ملے گا۔'
                    : 'Sabqi and Manzil will be hidden while in Nazra, but will NOT be deleted — they stay stored so nothing is lost if changed back to Hifz.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#FEF3C7] border border-[#D97706]/60 text-[#78350F] text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  {isUr
                    ? 'حفظ میں تبدیلی کا طریقہ کار'
                    : 'Switching from Nazra to Hifz'}
                </div>
                <p className="mt-0.5">
                  {hasStoredHifz
                    ? isUr
                      ? 'پہلے سے محفوظ شدہ حفظ کی سبقی اور منزل بحال ہو جائیں گی۔ ناظرہ میں پڑھے گئے پارے منزل میں شامل نہیں ہوں گے۔'
                      : 'Previously stored Hifz Sabqi, Manzil, and completed Paras will be restored. Any Paras read in Nazra are NOT moved into Manzil.'
                    : isUr
                    ? 'حفظ کی نگرانی نئے سرے سے شروع ہوگی: سبقی اور منزل خالی ہوں گے، اور ناظرہ میں پڑھے گئے پارے منزل میں شامل نہیں کیے جائیں گے۔'
                    : 'Hifz tracking will start fresh: Sabqi and Manzil will start empty, and any Paras read in Nazra will NOT be moved into Manzil.'}
                </p>
              </div>
            </div>
          )}

          <div className="text-[11px] text-[#5A4333] flex items-center gap-1.5 bg-[#FAF6EF] border border-[#E8DCC4] rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5 text-[#8F6E2B] shrink-0" />
            <span>
              {isUr
                ? `تبدیلی درج کی جائے گی: ${ustaad.urduName} (${currentDate})`
                : `Recorded by ${ustaad.name} (${currentDate})`}
            </span>
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
              onConfirm(student.id, toType);
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-[#241811] hover:bg-[#38271D] text-[#FCFAF6] border border-[#C5A059] text-xs font-bold shadow-xs cursor-pointer"
          >
            {t.confirmChangeTypeButton} ({toType === 'hifz' ? t.studentTypeHifz : t.studentTypeNazra})
          </button>
        </div>
      </div>
    </div>
  );
};
