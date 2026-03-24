import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId, reason } = await request.json();

    const assignDoc = await db.collection('assignments').doc(assignmentId).get();

    if (!assignDoc.exists || assignDoc.data()!.studentId !== session.id || assignDoc.data()!.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }

    // Increment violation count and save the reason
    await assignDoc.ref.update({
      violationCount: FieldValue.increment(1),
      violationsList: FieldValue.arrayUnion({
        reason,
        timestamp: new Date()
      }),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Violation API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
