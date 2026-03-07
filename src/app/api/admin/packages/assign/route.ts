import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST — assign all tryouts in a category to a student
export async function POST(req: NextRequest) {
    const { categoryId, studentId } = await req.json();

    if (!categoryId || !studentId) {
        return NextResponse.json({ error: 'categoryId dan studentId wajib diisi' }, { status: 400 });
    }

    // Get all tryouts in this category
    const tryouts = await prisma.tryout.findMany({
        where: { categoryId },
        select: { id: true }
    });

    if (tryouts.length === 0) {
        return NextResponse.json({ error: 'Tidak ada tryout dalam kategori ini' }, { status: 400 });
    }

    // Get existing assignments for this student
    const existingAssignments = await prisma.assignment.findMany({
        where: { studentId, tryoutId: { in: tryouts.map(t => t.id) } },
        select: { tryoutId: true }
    });

    const existingTryoutIds = new Set(existingAssignments.map(a => a.tryoutId));
    const newTryouts = tryouts.filter(t => !existingTryoutIds.has(t.id));

    if (newTryouts.length === 0) {
        return NextResponse.json({ message: 'Semua tryout sudah ditugaskan', assigned: 0 });
    }

    // Bulk-create assignments
    await prisma.assignment.createMany({
        data: newTryouts.map(t => ({
            studentId,
            tryoutId: t.id,
        }))
    });

    return NextResponse.json({
        message: `${newTryouts.length} tryout berhasil ditugaskan`,
        assigned: newTryouts.length,
        skipped: existingTryoutIds.size
    });
}
