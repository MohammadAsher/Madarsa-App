/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Original CSS + SVG Mushaf Illumination for Opening Pages (Pages 1 & 2).
 * All decorative borders, corner rosettes, and Surah cartouche ornaments live in
 * strictly separate layers from Quranic Arabic text so text data is untouched
 * and ornaments never overlap or sit behind text.
 */

import React, { useId } from 'react';

interface OpeningPageFrameProps {
  highContrast?: boolean;
  children: React.ReactNode;
}

/**
 * Corner Arabesque Rosette SVG (Original geometric + floral motif)
 * Traditional palette: deep green (#1B4D3E), gold (#C5A059), deep blue accent (#1D3557).
 */
const CornerRosette: React.FC<{
  positionClass: string;
  rotation: number;
  highContrast?: boolean;
}> = ({ positionClass, rotation, highContrast = false }) => {
  const green = highContrast ? '#000000' : '#1B4D3E';
  const gold = highContrast ? '#525252' : '#B88A36';
  const goldLight = highContrast ? '#E5E5E5' : '#EFE2BE';
  const blue = highContrast ? '#262626' : '#1D3557';

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className={`pointer-events-none select-none absolute w-8 h-8 sm:w-12 sm:h-12 z-20 ${positionClass}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* Outer stepped corner angle */}
      <path
        d="M2 2 H44 V10 C32 10 24 14 18 20 C12 26 10 34 10 44 H2 Z"
        fill={goldLight}
        stroke={green}
        strokeWidth="1.5"
      />
      {/* Inner deep green arch petal */}
      <path
        d="M5 5 H32 C23 8 16 14 12 22 C8 28 7 33 5 36 Z"
        fill={green}
      />
      {/* Gold geometric filigree star in corner */}
      <circle cx="15" cy="15" r="7" fill={gold} stroke={goldLight} strokeWidth="1" />
      <polygon
        points="15,9.5 16.7,13.3 20.5,15 16.7,16.7 15,20.5 13.3,16.7 9.5,15 13.3,13.3"
        fill={blue}
        stroke={goldLight}
        strokeWidth="0.6"
      />
      <circle cx="15" cy="15" r="1.8" fill={goldLight} />
      {/* Tiny scalloped floral dots along arms */}
      <circle cx="30" cy="8" r="1.5" fill={blue} />
      <circle cx="37" cy="6" r="1.2" fill={gold} />
      <circle cx="8" cy="30" r="1.5" fill={blue} />
      <circle cx="6" cy="37" r="1.2" fill={gold} />
    </svg>
  );
};

/**
 * Full Opening Page Illuminated Border Frame.
 * Uses a repeating SVG geometric-floral edge band strictly outside the opaque
 * cream Quran text panel, ensuring zero overlap with Arabic text.
 */
export const OpeningPageFrame: React.FC<OpeningPageFrameProps> = ({
  highContrast = false,
  children,
}) => {
  const uid = useId().replace(/:/g, '');
  const patternId = `mushaf_border_pattern_${uid}`;

  const green = highContrast ? '#000000' : '#1B4D3E';
  const gold = highContrast ? '#525252' : '#B88A36';
  const goldSoft = highContrast ? '#F5F5F5' : '#F4EAD0';
  const blue = highContrast ? '#262626' : '#1D3557';

  return (
    <div
      dir="rtl"
      className={`w-full max-w-4xl shrink-0 relative rounded-b-2xl shadow-2xl transition-colors duration-150 ${
        highContrast
          ? 'bg-white border-2 sm:border-4 border-black text-black'
          : 'bg-[#F8F1DE] border-2 sm:border-4 border-[#1B4D3E] text-[#111111]'
      }`}
    >
      {/* Layer 1 (Decorative Edge Layer Only — Strictly Behind & Outside Inner Cream Card) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden rounded-b-2xl"
      >
        {/* Repeating geometric 8-point rosette border pattern around perimeter */}
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id={patternId}
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <rect width="24" height="24" fill={goldSoft} />
              {/* Interlocking diamond lattice */}
              <path
                d="M12 0 L24 12 L12 24 L0 12 Z"
                fill="none"
                stroke={gold}
                strokeWidth="0.9"
                strokeOpacity="0.55"
              />
              {/* 8-pointed miniature rosette */}
              <circle cx="12" cy="12" r="4.2" fill={green} fillOpacity="0.16" stroke={green} strokeWidth="0.7" strokeOpacity="0.55" />
              <path
                d="M12 8.2 L13.2 10.8 L15.8 12 L13.2 13.2 L12 15.8 L10.8 13.2 L8.2 12 L10.8 10.8 Z"
                fill={blue}
                fillOpacity="0.35"
              />
              <circle cx="12" cy="12" r="1.2" fill={gold} />
              {/* Corner quarter dots */}
              <circle cx="0" cy="0" r="1.5" fill={green} fillOpacity="0.35" />
              <circle cx="24" cy="0" r="1.5" fill={green} fillOpacity="0.35" />
              <circle cx="0" cy="24" r="1.5" fill={green} fillOpacity="0.35" />
              <circle cx="24" cy="24" r="1.5" fill={green} fillOpacity="0.35" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>

        {/* Double hairline frame inset */}
        <div
          className={`absolute inset-1 sm:inset-1.5 border ${
            highContrast ? 'border-black' : 'border-[#B88A36]'
          }`}
        />

        {/* Four Corner Ornaments */}
        <CornerRosette positionClass="top-0.5 left-0.5 sm:top-1 sm:left-1" rotation={0} highContrast={highContrast} />
        <CornerRosette positionClass="top-0.5 right-0.5 sm:top-1 sm:right-1" rotation={90} highContrast={highContrast} />
        <CornerRosette positionClass="bottom-0.5 right-0.5 sm:bottom-1 sm:right-1" rotation={180} highContrast={highContrast} />
        <CornerRosette positionClass="bottom-0.5 left-0.5 sm:bottom-1 sm:left-1" rotation={270} highContrast={highContrast} />
      </div>

      {/* Layer 2 (Clean Opaque Text Frame — Inset Inside Border, Grows Naturally With Content) */}
      <div className="relative z-10 p-3 sm:p-6 md:p-7">
        <div
          className={`rounded-lg border-2 shadow-inner min-h-[520px] sm:min-h-[680px] flex flex-col justify-between p-2 sm:p-4 md:p-5 ${
            highContrast
              ? 'bg-white border-black'
              : 'bg-[#FFFDF9] border-[#1B4D3E]/85 ring-1 ring-[#C5A059] ring-offset-2 ring-offset-[#F4EAD0]'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

interface OrnamentalSurahCartoucheProps {
  surahArabicName: string;
  surahMeta?: string;
  fontClass: string;
  fontSizePx: number;
  highContrast?: boolean;
}

/**
 * Ornamental Surah Title Cartouche (Original SVG + CSS)
 * Renders symmetrical deep-green / gold / deep-blue floral wings flanking an
 * opaque central medallion containing the Arabic surah name verbatim from source data.
 */
export const OrnamentalSurahCartouche: React.FC<OrnamentalSurahCartoucheProps> = ({
  surahArabicName,
  surahMeta,
  fontClass,
  fontSizePx,
  highContrast = false,
}) => {
  const green = highContrast ? '#000000' : '#1B4D3E';
  const gold = highContrast ? '#525252' : '#B88A36';
  const goldFill = highContrast ? '#F5F5F5' : '#EFE2BE';
  const blue = highContrast ? '#262626' : '#1D3557';

  return (
    <div
      className={`flex-1 min-w-0 relative flex items-center justify-between gap-1 sm:gap-2 px-1 sm:px-2 py-1 sm:py-1.5 rounded-lg border-2 overflow-hidden ${
        highContrast
          ? 'bg-neutral-50 border-black text-black'
          : 'bg-gradient-to-r from-[#E9F0EC] via-[#FBF5E6] to-[#E9F0EC] border-[#B88A36] text-[#111111]'
      }`}
    >
      {/* Left Ornamental SVG Wing (Separate from Center Text) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 64 36"
        className="pointer-events-none select-none shrink-0 w-9 h-6 sm:w-14 sm:h-8"
      >
        <path
          d="M2 18 C10 6, 22 4, 34 4 L56 4 C50 10, 50 26, 56 32 L34 32 C22 32, 10 30, 2 18 Z"
          fill={green}
          stroke={gold}
          strokeWidth="1.4"
        />
        <path
          d="M10 18 C16 11, 24 9, 34 9 L46 9 C42 14, 42 22, 46 27 L34 27 C24 27, 16 25, 10 18 Z"
          fill={goldFill}
          stroke={blue}
          strokeWidth="0.9"
        />
        <polygon points="24,18 29,13 34,18 29,23" fill={blue} stroke={gold} strokeWidth="0.8" />
        <circle cx="29" cy="18" r="1.8" fill={goldFill} />
        <circle cx="16" cy="18" r="1.8" fill={gold} />
      </svg>

      {/* Center Medallion Text Box (Opaque cream backdrop so ornaments never touch letters) */}
      <div
        className={`relative z-10 px-2.5 sm:px-5 py-0.5 sm:py-1 rounded-md border flex items-center justify-center gap-2 whitespace-nowrap min-w-0 ${
          highContrast
            ? 'bg-white border-black text-black'
            : 'bg-[#FFFDF9] border-[#1B4D3E]/70 shadow-2xs text-[#111111]'
        }`}
      >
        <span
          className={`whitespace-nowrap ${fontClass}`}
          style={{
            fontSize: `${Math.min(24, Math.max(16, fontSizePx * 1.15))}px`,
            lineHeight: 1.45,
          }}
        >
          {surahArabicName}
        </span>
        {surahMeta && (
          <span className="text-[10px] sm:text-[11px] text-[#5A4333] hidden sm:inline whitespace-nowrap">
            ({surahMeta})
          </span>
        )}
      </div>

      {/* Right Ornamental SVG Wing (Mirrored, Separate from Center Text) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 64 36"
        className="pointer-events-none select-none shrink-0 w-9 h-6 sm:w-14 sm:h-8 scale-x-[-1]"
      >
        <path
          d="M2 18 C10 6, 22 4, 34 4 L56 4 C50 10, 50 26, 56 32 L34 32 C22 32, 10 30, 2 18 Z"
          fill={green}
          stroke={gold}
          strokeWidth="1.4"
        />
        <path
          d="M10 18 C16 11, 24 9, 34 9 L46 9 C42 14, 42 22, 46 27 L34 27 C24 27, 16 25, 10 18 Z"
          fill={goldFill}
          stroke={blue}
          strokeWidth="0.9"
        />
        <polygon points="24,18 29,13 34,18 29,23" fill={blue} stroke={gold} strokeWidth="0.8" />
        <circle cx="29" cy="18" r="1.8" fill={goldFill} />
        <circle cx="16" cy="18" r="1.8" fill={gold} />
      </svg>
    </div>
  );
};
