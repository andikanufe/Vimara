import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/firebase-admin';
import { encrypt } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan Password wajib diisi' }, { status: 400 });
    }

    // Find user by username
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Username atau Password salah' }, { status: 401 });
    }

    const userDoc = snapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() } as {
      id: string;
      username: string;
      password: string;
      name: string;
      role: string;
    };

    let isMatch = false;
    const isHashed = user.password.startsWith('$2');

    if (isHashed) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = password === user.password;
      if (isMatch) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await usersRef.doc(user.id).update({ password: hashedPassword });
      }
    }

    if (!isMatch) {
      return NextResponse.json({ error: 'Username atau Password salah' }, { status: 401 });
    }

    const sessionData = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await encrypt(sessionData);

    (await cookies()).set('session', session, {
      expires,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    return NextResponse.json({
      user: sessionData,
      redirect: user.role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
