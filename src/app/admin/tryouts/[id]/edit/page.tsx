import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/firebase-admin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EditTryoutPage({ params }: { params: Promise<{ id: string }> }) {
    const tryoutId = (await params).id;

    const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();

    if (!tryoutDoc.exists) return notFound();

    const tryout = tryoutDoc.data()!;

    const packageCategoriesSnap = await db.collection('packageCategories').orderBy('name', 'asc').get();
    const packageCategories = packageCategoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    async function updateTryout(formData: FormData) {
        'use server';

        const title = formData.get('title') as string;
        const category = formData.get('category') as string;
        const description = formData.get('description') as string;
        const durationStr = formData.get('duration') as string;
        const duration = durationStr ? parseInt(durationStr, 10) : null;
        const categoryId = (formData.get('categoryId') as string) || null;
        const pdfLink = (formData.get('pdfLink') as string) || null;
        const youtubeLink = (formData.get('youtubeLink') as string) || null;
        const randomizeQuestions = formData.get('randomizeQuestions') === 'on';

        await db.collection('tryouts').doc(tryoutId).update({
            title, category, description, duration, categoryId, pdfLink, youtubeLink, randomizeQuestions,
            updatedAt: new Date()
        });

        redirect(`/admin/tryouts/${tryoutId}`);
    }

    const durStr = tryout.duration ? tryout.duration.toString() : '';
    const tryoutCategory = tryout.category as string;
    const tTitle = tryout.title as string;
    const tDesc = tryout.description as string | undefined;
    const tCatId = tryout.categoryId as string | undefined;
    const tPdf = tryout.pdfLink as string | undefined;
    const tYt = tryout.youtubeLink as string | undefined;

    return (
        <div className="animate-in">
            <div className="page-header">
                <Link href={`/admin/tryouts/${tryoutId}`} className="back-link">
                    ← Kembali ke detail tryout
                </Link>
                <h1>Edit Tryout Info</h1>
            </div>

            <div className="card" style={{ maxWidth: '600px' }}>
                <form action={updateTryout}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="title">Judul Paket Tryout</label>
                        <input
                            id="title"
                            name="title"
                            type="text"
                            className="form-input"
                            defaultValue={tTitle}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="category">Kategori</label>
                        <select
                            id="category"
                            name="category"
                            className="form-input"
                            defaultValue={tryoutCategory}
                            required
                        >
                            <option value="Matematika Wajib">Matematika Wajib</option>
                            <option value="Matematika Lanjut">Matematika Lanjut</option>
                            <option value="PK">PK</option>
                            <option value="PM">PM</option>
                            <option value="TIU">TIU</option>
                            <option value="LAINNYA">Lainnya</option>
                        </select>
                    </div>

                    {packageCategories.length > 0 && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="categoryId">Paket Kategori (Opsional)</label>
                            <select
                                id="categoryId"
                                name="categoryId"
                                className="form-input"
                                defaultValue={tCatId || ''}
                            >
                                <option value="">-- Tanpa Paket --</option>
                                {packageCategories.map((pc: any) => (
                                    <option key={pc.id} value={pc.id}>{pc.name as string}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="description">Deskripsi (Opsional)</label>
                        <textarea
                            id="description"
                            name="description"
                            className="form-input"
                            rows={4}
                            defaultValue={tDesc || ''}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="pdfLink">Link PDF Pembahasan (Opsional)</label>
                        <input
                            id="pdfLink"
                            name="pdfLink"
                            type="url"
                            className="form-input"
                            defaultValue={tPdf || ''}
                            placeholder="Contoh: https://drive.google.com/file/d/..."
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="youtubeLink">Link Video Pembahasan YouTube (Opsional)</label>
                        <input
                            id="youtubeLink"
                            name="youtubeLink"
                            type="url"
                            className="form-input"
                            defaultValue={tYt || ''}
                            placeholder="Contoh: https://youtube.com/watch?v=..."
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label" htmlFor="duration">Durasi Timer (menit) — kosongkan jika tanpa batas waktu</label>
                        <input
                            id="duration"
                            name="duration"
                            type="number"
                            className="form-input"
                            defaultValue={durStr}
                            min={1}
                            max={600}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                name="randomizeQuestions"
                                defaultChecked={tryout.randomizeQuestions === true}
                                className="w-4 h-4 rounded"
                                style={{ width: '1rem', height: '1rem' }}
                            />
                            <span className="text-sm font-medium" style={{ marginLeft: '0.5rem' }}>Acak Urutan Soal untuk Siswa</span>
                        </label>
                        <div className="text-xs text-muted" style={{ marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                            Jika dicentang, urutan soal akan diacak setiap kali siswa mengerjakan. Matikan jika soal harus berurutan.
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button type="submit" className="btn btn-primary">Simpan Perubahan</button>
                        <Link href={`/admin/tryouts/${tryoutId}`} className="btn btn-outline">Batal</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
