import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import { google } from 'googleapis';

const SCOPES = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
];

async function getGoogleAuth() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            project_id: process.env.FIREBASE_PROJECT_ID,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: SCOPES,
    });
    return auth;
}

// POST: Admin creates/updates Google Doc
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tryoutId = (await params).id;
        const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;

        if (!adminEmail) {
            return NextResponse.json({ error: 'GOOGLE_ADMIN_EMAIL not configured in .env' }, { status: 500 });
        }

        const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
        if (!tryoutDoc.exists) {
            return NextResponse.json({ error: 'Tryout not found' }, { status: 404 });
        }
        const tryoutData = tryoutDoc.data()!;

        // Get Questions
        const questionsSnap = await db.collection('questions')
            .where('tryoutId', '==', tryoutId)
            .get();
        
        const questions = questionsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateA.getTime() - dateB.getTime();
            });

        const auth = await getGoogleAuth();
        const docs = google.docs({ version: 'v1', auth });
        const drive = google.drive({ version: 'v3', auth });

        let fileId = tryoutData.googleDocId;

        if (fileId) {
            // Check if file still exists
            try {
                await drive.files.get({ fileId });
                // If exists, we'll clear it first in the batchUpdate
            } catch (e) {
                // If not found or error, create a new one
                fileId = null;
            }
        }

        if (!fileId) {
            // 1. Create a new Google Doc
            const createRes = await docs.documents.create({
                requestBody: {
                    title: `${tryoutData.title} - ${tryoutData.category}`,
                },
            });
            fileId = createRes.data.documentId!;
        }

        // 2. Build full text and track parts for formatting/images
        let fullText = "";
        const formattingRequests: any[] = [];
        const imageRequests: any[] = [];

        // Title & Category
        const titleText = `${tryoutData.title}\n`;
        const categoryText = `${tryoutData.category}\n\n`;
        
        formattingRequests.push({
            updateParagraphStyle: {
                range: { startIndex: 1, endIndex: 1 + titleText.length },
                paragraphStyle: { namedStyleType: 'TITLE' },
                fields: 'namedStyleType'
            }
        });

        fullText += titleText + categoryText;

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i] as any;
            const qNum = i + 1;
            const startOfQ = fullText.length + 1;
            
            // Question Head (bold)
            const qHead = `${qNum}. `;
            formattingRequests.push({
                updateTextStyle: {
                    range: { startIndex: startOfQ, endIndex: startOfQ + qHead.length },
                    textStyle: { bold: true },
                    fields: 'bold'
                }
            });

            fullText += qHead;
            fullText += `${q.questionText}\n`;

            if (q.imageUrl) {
                // Placeholder for image
                const imageIndex = fullText.length + 1;
                fullText += "\n"; // Space for image
                imageRequests.push({
                    insertInlineImage: {
                        location: { index: imageIndex },
                        uri: q.imageUrl,
                        objectSize: { width: { magnitude: 300, unit: 'PT' } }
                    }
                });
            }

            // Options
            if (q.questionType !== 'ISIAN' && q.questionType !== 'BENAR_SALAH') {
                for (const opt of ['A', 'B', 'C', 'D', 'E']) {
                    if (q[`option${opt}`]) {
                        fullText += `   ${opt}. ${q[`option${opt}`]}\n`;
                    }
                }
            } else if (q.questionType === 'BENAR_SALAH') {
                fullText += `   (Tabel Benar/Salah)\n`;
                for (const opt of ['A', 'B', 'C', 'D', 'E']) {
                    if (q[`option${opt}`]) {
                        fullText += `   - ${q[`option${opt}`]}: [ ] B [ ] S\n`;
                    }
                }
            }
            
            fullText += "\n"; // Spacer
        }

        // 3. Batch Update
        const finalRequests: any[] = [];
        
        // If updating, delete existing content first
        if (tryoutData.googleDocId) {
            const currentDoc = await docs.documents.get({ documentId: fileId });
            const content = currentDoc.data.body?.content || [];
            const lastIndex = content[content.length - 1]?.endIndex || 2;
            if (lastIndex > 2) {
                finalRequests.push({
                    deleteContentRange: {
                        range: { startIndex: 1, endIndex: lastIndex - 1 }
                    }
                });
            }
        }

        // Note: When using multiple requests in one batch, 
        // they are processed sequentially. 
        // Subsequent requests must account for the shift caused by previous ones 
        // IF they use indices from the NEW state.
        // BUT Google Docs API docs say: "All requests in the batch are executed 
        // based on the state of the document before the call."
        // ACTUALLY, that's for some APIs, but for Google Docs batchUpdate, 
        // each request shifts the indices for the NEXT request in the same batch.
        // SO: We MUST work backwards.

        // Combined requests
        const combined = [
            ...formattingRequests,
            ...imageRequests,
            { insertText: { location: { index: 1 }, text: fullText } }
        ];

        // Reverse to process from end of doc to start, keeping indices stable.
        // Wait. If I insert everything at once at index 1, THEN the formatting ranges are correct.
        // But the formatting ranges are based on the NEW text.
        // So the order should be: 1. Insert Text, 2. Apply Formatting/Images.
        // BUT if I do them in one batch, and I want to use absolute indices of the NEW text:
        // I should put insertText FIRST, and then others.
        // HOWEVER, Google Docs docs say: "Indices are based on the state of the document BEFORE the batch update."
        // If so, I can't format text that isn't there yet.
        
        // Correct Pattern:
        // Request 1: Insert all text.
        // (Indices for following requests in the SAME batch are relative to the state AFTER request 1?)
        // NO. Usually they are all relative to original state.
        
        // Let's do TWO SEPARATE batchUpdates to be 100% safe.
        // Phase 1: Clear and Insert Text.
        // Phase 2: Format and Add Images.

        await docs.documents.batchUpdate({
            documentId: fileId,
            requestBody: {
                requests: [
                    ...finalRequests, // Delete
                    { insertText: { location: { index: 1 }, text: fullText } }
                ]
            }
        });

        await docs.documents.batchUpdate({
            documentId: fileId,
            requestBody: {
                requests: [...formattingRequests, ...imageRequests]
            }
        });

        // 4. Share with Admin
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'writer',
                type: 'user',
                emailAddress: adminEmail,
            },
        });

        // 5. Update Firestore
        await db.collection('tryouts').doc(tryoutId).update({
            googleDocId: fileId,
            googleDocUrl: `https://docs.google.com/document/d/${fileId}/edit`
        });

        return NextResponse.json({ 
            success: true, 
            docId: fileId, 
            url: `https://docs.google.com/document/d/${fileId}/edit` 
        });

    } catch (error: any) {
        console.error('Google Docs Export Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// GET: Student downloads PDF from Google Doc
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const tryoutId = (await params).id;
        const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
        if (!tryoutDoc.exists) {
            return NextResponse.json({ error: 'Tryout not found' }, { status: 404 });
        }

        const tryoutData = tryoutDoc.data()!;
        const fileId = tryoutData.googleDocId;

        if (!fileId) {
            return NextResponse.json({ error: 'No Google Doc linked to this tryout' }, { status: 400 });
        }

        const auth = await getGoogleAuth();
        const drive = google.drive({ version: 'v3', auth });

        const res = await drive.files.export(
            { fileId: fileId, mimeType: 'application/pdf' },
            { responseType: 'stream' }
        );

        const safeName = String(tryoutData.title || 'soal').replace(/[^a-zA-Z0-9]/g, '_');

        return new NextResponse(res.data as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error('PDF Export Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
