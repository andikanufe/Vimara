import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { storage, defaultBucketName } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Only JPEG, PNG, WebP, GIF allowed' }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const ext = file.name.split('.').pop() || 'png';
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

        // Upload to Firebase Storage
        const bucket = storage.bucket(defaultBucketName);
        const fileRef = bucket.file(`uploads/${filename}`);

        await fileRef.save(buffer, {
            metadata: {
                contentType: file.type,
            },
        });

        try {
            await fileRef.makePublic();
        } catch (e) {
            console.warn('Could not make file public automatically (UBLA might be ON). Check your bucket rules.', e);
        }

        const url = `https://storage.googleapis.com/${bucket.name}/${fileRef.name}`;

        return NextResponse.json({ url });
    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({
            error: 'Upload failed: ' + (error?.message || String(error))
        }, { status: 500 });
    }
}
