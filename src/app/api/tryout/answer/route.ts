import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId, questionId, selectedOption, answerText } = await request.json();

    // Verify assignment belongs to student
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment || assignment.studentId !== session.id || assignment.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }

    // Upsert answer
    const existing = await prisma.answer.findFirst({
      where: { assignmentId, questionId }
    });

    if (existing) {
      await prisma.answer.update({
        where: { id: existing.id },
        data: { selectedOption: selectedOption || null, answerText: answerText || null }
      });
    } else {
      await prisma.answer.create({
        data: { assignmentId, questionId, selectedOption: selectedOption || null, answerText: answerText || null }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Answer API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
