# Ruang Video

Aplikasi Next.js untuk mengelola video privat, permintaan akses customer dan izin menonton dengan masa berlaku. Video disimpan sebagai file lokal di dalam project. Database SQLite memiliki empat tabel utama: `User`, `Video`, `AccessRequest`, dan `VideoGrant`. Proyek ini dibuat oleh Wahit Fitriyanto untuk memenuhi tes rekruitmen Mediatama.

## Requirements

- Node.js 20.9 atau lebih baru
- npm

## Menjalankan secara lokal

1. Pasang dependensi:

   ```powershell
   npm install
   ```

2. Salin `.env.example` menjadi `.env`, lalu isi kredensial admin dan rahasia sesi:

   ```powershell
   Copy-Item .env.example .env
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   Masukkan hasil perintah sebagai `SESSION_SECRET`. Isi `ADMIN_USERNAME` dan `ADMIN_PASSWORD` dengan kredensial yang aman. Jangan gunakan nilai contoh atau membagikan file `.env`.

3. Siapkan Prisma dan database SQLite:

   ```powershell
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

4. Jalankan aplikasi:

   ```powershell
   npm run dev
   ```

Buka `http://localhost:3000`. Admin dapat masuk menggunakan akun yang dibuat saat seed serta menambah customer dan mengunggah video. Customer masuk dengan akun yang dibuat admin, meminta akses, lalu menonton dari katalog setelah permintaannya disetujui. Izin berakhir otomatis sesuai durasi jam yang diberikan admin setelah itu customer dapat meminta akses kembali.

## Konfigurasi

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | URL SQLite. contoh lokal `file:./dev.db`. file database berada di `prisma/dev.db`. |
| `SESSION_SECRET` | Minimal 32 byte untuk menandatangani sesi. |
| `ADMIN_USERNAME` | Username admin awal, wajib diisi sebelum seed. |
| `ADMIN_PASSWORD` | Password admin awal, wajib diisi sebelum seed dan disimpan sebagai hash. |
| `VIDEO_UPLOAD_DIR` | Direktori penyimpanan file. default `data/uploads` relatif terhadap direktori proyek. |
| `MAX_VIDEO_SIZE_MB` | Batas ukuran unggahan dalam MB. default `500`. |

Format unggahan yang didukung adalah MP4, WebM, dan MOV. Simpan `VIDEO_UPLOAD_DIR` di disk privat yang persisten dan jangan mengarahkannya ke `public`. Aplikasi ini menggunakan penyimpanan lokal. File unggahan dan SQLite harus ikut dicadangkan.

## Kredensial Tes
Admin
```username: wahit
password: wahit30122002
```
Customer
```username: tes
password: 9988776655
```
## Cek Command

```powershell
npm run test
npm run lint
npm run typecheck
npm run build
```
