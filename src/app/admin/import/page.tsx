import { db } from '@/lib/firebase-admin';
import ImportClient from './ImportClient';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const tryoutsSnap = await db.collection('tryouts').orderBy('createdAt', 'desc').get();
  const tryouts = tryoutsSnap.docs.map(doc => ({
    id: doc.id,
    title: doc.data().title as string,
    category: doc.data().category as string,
  }));

  return <ImportClient tryouts={tryouts} />;
}
