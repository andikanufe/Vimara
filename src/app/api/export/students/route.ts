import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tryouts = await prisma.tryout.findMany({ orderBy: { title: 'asc' } });
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            include: {
                assignments: {
                    where: { status: 'COMPLETED' },
                    include: { tryout: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        const wb = XLSX.utils.book_new();

        // Sheet: All Student Scores
        const headers = ['No', 'Nama', 'Username', ...tryouts.map(t => t.title), 'Rata-rata'];
        const rows = students.map((s, idx) => {
            const scores = tryouts.map(t => {
                const a = s.assignments.find(a => a.tryoutId === t.id);
                return a?.score !== undefined && a?.score !== null ? Number(a.score.toFixed(1)) : '-';
            });
            const numScores = scores.filter(s => typeof s === 'number') as number[];
            const avg = numScores.length > 0 ? (numScores.reduce((a, b) => a + b, 0) / numScores.length).toFixed(1) : '-';
            return [idx + 1, s.name, s.username, ...scores, avg];
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

        // Auto-width columns
        const colWidths = headers.map((h, i) => {
            const maxLen = Math.max(h.length, ...rows.map(r => String(r[i]).length));
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
