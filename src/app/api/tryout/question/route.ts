import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { tryoutId, questionType, questionText, imageUrl, optionA, optionB, optionC, optionD, optionE, correctAnswer, pembahasan } = await request.json();

        const now = new Date();
        const docRef = await db.collection('questions').add({
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
            pembahasan: pembahasan || null,
            createdAt: now,
            updatedAt: now,
        });

        return NextResponse.json({ success: true, id: docRef.id });
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

        const { id, questionType, questionText, imageUrl, optionA, optionB, optionC, optionD, optionE, correctAnswer, pembahasan } = await request.json();

        const questionDoc = await db.collection('questions').doc(id).get();
        if (!questionDoc.exists) {
            return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        }
        const oldData = questionDoc.data()!;
        const tryoutId = oldData.tryoutId;

        await db.collection('questions').doc(id).update({
            questionType: questionType || 'PG',
            questionText,
            imageUrl: imageUrl || null,
            optionA: optionA || null,
            optionB: optionB || null,
            optionC: optionC || null,
            optionD: optionD || null,
            optionE: optionE || null,
            correctAnswer,
            pembahasan: pembahasan || null,
            updatedAt: new Date(),
        });

        // Sync student scores if correctAnswer changed
        if (correctAnswer !== oldData.correctAnswer || questionType !== oldData.questionType) {
            // Get all questions
            const questionsSnap = await db.collection('questions').where('tryoutId', '==', tryoutId).get();
            const questions = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Get all completed assignments
            const assignmentsSnap = await db.collection('assignments')
                .where('tryoutId', '==', tryoutId)
                .where('status', '==', 'COMPLETED')
                .get();

            const batch = db.batch();
            let count = 0;

            for (const assignDoc of assignmentsSnap.docs) {
                const answersSnap = await db.collection('answers').where('assignmentId', '==', assignDoc.id).get();
                const answers = answersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                let correctAnswers = 0;
                questions.forEach((q: any) => {
                    const studentAnswer: any = answers.find((a: any) => a.questionId === q.id);
                    if (!studentAnswer) return;

                    const type = q.questionType;
                    const ans = studentAnswer.selectedOption;
                    const correctChoice = q.correctAnswer;

                    let isCorrect = false;
                    if (type === 'PILIHAN_GANDA' || type === 'PG') {
                        isCorrect = ans === correctChoice;
                    } else if (type === 'ISIAN') {
                        isCorrect = (studentAnswer.answerText || '').trim().toLowerCase() === (correctChoice || '').trim().toLowerCase();
                    } else if (type === 'PGK') {
                        isCorrect = String(ans || '').split(',').sort().join(',') === String(correctChoice || '').split(',').sort().join(',');
                    } else if (type === 'BENAR_SALAH') {
                        const opts = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE];
                        const li = opts.reduce((a: number, o: any, i: number) => (o && String(o).trim() !== '' ? i : a), 0);
                        const ca = String(correctChoice || '').split(',').slice(0, li + 1);
                        const sa = String(ans || '').split(',').slice(0, li + 1);
                        isCorrect = ca.join(',') === sa.join(',');
                    }

                    if (isCorrect) correctAnswers++;
                });

                const totalQuestions = questions.length;
                const newScore = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

                batch.update(assignDoc.ref, { score: newScore, updatedAt: new Date() });
                count++;
                
                // Firestore batch limit is 500
                if (count >= 400) {
                   await batch.commit();
                   count = 0;
                }
            }

            if (count > 0) await batch.commit();
        }

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

        // Delete all answers associated with this question
        const answersSnap = await db.collection('answers').where('questionId', '==', id).get();
        const batch = db.batch();
        answersSnap.forEach(doc => batch.delete(doc.ref));

        // Delete the question itself
        batch.delete(db.collection('questions').doc(id));
        await batch.commit();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Question Delete Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
