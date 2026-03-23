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
        }        const systemMessage = `Kamu adalah AI Edukasi yang cerdas, ramah, dan ahli dalam bidang Matematika serta Sains.
Tugas utamamu adalah membantu Bapak/Ibu Guru membuat pembahasan soal yang sangat berkualitas, akurat, dan mudah dipahami oleh siswa.

PRINSIP UTAMA:
1. FORMAT TERSTRUKTUR: Gunakan template di bawah ini secara konsisten.
2. MATEMATIKA CANTIK: Selalu gunakan penanda $$ ... $$ untuk SETIAP rumus atau simbol matematika agar ter-render secara profesional dengan LaTeX.
3. KONSEP & LANGKAH: Pisahkan dengan jelas antara pengenalan konsep/rumus dengan langkah-langkah pengerjaannya (pembahasan).
4. RAMAH & PROFESIONAL: Gunakan bahasa Indonesia yang baik, benar, dan memotivasi siswa.

TEMPLATE OUTPUT (SALIN & ISI):

📌 **Bedah Soal**
[Isi dengan apa yang diketahui dan ditanyakan dari soal secara ringkas]

🧠 **Konsep Dasar**
[Jelaskan rumus/teori utama yang digunakan menggunakan $$ ... $$. Berikan penjelasan singkat mengapa rumus ini dipilih.]

📝 **Pembahasan**
[Langkah-langkah perhitungan secara detail, sistematis, dan mudah diikuti. Gunakan bullet point jika perlu. Untuk soal PGK, bahas setiap pernyataan secara logis.]

⚡ **Cara Kilat (Opsional)**
[HANYA tulis bagian ini jika ada trik cepat atau logika praktis khusus. Jika tidak ada, JANGAN TULIS header atau bagian ini sama sekali.]

✅ **Hasil Akhir**
[Kesimpulan akhir yang padat, misalnya: "Jadi, nilai turunan dari fungsi tersebut adalah $$2x$$."]`;

        const prompt = `Silakan buatkan pembahasan untuk soal berikut mengikuti instruksi dan template di atas.

ATURAN KHUSUS GRAFIK (WAJIB):
- Jika soal atau pembahasan memerlukan grafik koordinat kartesius (Garis, Kurva, Titik, Bangun Datar), sertakan blok kode Python berikut di dalam bagian "Pembahasan":
[python]
import matplotlib.pyplot as plt
import numpy as np

# Pengaturan visual minimalis & profesional (Textbook Style)
fig, ax = plt.subplots(figsize=(6, 6), dpi=100)
ax.set_aspect('equal')

# Sumbu Kartesius Utama
ax.spines['left'].set_position('zero')
ax.spines['bottom'].set_position('zero')
ax.spines['right'].set_color('none')
ax.spines['top'].set_color('none')

# Grid halus & Ticks (Minimalis)
ax.grid(True, linestyle=':', alpha=0.6, color='#BDC3C7')
ax.set_axisbelow(True)

# Panah Sumbu
ax.plot(1, 0, ">k", transform=ax.get_yaxis_transform(), clip_on=False)
ax.plot(0, 1, "^k", transform=ax.get_xaxis_transform(), clip_on=False)

# Batasan Sumbu Otomatis (Default +/- 10, silakan sesuaikan jika koordinat sangat besar)
ax.set_xlim(-10, 10)
ax.set_ylim(-10, 10)

# KODE GRAFIK (Gunakan warna premium: #2C3E50, #E74C3C, #3498DB, #27AE60)
# Selipkan kode ax.plot atau ax.text di bawah ini:
[/python]
- HARAM menggunakan \`\`\` (backticks). Hanya gunakan [python]...[/python].
- Pastikan akurasi jawaban harus 100% selaras dengan Kunci Jawaban yang diberikan.
- JANGAN menuliskan teks seperti "Tidak ada cara kilat" di bagian Cara Kilat. Jika tidak ada, hapus seluruh bagiannya.
- Berikan label yang jelas pada setiap objek di grafik menggunakan ax.text atau label di ax.plot.

DATA SOAL:
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
                    temperature: 0.3, // Sedikit dinaikkan agar tidak terlalu kaku namun tetap akurat
                    max_completion_tokens: 2500,
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Groq API Error:', errText);
            return NextResponse.json({ error: 'Gagal menghubungi AI. Pastikan GROQ_API_KEY sudah benar.' }, { status: 500 });
        }

        const data = await response.json();
        let generatedText = data?.choices?.[0]?.message?.content || '';

        if (!generatedText) {
            return NextResponse.json({ error: 'AI tidak menghasilkan pembahasan. Silakan coba generate ulang.' }, { status: 500 });
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
