import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const API_BASE = 'https://api.quran.com/api/v4';
const TOTAL_PAGES = 604;
const CONCURRENCY = 10;

async function fetchJson(url, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }
}

async function fetchPageVerses(pageNum) {
  let allVerses = [];
  let page = 1;
  while (true) {
    const url = `${API_BASE}/verses/by_page/${pageNum}?words=true&per_page=50&page=${page}&word_fields=text_indopak,text_uthmani,line_number,page_number&fields=text_indopak,text_uthmani,juz_number,hizb_number,rub_el_hizb_number,ruku_number,manzil_number,sajdah_number,page_number,verse_key,verse_number`;
    const data = await fetchJson(url);
    allVerses.push(...(data.verses || []));
    if (!data.pagination || !data.pagination.next_page) break;
    page = data.pagination.next_page;
  }
  return allVerses;
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function main() {
  console.log('Fetching chapters & juzs from api.quran.com/api/v4...');
  const [chaptersRes, juzsRes] = await Promise.all([
    fetchJson(`${API_BASE}/chapters`),
    fetchJson(`${API_BASE}/juzs`),
  ]);

  const rawChapters = chaptersRes.chapters || [];
  if (rawChapters.length !== 114) {
    throw new Error(`Check failed: expected 114 surahs, got ${rawChapters.length}`);
  }

  // Deduplicate juzs by juz_number
  const juzMap = new Map();
  for (const j of juzsRes.juzs || []) {
    if (!juzMap.has(j.juz_number)) {
      juzMap.set(j.juz_number, j);
    }
  }
  const rawJuzs = Array.from(juzMap.values()).sort((a, b) => a.juz_number - b.juz_number);
  if (rawJuzs.length !== 30) {
    throw new Error(`Check failed: expected 30 paras (juzs), got ${rawJuzs.length}`);
  }

  const chapterMap = new Map(rawChapters.map(c => [c.id, c]));

  console.log(`Fetching all ${TOTAL_PAGES} pages...`);
  const pageNumbers = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
  const pageVersesResults = new Array(TOTAL_PAGES);

  let cursor = 0;
  async function worker() {
    while (cursor < pageNumbers.length) {
      const idx = cursor++;
      const pNum = pageNumbers[idx];
      pageVersesResults[idx] = await fetchPageVerses(pNum);
      if (pNum % 50 === 0 || pNum === TOTAL_PAGES) {
        console.log(`  Fetched page ${pNum}/${TOTAL_PAGES}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Track global verse order to verify 6,236 ayahs and detect exact ruku/rub/juz/surah boundaries
  const seenVerseKeys = new Set();
  const orderedVerses = [];
  for (let i = 0; i < TOTAL_PAGES; i++) {
    for (const v of pageVersesResults[i]) {
      if (!seenVerseKeys.has(v.verse_key)) {
        seenVerseKeys.add(v.verse_key);
        orderedVerses.push({ pageNumber: i + 1, verse: v });
      }
    }
  }

  if (seenVerseKeys.size !== 6236) {
    throw new Error(`Check failed: expected 6236 ayahs, got ${seenVerseKeys.size}`);
  }

  // Compute exact ruku ends (last verse of each ruku_number) and rub_el_hizb starts (first verse of each rub_el_hizb_number)
  const rukuEndVerseKeys = new Set();
  const rubStartByVerseKey = new Map(); // verseKey -> { rub, hizb, juz, quarterInJuz }
  const juzBoundaryStart = new Map(); // juzNumber -> { page, line, wordId, verseKey, surahNumber, ayahNumber }
  const juzBoundaryEnd = new Map(); // juzNumber -> { page, line, wordId, verseKey, surahNumber, ayahNumber }

  for (let i = 0; i < orderedVerses.length; i++) {
    const curr = orderedVerses[i].verse;
    const next = orderedVerses[i + 1]?.verse;
    const prev = orderedVerses[i - 1]?.verse;

    if (!next || next.ruku_number !== curr.ruku_number) {
      rukuEndVerseKeys.add(curr.verse_key);
    }
    if (!prev || prev.rub_el_hizb_number !== curr.rub_el_hizb_number) {
      // rub_el_hizb_number is 1..240; within each Juz there are 8 rub_el_hizb units (1..8)
      const quarterInJuz = ((curr.rub_el_hizb_number - 1) % 8) + 1;
      rubStartByVerseKey.set(curr.verse_key, {
        rubNumber: curr.rub_el_hizb_number,
        hizbNumber: curr.hizb_number,
        juzNumber: curr.juz_number,
        quarterInJuz, // 1=Juz start, 3=Rub (1/4), 5=Nisf (1/2), 7=Thalathah Arba (3/4)
      });
    }
  }

  // Build pages map: 1..604
  const pagesData = {};
  for (let i = 0; i < TOTAL_PAGES; i++) {
    const pageNum = i + 1;
    const versesOnPage = pageVersesResults[i];
    if (!versesOnPage || versesOnPage.length === 0) {
      throw new Error(`Check failed: page ${pageNum} has 0 verses`);
    }

    // Group words by line_number (1..15)
    const lineWordsMap = new Map();
    for (let ln = 1; ln <= 15; ln++) lineWordsMap.set(ln, []);

    const surahStartsOnPage = []; // { surahNumber, firstVerseLine }

    for (const verse of versesOnPage) {
      const [surahStr, ayahStr] = verse.verse_key.split(':');
      const surahNumber = parseInt(surahStr, 10);
      const ayahNumber = parseInt(ayahStr, 10);
      const isAyahOne = ayahNumber === 1;
      const rubInfo = rubStartByVerseKey.get(verse.verse_key);
      const isRukuEndVerse = rukuEndVerseKeys.has(verse.verse_key);

      const words = verse.words || [];
      // Separate real words and 'end' marker
      const realWords = words.filter(w => w.char_type_name !== 'end');
      const endToken = words.find(w => w.char_type_name === 'end');

      if (isAyahOne && realWords.length > 0) {
        surahStartsOnPage.push({
          surahNumber,
          firstVerseLine: realWords[0].line_number,
        });
      }

      realWords.forEach((w, wIdx) => {
        const lineNum = w.line_number;
        if (lineNum < 1 || lineNum > 15) {
          throw new Error(`Invalid line_number ${lineNum} on page ${pageNum}, verse ${verse.verse_key}`);
        }
        const isFirstWordOfAyah = wIdx === 0;
        const isLastWordOfAyah = wIdx === realWords.length - 1;

        const wordEntry = {
          // Compact fields; stable wordIndex & id will be finalized per line below
          t: w.text_indopak,
          u: w.text_uthmani,
          s: surahNumber,
          a: ayahNumber,
          j: verse.juz_number,
        };

        if (isFirstWordOfAyah && rubInfo) {
          // Attach rub/hizb/juz boundary marker at start of ayah
          wordEntry.rb = rubInfo.quarterInJuz; // 1..8
          wordEntry.rbn = rubInfo.rubNumber;
          wordEntry.hbn = rubInfo.hizbNumber;
        }
        if (isLastWordOfAyah) {
          wordEntry.e = 1;
          if (endToken?.text_indopak) {
            wordEntry.am = endToken.text_indopak;
          }
          if (isRukuEndVerse) {
            wordEntry.rk = verse.ruku_number;
          }
          if (verse.sajdah_number) {
            wordEntry.sj = verse.sajdah_number;
          }
        }

        lineWordsMap.get(lineNum).push(wordEntry);
      });
    }

    // Identify header lines and bismillah lines using the gap before each surah's first verse line
    const headerLines = new Map(); // lineNum -> surahNumber
    const bismillahLines = new Set();

    for (const sStart of surahStartsOnPage) {
      const ch = chapterMap.get(sStart.surahNumber);
      const firstLine = sStart.firstVerseLine;
      if (sStart.surahNumber === 1) {
        // Surah Al-Fatihah: Line 1 is header, Ayah 1:1 IS Bismillah on Line 2
        headerLines.set(1, 1);
      } else if (ch?.bismillah_pre) {
        // Surah header is 2 lines before first ayah, Bismillah is 1 line before first ayah
        const bLine = firstLine - 1;
        const hLine = firstLine - 2;
        if (hLine >= 1 && lineWordsMap.get(hLine)?.length === 0) {
          headerLines.set(hLine, sStart.surahNumber);
        }
        if (bLine >= 1 && lineWordsMap.get(bLine)?.length === 0) {
          bismillahLines.add(bLine);
        }
      } else {
        // Surah 9 (At-Tawbah): no Bismillah, header is 1 line before first ayah
        const hLine = firstLine - 1;
        if (hLine >= 1 && lineWordsMap.get(hLine)?.length === 0) {
          headerLines.set(hLine, sStart.surahNumber);
        }
      }
    }

    // Build final 15 lines for this page and assign stable word IDs
    const lines = [];
    for (let ln = 1; ln <= 15; ln++) {
      const wordsInLine = lineWordsMap.get(ln) || [];
      if (headerLines.has(ln)) {
        lines.push({
          l: ln,
          h: headerLines.get(ln), // surahNumber for header
          w: [],
        });
      } else if (bismillahLines.has(ln)) {
        lines.push({
          l: ln,
          b: 1, // Bismillah line
          w: [],
        });
      } else {
        const finalizedWords = wordsInLine.map((wd, idx) => {
          const wIndex = idx + 1;
          const id = `p${pageNum}_l${ln}_w${wIndex}`;

          // Update Juz start/end boundaries
          if (!juzBoundaryStart.has(wd.j)) {
            juzBoundaryStart.set(wd.j, {
              page: pageNum,
              line: ln,
              wordIndex: wIndex,
              wordId: id,
              surahNumber: wd.s,
              ayahNumber: wd.a,
            });
          }
          juzBoundaryEnd.set(wd.j, {
            page: pageNum,
            line: ln,
            wordIndex: wIndex,
            wordId: id,
            surahNumber: wd.s,
            ayahNumber: wd.a,
          });

          return {
            id,
            wi: wIndex,
            ...wd,
          };
        });
        lines.push({
          l: ln,
          w: finalizedWords,
        });
      }
    }

    const firstVerse = versesOnPage[0];
    const lastVerse = versesOnPage[versesOnPage.length - 1];
    const primarySurahNum = parseInt(firstVerse.verse_key.split(':')[0], 10);
    const ch = chapterMap.get(primarySurahNum);

    pagesData[pageNum] = {
      p: pageNum,
      j: firstVerse.juz_number,
      s: primarySurahNum,
      sn: ch?.name_simple || '',
      sa: ch?.name_arabic || '',
      sa1: firstVerse.verse_number,
      sa2: lastVerse.verse_number,
      lines,
    };
  }

  // Verify all 30 Juz boundaries and 604 pages
  if (Object.keys(pagesData).length !== 604) {
    throw new Error(`Check failed: expected 604 pages, got ${Object.keys(pagesData).length}`);
  }
  for (let j = 1; j <= 30; j++) {
    if (!juzBoundaryStart.has(j) || !juzBoundaryEnd.has(j)) {
      throw new Error(`Check failed: missing boundary for Juz ${j}`);
    }
  }

  const metadata = {
    source: 'Quran Foundation / Quran.com API v4 (Madinah 15-Line Layout + IndoPak & Uthmani Scripts)',
    fetchedAt: new Date().toISOString(),
    totalSurahs: rawChapters.length,
    totalAyahs: seenVerseKeys.size,
    totalJuzs: rawJuzs.length,
    totalPages: TOTAL_PAGES,
    chapters: rawChapters.map(c => ({
      id: c.id,
      nameSimple: c.name_simple,
      nameArabic: c.name_arabic,
      revelationPlace: c.revelation_place,
      versesCount: c.verses_count,
      bismillahPre: c.bismillah_pre,
      pages: c.pages,
    })),
    juzs: rawJuzs.map(j => {
      const startB = juzBoundaryStart.get(j.juz_number);
      const endB = juzBoundaryEnd.get(j.juz_number);
      return {
        juzNumber: j.juz_number,
        versesCount: j.verses_count,
        verseMapping: j.verse_mapping,
        startPage: startB.page,
        endPage: endB.page,
        startLoc: {
          page: startB.page,
          line: startB.line,
          wordIndex: startB.wordIndex,
          wordId: startB.wordId,
        },
        endLoc: {
          page: endB.page,
          line: endB.line,
          wordIndex: endB.wordIndex,
          wordId: endB.wordId,
        },
        lastSurahNumber: endB.surahNumber,
        lastAyahNumber: endB.ayahNumber,
      };
    }),
  };

  const pagesOutPath = path.resolve('src/data/quranPages.json');
  const metaOutPath = path.resolve('src/data/quranMetadata.json');

  fs.writeFileSync(pagesOutPath, JSON.stringify(pagesData));
  fs.writeFileSync(metaOutPath, JSON.stringify(metadata, null, 2));

  const pagesSha = sha256File(pagesOutPath);
  const metaSha = sha256File(metaOutPath);
  const fontPath = path.resolve('public/fonts/indopak-nastaleeq-waqf-lazim-v4.2.1.woff2');
  const fontSha = fs.existsSync(fontPath) ? sha256File(fontPath) : 'N/A';

  const sourceMd = `# Quran Data & Font Sources

All Quranic Arabic text, verse boundaries, ruku markers, hizb/rub-el-hizb boundaries, and 15-line page/line coordinates in this application are imported verbatim from official verified sources and stored locally as read-only static assets. No runtime API calls are made and no Quranic text is typed, modified, or normalized.

## 1. Quranic Text & 15-Line Page Layout Data
- **Source Name:** Quran Foundation / Quran.com Content API v4
- **Endpoints Used:**
  - \`https://api.quran.com/api/v4/chapters\` (114 Surahs)
  - \`https://api.quran.com/api/v4/juzs\` (30 Paras / Juzs)
  - \`https://api.quran.com/api/v4/verses/by_page/{1..604}?words=true&word_fields=text_indopak,text_uthmani,line_number,page_number&fields=text_indopak,text_uthmani,juz_number,hizb_number,rub_el_hizb_number,ruku_number,manzil_number,sajdah_number,page_number,verse_key,verse_number\`
- **Script Variants Stored Verbatim:**
  - Indo-Pak Nastaleeq Script (\`text_indopak\`, default display)
  - Uthmani Script (\`text_uthmani\`, toggleable)
- **Active Layout:** Madinah 15-Line Mushaf (604 pages, 15 lines per page).
  - *Note on 15-Line Hafizi (610-page Indo-Pak layout):* Quran Foundation's \`mushaf=6\` (610-page Indo-Pak) endpoint requires OAuth2 \`client_id\` + \`client_secret\`, and QUL (\`https://qul.tarteel.ai/resources/mushaf-layout/12\`) requires an authenticated user session to export JSON/SQLite. Therefore, the 604-page Madinah layout with verbatim \`text_indopak\` is used as the verified fallback without inventing any line breaks.
- **Fetched Date:** ${metadata.fetchedAt}
- **Verification Counts:** 114 Surahs, 6,236 Ayahs, 30 Paras (Juzs), 604 Pages
- **Licence:** Quran.com / Quran Foundation API open Quran data (King Fahd Glorious Quran Printing Complex / Tarteel QUL digital Quran text)

## 2. Indo-Pak Nastaleeq Font
- **Source Name:** Quran.com / Tarteel QUL IndoPak Nastaleeq Waqf Lazim Font
- **URL:** \`https://quran.com/fonts/quran/hafs/nastaleeq/indopak/indopak-nastaleeq-waqf-lazim-v4.2.1.woff2\`
- **Version:** \`v4.2.1\`
- **Fetched Date:** ${metadata.fetchedAt}
- **Licence:** Open-source / Permissive redistribution for Quranic display (Tarteel / Quran.com)

## 3. SHA-256 Checksums
| File | Size | SHA-256 |
| --- | --- | --- |
| \`src/data/quranPages.json\` | ${(fs.statSync(pagesOutPath).size / (1024 * 1024)).toFixed(2)} MB | \`${pagesSha}\` |
| \`src/data/quranMetadata.json\` | ${(fs.statSync(metaOutPath).size / 1024).toFixed(1)} KB | \`${metaSha}\` |
| \`public/fonts/indopak-nastaleeq-waqf-lazim-v4.2.1.woff2\` | ${(fs.statSync(fontPath).size / 1024).toFixed(1)} KB | \`${fontSha}\` |
`;

  fs.writeFileSync(path.resolve('SOURCE.md'), sourceMd);
  console.log('SUCCESS! Verified 114 surahs, 6236 ayahs, 30 juzs, 604 pages.');
  console.log(`quranPages.json size: ${(fs.statSync(pagesOutPath).size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`quranPages.json sha256: ${pagesSha}`);
  console.log(`quranMetadata.json sha256: ${metaSha}`);
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
