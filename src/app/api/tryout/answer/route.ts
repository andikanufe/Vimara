import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId, questionId, selectedOption, answerText } = await request.json();

    // Verify assignment belongs to student
    const assignDoc = await db.collection('assignments').doc(assignmentId).get();

    if (!assignDoc.exists || assignDoc.data()!.studentId !== session.id || assignDoc.data()!.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }

    const answerId = `${assignmentId}_${questionId}`;
    await db.collection('answers').doc(answerId).set({
      assignmentId,
      questionId,
      selectedOption: selectedOption || null,
      answerText: answerText || null,
      updatedAt: new Date(),
    }, { merge: true });

    // Ensure createdAt exists if it's the first time
    const docRef = db.collection('answers').doc(answerId);
    const doc = await docRef.get();
    if (!doc.get('createdAt')) {
      await docRef.update({ createdAt: new Date() });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Answer API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
