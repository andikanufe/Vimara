import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// POST — add a tryout to a category
export async function POST(req: NextRequest) {
    const { tryoutId, categoryId } = await req.json();

    if (!tryoutId || !categoryId) {
        return NextResponse.json({ error: 'tryoutId dan categoryId wajib diisi' }, { status: 400 });
    }

    await db.collection('tryouts').doc(tryoutId).update({ categoryId });

    return NextResponse.json({ success: true });
}

// DELETE — remove a tryout from its category
export async function DELETE(req: NextRequest) {
    const { tryoutId } = await req.json();

    if (!tryoutId) {
        return NextResponse.json({ error: 'tryoutId wajib diisi' }, { status: 400 });
    }

    await db.collection('tryouts').doc(tryoutId).update({ categoryId: null });

    return NextResponse.json({ success: true });
}
