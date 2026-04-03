import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export type ParsedQuestion = {
  questionType: 'PG' | 'PGK' | 'ISIAN' | 'BENAR_SALAH';
  questionText: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  optionE: string | null;
  correctAnswer: string;
  pembahasan: string;
  pythonCode: string | null;
  pythonCode2: string | null;
};

function detectType(raw: string, kunci: string, explicitType: string | null): ParsedQuestion['questionType'] {
  if (explicitType) {
    const t = explicitType.trim().toUpperCase();
    if (t === 'ISIAN') return 'ISIAN';
    if (t === 'PGK') return 'PGK';
    if (t === 'BENAR_SALAH') return 'BENAR_SALAH';
    if (t === 'PG') return 'PG';
  }
  // ISIAN: no options block
  if (!raw.match(/^\s*[abcde]\./im)) return 'ISIAN';
  // BENAR_SALAH: kunci is only B/S values
  if (/^[BS](,[BS])+$/i.test(kunci.trim())) return 'BENAR_SALAH';
  // PGK: kunci has comma without B/S (e.g. a,c or a, c)
  if (/^[a-e](\s*,\s*[a-e])+$/i.test(kunci.trim())) return 'PGK';
  return 'PG';
}

function normalizeKey(kunci: string, type: ParsedQuestion['questionType']): string {
  const raw = kunci.trim();
  if (type === 'ISIAN' || type === 'BENAR_SALAH') return raw;
  if (type === 'PGK') {
    // e.g. "a,c" -> "A,C"
    return raw.split(',').map(s => s.trim().toUpperCase()).join(',');
  }
  // PG: take first letter, uppercase
  const match = raw.match(/^([a-eA-E])/);
  return match ? match[1].toUpperCase() : raw;
}

function extractPythonBlocks(text: string): { cleaned: string; blocks: (string | null)[] } {
  const blocks: (string | null)[] = [];
  const cleaned = text.replace(/\[python\]([\s\S]*?)\[\/python\]/g, (_match, code) => {
    blocks.push(code.trim());
    return `[GAMBAR_${blocks.length}]`;
  });
  return { cleaned, blocks };
}

function parseOptionLines(text: string): { a: string | null; b: string | null; c: string | null; d: string | null; e: string | null } {
  const opts: Record<string, string | null> = { a: null, b: null, c: null, d: null, e: null };
  const lines = text.split('\n');
  for (const line of lines) {
    let m = line.match(/^\s*([abcde])\.\s*(.*)/i);
    if (!m) {
      const mNum = line.match(/^\s*([12345])\.\s*(.*)/);
      if (mNum) {
        const charMap: Record<string, string> = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e' };
        m = [mNum[0], charMap[mNum[1]], mNum[2]];
      }
    }
    if (m) {
      opts[m[1].toLowerCase()] = m[2].trim();
    }
  }
  return { a: opts.a, b: opts.b, c: opts.c, d: opts.d, e: opts.e };
}

function parseBlock(raw: string): ParsedQuestion | null {
  if (!raw.trim()) return null;

  // Extract python code blocks first
  const { cleaned, blocks } = extractPythonBlocks(raw);

  // Explicit type
  const typeMatch = cleaned.match(/^TIPE:\s*(\S+)/im);
  const explicitType = typeMatch ? typeMatch[1] : null;

  // Extract "Soal:" section
  const soalMatch = cleaned.match(/Soal:\s*([\s\S]*?)(?:^[a-e]\.|^[1-5]\.|Kunci Jawaban:|$)/im);
  const questionText = soalMatch ? soalMatch[1].trim() : '';

  // Extract options block (a. ... b. ... etc or 1. ... 2. ... etc)
  const optBlock = cleaned.match(/^(?:[a-e]|[1-5])\..*/gim)?.join('\n') || '';
  const { a, b, c, d, e } = parseOptionLines(cleaned);

  // Extract kunci jawaban
  const kunciMatch = cleaned.match(/Kunci Jawaban:\s*(.+)/i);
  const kunciRaw = kunciMatch ? kunciMatch[1].trim() : '';

  // Detect type
  const type = detectType(optBlock, kunciRaw, explicitType);
  const correctAnswer = normalizeKey(kunciRaw, type);

  // Extract pembahasan (everything after "Pembahasan:")
  const pembahasanMatch = cleaned.match(/Pembahasan:\s*([\s\S]*)/i);
  const pembahasan = pembahasanMatch ? pembahasanMatch[1].trim() : '';

  if (!questionText) return null;

  let finalQuestionText = questionText;
  let finalPembahasan = pembahasan;

  blocks.forEach((code, index) => {
    if (code) {
      const marker = `[GAMBAR_${index + 1}]`;
      const replacement = `[python]\n${code}\n[/python]`;
      finalQuestionText = finalQuestionText.replace(marker, replacement);
      finalPembahasan = finalPembahasan.replace(marker, replacement);
    }
  });

  return {
    questionType: type,
    questionText: finalQuestionText,
    optionA: a,
    optionB: b,
    optionC: c,
    optionD: d,
    optionE: e,
    correctAnswer,
    pembahasan: finalPembahasan,
    pythonCode: blocks[0] || null,
    pythonCode2: blocks[1] || null,
  };
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { templateText } = await request.json();
    if (!templateText || typeof templateText !== 'string') {
      return NextResponse.json({ error: 'templateText is required' }, { status: 400 });
    }

    // Extract PAKET name
    const paketMatch = templateText.match(/^PAKET:\s*(.+)/m);
    const packageName = paketMatch ? paketMatch[1].trim() : 'Paket Tidak Diketahui';

    // Split by ---SOAL--- separator OR by 🚀 SOAL N pattern
    let rawBlocks: string[];
    if (templateText.includes('---SOAL---')) {
      rawBlocks = templateText.split('---SOAL---');
    } else {
      // Split by 🚀 SOAL N headings
      rawBlocks = templateText.split(/(?=🚀\s*SOAL\s+\d+)/i);
    }

    const questions: ParsedQuestion[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rawBlocks.length; i++) {
      const block = rawBlocks[i].trim();
      if (!block || block.startsWith('PAKET:')) continue;
      try {
        const parsed = parseBlock(block);
        if (parsed) questions.push(parsed);
      } catch (e: any) {
        errors.push(`Blok ${i + 1}: ${e.message}`);
      }
    }

    return NextResponse.json({ packageName, questions, errors });
  } catch (error: any) {
    console.error('Parse Template Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
