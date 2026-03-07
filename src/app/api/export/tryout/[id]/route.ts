import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tryoutId = (await params).id;

        const tryout = await prisma.tryout.findUnique({
            where: { id: tryoutId },
            include: {
                questions: { orderBy: { createdAt: 'asc' } },
                assignments: {
                    where: { status: 'COMPLETED' },
                    include: { answers: true, student: true }
                }
            }
        });

        if (!tryout) {
            return NextResponse.json({ error: 'Tryout not found' }, { status: 404 });
        }

        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryHeaders = ['No', 'Nama', 'Username', 'Skor', 'Waktu Mulai', 'Waktu Selesai', 'Durasi (menit)'];
        const summaryRows = tryout.assignments.map((a, idx) => {
            const durMinutes = a.startTime && a.endTime
                ? ((new Date(a.endTime).getTime() - new Date(a.startTime).getTime()) / 60000).toFixed(1)
                : '-';
            return [
                idx + 1,
                a.student.name,
                a.student.username,
                a.score !== null ? Number(a.score.toFixed(1)) : '-',
                a.startTime ? new Date(a.startTime).toLocaleString('id-ID') : '-',
                a.endTime ? new Date(a.endTime).toLocaleString('id-ID') : '-',
                durMinutes,
            ];
        });

        const ws1 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
        ws1['!cols'] = summaryHeaders.map((h, i) => ({
            wch: Math.max(h.length, ...summaryRows.map(r => String(r[i]).length)) + 2
        }));
        XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');

        // Sheet 2: Per-question answer matrix
        const qHeaders = ['No', 'Nama', ...tryout.questions.map((_, i) => `Soal ${i + 1}`), 'Benar', 'Skor'];
        const kunciRow = ['', 'KUNCI', ...tryout.questions.map(q => q.correctAnswer)];

        const answerRows = tryout.assignments.map((a, idx) => {
            let correctCount = 0;

            const answers = tryout.questions.map(q => {
                const ans = a.answers.find(x => x.questionId === q.id);
                const qType = (q as Record<string, unknown>).questionType as string;
                const ansText = ans ? (ans as Record<string, unknown>).answerText as string | null : null;

                let studentAnswer = '-';
                let isCorrect = false;

                if (qType === 'ISIAN') {
                    studentAnswer = ansText || '-';
                    isCorrect = !!ansText && ansText.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
                } else {
                    studentAnswer = ans?.selectedOption || '-';
                    if (qType === 'PGK') {
                        isCorrect = q.correctAnswer.split(',').sort().join(',') === (ans?.selectedOption || '').split(',').sort().join(',');
                    } else {
                        isCorrect = ans?.selectedOption === q.correctAnswer;
                    }
                }

                if (isCorrect) correctCount++;
                return studentAnswer;
            });

            return [idx + 1, a.student.name, ...answers, correctCount, a.score !== null ? Number(a.score.toFixed(1)) : '-'];
        });

        const ws2 = XLSX.utils.aoa_to_sheet([qHeaders, kunciRow, ...answerRows]);
        ws2['!cols'] = qHeaders.map((h, i) => ({
            wch: Math.max(String(h).length, String(kunciRow[i] || '').length, ...answerRows.map(r => String(r[i]).length)) + 2
        }));
        XLSX.utils.book_append_sheet(wb, ws2, 'Detail Jawaban');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const safeName = tryout.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);

        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
            }
        });
    } catch (error) {
        console.error('Export Tryout Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
