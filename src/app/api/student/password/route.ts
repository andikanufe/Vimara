import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PUT(req: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'STUDENT') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { newPassword } = await req.json();

        if (!newPassword || newPassword.length < 4) {
            return NextResponse.json({ error: 'Password minimal 4 karakter' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: session.id },
            data: { password: hashedPassword }
        });

        return NextResponse.json({ message: 'Password berhasil diperbarui' });
    } catch (error) {
        console.error('Update password error:', error);
        return NextResponse.json({ error: 'Gagal memperbarui password' }, { status: 500 });
    }
}
