import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db as adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { questionText, questionType, optionA, optionB, optionC, optionD, optionE, correctAnswer, customPrompt } = await request.json();

        if (!questionText) {
            return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
        }

        // Build context about the question
        let questionContext = ``;
        
        if (customPrompt) {
            questionContext += `[INSTRUKSI REVISI DARI ADMIN (SUPER PRIORITAS)]:\n${customPrompt}\n\n`;
        }

        questionContext += `Tipe Soal: ${questionType === 'PG' ? 'Pilihan Ganda' : questionType === 'PGK' ? 'Pilihan Ganda Kompleks' : questionType === 'BENAR_SALAH' ? 'Benar/Salah' : 'Isian Singkat'}\n\n`;
        questionContext += `Soal:\n${questionText}\n\n`;

        if (questionType !== 'ISIAN') {
            const options = [
                optionA ? `A. ${optionA}` : null,
                optionB ? `B. ${optionB}` : null,
                optionC ? `C. ${optionC}` : null,
                optionD ? `D. ${optionD}` : null,
                optionE ? `E. ${optionE}` : null,
            ].filter(Boolean).join('\n');
            questionContext += `Pilihan Jawaban:\n${options}\n\n`;
        }

        if (questionType === 'BENAR_SALAH') {
            const bsArr = correctAnswer.split(',');
            const statements = [optionA, optionB, optionC, optionD, optionE].filter(Boolean);
            const bsContext = statements.map((s: string, i: number) => `${s} → ${bsArr[i] === 'B' ? 'Benar' : 'Salah'}`).join('\n');
            questionContext += `Kunci Jawaban (B/S):\n${bsContext}\n\n`;
        } else {
            questionContext += `Kunci Jawaban: ${correctAnswer}\n\n`;
        }

        const systemMessage = `Kamu adalah bot pembuat laporan (Report Generator) yang SANGAT KAKU dan DINGIN. PRIORITAS UTAMA: FORMAT. DILARANG MEMBERI KALIMAT PENGANTAR. DILARANG KERAS MENAMBAH HEADER ATAU JUDUL LAIN DI LUAR TEMPLATE.

Tugasmu mengonversi solusi soal matematika ke dalam template berformat Markdown berikut dengan cara MENGISI TEKS YANG BERTANDA KURUNG SIKU [ ]. JANGAN MENGUBAH HEADER.

FORMAT OUTPUT WAJIB 100% PERSIS SEPERTI INI (Hanya salin dan isi):

📌 **Bedah Soal**
[Tulis Diketahui & Ditanya secara singkat dan padat (maks 3 baris)]

🧠 **Konsep Dasar**
[TULIS RUMUS ATAU SIFAT MATEMATIS TANPA KATA PENGANTAR (misal, JANGAN tulis "Konsep yang digunakan adalah..."). LANGSUNG GUNAKAN $$...$$ UNTUK RUMUS.]
[LALU, Lanjutkan langsung dengan penjabaran/perhitungan penyelesaian langkah demi langkah di sini juga. DILARANG MEMBUAT HEADER BARU. Fokus pada angka dan variabel, JANGAN terlalu banyak kata pengantar di setiap langkahnya. PENTING UNTUK PGK: Bahas singkat per pernyataan dan tutup dengan tabel.]

⚡ **Cara Kilat**
[HAPUS SEMUA SECTION INI BESERTA JUDULNYA JIKA TIDAK ADA TRIK CEPAT/JALAN PINTAS YG NYATA]

✅ **Hasil Akhir**
[1 kalimat kesimpulan yang berisi jawaban hasil akhir]`;

        const prompt = `SALIN TEMPLATE DI ATAS LALU ISI. JILAT SEMUA ATURANNYA MENTAH-MENTAH.

ATURAN TAMBAHAN:
- Jika butuh grafik/koordinat, SELIPKAN kodingan Python ini di dalam area "Konsep Dasar":
[python]
import matplotlib.pyplot as plt
import numpy as np
fig, ax = plt.subplots(figsize=(8, 8))
ax.spines['right'].set_color('none')
ax.spines['top'].set_color('none')
ax.xaxis.set_ticks_position('bottom')
ax.yaxis.set_ticks_position('left')
ticks = np.arange(-10, 11, 1)
ax.set_xticks(ticks)
ax.set_yticks(ticks)
ax.set_xticklabels([str(t) if t != 0 else '' for t in ticks])
ax.set_yticklabels([str(t) if t != 0 else '' for t in ticks])
ax.plot(1, 0, ">k", transform=ax.get_yaxis_transform(), clip_on=False)
ax.plot(0, 1, "^k", transform=ax.get_xaxis_transform(), clip_on=False)
ax.spines['left'].set_position('zero')
ax.spines['bottom'].set_position('zero')
ax.grid(True, linestyle='--', alpha=0.4)
ax.set_xlim(-10, 10)
ax.set_ylim(-10, 10)
[/python]
HARAM backtick \`\`\`! Hanya gunakan penanda [python]...[/python]!
- PERINGATAN AKURASI: Pastikan hitunganmu SESUAI dengan Kunci Jawaban!

SOAL:
${questionContext}`;

        const response = await fetch(
            `https://api.groq.com/openai/v1/chat/completions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1, // menurunkan temperature agar lebih kaku ngikutin instruksi template
                    max_completion_tokens: 2000,
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Groq API Error:', errText);
            return NextResponse.json({ error: 'Gagal menghubungi AI. Coba lagi.' }, { status: 500 });
        }

        const data = await response.json();
        let generatedText = data?.choices?.[0]?.message?.content || '';

        // POST-PROCESSING CLEANUP: Untuk mengatasi bandelnya AI yang masih halusinasi nambahin header ilegal dsb.
        generatedText = generatedText.replace(/📝\s*\**Pembahasan\**/gi, '');
        generatedText = generatedText.replace(/\*\*Pembahasan\*\*/gi, '');
        generatedText = generatedText.replace(/💡\s*\**Solusi\**/gi, '');
        generatedText = generatedText.replace(/\*\*Solusi\*\*/gi, '');
        generatedText = generatedText.replace(/Menggunakan\skonsep\s.+?:\n/gi, '');
        generatedText = generatedText.replace(/Berikut\sadalah\spembahasan.+?:\n/gi, '');

        if (!generatedText) {
            return NextResponse.json({ error: 'AI tidak menghasilkan pembahasan. Coba lagi.' }, { status: 500 });
        }

        // Track usage in Firebase
        try {
            await adminDb.collection('metadata').doc('ai_usage').set({
                totalGenerations: admin.firestore.FieldValue.increment(1),
                lastUsed: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        } catch (dbErr) {
            console.error('Failed to log AI usage:', dbErr);
            // Non-blocking, continue returning the response
        }

        return NextResponse.json({ pembahasan: generatedText.trim() });
    } catch (error) {
        console.error('AI Generate Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
