import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// POST — assign all tryouts in a category to a student
export async function POST(req: NextRequest) {
    const { categoryId, studentId } = await req.json();

    if (!categoryId || !studentId) {
        return NextResponse.json({ error: 'categoryId dan studentId wajib diisi' }, { status: 400 });
    }

    // Get all tryouts in this category
    const tryoutsSnapshot = await db.collection('tryouts').where('categoryId', '==', categoryId).get();
    const tryouts = tryoutsSnapshot.docs.map(doc => ({ id: doc.id }));

    if (tryouts.length === 0) {
        return NextResponse.json({ error: 'Tidak ada tryout dalam kategori ini' }, { status: 400 });
    }

    // Get existing assignments for this student
    const existingSnapshot = await db.collection('assignments').where('studentId', '==', studentId).get();
    const existingTryoutIds = new Set(existingSnapshot.docs.map(doc => doc.data().tryoutId));

    const newTryouts = tryouts.filter(t => !existingTryoutIds.has(t.id));

    if (newTryouts.length === 0) {
        return NextResponse.json({ message: 'Semua tryout sudah ditugaskan', assigned: 0 });
    }

    // Bulk-create assignments using batch
    const batch = db.batch();
    const now = new Date();
    for (const t of newTryouts) {
        const ref = db.collection('assignments').doc();
        batch.set(ref, {
            studentId,
            tryoutId: t.id,
            status: 'PENDING',
            score: null,
            startTime: null,
            endTime: null,
            createdAt: now,
            updatedAt: now,
        });
    }
    await batch.commit();

    return NextResponse.json({
        message: `${newTryouts.length} tryout berhasil ditugaskan`,
        assigned: newTryouts.length,
        skipped: existingTryoutIds.size
    });
}
