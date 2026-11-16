# Quran Data & Font Sources

All Quranic Arabic text, verse boundaries, ruku markers, hizb/rub-el-hizb boundaries, and 15-line page/line coordinates in this application are imported verbatim from official verified sources and stored locally as read-only static assets. No runtime API calls are made and no Quranic text is typed, modified, or normalized.

## 1. Quranic Text & 15-Line Page Layout Data
- **Source Name:** Quran Foundation / Quran.com Content API v4
- **Endpoints Used:**
  - `https://api.quran.com/api/v4/chapters` (114 Surahs)
  - `https://api.quran.com/api/v4/juzs` (30 Paras / Juzs)
  - `https://api.quran.com/api/v4/verses/by_page/{1..604}?words=true&word_fields=text_indopak,text_uthmani,line_number,page_number&fields=text_indopak,text_uthmani,juz_number,hizb_number,rub_el_hizb_number,ruku_number,manzil_number,sajdah_number,page_number,verse_key,verse_number`
- **Script Variants Stored Verbatim:**
  - Indo-Pak Nastaleeq Script (`text_indopak`, default display)
  - Uthmani Script (`text_uthmani`, toggleable)
- **Active Layout:** Madinah 15-Line Mushaf (604 pages, 15 lines per page).
  - *Note on 15-Line Hafizi (610-page Indo-Pak layout):* Quran Foundation's `mushaf=6` (610-page Indo-Pak) endpoint requires OAuth2 `client_id` + `client_secret`, and QUL (`https://qul.tarteel.ai/resources/mushaf-layout/12`) requires an authenticated user session to export JSON/SQLite. Therefore, the 604-page Madinah layout with verbatim `text_indopak` is used as the verified fallback without inventing any line breaks.
- **Fetched Date:** 2026-11-13T02:32:25.935Z
- **Verification Counts:** 114 Surahs, 6,236 Ayahs, 30 Paras (Juzs), 604 Pages
- **Licence:** Quran.com / Quran Foundation API open Quran data (King Fahd Glorious Quran Printing Complex / Tarteel QUL digital Quran text)

## 2. Indo-Pak Nastaleeq Font
- **Source Name:** Quran.com / Tarteel QUL IndoPak Nastaleeq Waqf Lazim Font
- **URL:** `https://quran.com/fonts/quran/hafs/nastaleeq/indopak/indopak-nastaleeq-waqf-lazim-v4.2.1.woff2`
- **Version:** `v4.2.1`
- **Fetched Date:** 2026-11-13T02:32:25.935Z
- **Licence:** Open-source / Permissive redistribution for Quranic display (Tarteel / Quran.com)

## 3. SHA-256 Checksums
| File | Size | SHA-256 |
| --- | --- | --- |
| `src/data/quranPages.json` | 7.36 MB | `a0d37bc56cefc326b8a8f1adc6960cb6b7b66b7645c4e78a57a77166d9e3c80d` |
| `src/data/quranMetadata.json` | 42.3 KB | `c4a275b6cba0fffdd10b3b2cf6f8549f7bfa62db7aa5212b78b6daf8c1685f60` |
| `public/fonts/indopak-nastaleeq-waqf-lazim-v4.2.1.woff2` | 81.6 KB | `ca2a573bd46af4a03f208ebfbaa0336242d0ea4199f1e20b1f06e1e2a1d87900` |
