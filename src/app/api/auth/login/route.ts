import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan Password wajib diisi' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ error: 'Username atau Password salah' }, { status: 401 });
    }

    let isMatch = false;

    // Backward compatibility: check if password is a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    const isHashed = user.password.startsWith('$2');

    if (isHashed) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Direct string comparison for old plain text passwords
      isMatch = password === user.password;

      // Auto-migrate: hash the password and save it so it's secure for next time
      if (isMatch) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword }
        });
      }
    }

    if (!isMatch) {
      return NextResponse.json({ error: 'Username atau Password salah' }, { status: 401 });
    }

    // Buat session
    const sessionData = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };

    // Expires dalam 1 hari
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await encrypt(sessionData);

    // Set cookie
    (await cookies()).set('session', session, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    return NextResponse.json({
      user: sessionData,
      redirect: user.role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard'
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
