import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET — list all categories with tryout counts
export async function GET() {
    const categories = await prisma.packageCategory.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            tryouts: {
                select: { id: true, title: true, category: true }
            }
        }
    });

    return NextResponse.json(categories);
}

// POST — create category
export async function POST(req: NextRequest) {
    const { name } = await req.json();

    if (!name) {
        return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
    }

    const category = await prisma.packageCategory.create({
        data: { name },
        include: { tryouts: { select: { id: true, title: true, category: true } } }
    });

    return NextResponse.json(category, { status: 201 });
}

// PUT — update category
export async function PUT(req: NextRequest) {
    const { id, name } = await req.json();

    if (!id || !name) {
        return NextResponse.json({ error: 'ID dan nama wajib diisi' }, { status: 400 });
    }

    const category = await prisma.packageCategory.update({
        where: { id },
        data: { name },
        include: { tryouts: { select: { id: true, title: true, category: true } } }
    });

    return NextResponse.json(category);
}

// DELETE — delete category (unlinks tryouts, doesn't delete them)
export async function DELETE(req: NextRequest) {
    const { id } = await req.json();

    if (!id) {
        return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    // Unlink tryouts first
    await prisma.tryout.updateMany({
        where: { categoryId: id },
        data: { categoryId: null }
    });

    await prisma.packageCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
