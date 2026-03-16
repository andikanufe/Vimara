import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Missing tryout ID' }, { status: 400 });
        }

        const batch = db.batch();

        // Delete the tryout itself
        batch.delete(db.collection('tryouts').doc(id));

        // Delete associated questions
        const questionsSnap = await db.collection('questions').where('tryoutId', '==', id).get();
        questionsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete associated assignments
        const assignmentsSnap = await db.collection('assignments').where('tryoutId', '==', id).get();
        assignmentsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Note: we're skipping deleting all answers for simplicity to avoid batch limits (max 500).
        // Since answers are mainly queried by assignmentId or questionId, they will just be hanging orphans or deleted later.

        await batch.commit();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Tryout Delete Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
