import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await request.json();

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        answers: true,
        tryout: {
          include: { questions: true }
        }
      }
    });

    if (!assignment || assignment.studentId !== session.id || assignment.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }

    // Calculate score (PG, PGK, ISIAN)
    const totalQuestions = assignment.tryout.questions.length;
    let correctAnswers = 0;

    if (totalQuestions > 0) {
      assignment.tryout.questions.forEach(question => {
        const studentAnswer = assignment.answers.find(a => a.questionId === question.id);
        if (!studentAnswer) return;

        const qType = (question as Record<string, unknown>).questionType as string;

        if (qType === 'PGK') {
          const correctSet = question.correctAnswer.split(',').sort().join(',');
          const studentSet = (studentAnswer.selectedOption || '').split(',').sort().join(',');
          if (correctSet === studentSet) correctAnswers++;
        } else if (qType === 'ISIAN') {
          // Case-insensitive trimmed comparison
          const correct = question.correctAnswer.trim().toLowerCase();
          const student = ((studentAnswer as Record<string, unknown>).answerText as string || '').trim().toLowerCase();
          if (correct === student) correctAnswers++;
        } else {
          // PG
          if (studentAnswer.selectedOption === question.correctAnswer) correctAnswers++;
        }
      });
    }

    const finalScore = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: 'COMPLETED',
        score: finalScore,
        endTime: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      redirect: `/student/tryouts/${assignment.tryoutId}/result`
    });
  } catch (error) {
    console.error('Finish API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
