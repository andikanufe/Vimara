const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.answer.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.question.deleteMany();
  await prisma.tryout.deleteMany();
  await prisma.user.deleteMany();

  // Create admin
  await prisma.user.create({
    data: {
      username: 'andikanufe',
      password: await bcrypt.hash('semarang123', 10),
      name: 'Administrator',
      role: 'ADMIN',
    }
  });

  // Create students
  const student1 = await prisma.user.create({
    data: {
      username: 'siswa1',
      password: await bcrypt.hash('siswa123', 10),
      name: 'Budi Santoso',
      role: 'STUDENT',
    }
  });

  const student2 = await prisma.user.create({
    data: {
      username: 'siswa2',
      password: await bcrypt.hash('siswa123', 10),
      name: 'Siti Rahayu',
      role: 'STUDENT',
    }
  });

  const student3 = await prisma.user.create({
    data: {
      username: 'siswa3',
      password: await bcrypt.hash('siswa123', 10),
      name: 'Ahmad Fauzi',
      role: 'STUDENT',
    }
  });

  // ==================== TRYOUT 1: UTBK ====================
  const utbk = await prisma.tryout.create({
    data: {
      title: 'UTBK - Penalaran Umum',
      category: 'UTBK',
      description: 'Tes penalaran umum untuk seleksi masuk perguruan tinggi negeri',
      duration: 45,
    }
  });

  const utbkQuestions = [
    { questionType: 'PG', questionText: 'Jika $p \\Rightarrow q$ bernilai benar, maka yang bernilai benar adalah...', optionA: '$q \\Rightarrow p$', optionB: '$\\neg p \\Rightarrow \\neg q$', optionC: '$\\neg q \\Rightarrow \\neg p$ (kontraposisi)', optionD: '$p \\Rightarrow \\neg q$', optionE: '$\\neg p \\Rightarrow q$', correctAnswer: 'C' },
    { questionType: 'PG', questionText: 'Deret aritmetika: 3, 7, 11, 15, ... Suku ke-20 adalah...', optionA: '$75$', optionB: '$79$', optionC: '$81$', optionD: '$83$', optionE: null, correctAnswer: 'B' },
    { questionType: 'PGK', questionText: 'Manakah yang merupakan tautologi? (Pilih semua yang benar)', optionA: '$p \\lor \\neg p$', optionB: '$p \\land \\neg p$', optionC: '$(p \\Rightarrow q) \\Leftrightarrow (\\neg q \\Rightarrow \\neg p)$', optionD: '$p \\land q$', optionE: null, correctAnswer: 'A,C' },
    { questionType: 'PG', questionText: 'Diketahui barisan geometri dengan $a = 2$ dan $r = 3$. Jumlah 5 suku pertama ($S_5$) adalah...', optionA: '$200$', optionB: '$242$', optionC: '$240$', optionD: '$250$', optionE: null, correctAnswer: 'B' },
    { questionType: 'ISIAN', questionText: 'Berapakah hasil dari $\\log_2 32$?', correctAnswer: '5' },
    { questionType: 'PG', questionText: 'Jika $f(x) = 2x + 3$, maka $f^{-1}(x) = ...$', optionA: '$\\frac{x-3}{2}$', optionB: '$\\frac{x+3}{2}$', optionC: '$2x - 3$', optionD: '$\\frac{2}{x+3}$', optionE: null, correctAnswer: 'A' },
    { questionType: 'PGK', questionText: 'Manakah pernyataan yang benar tentang himpunan? (Pilih semua yang benar)', optionA: '$A \\cup B = B \\cup A$', optionB: '$A \\cap B = B \\cap A$', optionC: '$A - B = B - A$', optionD: '$A \\cup \\emptyset = A$', optionE: null, correctAnswer: 'A,B,D' },
    { questionType: 'ISIAN', questionText: 'Jika $x + 5 = 12$, berapakah nilai $x$?', correctAnswer: '7' },
    { questionType: 'PG', questionText: 'Jika matriks $A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$, maka $\\det(A) = ...$', optionA: '$-2$', optionB: '$2$', optionC: '$-10$', optionD: '$10$', optionE: null, correctAnswer: 'A' },
    { questionType: 'ISIAN', questionText: 'Berapakah keliling lingkaran dengan jari-jari $r = 7$ cm? (gunakan $\\pi = \\frac{22}{7}$, jawab dalam cm tanpa satuan)', correctAnswer: '44' },
  ];

  for (const q of utbkQuestions) {
    await prisma.question.create({
      data: { tryoutId: utbk.id, ...q }
    });
  }

  // ==================== TRYOUT 2: CPNS ====================
  const cpns = await prisma.tryout.create({
    data: {
      title: 'CPNS - Tes Wawasan Kebangsaan',
      category: 'CPNS',
      description: 'Tes wawasan kebangsaan untuk seleksi CPNS',
      duration: 30,
    }
  });

  const cpnsQuestions = [
    { questionType: 'PG', questionText: 'Pancasila sebagai dasar negara pertama kali diusulkan oleh...', optionA: 'Ir. Soekarno', optionB: 'Moh. Hatta', optionC: 'Moh. Yamin', optionD: 'Soepomo', optionE: null, correctAnswer: 'A' },
    { questionType: 'PGK', questionText: 'Manakah yang termasuk dalam isi Pembukaan UUD 1945? (Pilih semua yang benar)', optionA: 'Tujuan negara', optionB: 'Dasar negara (Pancasila)', optionC: 'Bentuk pemerintahan', optionD: 'Daftar presiden', optionE: 'Ketuhanan Yang Maha Esa', correctAnswer: 'A,B,C,E' },
    { questionType: 'PG', questionText: 'Bhinneka Tunggal Ika berasal dari kitab...', optionA: 'Negarakertagama', optionB: 'Sutasoma', optionC: 'Pararaton', optionD: 'Arjunawiwaha', optionE: null, correctAnswer: 'B' },
    { questionType: 'ISIAN', questionText: 'Berapa jumlah pasal dalam UUD 1945 sebelum amandemen?', correctAnswer: '37' },
    { questionType: 'PG', questionText: 'Lambang negara Garuda Pancasila ditetapkan melalui...', optionA: 'PP No. 66 Tahun 1951', optionB: 'PP No. 66 Tahun 1950', optionC: 'UU No. 24 Tahun 2009', optionD: 'Keppres No. 100 Tahun 1950', optionE: null, correctAnswer: 'A' },
    { questionType: 'PGK', questionText: 'Manakah yang termasuk fungsi Pancasila? (Pilih semua yang benar)', optionA: 'Dasar negara', optionB: 'Pandangan hidup bangsa', optionC: 'Sumber hukum', optionD: 'Perjanjian luhur', optionE: null, correctAnswer: 'A,B,D' },
    { questionType: 'PG', questionText: 'Sistem pemerintahan Indonesia menurut UUD 1945 adalah...', optionA: 'Parlementer', optionB: 'Presidensial', optionC: 'Semi-presidensial', optionD: 'Monarki konstitusional', optionE: null, correctAnswer: 'B' },
    { questionType: 'ISIAN', questionText: 'Proklamasi kemerdekaan RI dibacakan pada tanggal berapa? (jawab angka saja)', correctAnswer: '17' },
    { questionType: 'PG', questionText: 'NKRI memiliki berapa provinsi pada tahun 2024?', optionA: '34', optionB: '36', optionC: '37', optionD: '38', optionE: null, correctAnswer: 'D' },
    { questionType: 'PG', questionText: 'Sidang BPUPKI yang membahas dasar negara dilaksanakan pada...', optionA: '29 Mei - 1 Juni 1945', optionB: '10-17 Juli 1945', optionC: '18 Agustus 1945', optionD: '1 Juni 1945', optionE: null, correctAnswer: 'A' },
  ];

  for (const q of cpnsQuestions) {
    await prisma.question.create({
      data: { tryoutId: cpns.id, ...q }
    });
  }

  // ==================== TRYOUT 3: TKA Saintek ====================
  const tka = await prisma.tryout.create({
    data: {
      title: 'TKA Saintek - Fisika & Matematika',
      category: 'TKA',
      description: 'Tes Kemampuan Akademik bidang Saintek',
      duration: 60,
    }
  });

  const tkaQuestions = [
    { questionType: 'PGK', questionText: 'Manakah yang termasuk ikatan kimia? (Pilih semua yang benar)', optionA: 'Ikatan ion', optionB: 'Ikatan gravitasi', optionC: 'Ikatan kovalen', optionD: 'Ikatan magnetik', optionE: 'Ikatan logam', correctAnswer: 'A,C,E' },
    { questionType: 'PG', questionText: 'Turunan pertama dari $f(x) = 3x^2 + 2x - 5$ adalah...', optionA: "$f'(x) = 6x + 2$", optionB: "$f'(x) = 3x + 2$", optionC: "$f'(x) = 6x - 5$", optionD: "$f'(x) = 6x^2 + 2$", optionE: "$f'(x) = 3x^2 + 2$", correctAnswer: 'A' },
    { questionType: 'PG', questionText: 'Nilai dari $\\lim_{x \\to 0} \\frac{\\sin x}{x}$ adalah...', optionA: '$0$', optionB: '$1$', optionC: '$\\infty$', optionD: '$-1$', optionE: 'Tidak ada', correctAnswer: 'B' },
    { questionType: 'PGK', questionText: 'Manakah besaran vektor? (Pilih semua yang benar)', optionA: 'Kecepatan ($\\vec{v}$)', optionB: 'Massa ($m$)', optionC: 'Gaya ($\\vec{F}$)', optionD: 'Suhu ($T$)', optionE: 'Percepatan ($\\vec{a}$)', correctAnswer: 'A,C,E' },
    { questionType: 'PG', questionText: 'Hasil dari $\\int 2x \\, dx$ adalah...', optionA: '$x^2 + C$', optionB: '$2x + C$', optionC: '$x^2$', optionD: '$2x^2 + C$', optionE: null, correctAnswer: 'A' },
    { questionType: 'ISIAN', questionText: 'Berapakah resultan gaya jika $F_1 = 3$ N dan $F_2 = 4$ N bekerja tegak lurus? (jawab angka saja, dalam Newton)', correctAnswer: '5' },
    { questionType: 'PG', questionText: 'Rumus energi kinetik adalah $E_k = ...$', optionA: '$\\frac{1}{2}mv^2$', optionB: '$mgh$', optionC: '$\\frac{1}{2}kx^2$', optionD: '$mc^2$', optionE: null, correctAnswer: 'A' },
    { questionType: 'PG', questionText: 'Reaksi eksoterm ditandai dengan...', optionA: '$\\Delta H > 0$', optionB: '$\\Delta H < 0$', optionC: '$\\Delta H = 0$', optionD: '$\\Delta G > 0$', optionE: null, correctAnswer: 'B' },
    { questionType: 'PGK', questionText: 'Manakah sifat gelombang? (Pilih semua yang benar)', optionA: 'Refleksi', optionB: 'Refraksi', optionC: 'Gravitasi', optionD: 'Difraksi', optionE: 'Interferensi', correctAnswer: 'A,B,D,E' },
    { questionType: 'ISIAN', questionText: 'Berapakah $\\sqrt{169}$?', correctAnswer: '13' },
  ];

  for (const q of tkaQuestions) {
    await prisma.question.create({
      data: { tryoutId: tka.id, ...q }
    });
  }

  // ==================== Assign tryouts to students ====================
  await prisma.assignment.create({ data: { studentId: student1.id, tryoutId: utbk.id } });
  await prisma.assignment.create({ data: { studentId: student1.id, tryoutId: tka.id } });
  await prisma.assignment.create({ data: { studentId: student2.id, tryoutId: utbk.id } });
  await prisma.assignment.create({ data: { studentId: student2.id, tryoutId: cpns.id } });
  await prisma.assignment.create({ data: { studentId: student2.id, tryoutId: tka.id } });
  await prisma.assignment.create({ data: { studentId: student3.id, tryoutId: utbk.id } });
  await prisma.assignment.create({ data: { studentId: student3.id, tryoutId: cpns.id } });
  await prisma.assignment.create({ data: { studentId: student3.id, tryoutId: tka.id } });

  console.log('✅ Seed data created successfully!');
  console.log('   - 1 admin, 3 students');
  console.log('   - 3 tryouts (UTBK, CPNS, TKA) with 10 questions each (PG + PGK + ISIAN)');
  console.log('   - 8 assignments');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
