import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// GET — list all tryouts (for package management dropdown)
export async function GET() {
    const tryoutsSnapshot = await db.collection('tryouts').get();
    const sortedDocs = tryoutsSnapshot.docs.sort((a, b) => {
        const dateA = a.data().createdAt?.toDate?.() || new Date(0);
        const dateB = b.data().createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
    });

    const tryouts = sortedDocs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        category: doc.data().category,
        categoryId: doc.data().categoryId || null,
    }));

    return NextResponse.json(tryouts);
}
