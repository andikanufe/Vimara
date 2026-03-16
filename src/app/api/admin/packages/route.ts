import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// GET — list all categories with tryout counts
export async function GET() {
    const categoriesSnapshot = await db.collection('packageCategories').get();
    const categoriesDocs = categoriesSnapshot.docs.sort((a, b) => {
        const dateA = a.data().createdAt?.toDate?.() || new Date(0);
        const dateB = b.data().createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
    });

    const categories = await Promise.all(categoriesDocs.map(async (doc) => {
        const tryoutsSnapshot = await db.collection('tryouts').where('categoryId', '==', doc.id).get();
        const tryouts = tryoutsSnapshot.docs.map(tDoc => ({
            id: tDoc.id,
            title: tDoc.data().title,
            category: tDoc.data().category,
        }));

        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            tryouts,
        };
    }));

    return NextResponse.json(categories);
}

// POST — create category
export async function POST(req: NextRequest) {
    const { name } = await req.json();

    if (!name) {
        return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
    }

    const now = new Date();
    const docRef = await db.collection('packageCategories').add({
        name,
        createdAt: now,
        updatedAt: now,
    });

    const doc = await docRef.get();
    const data = doc.data()!;

    return NextResponse.json({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
        tryouts: []
    }, { status: 201 });
}

// PUT — update category
export async function PUT(req: NextRequest) {
    const { id, name } = await req.json();

    if (!id || !name) {
        return NextResponse.json({ error: 'ID dan nama wajib diisi' }, { status: 400 });
    }

    const updateData = { name, updatedAt: new Date() };
    await db.collection('packageCategories').doc(id).update(updateData);

    const doc = await db.collection('packageCategories').doc(id).get();
    const data = doc.data()!;

    const tryoutsSnapshot = await db.collection('tryouts').where('categoryId', '==', id).get();
    const tryouts = tryoutsSnapshot.docs.map(tDoc => ({
        id: tDoc.id,
        title: tDoc.data().title,
        category: tDoc.data().category,
    }));

    return NextResponse.json({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
        tryouts,
    });
}

// DELETE — delete category (unlinks tryouts, doesn't delete them)
export async function DELETE(req: NextRequest) {
    const { id } = await req.json();

    if (!id) {
        return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    // Unlink tryouts first
    const tryoutsSnapshot = await db.collection('tryouts').where('categoryId', '==', id).get();
    const batch = db.batch();
    tryoutsSnapshot.forEach(doc => {
        batch.update(doc.ref, { categoryId: null });
    });

    // Delete the category
    batch.delete(db.collection('packageCategories').doc(id));
    await batch.commit();

    return NextResponse.json({ success: true });
}
