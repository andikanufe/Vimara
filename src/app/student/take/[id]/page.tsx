import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import ExamInterface from './ExamInterface';

export default async function TakeTryoutPage({ params }: { params: Promise<{ id: string }> }) {
  const tryoutId = (await params).id;
  const session = await getSession();

  if (!session) return redirect('/');

  const assignment = await prisma.assignment.findFirst({
    where: { tryoutId, studentId: session.id },
    include: {
      tryout: {
        include: { questions: { orderBy: { id: 'asc' } } }
      },
      answers: true
    }
  });

  if (!assignment || assignment.status === 'COMPLETED') {
    return redirect('/student/dashboard');
  }

  let effectiveStartTime = assignment.startTime;
  if (!effectiveStartTime || assignment.status === 'PENDING') {
    effectiveStartTime = new Date();
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { status: 'ONGOING', startTime: effectiveStartTime }
    });
  }

  // Build existing answers dict — support both selectedOption and answerText
  const existingAnswers: Record<string, string> = {};
  assignment.answers.forEach(a => {
    const ansText = (a as Record<string, unknown>).answerText as string | null;
    if (a.selectedOption) {
      existingAnswers[a.questionId] = a.selectedOption;
    } else if (ansText) {
      existingAnswers[a.questionId] = ansText;
    }
  });

  const dur = (assignment.tryout as Record<string, unknown>).duration as number | null;

  const safeQuestions = assignment.tryout.questions.map(q => {
    const qType = (q as Record<string, unknown>).questionType as string;
    const imgUrl = (q as Record<string, unknown>).imageUrl as string | null;
    return {
      id: q.id,
      questionType: qType === 'PGK' ? 'PGK' as const : qType === 'ISIAN' ? 'ISIAN' as const : qType === 'BENAR_SALAH' ? 'BENAR_SALAH' as const : 'PG' as const,
      questionText: q.questionText,
      imageUrl: imgUrl,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      optionE: q.optionE,
    };
  });

  return (
    <ExamInterface
      assignmentId={assignment.id}
      tryoutTitle={assignment.tryout.title}
      questions={safeQuestions}
      initialAnswers={existingAnswers}
      duration={dur}
      startTime={effectiveStartTime?.toISOString() || null}
    />
  );
}
