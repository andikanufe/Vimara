import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tryoutId = (await params).id;

        const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
        if (!tryoutDoc.exists) {
            return NextResponse.json({ error: 'Tryout not found' }, { status: 404 });
        }

        const tryoutData = tryoutDoc.data()!;

        // Get Questions
        const questionsSnap = await db.collection('questions')
            .where('tryoutId', '==', tryoutId)
            .get();
        const questions = questionsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateA.getTime() - dateB.getTime();
            });

        // Get Assignments
        const assignmentsSnap = await db.collection('assignments')
            .where('tryoutId', '==', tryoutId)
            .where('status', '==', 'COMPLETED')
            .get();

        const assignments = await Promise.all(assignmentsSnap.docs.map(async (doc) => {
            const a = doc.data();

            // Get Student
            const studentDoc = await db.collection('users').doc(a.studentId).get();
            const student = studentDoc.exists ? { id: studentDoc.id, ...studentDoc.data() } : null;

            // Get Answers
            const answersSnap = await db.collection('answers').where('assignmentId', '==', doc.id).get();
            const answers = answersSnap.docs.map(ans => ({ id: ans.id, ...ans.data() }));

            return {
                id: doc.id,
                ...a,
                student,
                answers
            };
        }));

        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary (Ringkasan)
        const summaryHeaders = ['No', 'Nama', 'Username', 'Skor', 'Waktu Mulai', 'Waktu Selesai', 'Durasi (menit)'];
        const summaryRows = assignments.map((a: any, idx) => {
            // Handle both possible timestamp field names
            const rawStart = a.startedAt || a.startTime;
            const rawEnd = a.completedAt || a.endTime;  
            
            let startDate: Date | null = null;
            let endDate: Date | null = null;
            
            if (rawStart) {
                startDate = rawStart.toDate ? rawStart.toDate() : new Date(rawStart);
            }
            if (rawEnd) {
                endDate = rawEnd.toDate ? rawEnd.toDate() : new Date(rawEnd);
            }

            let durMinutes = '-';
            if (startDate && endDate) {
                durMinutes = ((endDate.getTime() - startDate.getTime()) / 60000).toFixed(1);
            }

            return [
                idx + 1,
                a.student?.name || 'Unknown',
                a.student?.username || 'Unknown',
                a.score != null ? Number(Number(a.score).toFixed(1)) : 0,
                startDate ? startDate.toLocaleString('id-ID') : '-',
                endDate ? endDate.toLocaleString('id-ID') : '-',
                durMinutes,
            ];
        });

        const ws1 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
        ws1['!cols'] = summaryHeaders.map((h, i) => ({
            wch: Math.max(String(h).length, ...summaryRows.map(r => String(r[i] ?? '').length), 5) + 2
        }));
        XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');

        // Sheet 2: Answer Matrix (Detail Jawaban)
        const qHeaders = ['No', 'Nama', ...questions.map((_, i) => `Soal ${i + 1}`), 'Benar', 'Skor'];
        const kunciRow = ['', 'KUNCI', ...questions.map((q: any) => String(q.correctAnswer || ''))];

        const answerRows = assignments.map((a: any, idx) => {
            let correctCount = 0;

            const ansMatrix = questions.map((q: any) => {
                const ans = a.answers.find((x: any) => x.questionId === q.id);
                const qType = q.questionType as string;
                const ansText = ans ? ans.answerText as string | null : null;

                let studentAnswer = '-';
                let isCorrect = false;

                if (qType === 'ISIAN') {
                    studentAnswer = ansText || '-';
                    isCorrect = !!ansText && ansText.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
                } else if (qType === 'BENAR_SALAH') {
                    studentAnswer = ans?.selectedOption ? String(ans.selectedOption) : '-';
                    const options = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE];
                    const lastIdx = options.reduce((acc: number, opt: any, i: number) => (opt && String(opt).trim() !== '' ? i : acc), 0);
                    
                    const correctArr = String(q.correctAnswer).split(',').slice(0, lastIdx + 1);
                    const studentArr = studentAnswer.split(',').slice(0, lastIdx + 1);
                    
                    isCorrect = correctArr.join(',') === studentArr.join(',');
                } else {
                    studentAnswer = ans?.selectedOption ? String(ans.selectedOption) : '-';
                    if (qType === 'PGK') {
                        isCorrect = String(q.correctAnswer).split(',').sort().join(',') === String(ans?.selectedOption || '').split(',').sort().join(',');
                    } else {
                        isCorrect = ans?.selectedOption === q.correctAnswer;
                    }
                }

                if (isCorrect) correctCount++;
                return studentAnswer;
            });

            const score = a.score != null ? Number(Number(a.score).toFixed(1)) : 0;
            return [idx + 1, a.student?.name || 'Unknown', ...ansMatrix, correctCount, score];
        });

        const ws2 = XLSX.utils.aoa_to_sheet([qHeaders, kunciRow, ...answerRows]);
        const allRows2 = [qHeaders, kunciRow, ...answerRows];
        ws2['!cols'] = qHeaders.map((h, i) => ({
            wch: Math.max(String(h).length, ...allRows2.map(r => String(r[i] ?? '').length), 5) + 2
        }));
        XLSX.utils.book_append_sheet(wb, ws2, 'Detail Jawaban');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const safeName = String(tryoutData.title || 'export').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);

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
