import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tryoutsSnap = await db.collection('tryouts').get();
        const tryouts = tryoutsSnap.docs
            .map(t => ({ id: t.id, ...t.data() }))
            .sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''));

        const studentsSnap = await db.collection('users').where('role', '==', 'STUDENT').get();
        const studentDocs = studentsSnap.docs.sort((a, b) => (a.data().name || '').localeCompare(b.data().name || ''));

        const students = await Promise.all(studentDocs.map(async (doc) => {
            const assignSnap = await db.collection('assignments')
                .where('studentId', '==', doc.id)
                .where('status', '==', 'COMPLETED')
                .get();

            const assignments = assignSnap.docs.map(a => ({
                id: a.id,
                ...a.data(),
                tryout: tryouts.find(t => t.id === a.data().tryoutId)
            }));

            return {
                id: doc.id,
                ...doc.data(),
                assignments
            };
        }));

        const detailHeaders = ['No', 'Nama', 'Tryout', 'Skor', 'Waktu Mulai', 'Waktu Selesai'];
        const detailRows: any[] = [];
        let detailIdx = 1;
        students.forEach((s: any) => {
            s.assignments.forEach((a: any) => {
                if (a.status === 'COMPLETED') {
                    const tryout = tryouts.find((t: any) => t.id === a.tryoutId);
                    detailRows.push([
                        detailIdx++,
                        s.name,
                        (tryout as any) ? (tryout as any).title : 'Unknown',
                        Number(a.score) || 0,
                        a.startedAt ? new Date(a.startedAt).toLocaleString('id-ID') : '-',
                        a.completedAt ? new Date(a.completedAt).toLocaleString('id-ID') : '-'
                    ]);
                }
            });
        });
        const wb = XLSX.utils.book_new();

        // Sheet: All Student Scores
        const headers = ['No', 'Nama', 'Username', ...tryouts.map((t: any) => t.title as string), 'Rata-rata'];
        const rows = students.map((s: any, idx: any) => {
            const scores = tryouts.map((t: any) => {
                const asg = s.assignments.find((a: any) => a.tryoutId === t.id);
                return asg && asg.status === 'COMPLETED' && asg.score !== undefined && asg.score !== null ? Number((asg.score as number).toFixed(1)) : '-';
            });
            const numScores = scores.filter(s => typeof s === 'number') as number[];
            const avg = numScores.length > 0 ? (numScores.reduce((a, b) => a + b, 0) / numScores.length).toFixed(1) : '-';
            return [idx + 1, s.name, s.username, ...scores, avg];
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

        // Auto-width columns
        const colWidths = headers.map((h, i) => {
            const maxLen = Math.max(String(h).length, ...rows.map(r => String(r[i]).length));
            return { wch: maxLen + 2 };
        });
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai Siswa');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="rekap_nilai_siswa_${new Date().toISOString().slice(0, 10)}.xlsx"`,
            }
        });
    } catch (error) {
        console.error('Export Students Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
