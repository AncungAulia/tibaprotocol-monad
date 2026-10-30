# Arsip — review PRD v1.0 dan rencana awal

> Digantikan oleh [PRD v1.1](PRD.md) dan [rencana implementasi aktif](implementation-plan.md)
> sesuai prioritas gambar pengguna. Dokumen ini dipertahankan sebagai catatan review
> teknis awal. Ketentuan semua fitur wajib, TEE/multisig sebagai gerbang pertama, dan
> pengecualian seluruh cross-chain/mainnet di bawah tidak lagi menjadi scope aktif.

Tanggal review: 30 Oktober 2026. Status: rancangan, belum merupakan bukti integrasi.
Dasar: PRD v1.0 dalam percakapan dan inspeksi repository pada commit
`452628a67d98c312e1311a6b2a045a9eb702b9b0`, branch `main`.

## 1. Penilaian

PRD cukup kuat untuk menjadi spesifikasi produk: ekonomi jelas, otorisasi per pihak,
penolakan pembiayaan saat overdue, batas agent, dan perilaku gagal sudah disebutkan.
Namun implementasi belum siap dimulai sebagai satu migrasi besar. Empat pembuktian
Tahap 1 harus mendahului integrasi UI: email ke akun yang bisa menandatangani NEAR,
relayer, private inference terverifikasi, dan governance tanpa bypass deployer.

Estimasi jadwal di bawah bersifat target kerja dengan kapasitas beberapa penanggung
jawab, bukan janji penyelesaian. Kapasitas tim dan kredensial belum diverifikasi.
Seluruh fitur wajib tetap ada; kegagalan gerbang berarti rilis belum memenuhi PRD,
bukan alasan menggantinya dengan mock yang disebut selesai.

### Temuan baseline

| Area      | Bukti repo                                                                       | Dampak migrasi                                                                                                          |
| --------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Login     | `fe/src/providers/AuthProvider.tsx`, `be/src/middlewares/auth.ts`                | Privy + wagmi, `Address`, dan pemeriksaan linked EVM wallet harus diganti dengan binding identitas NEAR yang dibuktikan |
| Chain     | `fe/src/lib/chain.ts`, `contracts.ts`, `send-contract.ts`; `be/src/lib/chain.ts` | Bukan sekadar mengganti RPC: format akun, penandatanganan, receipt dan callback berbeda                                 |
| Kredit    | `be/src/modules/payer/payer.service.ts`                                          | Approval demo memakai owner `setCreditLimit`; belum ada private analysis, keputusan terverifikasi atau agent terbatas   |
| Alur uang | `sc/src/TibaPool.sol`, `ShipmentManager.sol`                                     | Ekonomi 97,5% dan jalur pembayaran langsung bisa menjadi acuan; atomic EVM tidak bisa disalin ke transfer asinkron      |
| Overdue   | `TibaPool.sol:requestAdvance`, `hasOverdue`                                      | Create memeriksa overdue; advance baseline belum memanggil pemeriksaan tersebut. Tambahkan tes regresi eksplisit        |
| Invoice   | `ShipmentManager.sol:createShipment`                                             | Belum menerima referensi invoice; deduplikasi payer + referensi perlu dibuat                                            |
| Database  | `be/supabase/migrations/0001_init.sql`, `0006_quantity_pool_events.sql`          | Foreign key identitas dan constraint hash `0x` perlu skema NEAR baru; jangan menerapkan migrasi ke DB Monad             |
| Recovery  | `fe/src/lib/transaction-recovery.ts`, `be/src/modules/pool/pool.service.ts`      | Pola pemulihan bisa digunakan ulang, tetapi event EVM/log index tidak setara receipt NEAR                               |
| UI        | Role screens, invite, QR, peta                                                   | Gunakan ulang setelah batas auth/chain dipisahkan; pergantian role bukan otorisasi                                      |
| Toolchain | `package.json`, `pnpm-workspace.yaml`; pemeriksaan PATH                          | Workspace Node tersedia. `cargo`/`rustc` tidak ditemukan di PATH sesi review; Rust/WSL/CI harus disiapkan               |

Tidak ada pengujian aplikasi, transaksi testnet, penilaian AI, atau deployment yang
dijalankan pada review ini. Folder untracked `brag-output/` sudah ada sebelum review.

## 2. Hal yang perlu dipertegas di PRD

Rekomendasi berikut adalah usulan keputusan implementasi, bukan perubahan PRD yang
sudah disetujui. Catat hasil pembuktian atau keputusan produk dalam ADR sebelum
mengunci antarmuka terkait.

| Prioritas | Ketidakjelasan / risiko                                               | Rekomendasi dan bukti penerimaan                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | Email terautentikasi belum berarti pengguna dapat menandatangani NEAR | Jangan menganggap Privy SDK terpasang mendukungnya. Buktikan signer, provisioning, pemulihan lintas login, dan pencabutan key. Jika tidak didukung, pilih provider NEAR yang membuktikan semuanya; catat model custody                  |
| P0        | Privasi dokumen dapat bocor melalui keluaran model                    | Backend hanya boleh mendekripsi keputusan ringkas. Gunakan kategori dan reason code terbatas dengan kalimat dari template; jangan simpan free-text reasoning/model error. Uji dokumen dengan prompt injection dan canary rekening       |
| P0        | Signature gateway belum mengikat keluaran ke model TEE                | Wajibkan bukti model sebelum enkripsi dan signature `provider_tee` yang cocok; gateway-only, missing, ambigu, atau invalid ditolak. Ketersediaan model harus dibuktikan langsung                                                        |
| P0        | Account kontrak masih mungkin diambil alih lewat key                  | Governance method saja tidak cukup. Hapus semua full-access key di akun core dan DAO final; audit key list. Upgrade hanya melalui method core yang mengecek predecessor DAO, dengan migrasi storage teruji                              |
| P0        | Transfer/callback dan harga shares bisa bersilangan                   | Tetapkan ledger pending dan aturan harga shares sebelum kontrak. Untuk demo, serialisasi mutasi uang yang mengubah NAV selama operasi transfer belum terselesaikan; baca state tetap tersedia. Jangan membuka lock hanya karena timeout |
| P1        | Definisi overdue belum membahas delivery tanpa advance                | Rekomendasi: tagihan DELIVERED dan FINANCED yang belum dibayar melewati due + 60 detik memblokir kredit baru; APPROVED/IN_TRANSIT/DISPUTED tidak dihitung. Ini perlu keputusan karena baseline hanya menghitung FINANCED                |
| P1        | Kredit memakai nominal invoice atau advance?                          | Ikuti baseline: exposure kredit memakai nominal penuh, aset pool memakai pokok advance. Invoice 300 memakai limit 300, bukan 292,50                                                                                                     |
| P1        | Shipment yang dibuat dianggap menjamin dana?                          | Create hanya memeriksa kapasitas saat itu, tidak menjanjikan likuiditas atau mereservasi seluruh invoice. Advance memeriksa ulang limit, overdue, pause, dan kas termasuk reservasi pending                                             |
| P1        | Limit awal nol vs larangan kenaikan dari nol                          | Bedakan UNASSESSED, ACTIVE, FROZEN. Penilaian pertama boleh menetapkan 0–1.000 dari UNASSESSED sekali. Limit nol yang telah ditetapkan atau FROZEN hanya dapat diaktifkan multisig setelah penilaian ulang                              |
| P1        | Penurunan di tengah periode dapat membuka kenaikan ulang              | Gunakan periode tujuh hari tetap per payer dan jumlah kenaikan positif kumulatif <= 20% limit awal periode. Penurunan tidak mengembalikan kuota; policy update tidak mereset periode                                                    |
| P1        | Binding penilaian belum memuat expiry konkret                         | Usul TTL 10 menit untuk penerapan, memakai waktu chain; bind network, core account, payer, assessment ID, policy version, expiry, dan digest evidence. ID yang sudah dipakai tidak bisa dipakai lagi                                    |
| P1        | Privasi profil vs dokumen                                             | Jelaskan bahwa profil perusahaan, participant, limit, status dan transaksi tetap terlihat sesuai akses; klaim privat hanya untuk dokumen/teks mentah. Attestation tidak memverifikasi keaslian dokumen                                  |
| P1        | Role di UI dan panggilan langsung kontrak                             | Tegakkan role/participant di core, bukan hanya API. Pilih registrasi role terverifikasi yang tidak dapat diubah pengguna untuk menyamar sebagai pihak lain                                                                              |
| P1        | Referensi invoice bisa berbeda spasi/huruf                            | Tetapkan canonicalization, batas panjang, dan uniqueness on-chain per payer. Simpan digest referensi jika kerahasiaan diperlukan; digest bukan enkripsi                                                                                 |

## 3. Arsitektur yang diusulkan

```text
Browser: akun NEAR + signer/session key + ekstraksi file + verifikasi attestation
  |-- signed delegated action --> API relayer --> NEAR core
  |-- wallet transaction ------> NEP-141 token --> core ft_on_transfer
  |-- ciphertext --------------> proxy AI terbatas --> NEAR AI model TEE
                                                   |
Agent: verifikasi exact response + dekripsi keputusan ringkas + data chain
  |-- apply_credit_decision --> NEAR core
  |-- worker repayment/overdue + riwayat metadata --> database NEAR terpisah
DAO Sputnik 2/3 --> core policy / treasury / agent / pause / upgrade
Receipt reconciler --> database terverifikasi --> UI pending/success/failure
```

Lokasi baru yang disarankan: `near/contracts/core`, `near/contracts/mock-usd`,
`near/integration-tests`, `near/scripts`, `near/deployments/testnet.json`.
Adapter Node/browser berada di `be/src/lib/near/` dan `fe/src/lib/near/`.
Tambahkan modul `near-auth`, `relayer`, `credit`, `governance`, dan worker backend.
Nama folder adalah rencana; belum dibuat dalam review ini.

Target satu aplikasi NEAR di branch khusus, bukan membangun framework multichain.
Pertahankan kontrak Solidity dan catat commit baseline; jangan ubah deployment Monad.
DB, secrets, storage, deployment environment dan local pending-payment namespace NEAR
harus terpisah. Manifest mengikat network, core, token, DAO, code hash dan policy version.

### Auth dan sponsor

- Wallet login memakai challenge sekali pakai terikat domain, nonce, expiry, network,
  dan NEAR account; verifikasi signature serta kepemilikan access key on-chain.
  NEP-413 menjadi kandidat format, bergantung dukungan wallet yang dibuktikan.
- Email login memetakan provider subject unik ke akun NEAR secara idempotent.
  Jangan mengikat akun dari account ID yang dikirim browser tanpa pembuktian signer.
  Race login pertama tidak boleh membuat dua akun; login ulang tidak membuat role baru.
- Tentukan root/recovery signer dan penyimpanan key. Operational key hanya boleh memanggil
  core pada metode pickup, delivery/dispute, advance. Uji pencabutan on-chain; logout
  membersihkan token/cache/key lokal dan memberi akses revoke. Jangan menyimpan root key
  plaintext di localStorage atau menganggap logout telah menghapus key on-chain.
- NEP-366 adalah kandidat relay. Pengguna menandatangani tindakan, relayer membayar gas;
  kontrak mengotorisasi participant dari predecessor yang benar, bukan signer relayer.
  Buktikan zero-deposit operational methods dengan function-call key.
- Relayer memvalidasi signature, sender binding, receiver, metode, argumen, gas cap,
  deposit nol, nonce dan max block height. Tolak batch/nested action di luar format yang
  dibutuhkan. Rate limit per identity/key/IP, budget global dan idempotency persisten.
- Bedakan biaya account creation, access-key setup, storage registration, gas relay,
  dan attached deposit. Semua dibudgetkan; gasless tidak berarti tidak ada biaya sponsor.
  Payer/investor memakai signer yang sesuai untuk transfer token dan attached deposit.

### Transfer dan accounting

Gunakan integer enam desimal (`u128`, JSON decimal string), pembulatan konsisten, checked
arithmetic dan intermediate yang tidak overflow. Jangan memakai float untuk uang.

```text
fee = 300_000_000
advance = floor(fee * 9750 / 10000) = 292_500_000
spread = fee - advance = 7_500_000
treasury = floor(spread * 2000 / 10000) = 1_500_000
pool_income = spread - treasury = 6_000_000
```

- Deposit/repayment masuk melalui `ft_transfer_call` dan `ft_on_transfer` yang hanya
  menerima predecessor token resmi. Identitas pembayar berasal dari `sender_id` token,
  bukan `msg`. Usul repayment hanya oleh payer shipment untuk memperkecil permukaan demo.
  Token salah, nominal salah, shipment final, dan msg rusak harus ditolak/refund sesuai
  resolver NEP-141. Tangani refund yang belum selesai dalam rekonsiliasi kas.
- Advance/withdraw: buat operation ID, reservasi kas dan exposure/shares secara atomik,
  panggil `ft_transfer`, lalu callback privat hanya menyelesaikan operation pending sekali.
  Kegagalan melepaskan reservasi persis sekali. FINANCED hanya setelah transfer berhasil.
- Simpan status bisnis dan status operasi terpisah; pending tidak membuka jalan advance,
  withdrawal, repayment atau settlement kedua yang memakai saldo sama.
- Pada financed repayment, uang masuk diterima satu kali, utang ditutup dan pokok/
  pendapatan pool diakui. Treasury menjadi payable terpisah dengan receiver tersnapshot;
  gagal bayar treasury tidak menghidupkan lagi tagihan payer. Retry hanya oleh jalur
  terbatas dengan penerima yang tercatat, bukan argumen receiver bebas.
- Pada direct settlement, simpan uang masuk dalam escrow liability sampai transfer penuh
  ke carrier selesai. Kegagalan transfer mempertahankan dana untuk retry terikat operation,
  bukan menagih payer lagi. UI menunjukkan settlement pending; REPAID setelah sukses.
- NAV investor = kas milik pool + pokok financed yang tercatat; treasury payable, escrow
  carrier, refund tertunda, dan dana in-flight bukan kas yang boleh dibelanjakan ulang.
  Pending withdrawal tetap mempunyai klaim sampai berhasil, agar rollback shares tidak
  berubah nilainya akibat deposit/repayment yang menyela. Serialisasi demo mempermudah ini.
- Tentukan virtual assets/shares atau bootstrap pricing, floor conversion, minimum
  deposit/shares, dan perilaku zero shares. Uji donation, dust dan first-depositor case.
  Nilai pokok overdue belum di-write-off; tampilkan keterbatasan valuasi tersebut.
- Daftar overdue harus bounded atau memakai indeks due-date yang aman. Hindari scan tak
  terbatas yang akhirnya membuat create/advance tidak dapat dieksekusi dalam gas limit.
- Backend menelusuri receipt terkait dan hasil bisnis final dari core, bukan hanya
  keberhasilan transaksi luar relayer. Event persistence memakai receipt ID + event index
  - contract/network; sinkronisasi ulang tidak boleh mengirim pembayaran baru.
- Jangan melepas reservasi saat RPC timeout: transfer mungkin sudah berhasil. Uji callback
  gagal, gas callback kurang, dan restart worker. Bila perlu recovery admin, hanya melalui
  governance dengan bukti hasil transfer dan prosedur tanpa risiko pembayaran ulang.

### Private inference dan agent

Browser membatasi tiga file, 5 MB per file, 60.000 karakter gabungan, ekstraksi lokal,
dan menolak scan/encrypted PDF yang tidak terbaca. Semua batas juga diterapkan untuk
resource/ciphertext di proxy; backend tidak menerima field file atau plaintext fallback.

Agent membuat assessment ID dan instruksi versi tetap. Browser memverifikasi model
attestation sebelum mengenkripsi. Sebelum mengunci desain, buktikan bahwa dokumen
terenkripsi dapat diteruskan dengan instruksi milik agent dan public key respons milik
agent, tanpa memberi browser hak mengganti system prompt atau memilih limit final.
Agent tidak boleh menjadi endpoint dekripsi umum bagi ciphertext kiriman browser.

Jika API tidak bisa membuktikan pemisahan ini, Tahap 1 gagal: desain perlu direvisi;
jangan mengganti dengan plaintext di server. Proxy menjaga API key tetap server-side,
meneruskan body bytes yang dikunci, tidak melakukan parse/reserialize yang mengubah
hash, dan menonaktifkan body tracing/analytics. Respons non-streaming memakai model ID
kanonik dan `x-no-aliasing: true`; hash exact request/response dipakai untuk verifikasi.

Verifikasi response signer harus cocok dengan evidence preflight model; tidak cukup
memercayai flag `verified` atau signature yang baru diambil setelah output diterima tanpa
preflight. Algoritme dan tipe signature eksplisit. Retry bukti dibatasi, lalu gagal tertutup.
Output ketat: limit integer bounded, risk enum, reason code enum; tidak ada rekening,
kutipan atau reasoning bebas. Hapus ciphertext dan ephemeral key setelah selesai/gagal;
beri TTL cleanup untuk crash, tanpa request body di log/error/APM/DB/backups.

Agent mengambil repayment dari chain dan memakai hasil awal terverifikasi untuk evaluasi
berikutnya. Worker <= 60 detik, queue persisten, lease, cursor dan retry idempotent.
Keputusan hanya efektif setelah receipt penerapan berhasil. Contract mempercayai agent
terbatas sebagai verifier; tidak mengklaim melakukan verifikasi TEE on-chain. Contract
tetap memaksakan plafon, cumulative increase, freeze, version, expiry dan replay protection.

### Governance

Tiga account anggota berbeda, voting RoleWeight dengan threshold dua suara yang diuji
pada artifact Sputnik terpilih. Audit semua role/proposal permissions agar tidak ada role
lain yang mengeksekusi kebijakan sendiri. Core hanya mengizinkan DAO untuk policy,
treasury, agent, pause dan upgrade; agent hanya untuk keputusan kredit terbatas.

UI menunjukkan proposal, payload, code hash bila upgrade, suara, status DAO dan hasil
receipt di core. Approval DAO bukan bukti aksi remote berhasil. Uji satu suara tidak
mengubah core, suara kedua mengubahnya, proposer/voter asing ditolak, dan deployer lama
tidak bisa upgrade. Hapus key setelah jalur governance dan recovery teruji, bukan sebelumnya.

## 4. Backlog berurutan dan gerbang penerimaan

PIC adalah fungsi kerja yang harus ditetapkan tim, bukan nama anggota yang diasumsikan.

| ID / target                   | PIC           | Pekerjaan dan ketergantungan                                                  | Bukti lulus                                                                                                                                          |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| N00 / 30 Okt                  | Lead          | Catat baseline/diff, keputusan tabel §2, env NEAR terpisah, setup Rust/WSL/CI | Manifest kosong berlabel belum deploy; toolchain terkunci; keputusan tercatat                                                                        |
| N01 / 30 Okt–1 Nov            | Auth          | Spike email + wallet, provisioning, recovery, session revoke                  | Login ulang akun/role sama; tanda tangan NEAR valid; akun asing/replay gagal; tidak ada langkah wallet manual untuk email                            |
| N02 / 30 Okt–1 Nov            | Backend/chain | Relayer ke kontrak probe; setelah signer N01 tersedia                         | Akun pengguna tanpa saldo gas menjalankan aksi; signature salah, method asing, replay dan expiry gagal; receipt + biaya sponsor                      |
| N03 / 30 Okt–1 Nov            | Privacy       | Spike file browser → E2EE → model → agent verification                        | Live model evidence dan model-bound response valid; tamper/missing/gateway-only ditolak; canary tidak ada di TIBA; pemisahan prompt/signing terbukti |
| N04 / 30 Okt–1 Nov            | Chain         | Sputnik 2/3, probe policy dan upgrade                                         | Satu suara belum mengubah state; dua suara berhasil; upgrade hanya DAO; key inventory tanpa bypass final                                             |
| G1 / 1 Nov                    | Lead          | Review N01–N04; semua wajib lulus                                             | Evidence bundle tanpa dokumen atau secrets; keputusan lanjut/revisi desain. Tidak mengklaim gate lulus dari unit mocks                               |
| N05 / 2–4 Nov                 | Chain         | Rust core + mock USD; integritas state/accounting setelah G1                  | Unit/sandbox tests otorisasi, invoice unik, rounding, callbacks, rollback, race advance/withdraw, direct settlement dan treasury retry               |
| N06 / 2–5 Nov                 | Backend       | Skema DB NEAR, receipt adapter/reconciler, auth role, relayer durable         | Restart setelah chain sukses memperbaiki DB tanpa transfer ulang; identitas/hash EVM ditolak di deployment NEAR                                      |
| N07 / 4–6 Nov                 | Frontend      | Adapter NEAR dan alur role/QR/pool setelah N05/N06 stabil                     | Deposit → create → pickup → delivery → advance → repay → withdraw di testnet, receipt final di setiap aksi                                           |
| G2 / 6 Nov                    | Lead          | Alur uang lengkap                                                             | Invoice 300: 292,50 / 6 / 1,50; direct settlement carrier 300 tanpa potongan; saldo on-chain sesuai dashboard                                        |
| N08 / 6–8 Nov                 | Credit        | Integrasi N03, policy engine, worker dan riwayat                              | Penilaian valid diterapkan sekali; >cap, >20%, expired, version salah ditolak; repayment trigger dan overdue worker <=60 detik                       |
| N09 / 7–9 Nov                 | Governance/UI | Hubungkan N04 ke core dan halaman governance                                  | Policy, agent, pause, treasury, upgrade via DAO; repayment dan withdraw valid tetap berjalan saat financing dipause                                  |
| N10 / 9–11 Nov                | QA/semua      | Adversarial, outage, privacy, fresh setup; setelah N07–N09                    | Seluruh matriks §5 terisi dengan hasil aktual dan evidence; setup memakai kredensial reviewer sendiri                                                |
| G3 / 12 Nov                   | Lead          | Freeze semua fitur wajib                                                      | G1/G2 + kredit, privasi, governance dan acceptance lulus; tidak ada P0/P1 integritas uang terbuka                                                    |
| N11 / 13–14 Nov               | Demo/docs     | Seed testnet, rehearsal, README, rekaman dan diff baseline                    | Demo <=5 menit, skenario tambahan, hasil timing/biaya aktual, reproduksi independen                                                                  |
| G4 / sebelum 15 Nov 06.59 WIB | Tim           | Repo publik, post demo, submission sesuai aturan terbaru                      | URL repo/post, payload final yang disetujui pemilik, bukti submission; jangan menjadwalkan kirim pada menit terakhir                                 |

Pekerjaan N01–N04 dapat dikerjakan oleh pemilik berbeda bila kapasitas tim tersedia;
ini pembagian rencana, bukan instruksi menjalankan sub-agent. Jangan mulai migrasi besar
UI sebelum risiko signer dan private inference terjawab. Jika G1 terlambat, jadwal
berikutnya perlu diestimasi ulang secara terbuka; jangan menghapus fitur wajib diam-diam.

## 5. Matriks acceptance dan evidence

Semua baris berstatus **belum dijalankan** pada review ini. Unit tests untuk aturan lokal,
sandbox untuk promises/callback dan kegagalan token, testnet untuk integrasi layanan nyata.
Gunakan token fixture gagal-transfer di sandbox; mock tersebut bukan bukti live inference.

| Skenario        | Lapisan                        | Hasil yang harus dibuktikan                                                                                                                                |
| --------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-1/2        | Unit + testnet/browser         | Email/wallet valid, wrong-key/replay ditolak, login ulang sama, logout bersih, revoked key gagal                                                           |
| SHIP-1          | Contract + API                 | Role payer, limit aktif, amount/due valid dan immutable, invoice unik per payer; direct-call bypass ditolak                                                |
| SHIP-2/3        | Contract + multi-account       | Wrong carrier/warehouse gagal; dispute terlihat peserta; dispute tidak dapat dibiayai                                                                      |
| PAY-1           | Sandbox + testnet              | Advance sekali, delivered wajib, kas/limit cukup; overdue muncul setelah create tetap memblokir                                                            |
| PAY-2           | Sandbox + testnet              | Repay sekali, direct settlement tanpa fee, pending disinkronkan tanpa pembayaran kedua                                                                     |
| POOL-1          | Contract + sandbox             | Share price/rounding, investor balance, kas tersedia, donation/dust, lock accounting saat callback                                                         |
| Race/failure    | Sandbox                        | Advance + withdraw tidak double spend, callback duplikat/asing gagal, token transfer gagal rollback, callback gas gagal tidak memicu retry pembayaran buta |
| Treasury        | Sandbox                        | Repayment sukses + transfer treasury gagal: tagihan tetap lunas, liability ada, retry tepat receiver sekali                                                |
| GAS-1/2         | Testnet + relayer tests        | Nol top-up user untuk operasi, allowlist, nonce/expiry, auth/rate/budget limit dan receiver asing ditolak                                                  |
| AI-1/2/3        | Contract + live service        | Limit awal, repayment eval, overdue cadence, cumulative cap termasuk small increments/decrease; agent tidak dapat withdraw/admin/upgrade                   |
| PRIV-1          | Browser + proxy/DB/log audit   | Canary file/teks tidak muncul di request plaintext TIBA, storage, analytics, error, reasoning; parser menolak scan dan oversized file                      |
| PRIV-2          | Unit + live service            | Signature/bytes/evidence tamper, model mismatch, bukti hilang, output rusak, expired/replayed decision: limit tidak berubah                                |
| GOV-1/2         | Testnet + key audit            | 1 vote tidak eksekusi, 2 vote berhasil, remote failure tampak, policy/upgrade hanya DAO, tidak ada bypass full-access                                      |
| VIEW-1/2        | Browser + receipt verification | Pending/success/failure dengan tautan; tersedia kas, financed, overdue, pendapatan, liability, batas withdraw                                              |
| Outages/restart | Integration                    | Relayer/model/RPC gagal aman, retry idempotent, backend restart sesudah transfer sukses tidak membayar ulang                                               |
| Fresh setup     | Mesin/environment bersih       | Install, build, deploy testnet, seed dan demo dengan layanan reviewer; tanpa secret tim atau DB Monad                                                      |

Simpan ringkasan bukti di `docs/near/evidence/`: tanggal, commit, network, account per role,
metode, operation ID, transaction/receipt ID, expected vs actual, code hash/policy version,
hasil verifikasi tanpa dokumen, dan daftar access key publik. Jangan simpan key privat,
ciphertext dokumen, raw signed inference bytes atau isi rekening sebagai evidence publik.

## 6. Demo dan rilis

Skenario utama target lima menit memakai empat identitas yang sudah disiapkan pada profil
browser berbeda, invoice sintetis 300, jatuh tempo cukup jauh, dan investor seed berlabel.
Penilaian privat dapat diprajalankan untuk alur utama, tetapi tampilkan bukti dan sediakan
jalur unggah live yang dapat dicoba reviewer. Jangan mempercepat dengan menghapus otorisasi.

| Menit     | Aksi                                                          | Yang dilihat juri                                            |
| --------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| 0:00–0:45 | Perlihatkan identitas, hasil kredit terverifikasi dan deposit | Akun terpisah, policy version, kas seed, receipt             |
| 0:45–1:30 | Payer membuat invoice 300; carrier pickup                     | APPROVED → IN_TRANSIT; gas carrier disponsori                |
| 1:30–2:15 | Warehouse scan dan terima                                     | DELIVERED; receipt sponsor                                   |
| 2:15–3:00 | Carrier cairkan                                               | 292,50 diterima; FINANCED                                    |
| 3:00–4:00 | Payer bayar 300                                               | REPAID; pool +6, treasury payable/paid 1,50; keputusan ulang |
| 4:00–5:00 | Investor withdraw dan lihat bukti                             | Kas/batas withdraw, saldo, receipt, biaya dan durasi aktual  |

Skenario tambahan terpisah: dispute; overdue >60 detik dan repayment saat freeze; agent
melampaui cap; satu lalu dua suara multisig. Ukur waktu dari submit sampai hasil bisnis
final, bukan sekadar hash diterima. Catat NEAR sponsor sebelum/sesudah dengan pemisahan
gas, storage dan provisioning; tampilkan actual, bukan estimasi sebagai hasil.

README rilis harus menjelaskan baseline/diff, akun dan env, fresh deployment, model custody,
cara memperoleh test token, langkah lakukan X → lihat Y, risiko default, warehouse trust,
visibilitas chain, TEE trust dan batas privasi. Tambahkan lisensi dan pin artifact/toolchain.
Jaga demo sampai setidaknya akhir penjurian, idealnya 25 November.

Aturan live yang dibaca saat review mengizinkan proyek testnet, multi-track dan baseline
chain lain dengan disclosure. Deadline tertulis 14 November 2026 23:59 UTC = 15 November
06:59 WIB. Baca ulang sebelum submission. Track utama `realworld`; `business` dan `privacy`
hanya jika evidence mendukung. Pemilik tim menerbitkan post demo dan menyetujui payload
submission final. Review ini tidak melakukan push, publikasi, deployment atau submission.

## 7. Sumber primer dan batas verifikasi

- [Aturan hackathon](https://nearhackathon.com/HACKATHON.md): dibaca melalui HTTP pada review ini; jadwal, baseline, track dan submission dapat berubah.
- [NEP-366](https://github.com/near/NEPs/blob/master/neps/nep-0366.md): kandidat signed delegate action, nonce, expiry dan predecessor; perlu uji SDK/runtime testnet aktual.
- [NEP-413](https://github.com/near/NEPs/blob/master/neps/nep-0413.md): kandidat wallet message signing; dukungan wallet belum dibuktikan.
- [NEP-141](https://github.com/near/NEPs/blob/master/neps/nep-0141.md) dan [NEP-145](https://github.com/near/NEPs/blob/master/neps/nep-0145.md): token receiver/resolver dan storage registration; budget storage wajib diuji.
- [NEAR AI E2EE](https://docs.near.ai/cloud/guides/e2ee-chat-completions): enkripsi browser ke attested model key; live provider belum diuji.
- [NEAR AI response signatures](https://docs.near.ai/cloud/verification/cloud-api/response-signatures): exact-byte verification, preflight matching dan perbedaan provider/gateway signature.
- [Sputnik DAO](https://github.com/near-daos/sputnik-dao-contract): proposal, voting policy dan call governance; factory/account testnet serta artifact harus diverifikasi saat spike.

Inspeksi kode menunjukkan SDK Privy dan pola EVM yang dipakai baseline; review ini tidak
menemukan bukti kemampuan signing NEAR end-to-end pada aplikasi. Dukungan provider tetap
pertanyaan terbuka, bukan kesimpulan bahwa layanan tersebut pasti tidak mendukung NEAR.
