import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tryoutId, questions } = await request.json();

    if (!tryoutId) {
      return NextResponse.json({ error: 'tryoutId is required' }, { status: 400 });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'questions array is required' }, { status: 400 });
    }

    // Verify tryout exists
    const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
    if (!tryoutDoc.exists) {
      return NextResponse.json({ error: 'Tryout not found' }, { status: 404 });
    }

    const imported: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      try {
        const now = new Date();
        // Use sequential timestamps so order is preserved
        const createdAt = new Date(now.getTime() + i * 100);
        const docRef = await db.collection('questions').add({
          tryoutId,
          questionType: q.questionType || 'PG',
          questionText: q.questionText || '',
          imageUrl: null,
          optionA: q.optionA || null,
          optionB: q.optionB || null,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          optionE: q.optionE || null,
          correctAnswer: q.correctAnswer || '',
          pembahasan: q.pembahasan || null,
          createdAt,
          updatedAt: now,
        });
        imported.push(docRef.id);
      } catch (e: any) {
        errors.push(`Soal ${i + 1}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      importedCount: imported.length,
      importedIds: imported,
      errors,
    });
  } catch (error: any) {
    console.error('Import Questions Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
