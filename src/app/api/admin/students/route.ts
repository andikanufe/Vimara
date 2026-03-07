import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

// GET — list all students with assignment counts
export async function GET() {
    const students = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        orderBy: { createdAt: 'desc' },
        include: {
            _count: { select: { assignments: true } }
        }
    });

    return NextResponse.json(students);
}

// POST — create new student
export async function POST(req: NextRequest) {
    const { username, password, name } = await req.json();

    if (!username || !password || !name) {
        return NextResponse.json({ error: 'Username, password, dan nama wajib diisi' }, { status: 400 });
    }

    // Check uniqueness
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    const student = await prisma.user.create({
        data: { username, password, name, role: 'STUDENT' },
        include: { _count: { select: { assignments: true } } }
    });

    return NextResponse.json(student, { status: 201 });
}

// PUT — update student
export async function PUT(req: NextRequest) {
    const { id, username, password, name } = await req.json();

    if (!id) {
        return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    // Check if username is taken by another user
    if (username) {
        const existing = await prisma.user.findFirst({
            where: { username, NOT: { id } }
        });
        if (existing) {
            return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
        }
    }

    const updateData: Record<string, string> = {};
    if (username) updateData.username = username;
    if (password) updateData.password = password;
    if (name) updateData.name = name;

    const student = await prisma.user.update({
        where: { id },
        data: updateData,
        include: { _count: { select: { assignments: true } } }
    });

    return NextResponse.json(student);
}

// DELETE — delete student
export async function DELETE(req: NextRequest) {
    const { id } = await req.json();

    if (!id) {
        return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
