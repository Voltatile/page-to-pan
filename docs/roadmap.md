# Roadmap: dari prototipe ke game utuh

Rencana sisa pengerjaan setelah Hari 9 (polish). Dibuat 8 Nov 2026.
Deadline: **19 Nov 2026 03:00 WIB**, target submit 18 Nov malam WIB.

## Status sekarang (8 Nov)

Sudah jalan: Title, persiapan bahan, 11 langkah memasak, Hasil (skor, bintang, catatan chef), lalu Again.
Ditambah pause (telapak tangan dan otomatis), suara sintesis, partikel, cincin penanda, petunjuk saat macet,
kulit telur, preview omelette di judul, dan overlay `?debug=1`. Draw call maksimal 76 (batasnya < 100).

Yang masih kurang supaya terasa seperti game utuh adalah **bingkainya**: identitas game, menu,
dan kesan pertama.

## Prioritas 1: kesan pertama (target 8–10 Nov)

- [x] **Halaman pembuka 2D** sebelum masuk VR, yaitu yang pertama dilihat juri di Quest Browser:
  judul **Page to Pan**, satu kalimat penjelasan, tombol besar **Enter VR**, dan petunjuk singkat
  (duduk, pakai tangan, nyalakan suara).
- [ ] **Layar judul 3D**: teks besar "Page to Pan" di atas meja, kartu menu berisi **Play**,
  **How to Play**, **Settings**, **Credits**. Omelette yang berputar tetap dipakai sebagai hiasan.
  Saat ini nama game belum muncul di mana pun di dalam VR.
- [ ] **Menu di Hasil dan Pause**: banner **"New best!"** saat rekor pecah, tombol **Menu** di samping
  Again, dan **Quit to Menu** di pause.
- [ ] **Settings sederhana**: volume, dan **Recenter table** untuk mengkalibrasi ulang tinggi meja.

## Prioritas 2: rasa "game" (target 11–12 Nov)

- [ ] **Pujian singkat yang melayang** setelah tiap langkah ("Clean crack!", "Perfect flip!",
  "Golden!"), diambil dari nilai skor yang sudah ada.
- [ ] **Latihan tangan singkat** untuk pemain baru (sekitar 15 detik: ambil, lepas, telapak ke atas),
  dan **harus bisa dilewati** supaya tetap memenuhi aturan "main dalam 10 detik".
- [ ] **Musik latar santai**, disintesis di kode (tanpa file, aman lisensi).

## Prioritas 3: konten (target 13–14 Nov, pilih SATU)

- [ ] **Buku resep sebagai menu**: lembar resep menjadi buku, tiap halaman satu resep dengan bintang
  terbaiknya. Cocok dengan nama "Page to Pan" dan bisa menambah nilai Innovation.
- [ ] **Nasi goreng** sebagai resep kedua: sistemnya data-driven, tapi butuh aset dan gestur baru
  (menumis, mengaduk). Perkiraan 2–3 hari.

Opsional kalau masih ada waktu: model 3D CC0 untuk menggantikan bentuk primitif, serta mode Learn
dan Challenge (lihat CLAUDE.md bagian 5).

## Jadwal

| Tanggal | Pekerjaan |
|---|---|
| 8–10 Nov | Prioritas 1 |
| 11–12 Nov | Prioritas 2 |
| 13–14 Nov | Prioritas 3 (satu pilihan) |
| 15–16 Nov | Rekam video demo kurang dari 3 menit (`npm run demo`), tulis deskripsi submission |
| 17–18 Nov | Cadangan, cek `docs/quest-checklist.md` kalau ada akses Quest, lalu submit |

Video direkam **setelah** Prioritas 1 dan 2 masuk, supaya yang terekam adalah versi final.

## Aturan selama mengerjakan

- Jangan tampilkan resep yang "terkunci" atau "coming soon" kalau tidak akan selesai, karena juri bisa
  menganggap game-nya belum jadi.
- Setiap fitur baru tetap dalam anggaran performa (draw call < 100, cek dengan `DEMO_DEBUG=1 npm run demo`).
- Semua teks di dalam game dalam bahasa Inggris, tanpa merek dan tanpa nama orang.
- Aset baru hanya yang CC0 atau buatan sendiri, dicatat di `CREDITS.md`.
- Setelah tiap fitur: typecheck, lint, test, `npm run demo` lolos, lalu commit kecil.
