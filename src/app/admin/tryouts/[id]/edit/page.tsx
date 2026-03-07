import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import Link from 'next/link';

export default async function EditTryoutPage({ params }: { params: Promise<{ id: string }> }) {
    const tryoutId = (await params).id;

    const tryout = await prisma.tryout.findUnique({
        where: { id: tryoutId },
        include: { packageCategory: true }
    });

    if (!tryout) return notFound();

    const packageCategories = await prisma.packageCategory.findMany({
        orderBy: { name: 'asc' }
    });

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

        await prisma.tryout.update({
            where: { id: tryoutId },
            data: { title, category, description, duration, categoryId, pdfLink, youtubeLink },
        });

        redirect(`/admin/tryouts/${tryoutId}`);
    }

    const durStr = tryout.duration ? tryout.duration.toString() : '';
    const tryoutCategory = tryout.category as string;
    const tTitle = tryout.title as string;
    const tDesc = tryout.description as string | undefined;
    const tCatId = tryout.categoryId as string | undefined;
    const tPdf = (tryout as Record<string, unknown>).pdfLink as string | undefined;
    const tYt = (tryout as Record<string, unknown>).youtubeLink as string | undefined;

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
                            <option value="UTBK">UTBK / SNBT</option>
                            <option value="CPNS">CPNS / Kedinasan</option>
                            <option value="TKA">TKA (Saintek/Soshum)</option>
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
                                {packageCategories.map(pc => (
                                    <option key={pc.id} value={pc.id}>{pc.name}</option>
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

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button type="submit" className="btn btn-primary">Simpan Perubahan</button>
                        <Link href={`/admin/tryouts/${tryoutId}`} className="btn btn-outline">Batal</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
