import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK (singleton)
function initFirebaseAdmin() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            'Firebase Admin SDK environment variables are missing. ' +
            'Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file.'
        );
    }
    try {
        return admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
    } catch (error) {
        console.warn('Firebase admin initialization warning (usually safe during build):', error);
        // Fallback for build phase when dummy credentials are in .env
        return admin.initializeApp({ projectId: projectId || 'demo-project' });
    }
}

const app = initFirebaseAdmin();

export const db = admin.firestore(app);
export const storage = admin.storage(app);
export const defaultBucketName = process.env.FIREBASE_STORAGE_BUCKET || '';
export default admin;
