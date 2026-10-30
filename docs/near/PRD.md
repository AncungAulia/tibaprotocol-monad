# PRD TIBA NEAR — Pembayaran Carrier Berbasis Konfirmasi Pengiriman

Versi: 1.1 · 30 Oktober 2026 · Rancangan hackathon

Baseline: repository `tibaprotocol-monad`.
Dokumen ini menggantikan prioritas dan scope PRD v1.0 dalam percakapan.
Urutan pengembangan mengikuti tabel prioritas dari pengguna.

## 1. Produk dan prioritas

TIBA membantu carrier menerima ongkos kirim setelah barang diterima, sementara payer
melunasi sesuai jatuh tempo. Investor menyediakan likuiditas dan memperoleh bagian
biaya pembiayaan. Integrasi NEAR mengutamakan settlement native dan operasi gasless,
kemudian pilihan payout lintas chain dan penilaian kredit AI.

| Prioritas | Fitur                                       | Alasan                                                | Status rilis                  |
| --------- | ------------------------------------------- | ----------------------------------------------------- | ----------------------------- |
| 1         | Port kontrak ke NEAR native Rust + USDC     | Fondasi alur uang                                     | Wajib                         |
| 2         | Gasless untuk carrier dan warehouse         | Mengurangi hambatan gas pada operasi harian           | Wajib                         |
| 3         | Payout via NEAR Intents                     | Carrier memilih chain penerimaan yang didukung        | Target setelah 1–2 selesai    |
| 4         | AI credit agent dengan guardrail di kontrak | Penilaian dan penyesuaian limit yang dibatasi manusia | Target setelah 3              |
| 5         | AI di TEE + multisig Trezu                  | Privasi dan kontrol bersama                           | Bonus jika waktu memungkinkan |

Prioritas 3 dan 4 tetap masuk roadmap hackathon, tetapi bukan syarat kelulusan fondasi
1–2. Prioritas 5 tidak menghambat rilis fondasi. Jangan menyebut fitur target/bonus
berfungsi sebelum ada bukti integrasi yang benar-benar dijalankan.

Track utama: Real-World Money. Autonomous Business hanya diklaim jika agent prioritas 4
berfungsi; Privacy & Private AI hanya jika integrasi TEE prioritas 5 terbukti.

## 2. Pengguna dan alur

| Pengguna  | Kebutuhan                                                                 |
| --------- | ------------------------------------------------------------------------- |
| Payer     | Membuat shipment dan melunasi sesuai jatuh tempo                          |
| Carrier   | Pickup, menerima advance, dan memilih tujuan payout jika Intents tersedia |
| Warehouse | Scan QR/kode lalu menerima barang atau melaporkan masalah                 |
| Investor  | Deposit, withdraw, dan melihat kas, eksposur serta pendapatan             |
| Pengelola | Menetapkan kredit/kebijakan; mengawasi agent jika tersedia                |

Alur fondasi:

1. Pengguna login wallet atau email dan terikat pada akun NEAR yang dapat bertransaksi.
2. Payer mengisi profil perusahaan; pengelola menetapkan limit awal secara manual.
3. Investor menyetor token ke pool.
4. Payer membuat shipment dengan carrier, warehouse, fee, quantity, referensi invoice,
   dan jatuh tempo yang terkunci.
5. Carrier pickup melalui transaksi tersponsor.
6. Warehouse scan QR/kode dan menerima delivery atau melaporkan masalah, secara gasless.
7. Setelah diterima, carrier meminta advance secara gasless.
8. Payer membayar penuh; pool mengakui pengembalian pokok dan pendapatan.
9. Investor dapat menarik dana sesuai shares dan kas tersedia.

Jika prioritas 3 selesai, carrier dapat meneruskan dana yang telah diterima ke chain
pilihan melalui Intents. Jika prioritas 4 selesai, agent mengambil alih penilaian rutin
di dalam batas kebijakan; aktivasi khusus tetap dilakukan pengelola. TEE dan multisig
ditambahkan pada prioritas 5, bukan prasyarat alur awal.

## 3. Ekonomi dan token

| Invoice 300                     |  Nilai |
| ------------------------------- | -----: |
| Advance carrier, 97,5%          | 292,50 |
| Pelunasan payer                 | 300,00 |
| Pokok kembali ke pool           | 292,50 |
| Pendapatan pool, 80% spread     |   6,00 |
| Pendapatan treasury, 20% spread |   1,50 |

Delivery diterima yang belum dibiayai dapat dibayar penuh langsung kepada carrier melalui
settlement, tanpa potongan pembiayaan. Semua uang dihitung sebagai integer enam desimal.
Exposure kredit memakai nominal invoice penuh; aset pembiayaan pool memakai pokok advance.

Fondasi dikembangkan dan diuji di NEAR Testnet memakai mock USD NEP-141 enam desimal,
dengan label jelas sebagai token uji, bukan USDC resmi. Target USDC asli memerlukan
verifikasi kontrak token resmi, network dan registrasi storage sebelum digunakan.
Mock token tidak boleh dipresentasikan sebagai bukti settlement USDC asli.

## 4. Prioritas 1 — Kontrak NEAR dan alur uang wajib

Gunakan kontrak Rust native yang menggabungkan shipment, pool accounting, dan kebijakan
kredit. Token NEP-141 berada di kontrak terpisah.

State bisnis:

```text
APPROVED → IN_TRANSIT → DELIVERED → FINANCED → REPAID
                     ↘ DISPUTED
                       DELIVERED → REPAID (tanpa advance)
```

Cabang DISPUTED hanya berasal dari IN_TRANSIT; tidak tersedia resolusi sengketa.

| ID     | Kebutuhan dan penerimaan                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-1 | Wallet/email menghasilkan identitas NEAR terverifikasi. Login ulang kembali ke akun dan role yang sama; email auth saja belum cukup tanpa signer NEAR |
| AUTH-2 | Logout menghapus sesi lokal; operational session key dapat dicabut on-chain                                                                           |
| SHIP-1 | Create hanya oleh payer dengan limit aktif, tanpa overdue; fee/due terkunci; referensi invoice unik per payer                                         |
| SHIP-2 | Hanya carrier shipment boleh pickup; hanya warehouse tujuan boleh accept/dispute                                                                      |
| SHIP-3 | Disputed tidak dapat dibiayai; laporan terlihat oleh peserta terkait                                                                                  |
| PAY-1  | Advance hanya carrier terkait, sekali, setelah delivery diterima; kontrak memeriksa ulang limit, overdue dan likuiditas                               |
| PAY-2  | Repayment hanya sekali; saldo dan state akhir mengikuti keberhasilan settlement                                                                       |
| POOL-1 | Deposit/withdraw memakai shares konsisten; withdraw dibatasi shares investor dan kas yang tidak sedang direservasi                                    |
| VIEW-1 | Aksi menampilkan pending/success/failure dan tautan transaksi; receipt bisnis diverifikasi backend                                                    |
| VIEW-2 | Dashboard investor menampilkan kas, financed, overdue, pendapatan, dan batas withdraw                                                                 |

Transfer asinkron memakai operation ID, reservasi saldo dan callback privat idempotent.
Transfer gagal mengembalikan reservasi/status secara tepat; callback duplikat tidak
menggandakan saldo. Advance dan withdraw bersamaan tidak memakai kas yang sama.

Repayment yang sudah diterima tidak boleh ditagih ulang karena transfer treasury gagal.
Simpan treasury payable terpisah dengan receiver tetap dan retry idempotent. Untuk
settlement langsung, transfer carrier gagal mempertahankan escrow untuk retry; jangan
menagih payer kedua kali. Timeout RPC tidak menjadi bukti transfer gagal.

Overdue fondasi mengikuti tagihan FINANCED yang melewati due + grace 60 detik. Blokir
create dan advance langsung di kontrak tanpa menunggu worker. Repayment tetap diizinkan
saat kredit frozen/pause. Perluasan overdue ke delivery tanpa advance merupakan keputusan
produk lanjutan, bukan perubahan implisit dari baseline.

Sebelum multisig tersedia, pengelola demo menetapkan limit dan kebijakan melalui akun
admin terpisah. Disclosure harus menyatakan kontrol admin dan kemampuan upgrade yang
masih ada; jangan mengklaim satu anggota tidak bisa mengubah kebijakan pada fase ini.

## 5. Prioritas 2 — Gasless wajib

| ID    | Kebutuhan dan penerimaan                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAS-1 | Pickup, accept delivery, dispute dan request advance tersponsor; carrier/warehouse tidak membeli atau top-up token gas                                  |
| GAS-2 | Relayer hanya menerima contract/method yang diizinkan; signature, identity binding, nonce, expiry, argumen, gas/deposit dan rate/budget limit diperiksa |
| GAS-3 | Relayer tidak tersedia: aksi tetap belum selesai, tampil pesan dan retry; hasil transaksi luar tidak dianggap bukti callback bisnis selesai             |

Account provisioning, key setup, token storage dan biaya transaksi sponsor dibudgetkan
terpisah. Buktikan login email → akun NEAR → signed action → receipt sukses dengan saldo
gas pengguna nol. Dukungan Privy yang terpasang belum terbukti; pilih signer berdasarkan
spike aktual, bukan asumsi dukungan SDK.

## 6. Prioritas 3 — Payout melalui NEAR Intents

Tujuan: carrier dapat menerima pada aset/chain yang tersedia dalam daftar dukungan
provider, bukan klaim semua chain tanpa batas. Kandidat integrasi: 1Click Swap API.

Desain awal memisahkan advance pool dan payout lintas chain:

1. Pool membayar advance ke akun NEAR carrier sesuai aturan prioritas 1.
2. Carrier memilih aset/chain tujuan dan alamat penerimaan.
3. Aplikasi mengambil quote yang memuat jumlah sumber, estimasi/minimum penerimaan,
   biaya provider/jaringan, expiry serta alamat refund yang terikat carrier.
4. Carrier menyetujui quote dan pendanaan menggunakan signer yang sesuai.
5. UI melacak transfer sumber, status Intents dan transaksi tujuan/refund.

Biaya payout ditampilkan terpisah dari potongan pembiayaan. Nilai di chain tujuan dapat
lebih kecil karena biaya/rate; tabel advance 292,50 mengacu pada pembayaran pool.
Kegagalan swap tidak membatalkan FINANCED atau menghapus utang payer. Jangan meminta
advance kedua untuk retry payout. Retry harus memeriksa apakah deposit sudah dikirim;
refund dikirim hanya ke akun carrier yang telah ditetapkan.

| ID    | Kebutuhan dan penerimaan                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------- |
| INT-1 | Pilihan hanya aset/chain yang didukung; validasi alamat sesuai chain; quote kedaluwarsa tidak dapat dipakai             |
| INT-2 | Sebelum konfirmasi terlihat biaya, jumlah sumber, estimasi/minimum penerimaan dan tujuan                                |
| INT-3 | Deposit dan status tersimpan idempotent; duplicate click/restart backend tidak mengirim dana kedua                      |
| INT-4 | Pending/success/failure/refund terlihat dengan bukti sumber dan tujuan; gagal payout tidak mengubah accounting pinjaman |

Batas integrasi: menurut aturan hackathon yang dibaca pada review, Intents tidak
menyediakan testnet. Mock USD testnet tidak dapat dipakai sebagai dana payout nyata.
Karena itu demonstrasi fondasi tetap testnet; pengembangan quote dapat memakai dry-run.
Klaim payout berhasil memerlukan transaksi mainnet kecil dengan aset yang didukung,
disiapkan sebagai pengujian terpisah setelah cakupan dan dana disetujui pengguna.
Quote dry-run tidak dihitung sebagai payout selesai. Jika belum dieksekusi, tandai
prioritas 3 sebagai belum terbukti, bukan menggantinya dengan simulasi tanpa label.

## 7. Prioritas 4 — AI credit agent dengan guardrail

Agent menilai perusahaan dan menyesuaikan limit memakai data profil serta riwayat
pembayaran on-chain. TEE bukan syarat fase ini. Mulai dari profil non-sensitif dan data
sintetis berlabel; upload dokumen finansial mentah tidak diaktifkan sebelum bonus privasi
siap. Jangan memberi label private inference pada AI biasa.

| Kebijakan             | Default demo                                                              |
| --------------------- | ------------------------------------------------------------------------- |
| Initial limit         | $0–$1.000                                                                 |
| Company ceiling       | $10.000                                                                   |
| Kenaikan              | Maksimum 20% kumulatif per tujuh hari, dari limit awal periode            |
| Penurunan/freeze      | Segera                                                                    |
| Overdue               | Memblokir create/advance; worker memeriksa minimal setiap menit           |
| Setelah overdue lunas | Penilaian ulang sebelum pengelola mengaktifkan kembali                    |
| Limit nol/frozen      | Reaktivasi oleh pengelola; agent tidak boleh menaikkan melalui persentase |

| ID   | Kebutuhan dan penerimaan                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-1 | Initial assessment menghasilkan limit, kategori risiko dan alasan singkat dalam schema ketat                                                                    |
| AI-2 | Repayment memicu evaluasi; worker overdue <=60 detik, retry/cursor idempotent                                                                                   |
| AI-3 | Guardrail on-chain menolak ceiling/cumulative increase yang dilampaui. Agent tidak dapat withdraw, memilih receiver dana, mengubah treasury/policy atau upgrade |
| AI-4 | Keputusan terikat payer, assessment ID, policy version, expiry, network/contract; keputusan replay/expired/versi salah ditolak                                  |
| AI-5 | Histori menyimpan limit sebelum/sesudah, alasan, sumber evaluasi, waktu, policy version dan transaksi penerapan; model gagal/output rusak tidak mengubah limit  |

Penurunan tidak menghapus outstanding dan tidak mereset kuota kenaikan periode.
Model adalah sumber rekomendasi; kontrak memaksakan batas walau agent salah atau disusupi.
Sebelum multisig tersedia, tindakan khusus manusia memakai admin dan dilaporkan demikian.

## 8. Prioritas 5 — Bonus TEE dan multisig Trezu

### TEE / private AI

Jika dikerjakan, browser mengekstrak PDF teks/CSV/TXT, maksimal tiga file masing-masing
5 MB dan total 60.000 karakter. Scan/unreadable PDF ditolak. Browser memverifikasi
model attestation sebelum mengenkripsi menuju model TEE; backend hanya meneruskan
ciphertext. Agent memverifikasi respons sebelum menggunakan keputusan.

Signature harus mengikat exact request/response bytes ke model TEE terverifikasi;
gateway-only atau bukti tidak tersedia/invalid ditolak tanpa limit baru. Output hanya
limit, kategori risiko dan alasan terbatas tanpa kutipan/rekening. Hapus ciphertext/key
sementara; dokumen tidak masuk DB, log, analytics atau error. Uji prompt injection dan
canary kebocoran. TEE tidak membuktikan keaslian dokumen atau ketepatan kredit.

### Multisig Trezu

Target multisig 2 dari 3 memakai SputnikDAO dengan antarmuka Trezu bila tersedia.
Governance mengatur policy, agent, financing pause, treasury dan upgrade. Satu suara
belum mengeksekusi, suara kedua mengeksekusi aksi valid; receipt remote tetap diperiksa.
Hapus full-access deployer key yang dapat melewati governance pada deployment yang
mengklaim multisig aktif. Ketidaktersediaan UI Trezu tidak boleh dianggap bukti bahwa
governance bekerja; sediakan jalur proposal/voting yang diuji.

Kedua bonus dilaporkan terpisah: multisig selesai tidak otomatis membuktikan privasi,
dan TEE selesai tidak otomatis berarti admin sudah kehilangan kontrol sepihak.

## 9. UI

Gunakan ulang role, onboarding, invite, QR, shipment, settlement dan pool baseline.
Ganti EVM address/hash/receipt dengan identitas dan adapter NEAR.

| Prioritas | Perubahan UI                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| 1–2       | Adaptasi halaman lama, sponsor status dan modal session-key/revoke                                                    |
| 3         | Pilihan payout chain/asset, quote confirmation dan tracking di halaman pencairan carrier; tidak wajib halaman mandiri |
| 4         | Halaman penilaian kredit + histori; upload privat hanya muncul jika bonus TEE aktif                                   |
| 5         | Halaman daftar proposal dan detail/voting; tautan Trezu jika digunakan                                                |

Mockup pen.dev mencakup kredit mode standard AI dan bonus TEE, dua halaman governance
bonus, alur payout Intents, serta pengaturan session key dan feedback gasless.
Alur payout dan session settings berupa rancangan overlay/state untuk halaman yang
sudah ada, bukan halaman produk tambahan. Seluruh mockup memakai data sintetis;
render desain bukan bukti integrasi atau transaksi live.

## 10. Urutan pengembangan, acceptance dan demo

| Tahap  | Hasil wajib tahap tersebut                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1 / P1 | Signer email/wallet terbukti; Rust core + token mock; deposit → shipment → pickup → delivery → advance → repay → withdraw di testnet |
| 2 / P2 | Operasi carrier/warehouse tersponsor; allowlist, replay protection, quota dan recovery teruji                                        |
| 3 / P3 | Quote, validasi tujuan, deposit/status/refund; bukti mainnet terpisah jika disetujui; tanpa bukti hanya klaim dry-run                |
| 4 / P4 | Initial assessment, repayment eval, overdue worker, guardrail dan histori terhubung                                                  |
| 5 / P5 | TEE dan multisig diuji bila kapasitas tersisa; tidak menunda fondasi                                                                 |

Acceptance fondasi: invoice 300 menghasilkan 292,50/6/1,50; wrong participant ditolak;
duplicate advance/repay/callback tidak menggandakan saldo; overdue setelah create
memblokir advance; advance/withdraw tidak double-spend; transfer gagal mengembalikan
saldo/shares; backend restart tidak mengirim ulang pembayaran; pause financing tetap
memungkinkan repayment dan withdraw yang memenuhi ketentuan; login ulang dan revoke
teruji; fresh setup bisa direproduksi tanpa kredensial milik tim.

Acceptance target/bonus ditambahkan saat tahap terkait dikerjakan: Intents invalid address,
expired quote, duplicate deposit dan refund; AI ceiling/cumulative cap/replay; TEE tamper,
missing proof dan kebocoran plaintext; multisig satu/dua suara serta audit deployer key.

Demo utama maksimal lima menit berfokus pada alur uang dan gasless dengan identitas role
terpisah. Sediakan skenario dispute dan overdue. Tampilkan biaya relayer serta waktu
settlement aktual. Pisahkan bukti Intents mainnet, quote dry-run, data sintetis, seed funds,
dan bonus yang belum aktif. Jangan mengklaim transaksi komersial, audit, atau yield terjamin.

README memisahkan baseline Monad dengan diff NEAR dan status per prioritas, langkah
lakukan X → lihat Y, risiko gagal bayar, warehouse trust, kontrol admin dan batas privasi.
Rilis fondasi selesai saat P1–P2 lulus, bukan saat seluruh bonus selesai. Target P3–P4
dan status P5 harus tetap dilaporkan secara terbuka dalam submission.

Deadline target: repo dan post demo sebelum 15 November 2026 06.59 WIB; freeze internal
12 November, rehearsal/perbaikan 13–14 November, demo dipertahankan idealnya sampai
25 November. Alokasikan waktu tersisa ke target/bonus setelah fondasi stabil.

## 11. Di luar scope dan sumber

Di luar scope: migrasi saldo Monad, pencairan rupiah, OCR scan, penyelesaian sengketa,
dan recovery kredit macet. Cross-chain payout kini masuk P3. Mainnet tidak menjadi
target porting core pada fondasi; pengujian Intents mainnet adalah pengecualian terpisah,
bukan migrasi seluruh pool ke mainnet.

- [Aturan hackathon](https://nearhackathon.com/HACKATHON.md): cek ulang sebelum submission; menyebut Intents tidak memiliki testnet.
- [1Click Swap API](https://docs.near-intents.org/integration/distribution-channels/1click-api/about-1click-api): quote, deposit dan tracking settlement; verifikasi aset/chain serta biaya aktual saat integrasi.
- [NEAR AI E2EE](https://docs.near.ai/cloud/guides/e2ee-chat-completions).
- [NEAR AI response signatures](https://docs.near.ai/cloud/verification/cloud-api/response-signatures).
- [SputnikDAO](https://github.com/near-daos/sputnik-dao-contract).

Dokumen adalah spesifikasi rencana. Tidak ada klaim deployment, payout, inference atau
multisig live yang sudah berhasil dari perubahan dokumen ini.
