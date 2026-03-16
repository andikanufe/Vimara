'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUI } from '@/providers/UIProvider';

export default function DeleteTryoutBtn({ tryoutId, tryoutTitle }: { tryoutId: string, tryoutTitle: string }) {
    const router = useRouter();
    const { confirm, toast, alert } = useUI();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        const ok = await confirm(
            'Hapus Tryout?',
            `Apakah Anda yakin ingin menghapus tryout "${tryoutTitle}"? Semua soal dan data ujian terkait akan ikut terhapus. Aksi ini tidak dapat dibatalkan.`
        );
        if (!ok) return;

        setIsDeleting(true);
        try {
            const res = await fetch('/api/tryout', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tryoutId }),
            });

            if (res.ok) {
                toast('Tryout berhasil dihapus', 'success');
                router.refresh();
            } else {
                const data = await res.json();
                alert('Gagal', data.error || 'Gagal menghapus tryout');
            }
        } catch {
            alert('Error', 'Terjadi kesalahan jaringan');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={handleDelete}
            disabled={isDeleting}
        >
            {isDeleting ? 'Menghapus...' : 'Hapus'}
        </button>
    );
}
