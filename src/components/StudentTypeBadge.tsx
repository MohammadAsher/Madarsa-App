/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookMarked, BookOpenCheck } from 'lucide-react';
import { StudentType } from '../types/hifz';
import { translations } from '../i18n/translations';

interface StudentTypeBadgeProps {
  type: StudentType;
  language: 'en' | 'ur';
  size?: 'xs' | 'sm';
}

export const StudentTypeBadge: React.FC<StudentTypeBadgeProps> = ({
  type,
  language,
  size = 'xs',
}) => {
  const t = translations[language];
  const isHifz = type !== 'nazra';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-bold tracking-wide shrink-0 ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]'
      } ${
        isHifz
          ? 'bg-[#E8F0EC] text-[#1F4E3D] border-[#2E6A54]/50'
          : 'bg-[#E8EEF6] text-[#16365D] border-[#16365D]/40'
      }`}
    >
      {isHifz ? (
        <BookMarked className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      ) : (
        <BookOpenCheck className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      )}
      <span>{isHifz ? t.studentTypeHifz : t.studentTypeNazra}</span>
    </span>
  );
};
