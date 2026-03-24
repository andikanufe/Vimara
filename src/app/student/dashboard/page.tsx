import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session) return null;

  // 1. Fetch ALL assignments for the student
  const assignmentsSnap = await db.collection('assignments')
    .where('studentId', '==', session.id)
    .get();

  const sortedDocs = assignmentsSnap.docs.sort((a, b) => {
    const dateA = a.data().createdAt?.toDate?.() || new Date(0);
    const dateB = b.data().createdAt?.toDate?.() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  const enrichedAssignments = await Promise.all(sortedDocs.map(async (doc) => {
    const aData = doc.data();
    const tryoutDoc = await db.collection('tryouts').doc(aData.tryoutId as string).get();
    if (!tryoutDoc.exists) return null;
    const tData = tryoutDoc.data()!;
    const qSnap = await db.collection('questions').where('tryoutId', '==', tryoutDoc.id).count().get();
    return {
      id: doc.id,
      ...aData,
      tryout: { id: tryoutDoc.id, ...tData, _count: { questions: qSnap.data().count } }
    };
  }));

  const validAssignments: any[] = enrichedAssignments.filter(Boolean);

  const ongoingAssignment = validAssignments.find((a: any) => a.status === 'ONGOING');
  const pendingAssignments = validAssignments.filter((a: any) => a.status === 'PENDING');
  const completedAssignments = validAssignments.filter((a: any) => a.status === 'COMPLETED');

  const scores = completedAssignments.map((a: any) => Number(a.score) || 0);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const passCount = scores.filter(s => s >= 70).length;

  // Global Rank
  const studentsSnap = await db.collection('users').where('role', '==', 'STUDENT').get();
  let globalRank = 0;
  if (studentsSnap.size > 0 && avgScore > 0) {
    let betterStudents = 0;
    await Promise.all(studentsSnap.docs.map(async (doc) => {
      if (doc.id === session.id) return;
      const aSnap = await db.collection('assignments').where('studentId', '==', doc.id).where('status', '==', 'COMPLETED').get();
      if (aSnap.empty) return;
      const userScores = aSnap.docs.map(d => Number(d.data().score) || 0);
      const userAvg = userScores.reduce((a, b) => a + b, 0) / userScores.length;
      if (userAvg > avgScore) betterStudents++;
    }));
    globalRank = betterStudents + 1;
  }

  const getScoreInfo = (s: number) => {
    if (s >= 90) return { label: 'Sangat Baik', colorClass: 'text-green-700', bgClass: 'bg-green-100' };
    if (s >= 70) return { label: 'Lulus', colorClass: 'text-blue-700', bgClass: 'bg-blue-100' };
    if (s >= 50) return { label: 'Cukup', colorClass: 'text-yellow-700', bgClass: 'bg-yellow-100' };
    return { label: 'Perlu Belajar', colorClass: 'text-red-700', bgClass: 'bg-red-100' };
  };

  return (
    <div style={{ paddingTop: '8px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary, #111)', margin: 0 }}>
          Halo, {session.name.split(' ')[0]}!
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary, #666)', marginTop: '4px' }}>
          Selamat datang di dashboard pribadi kamu. Yuk, lanjutkan belajar hari ini!
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rata-rata Nilai</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary, #111)', lineHeight: 1 }}>{avgScore > 0 ? avgScore : '–'}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginTop: '4px' }}>dari {completedAssignments.length} tryout selesai</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nilai Tertinggi</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--primary, #2563eb)', lineHeight: 1 }}>{bestScore > 0 ? bestScore.toFixed(0) : '–'}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginTop: '4px' }}>{passCount} kali lulus (nilai ≥70)</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Menunggu Dikerjakan</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary, #111)', lineHeight: 1 }}>{pendingAssignments.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginTop: '4px' }}>tryout belum dimulai</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peringkat</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary, #111)', lineHeight: 1 }}>#{globalRank || '–'}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginTop: '4px' }}>dari seluruh siswa</div>
        </div>
      </div>

      {/* Ongoing Exam */}
      {ongoingAssignment && (
        <div className="card" style={{ padding: '16px', marginBottom: '20px', borderLeft: '3px solid var(--primary, #2563eb)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary, #2563eb)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                ● Sedang Berlangsung
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #111)', marginBottom: '4px' }}>
                {(ongoingAssignment as any).tryout.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #888)' }}>
                {(ongoingAssignment as any).tryout._count.questions} soal
                {(ongoingAssignment as any).tryout.duration ? ` · ${(ongoingAssignment as any).tryout.duration} menit` : ''}
              </div>
            </div>
            <Link
              href={`/student/tryouts/${(ongoingAssignment as any).tryout.id}`}
              className="btn btn-primary"
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Lanjutkan
            </Link>
          </div>
        </div>
      )}

      {/* Two Column: Pending + Completed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Pending Tryouts */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border, #e5e7eb)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111)' }}>Tryout Menunggu</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginTop: '2px' }}>{pendingAssignments.length} belum dikerjakan</div>
            </div>
          </div>
          {pendingAssignments.length > 0 ? (
            <div>
              {pendingAssignments.slice(0, 5).map((a: any) => (
                <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light, #f3f4f6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary, #111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.tryout.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginTop: '2px' }}>
                      {a.tryout._count.questions} soal{a.tryout.duration ? ` · ${a.tryout.duration} mnt` : ''}
                    </div>
                  </div>
                  <Link href={`/student/tryouts/${a.tryout.id}`} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary, #2563eb)', flexShrink: 0 }}>
                    Mulai →
                  </Link>
                </div>
              ))}
              {pendingAssignments.length > 5 && (
                <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <Link href="/student/tryouts" style={{ fontSize: '12px', color: 'var(--text-secondary, #888)' }}>
                    +{pendingAssignments.length - 5} lainnya
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary, #888)', fontSize: '13px' }}>
              Semua tryout sudah dikerjakan! 🎉
            </div>
          )}
        </div>

        {/* Completed Tryouts */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111)' }}>Riwayat Nilai</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginTop: '2px' }}>{completedAssignments.length} tryout selesai</div>
          </div>
          {completedAssignments.length > 0 ? (
            <div>
              {completedAssignments.slice(0, 5).map((a: any) => {
                const score = Number(a.score) || 0;
                const info = getScoreInfo(score);
                return (
                  <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light, #f3f4f6)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={info.bgClass} style={{ width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className={info.colorClass} style={{ fontSize: '13px', fontWeight: 700 }}>{score.toFixed(0)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary, #111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.tryout.title}
                      </div>
                      <div className={info.colorClass} style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>
                        {info.label}
                      </div>
                    </div>
                    <Link href={`/student/tryouts/${a.tryout.id}/result`} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary, #2563eb)', flexShrink: 0 }}>
                      Lihat
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary, #888)', fontSize: '13px' }}>
              Belum ada tryout yang selesai.
            </div>
          )}
        </div>

      </div>

      {/* Progress Bar Summary */}
      <div className="card" style={{ padding: '16px', marginTop: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111)', marginBottom: '12px' }}>Ringkasan Progress</div>
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '5px' }}>
            <span>Tryout Diselesaikan</span>
            <span style={{ fontWeight: 600 }}>{completedAssignments.length} / {validAssignments.length}</span>
          </div>
          <div style={{ height: '6px', backgroundColor: 'var(--border-light, #f0f0f0)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: '99px',
              backgroundColor: 'var(--primary, #2563eb)',
              width: validAssignments.length > 0 ? `${(completedAssignments.length / validAssignments.length) * 100}%` : '0%',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '5px' }}>
            <span>Tingkat Kelulusan (≥70)</span>
            <span style={{ fontWeight: 600 }}>{completedAssignments.length > 0 ? Math.round((passCount / completedAssignments.length) * 100) : 0}%</span>
          </div>
          <div style={{ height: '6px', backgroundColor: 'var(--border-light, #f0f0f0)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: '99px',
              backgroundColor: '#22c55e',
              width: completedAssignments.length > 0 ? `${(passCount / completedAssignments.length) * 100}%` : '0%',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
        {completedAssignments.length > 0 && (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginTop: '10px' }}>
            {passCount === completedAssignments.length
              ? `Luar biasa! Semua tryout yang dikerjakan berhasil lulus.`
              : `${passCount} dari ${completedAssignments.length} tryout berhasil lulus. Terus semangat!`
            }
          </p>
        )}
      </div>

    </div>
  );
}
