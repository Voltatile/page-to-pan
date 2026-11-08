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
- [x] **Layar judul 3D**: papan "Page to Pan" di atas kartu, kartu judul dengan **Start** dan baris
  menu **How to Play** dan **Credits** (masing-masing punya halaman dengan tombol Back). Omelette yang
  berputar tetap dipakai sebagai hiasan. Tombol **Settings** sudah masuk ke baris menu ini.
- [x] **Menu di Hasil dan Pause**: banner **"New best!"** yang pop setelah bintang saat rekor pecah;
  di hasil **Again** langsung memulai masak baru dan **Menu** kembali ke judul; pause berisi **Resume**
  dan **Menu**.
- [x] **Settings sederhana**: halaman Settings di kartu judul dengan volume (tombol - dan +, per 10%,
  disimpan di localStorage) dan **Recenter** untuk mengkalibrasi ulang tinggi meja.

## Prioritas 2: rasa "game" (target 11–12 Nov)

- [x] **Pujian singkat yang melayang** setelah tiap langkah ("Clean crack!", "Perfect flip!",
  "Golden!"), diambil dari nilai skor yang sudah ada.
- [x] **Latihan tangan singkat**: halaman How to Play sekarang latihan tiga tahap (pinch telur, lepas,
  telapak ke atas) yang maju sendiri. Tidak wajib dan bisa ditinggal dengan Back, jadi aturan
  "main dalam 10 detik" tetap terpenuhi.
- [x] **Musik latar santai**, disintesis di kode (tanpa file, aman lisensi).

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
