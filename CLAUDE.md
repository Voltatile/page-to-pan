# CLAUDE.md — Page to Pan (working title)

Konteks proyek untuk Claude Code. Baca file ini sebelum mengerjakan apa pun.

## 1. Ringkasan proyek

Game VR simulasi belajar memasak untuk pemula, dibuat untuk **Meta VR Start Developer Competition 2026**
(track **Gaming**, divisi **New Experience**). Developer: satu orang (Filbert), dibantu Claude Code.

**Ide inti:** di meja dapur virtual ada *lembar resep bergambar* yang memuat siluet bahan dalam ukuran asli.
Pemain mengambil bahan dengan tangan, menaruhnya di siluetnya (snap), lalu menjalankan langkah memasak
satu per satu dengan gerakan tangan. Di akhir, pemain mendapat skor bintang dan "catatan chef".

- Target pemain: pemula, audiens internasional. Semua teks dalam **bahasa Inggris**.
- Resep 1 (wajib, sekaligus tutorial): **Omelette**.
- Resep 2: **Nasi Goreng**, sudah bisa dimainkan. Pemain memilih resep lewat buku resep di meja;
  desainnya di `docs/roadmap.md` (Prioritas 3).
- Resep 3: **Pancake**, sudah bisa dimainkan: tepung dan telur dikocok di mangkuk, adonan dituang dan
  diratakan dengan sudip, dibalik, lalu diberi sirup maple (ideal 2 kali) sebelum sisi kedua matang.

## 2. Aturan lomba yang WAJIB dipatuhi

- **Hands-first:** seluruh game harus bisa dimainkan dengan hand tracking. Dukungan controller boleh ada, tapi opsional.
- **Seated:** semua interaksi dalam jangkauan tangan orang yang duduk. Tanpa locomotion, tanpa roomscale.
- **Mudah masuk dan keluar:** gameplay bisa dimulai kurang dari ±10 detik setelah masuk, ada pause dan resume yang rapi
  (menu dengan telapak tangan menghadap ke atas, dan otomatis pause saat sesi XR kehilangan fokus/visibilitas).
- **Tanpa merek, logo, atau iklan.** Jangan menyebut "IKEA" atau merek apa pun di kode, aset, UI, maupun teks.
- **Orisinal:** jangan pakai aset atau kode yang lisensinya tidak jelas. Aset 3D hanya yang berlisensi CC0 atau buatan sendiri.
  Catat setiap aset di `CREDITS.md`.
- **Gratis dan bisa diakses** lewat link (GitHub Pages) sampai pemenang diumumkan.
- **Tidak boleh ada perubahan setelah deadline:** 18 Nov 2026 12:00 PT = **19 Nov 2026 03:00 WIB**. Target submit 18 Nov malam WIB.
- Juri menilai 4 hal dengan bobot sama: Innovation, Experience Design, Technical (minimal 60 fps di Quest), Polish.

## 3. Stack teknis

- **Meta Immersive Web SDK (IWSDK)**: Three.js + ECS (elics) + Vite + TypeScript. Dibuat dengan `npm create @iwsdk@latest`.
- Fitur IWSDK yang dipakai: hand tracking, gaze (opsional, untuk Meta VR Glasses: lihat tombol lalu pinch), grab satu tangan (`OneHandGrabbable` lewat pinch), spatial UI (UIKitML),
  dan audio spasial lewat listener IWSDK. Physics (Havok) **tidak** dipakai: gerakan benda (meluncur pulang, lempar
  omelette) dihitung sendiri oleh system.
- Semua aset (meja, alat masak, bahan, partikel) dibuat prosedural di kode, dan semua suara disintesis di kode.
  Tidak ada file GLB, tekstur, atau audio.
- Testing: emulator IWER di browser desktop, dikendalikan lewat IWSDK CLI/skills. `npm run demo` memainkan satu
  omelette penuh sebagai tes end-to-end; `DEMO_RECIPE=nasi-goreng` atau `DEMO_RECIPE=pancake` memainkan
  resep lain, `DEMO_DEBUG=1` juga mencetak angka performa, dan `DEMO_SHOTS=<folder>` menyimpan gambar.
- Deploy: build statis ke **GitHub Pages** (HTTPS wajib untuk WebXR), dengan domain sendiri
  **https://pagetopan.voltatile.tech/** (CNAME di DNS Hostinger ke `voltatile.github.io`; alamat
  github.io lama otomatis diarahkan ke sana).

**Penting:** sebelum menulis kode yang memakai API IWSDK, cek dokumentasi resmi (iwsdk.dev / repo `facebook/immersive-web-sdk`)
atau tool RAG/skills IWSDK yang terpasang. Jangan mengarang nama API. Kalau ragu, cari contoh di starter template.

## 4. Developer TIDAK punya Meta Quest

Semua pengujian dilakukan di emulator, jadi kode harus ditulis dengan **asumsi akan berjalan di Quest 2/3 asli**:

- **Anggaran performa (Quest 2 sebagai batas bawah):** target 72 Hz, minimal 60 fps.
  - Draw call < 100, total segitiga di scene < ~100k.
  - Tekstur maksimal 1024px, sebisa mungkin pakai atlas. Pakai GLB dengan kompresi (meshopt/Draco/KTX2 kalau didukung pipeline).
  - Lampu dinamis maksimal 1 directional + ambient/hemisphere. Pakai baked/unlit kalau memungkinkan. Tanpa shadow real-time kecuali sangat murah.
  - Jangan ada alokasi objek di dalam loop per frame (gunakan ulang Vector3/Quaternion). Tanpa post-processing berat.
- **Realisme hand tracking:** tracking tangan asli lebih "goyang" daripada emulator.
  - Beri toleransi besar untuk snap (radius ±6–8 cm) dan untuk deteksi gerakan.
  - Haluskan (smoothing) data posisi/kecepatan sebelum mendeteksi gestur.
  - Hindari gestur yang butuh presisi jari. Gunakan pinch dan grab yang sudah disediakan IWSDK.
  - Objek interaktif minimal ±4 cm dan tidak saling berdempetan.
- **Ergonomi duduk:** permukaan meja ±42 cm di bawah kepala (dikalibrasi sekali tiap masuk XR; awalnya 70–75 cm,
  diturunkan setelah playtest karena terasa seperti melihat dari posisi berdiri), semua objek dalam radius ±60 cm dari dada,
  dan tidak ada yang mengharuskan pemain berdiri, memutar badan > 60°, atau menengok ke belakang.
- **Teks:** ukuran cukup besar untuk headset (panel UI minimal setara 24–32px di jarak ±0,6–1 m), kontras tinggi.
- Tambahkan **overlay FPS/debug** yang bisa dinyalakan lewat query string (`?debug=1`) supaya nanti bisa dicek di perangkat asli.

## 5. Desain gameplay

### Alur
`Halaman pembuka 2D (Enter VR)` → `Title (papan "Page to Pan", buku resep "< Recipe 1 of 3 >", tombol "Start", menu How to Play (latihan tangan 3 tahap) / Mode / Settings / Credits)` → `Persiapan bahan (snap ke siluet)` → `Langkah memasak` → `Hasil (skor, bintang, catatan chef, "New best!" kalau rekor, catatan "Try it at home" di samping piring)` → `"Again" (langsung masak baru) atau "Menu" (kembali ke Title)`

Pause kapan saja selama memasak: telapak tangan yang kosong menghadap ke atas ditahan ±1 detik sampai cincinnya
penuh, atau otomatis saat sesi XR kehilangan fokus. Kartu lalu menampilkan **Resume** dan **Menu**.

### Mekanik (omelette)
Semua benda dipegang dengan pinch. Whisk, sudip, dan wajan dipegang di gagangnya: gagang berada di
ujung jari yang menjepit. Saat mengaduk, gagang whisk dan sudip condong ke arah pemain dan ke sisi tangan
yang memegang (kanan ke kanan, kiri ke kiri), dan putaran dibaca di ujung alatnya. Angka ambang ada di `src/config/tuning.ts`.

| Langkah | Interaksi | Deteksi |
|---|---|---|
| Siapkan bahan | Taruh telur, garam, mentega, (opsional) daun bawang di siluetnya | Dilepas dalam radius snap (7 cm) dari siluet |
| Pecahkan telur | Pegang telur di atas mangkuk, pinch dengan dua tangan di dekat telur, tarik berlawanan arah | Jarak antar tangan bertambah > 8 cm saat kedua tangan pinch dan telur di zona mangkuk |
| Kocok | Pegang whisk dan buat putaran di dalam mangkuk | Akumulasi sudut putaran di bidang horizontal mangkuk, target 3 putaran |
| Tabur garam | Pegang shaker dan miringkan di atas mangkuk; tiap miring = 1 tabur. Tekan Next kalau sudah | Shaker miring > 95° dengan tutup di atas mangkuk, harus tegak lagi (< 60°) sebelum tabur berikutnya |
| Daun bawang (opsional) | Lepas daun bawang di atas mangkuk | Dilepas di zona mangkuk |
| Panaskan | Taruh wajan di kompor, lalu jatuhkan mentega ke wajan | Wajan dilepas dekat kompor; mentega dilepas di atas wajan |
| Tuang | Miringkan mangkuk di atas wajan | Kemiringan > 55° selama 1,2 detik |
| Masak | Tunggu sampai kartu bilang Ready, lalu angkat wajan dari kompor | `cookProgress` naik saat wajan di kompor; angkat > 5 cm setelah ≥ 0,35 |
| Balik | Sentak pergelangan tangan sambil memegang wajan; omelette terlempar dan mendarat terlipat | Kecepatan putar tangan (dihaluskan) > 4,5 rad/s |
| Selesaikan | Taruh wajan lagi di kompor sampai Golden, lalu angkat | Angkat > 5 cm setelah ≥ 0,55 |
| Sajikan | Bawa wajan ke atas piring | Wajan masuk zona piring |

Setiap langkah menampilkan **kartu tips** singkat dalam bahasa Inggris (kenapa langkah itu dilakukan).

### Kematangan
- `cookProgress` 0 → 1 naik secara linear selama di atas api (25 detik untuk omelette, diatur di `tuning.ts`).
- Zona: `< 0.55` mentah, `0.55–0.85` **pas** (titik ideal 0.7), `> 0.85` mulai gosong, `> 1.0` gosong.
- Visual: warna omelette berubah bertahap, uap naik dari wajan (jadi asap gelap saat gosong), dan suara desis
  makin keras lalu makin tajam saat gosong.

### Skor (0–100 → bintang)
- **Akurasi 40%:** takaran garam (ideal 2 tabur; tiap selisih 1 tabur −25% komponen ini). Kelengkapan bahan sudah
  dijamin oleh langkah persiapan.
- **Timing 40%:** `1 - |cookProgress_saat_disajikan - 0.7| / 0.3`, dibatasi 0..1.
- **Teknik 20%:** rata-rata dari tiga hal: telur pecah di tengah mangkuk (penuh sampai 40% radius zona, di tepi
  tetap 50%), putaran kocokan ≥ target, dan flip tidak terlambat (nilai turun dari 0,55 sampai 0 di 0,85).
- Bintang: ≥ 85 = 3★, ≥ 60 = 2★, sisanya 1★ (selalu dapat minimal 1★ supaya pemula tidak frustrasi).
- **Catatan chef:** 1 kalimat feedback dari komponen dengan nilai terendah; skor ≥ 95 hanya mendapat pujian.
- Bintang terbaik per resep disimpan di `localStorage` (dibungkus try/catch) dan tampil di kartu Title.
- Setelah disajikan, catatan **"Try it at home"** muncul di samping piring: takaran dan cara memasak
  hidangan itu di dapur sungguhan (`atHome` di data resep).
- **Chef rank** (`src/game/chef-rank.ts`): jumlah bintang terbaik semua resep (maks 9) menentukan gelar
  Kitchen Newcomer → Home Cook (2) → Line Cook (4) → Sous Chef (6) → Head Chef (9). Tampil di bawah papan
  "Page to Pan", kartu judul menyebut berapa bintang lagi ke rank berikutnya, dan banner hasil menjadi
  "Rank up: ...!" saat naik rank.
- **Aksesibilitas:** Settings punya Voice (membacakan tiap langkah) dan **Contrast: High** (kartu resep dan
  catatan jadi teks terang di latar hitam, disimpan di `localStorage`). Di Meta VR Glasses tombol bisa
  ditekan dengan tatapan plus pinch.

### Mode
- **Guided** (bawaan): penilaian lunak, tips dan cincin penanda selalu tampil.
- **Chef Exam**: dipilih lewat tombol Mode di kartu Title. Memasak dari ingatan, tanpa cincin penanda
  dan tanpa tips.

## 6. Arsitektur kode (ECS)

Struktur sekarang:
```
src/
  index.ts              # World.create, registrasi system (urutan registrasi penting)
  assets.ts             # Manifest aset (semua prosedural)
  components.ts         # Daftar komponen untuk editor; definisinya di game-components.ts (Ingredient)
  config/
    recipes/            # Data resep (omelette, nasi goreng, pancake) + index.ts (daftar resep): langkah, bahan, tips, zona, alat
    menu.ts             # Teks halaman judul: How to Play (latihan), Settings, Credits
    tuning.ts           # Semua konstanta tuning
    cookware.ts         # Ukuran alat masak
  game/                 # Logika murni + Vitest: steps, gestures, cooking, score, sizzle, synth (suara)
  scene-assets/         # Geometri prosedural: dapur, lembar resep, bahan, alat masak
  systems/
    SeatedCalibrationSystem.ts  # Tinggi kepala ke meja, sekali per sesi XR
    ViewFitSystem.ts    # Kartu resep turun dan mendekat di headset berbidang pandang sempit (Meta VR Glasses)
    SnapSystem.ts       # Snap bahan ke siluet, bahan yang lepas meluncur pulang
    StepSystem.ts       # State machine langkah resep + pause
    KitchenSystem.ts    # Alat masak yang tampil/bisa dipegang per langkah, wajan di kompor
    CookingSystem.ts    # cookProgress, warna makanan, lempar omelette
    ScoreSystem.ts      # Kumpulkan data permainan, hitung skor + catatan chef, simpan bintang terbaik
    SoundSystem.ts      # Suara sintesis: desis wajan + suara tiap aksi
    EffectsSystem.ts    # Partikel: garam, kuning telur, daun bawang, uap/asap, kilau bintang
    GestureSystem.ts    # Deteksi pecah telur, kocok, tabur (miring shaker), tuang, angkat, flip, sajikan
    PauseSystem.ts      # Telapak tangan menghadap ke atas + auto pause
    UISystem.ts         # Kartu resep: title, menu, langkah, tips, hasil, tombol
    BookSystem.ts       # Buku resep: halaman yang tampil dan animasi membalik halaman
    GuideSystem.ts      # Cincin penanda tujuan benda yang dipegang
    EggShellSystem.ts   # Kulit telur yang terlempar saat telur pecah
    PraiseSystem.ts     # Pujian singkat yang melayang setelah tiap langkah
    HomeNoteSystem.ts   # Catatan "Try it at home" di samping piring saat hasil
    ChefMascotSystem.ts # Maskot topi koki di samping kartu: melompat tiap langkah selesai
    SettingsSystem.ts   # Volume dan recenter meja
    PracticeSystem.ts   # Latihan tangan di halaman How to Play
    ResultStarsSystem.ts    # Bintang 3D dan banner "New best!" saat hasil
    TitlePreviewSystem.ts   # Hidangan jadi yang berputar di layar judul
    ReachHighlightSystem.ts # Glow pada benda yang bisa dipegang
    DebugOverlaySystem.ts   # Papan FPS/draw call/segitiga, hanya dengan ?debug=1
  landing.ts            # Halaman pembuka 2D sebelum masuk VR
  util/                 # Smoothing, snap, home-glide, best-stars, sprite-pool
public/scenes/          # Scene JSON
public/ui/              # Panel UIKitML (kartu resep, label lembar resep)
scripts/demo.mjs        # Tes end-to-end di emulator, sekaligus untuk rekam video
```
Prinsip:
- **Resep data-driven:** menambah resep kedua seharusnya cukup dengan menambah file data dan sedikit aset, tanpa menulis ulang system.
- Konstanta tuning (radius snap, ambang gestur, durasi masak) dikumpulkan di satu file `src/config/tuning.ts`.
- Logika skor dan gestur berupa fungsi murni sebisa mungkin, supaya bisa diunit-test (Vitest).

## 7. Cara kerja Claude Code di repo ini

- Kerjakan per fitur kecil. Setelah setiap fitur: jalankan type-check, lint, dan test, lalu uji di emulator
  (lewat MCP IWSDK kalau tersedia: masuk XR, mode tangan, coba gestur), baru commit.
- Commit kecil dengan pesan jelas (bahasa Inggris, format `feat: ...`, `fix: ...`).
- Jangan menambah dependency besar tanpa alasan kuat. Ukuran build kecil = loading cepat.
- Jangan mengubah aturan di bagian 2 dan 4. Kalau ada konflik antara fitur dan performa, **performa menang**.
- Kalau ada bagian yang tidak bisa dipastikan berjalan di Quest asli tanpa perangkat, beri komentar `// QUEST-CHECK:`
  dan catat di `docs/quest-checklist.md`.
- Bahasa komunikasi dengan developer: bahasa Indonesia yang santai. Teks di dalam game: bahasa Inggris.

## 8. Jadwal dan definisi selesai

| Hari | Target |
|---|---|
| 1 | Setup proyek, scene meja + lembar resep tampil di emulator, deploy pertama ke GitHub Pages |
| 2–3 | Grab + snap bahan ke siluet, state machine langkah |
| 4–5 | Wajan + kompor + kematangan, semua gestur omelette |
| 6 | Skor, panel hasil, kartu tips, pause |
| 7 | Audio, efek visual, alur dari awal sampai akhir yang mulus |
| 8 | Optimasi sesuai anggaran performa, overlay debug, checklist Quest |
| 9 | Nasi goreng ATAU polish |
| 10 | Rekam video demo kurang dari 3 menit (emulator/XR Simulator) |
| 11 | Deskripsi submission, submit, cadangan waktu |

Hari 1–9 sudah selesai. **Rencana sisa pengerjaan (menu, layar judul, rasa "game", konten) dan jadwal per
tanggal ada di [`docs/roadmap.md`](docs/roadmap.md).** Centang di sana setiap item yang selesai.

**Definisi selesai untuk submit:**
- [ ] Omelette bisa dimainkan dari awal sampai akhir hanya dengan tangan, sambil duduk, tanpa error di console
- [ ] Pause/resume berfungsi, ada auto pause
- [ ] Anggaran performa di bagian 4 terpenuhi (cek draw call & jumlah segitiga lewat overlay debug)
- [ ] Tidak ada merek, logo, atau nama orang di game
- [ ] Live di GitHub Pages (HTTPS), bisa dibuka di Quest Browser
- [ ] `CREDITS.md` lengkap, video demo kurang dari 3 menit sudah publik di YouTube
