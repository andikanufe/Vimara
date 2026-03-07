import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { tryoutId, questionType, questionText, imageUrl, optionA, optionB, optionC, optionD, optionE, correctAnswer } = await request.json();

        await prisma.question.create({
            data: {
                tryoutId,
                questionType: questionType || 'PG',
                questionText,
                imageUrl: imageUrl || null,
                optionA: optionA || null,
                optionB: optionB || null,
                optionC: optionC || null,
                optionD: optionD || null,
                optionE: optionE || null,
                correctAnswer,
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Question Create Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, questionType, questionText, imageUrl, optionA, optionB, optionC, optionD, optionE, correctAnswer } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Missing question ID' }, { status: 400 });
        }

        await prisma.question.update({
            where: { id },
            data: {
                questionType: questionType || 'PG',
                questionText,
                imageUrl: imageUrl || null,
                optionA: optionA || null,
                optionB: optionB || null,
                optionC: optionC || null,
                optionD: optionD || null,
                optionE: optionE || null,
                correctAnswer,
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Question Update Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Missing question ID' }, { status: 400 });
        }

        await prisma.answer.deleteMany({ where: { questionId: id } });
        await prisma.question.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Question Delete Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
