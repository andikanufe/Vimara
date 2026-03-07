import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST — add a tryout to a category
export async function POST(req: NextRequest) {
    const { tryoutId, categoryId } = await req.json();

    if (!tryoutId || !categoryId) {
        return NextResponse.json({ error: 'tryoutId dan categoryId wajib diisi' }, { status: 400 });
    }

    await prisma.tryout.update({
        where: { id: tryoutId },
        data: { categoryId }
    });

    return NextResponse.json({ success: true });
}

// DELETE — remove a tryout from its category
export async function DELETE(req: NextRequest) {
    const { tryoutId } = await req.json();

    if (!tryoutId) {
        return NextResponse.json({ error: 'tryoutId wajib diisi' }, { status: 400 });
    }

    await prisma.tryout.update({
        where: { id: tryoutId },
        data: { categoryId: null }
    });

    return NextResponse.json({ success: true });
}
