import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET — list all tryouts (for package management dropdown)
export async function GET() {
    const tryouts = await prisma.tryout.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, category: true, categoryId: true }
    });

    return NextResponse.json(tryouts);
}
