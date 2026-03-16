import { redirect } from 'next/navigation';
import { db as adminDb } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import ExamInterface from './ExamInterface';

export default async function TakeTryoutPage({ params }: { params: Promise<{ id: string }> }) {
  const tryoutId = (await params).id;
  const session = await getSession();

  if (!session) return redirect('/');

  // 1. Fetch assignment using Firestore
  const assignmentsSnapshot = await adminDb.collection('assignments')
    .where('studentId', '==', session.id)
    .get();

  const aDoc = assignmentsSnapshot.docs.find(d => d.data().tryoutId === tryoutId);

  if (!aDoc) {
    return redirect('/student/dashboard');
  }
  const assignment = { id: aDoc.id, ...aDoc.data() } as any;

  if (assignment.status === 'COMPLETED') {
    return redirect('/student/dashboard');
  }

  // 2. Fetch tryout and its questions
  const tryoutDoc = await adminDb.collection('tryouts').doc(tryoutId).get();
  if (!tryoutDoc.exists) {
    return redirect('/student/dashboard');
  }
  const tryoutData = tryoutDoc.data() as any;

  const questionsSnapshot = await adminDb.collection('questions')
    .where('tryoutId', '==', tryoutId)
    .get();

  let questionsData = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (tryoutData.randomizeQuestions) {
    // Fisher-Yates Shuffle
    for (let i = questionsData.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questionsData[i], questionsData[j]] = [questionsData[j], questionsData[i]];
    }
  } else {
    // Sort by createdAt (default sequential order)
    questionsData.sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
  }

  const questions = questionsData;

  // 3. Fetch existing answers for this assignment
  const answersSnapshot = await adminDb.collection('answers').where('assignmentId', '==', aDoc.id).get();
  const existingAnswersData = answersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  let effectiveStartTime = assignment.startTime;

  // Convert Firestore Timestamp to JS Date
  if (effectiveStartTime && typeof effectiveStartTime.toDate === 'function') {
    effectiveStartTime = effectiveStartTime.toDate();
  }

  if (!effectiveStartTime || assignment.status === 'PENDING') {
    const newStartTime = new Date();
    await adminDb.collection('assignments').doc(aDoc.id).update({
      status: 'ONGOING',
      startTime: newStartTime
    });
    effectiveStartTime = newStartTime;
  }

  // Build existing answers dict — support both selectedOption and answerText
  const existingAnswers: Record<string, string> = {};
  existingAnswersData.forEach((a: any) => {
    if (a.selectedOption) {
      existingAnswers[a.questionId] = a.selectedOption;
    } else if (a.answerText) {
      existingAnswers[a.questionId] = a.answerText;
    }
  });

  const dur = tryoutData.duration as number | null;

  const safeQuestions = questions.map((q: any) => {
    const qType = q.questionType as string;
    const imgUrl = q.imageUrl as string | null;
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
      tryoutTitle={tryoutData.title as string}
      questions={safeQuestions}
      initialAnswers={existingAnswers}
      duration={dur}
      startTime={effectiveStartTime?.toISOString() || null}
    />
  );
}
