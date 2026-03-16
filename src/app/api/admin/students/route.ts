import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/firebase-admin';

// GET — list all students with assignment counts
export async function GET() {
    const snapshot = await db.collection('users').where('role', '==', 'STUDENT').get();
    const sortedDocs = snapshot.docs.sort((a, b) => {
        const dateA = a.data().createdAt?.toDate?.() || new Date(0);
        const dateB = b.data().createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
    });

    const students = await Promise.all(sortedDocs.map(async (doc) => {
        const data = doc.data();
        const assignmentsSnap = await db.collection('assignments').where('studentId', '==', doc.id).count().get();
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            _count: { assignments: assignmentsSnap.data().count }
        };
    }));

    return NextResponse.json(students);
}

// POST — create new student
export async function POST(req: NextRequest) {
    const { username, password, name } = await req.json();

    if (!username || !password || !name) {
        return NextResponse.json({ error: 'Username, password, dan nama wajib diisi' }, { status: 400 });
    }

    // Check uniqueness
    const existing = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!existing.empty) {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const docRef = await db.collection('users').add({
        username,
        password: hashedPassword,
        name,
        role: 'STUDENT',
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
        _count: { assignments: 0 }
    }, { status: 201 });
}

// PUT — update student
export async function PUT(req: NextRequest) {
    const { id, username, password, name } = await req.json();

    if (!id) {
        return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    // Check if username is taken by another user
    if (username) {
        const existing = await db.collection('users').where('username', '==', username).limit(1).get();
        if (!existing.empty && existing.docs[0].id !== id) {
            return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
        }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (username) updateData.username = username;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (name) updateData.name = name;

    await db.collection('users').doc(id).update(updateData);

    const doc = await db.collection('users').doc(id).get();
    const data = doc.data()!;
    const assignmentsSnap = await db.collection('assignments').where('studentId', '==', id).count().get();

    return NextResponse.json({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
        _count: { assignments: assignmentsSnap.data().count }
    });
}

// DELETE — delete student (and their assignments)
export async function DELETE(req: NextRequest) {
    const { id } = await req.json();

    if (!id) {
        return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    // Delete all assignments for this student (and their answers)
    const assignmentsSnap = await db.collection('assignments').where('studentId', '==', id).get();
    const batch = db.batch();
    for (const assignDoc of assignmentsSnap.docs) {
        // Delete answers for each assignment
        const answersSnap = await db.collection('answers').where('assignmentId', '==', assignDoc.id).get();
        answersSnap.forEach(a => batch.delete(a.ref));
        batch.delete(assignDoc.ref);
    }
    batch.delete(db.collection('users').doc(id));
    await batch.commit();

    return NextResponse.json({ success: true });
}
