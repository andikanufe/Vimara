import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET — get full student detail with assignments
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const studentId = (await params).id;

    const student = await prisma.user.findUnique({
        where: { id: studentId },
        include: {
            assignments: {
                include: {
                    tryout: {
                        include: {
                            packageCategory: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!student) {
        return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(student);
}

// POST — assign tryout(s) to student
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const studentId = (await params).id;
    const { tryoutIds, categoryId } = await req.json();

    let idsToAssign: string[] = [];

    if (categoryId) {
        // Assign all tryouts from a category
        const tryouts = await prisma.tryout.findMany({
            where: { categoryId },
            select: { id: true }
        });
        idsToAssign = tryouts.map(t => t.id);
    } else if (tryoutIds && Array.isArray(tryoutIds)) {
        idsToAssign = tryoutIds;
    }

    if (idsToAssign.length === 0) {
        return NextResponse.json({ error: 'Tidak ada tryout untuk di-assign' }, { status: 400 });
    }

    // Check existing assignments
    const existing = await prisma.assignment.findMany({
        where: { studentId, tryoutId: { in: idsToAssign } },
        select: { tryoutId: true }
    });
    const existingSet = new Set(existing.map(a => a.tryoutId));
    const newIds = idsToAssign.filter(id => !existingSet.has(id));

    if (newIds.length === 0) {
        return NextResponse.json({ message: 'Semua tryout sudah ditugaskan', assigned: 0 });
    }

    await prisma.assignment.createMany({
        data: newIds.map(tryoutId => ({ studentId, tryoutId }))
    });

    return NextResponse.json({
        message: `${newIds.length} tryout berhasil ditugaskan`,
        assigned: newIds.length,
        skipped: existingSet.size
    });
}

// DELETE — remove assignment(s) from student
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const studentId = (await params).id;
    const { assignmentIds, categoryId } = await req.json();

    if (categoryId) {
        // Remove all assignments for tryouts in this category
        const tryouts = await prisma.tryout.findMany({
            where: { categoryId },
            select: { id: true }
        });
        const tryoutIds = tryouts.map(t => t.id);

        await prisma.assignment.deleteMany({
            where: {
                studentId,
                tryoutId: { in: tryoutIds },
                status: 'PENDING' // Only delete pending assignments
            }
        });
    } else if (assignmentIds && Array.isArray(assignmentIds)) {
        await prisma.assignment.deleteMany({
            where: {
                id: { in: assignmentIds },
                studentId,
                status: 'PENDING' // Safety: only delete pending
            }
        });
    }

    return NextResponse.json({ success: true });
}
