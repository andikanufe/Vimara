import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// GET — get full student detail with assignments
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const studentId = (await params).id;

    const userDoc = await db.collection('users').doc(studentId).get();
    if (!userDoc.exists) {
        return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 });
    }

    const userData = userDoc.data()!;

    // Get assignments with their tryouts
    const assignSnap = await db.collection('assignments')
        .where('studentId', '==', studentId)
        .get();

    const sortedAssigns = assignSnap.docs.sort((a, b) => {
        const dateA = a.data().createdAt?.toDate?.() || new Date(0);
        const dateB = b.data().createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
    });

    const assignments = await Promise.all(sortedAssigns.map(async (doc) => {
        const a = doc.data();
        const tryoutDoc = await db.collection('tryouts').doc(a.tryoutId).get();
        let tryoutData = null;
        if (tryoutDoc.exists) {
            const t = tryoutDoc.data()!;
            let packageCategory = null;
            if (t.categoryId) {
                const catDoc = await db.collection('packageCategories').doc(t.categoryId).get();
                if (catDoc.exists) {
                    packageCategory = { id: catDoc.id, ...catDoc.data() };
                }
            }
            tryoutData = {
                id: tryoutDoc.id,
                ...t,
                createdAt: t.createdAt?.toDate?.()?.toISOString(),
                updatedAt: t.updatedAt?.toDate?.()?.toISOString(),
                packageCategory,
            };
        }
        return {
            id: doc.id,
            ...a,
            startTime: a.startTime?.toDate?.()?.toISOString() || null,
            endTime: a.endTime?.toDate?.()?.toISOString() || null,
            createdAt: a.createdAt?.toDate?.()?.toISOString(),
            updatedAt: a.updatedAt?.toDate?.()?.toISOString(),
            tryout: tryoutData,
        };
    }));

    return NextResponse.json({
        id: userDoc.id,
        ...userData,
        createdAt: userData.createdAt?.toDate?.()?.toISOString(),
        updatedAt: userData.updatedAt?.toDate?.()?.toISOString(),
        assignments,
    });
}

// POST — assign tryout(s) to student
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const studentId = (await params).id;
    const { tryoutIds, categoryId } = await req.json();

    let idsToAssign: string[] = [];

    if (categoryId) {
        const tryouts = await db.collection('tryouts').where('categoryId', '==', categoryId).get();
        idsToAssign = tryouts.docs.map(d => d.id);
    } else if (tryoutIds && Array.isArray(tryoutIds)) {
        idsToAssign = tryoutIds;
    }

    if (idsToAssign.length === 0) {
        return NextResponse.json({ error: 'Tidak ada tryout untuk di-assign' }, { status: 400 });
    }

    // Check existing assignments
    const existing = await db.collection('assignments').where('studentId', '==', studentId).get();
    const existingSet = new Set(existing.docs.map(d => d.data().tryoutId));
    const newIds = idsToAssign.filter(id => !existingSet.has(id));

    if (newIds.length === 0) {
        return NextResponse.json({ message: 'Semua tryout sudah ditugaskan', assigned: 0 });
    }

    const batch = db.batch();
    const now = new Date();
    for (const tryoutId of newIds) {
        const ref = db.collection('assignments').doc();
        batch.set(ref, {
            studentId,
            tryoutId,
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
        message: `${newIds.length} tryout berhasil ditugaskan`,
        assigned: newIds.length,
        skipped: existingSet.size,
    });
}

// DELETE — remove assignment(s) from student
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const studentId = (await params).id;
    const { assignmentIds, categoryId } = await req.json();

    const batch = db.batch();

    if (categoryId) {
        const tryouts = await db.collection('tryouts').where('categoryId', '==', categoryId).get();
        const tryoutIds = tryouts.docs.map(d => d.id);

        for (const tryoutId of tryoutIds) {
            const snap = await db.collection('assignments')
                .where('studentId', '==', studentId)
                .where('tryoutId', '==', tryoutId)
                .where('status', '==', 'PENDING')
                .get();
            snap.forEach(d => batch.delete(d.ref));
        }
    } else if (assignmentIds && Array.isArray(assignmentIds)) {
        for (const assignId of assignmentIds) {
            const doc = await db.collection('assignments').doc(assignId).get();
            if (doc.exists && doc.data()!.studentId === studentId && doc.data()!.status === 'PENDING') {
                batch.delete(doc.ref);
            }
        }
    }

    await batch.commit();
    return NextResponse.json({ success: true });
}
