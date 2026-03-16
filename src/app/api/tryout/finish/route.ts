import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await request.json();

    const assignDoc = await db.collection('assignments').doc(assignmentId).get();

    if (!assignDoc.exists || assignDoc.data()!.studentId !== session.id || assignDoc.data()!.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }

    const assignment = assignDoc.data()!;
    const tryoutId = assignment.tryoutId;

    // Get answers
    const answersSnap = await db.collection('answers').where('assignmentId', '==', assignmentId).get();
    const answers = answersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get questions
    const questionsSnap = await db.collection('questions').where('tryoutId', '==', tryoutId).get();
    const questions = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate score (PG, PGK, ISIAN)
    const totalQuestions = questions.length;
    let correctAnswers = 0;

    if (totalQuestions > 0) {
      questions.forEach((question: any) => {
        const studentAnswer = answers.find((a: any) => a.questionId === question.id);
        if (!studentAnswer) return;

        const qType = question.questionType as string;

        let isCorrect = false;

        if (qType === 'PILIHAN_GANDA') {
          isCorrect = (studentAnswer as any).selectedOption === question.correctAnswer;
        } else if (qType === 'ISIAN') {
          const ansText = ((studentAnswer as any).answerText || '').trim().toLowerCase();
          const correctText = (question.correctAnswer || '').trim().toLowerCase();
          isCorrect = ansText === correctText;
        } else if (qType === 'PGK') {
          const correctSet = String(question.correctAnswer).split(',').sort().join(',');
          const studentSet = String((studentAnswer as any).selectedOption || '').split(',').sort().join(',');
          isCorrect = correctSet === studentSet;
        } else if (qType === 'BENAR_SALAH') {
          const options = [question.optionA, question.optionB, question.optionC, question.optionD, question.optionE];
          const lastIdx = options.reduce((acc, opt, i) => (opt && opt.trim() !== '' ? i : acc), 0);
          
          const correctArr = String(question.correctAnswer).split(',').slice(0, lastIdx + 1);
          const studentArr = String((studentAnswer as any).selectedOption || '').split(',').slice(0, lastIdx + 1);
          
          isCorrect = correctArr.join(',') === studentArr.join(',');
        }

        if (isCorrect) {
          correctAnswers++;
        }
      });
    }

    const finalScore = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    await assignDoc.ref.update({
      status: 'COMPLETED',
      score: finalScore,
      endTime: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      redirect: `/student/tryouts/${tryoutId}/result`
    });
  } catch (error) {
    console.error('Finish API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
