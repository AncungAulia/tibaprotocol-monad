# TIBA NEAR — rencana implementasi berdasarkan PRD v1.1

Sumber aktif: [PRD v1.1](PRD.md), mengikuti prioritas gambar pengguna.
Review v1.0 tersimpan sebagai referensi historis; gerbang TEE/multisig di sana tidak lagi
menjadi prasyarat fondasi.

## Urutan pekerjaan

| Urutan | Pekerjaan                                                                      | Ketergantungan                               | Bukti selesai                                                                                 |
| ------ | ------------------------------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P1.1   | Catat baseline commit; branch/env/DB NEAR terpisah; setup Rust, sandbox dan CI | Tidak ada                                    | Build fresh environment, manifest network jelas, tidak menyentuh DB Monad                     |
| P1.2   | Spike email/wallet → akun NEAR, recovery login dan session key                 | P1.1                                         | Signer NEAR aktual, login ulang akun sama, revoke key berhasil                                |
| P1.3   | Rust core, mock USD NEP-141 dan admin demo terbatas                            | P1.1                                         | Unit/sandbox accounting, role, invoice uniqueness, pending callbacks dan treasury liabilities |
| P1.4   | Adapter frontend/backend, DB/receipt reconciler dan alur role                  | P1.2–P1.3                                    | Invoice 300 end-to-end testnet, direct settlement 300 tanpa potongan, withdraw sesuai kas     |
| P2.1   | Spike relay operational action menggunakan signer P1.2                         | P1.2, kontrak probe/core                     | User saldo gas nol, receipt bisnis sukses dan biaya sponsor tercatat                          |
| P2.2   | Allowlist, nonce/expiry, auth, quotas/budget, duplicate/restart recovery       | P2.1                                         | Wrong-method, replay, wrong-account, outage dan duplicate action gagal aman                   |
| G1     | Acceptance fondasi P1–P2                                                       | Semua di atas                                | Seluruh acceptance fondasi PRD lulus; tidak memerlukan AI/TEE/multisig                        |
| P3.1   | Verifikasi aset/chain dan batas mainnet Intents; desain quote/payout/refund    | G1                                           | Decision record: aset sumber nyata vs token mock, biaya, receiver/refund binding              |
| P3.2   | Pilihan tujuan, dry-run quote dan status persistence di UI carrier             | P3.1                                         | Unsupported chain/alamat salah/expiry ditolak; duplicate/restart tidak mendanai ulang         |
| P3.3   | Uji payout nyata dengan nominal kecil jika disetujui pengguna                  | P3.2 dan kesiapan dana/signer mainnet        | Bukti sumber + tujuan/refund; tanpa eksekusi status tetap dry-run/belum terbukti              |
| P4.1   | Credit engine schema ketat dari profil non-sensitif/data on-chain              | Setelah evaluasi P3                          | Initial limit + reason, model gagal tidak mengubah limit, tidak ada klaim private AI          |
| P4.2   | Guardrail on-chain, replay/version/expiry, worker dan histori                  | P4.1                                         | >ceiling dan cumulative 20% ditolak; repayment eval dan overdue <=60 detik                    |
| P4.3   | Halaman kredit mode non-TEE                                                    | P4.1–P4.2                                    | Histori, status keputusan dan receipt; upload dokumen sensitif belum tersedia                 |
| P5.1   | Spike lalu integrasi browser E2EE → verified model response                    | G1 stabil, target utama selesai, waktu cukup | Attestation/signature live, invalid proof ditolak, privacy canary tidak bocor                 |
| P5.2   | Sputnik 2/3 + Trezu, governance UI dan penghapusan bypass key                  | Waktu cukup, core upgrade path teruji        | Satu suara tidak eksekusi, dua suara sukses, key inventory tanpa bypass                       |

P3.3 merupakan gerbang pengujian tersendiri karena Intents tidak memiliki testnet; tidak
menahan kelulusan G1 dan tidak mengizinkan penggunaan mock USD sebagai dana mainnet.
Jika dependensi P3 belum tersedia, catat blockage sebelum memutuskan pekerjaan P4;
jangan menyatakan P3 selesai dari quote saja.

## Pemetaan repo

- Kontrak baru: `near/contracts/core`, `near/contracts/mock-usd`, integration tests dan
  manifest testnet. Pertahankan baseline Solidity sebagai pembanding.
- Frontend: ganti boundary auth/chain/transaction recovery; gunakan ulang role screens,
  QR, invite, shipment dan investor pool. Intents ditambahkan pada pencairan carrier.
- Backend: identity NEAR, relayer, receipt reconciler, skema DB terpisah; lalu modul
  payout Intents dan credit worker. Modul TEE/governance hanya saat bonus dikerjakan.
- Hilangkan pola owner auto-approval EVM dari deployment NEAR; untuk fondasi sediakan
  admin NEAR yang perannya diungkapkan. Setelah bonus multisig aktif, pindahkan kewenangan
  ke DAO dan audit seluruh key.

## Jadwal dan release evidence

Target urutan tetap P1 → P2 → P3 → P4 → P5; kapasitas tim belum ditetapkan. Jangan
mengunci tanggal tiap integrasi sebelum signer dan kontrak asinkron terbukti. Freeze
internal 12 November mengutamakan fondasi stabil; 13–14 November untuk rehearsal,
reproduksi fresh setup, dokumentasi dan perbaikan. Deadline 15 November 06.59 WIB.

Simpan status tiap prioritas: belum mulai / dalam pengerjaan / diuji lokal / terbukti
live, dengan commit, network, expected/actual, receipt dan batas klaim. Pisahkan testnet,
mainnet Intents, dry-run quote, synthetic data dan fitur bonus. Jangan menyimpan secrets
atau dokumen finansial di evidence.

Mockup pen.dev kini mencakup kredit standard AI dan bonus TEE, dua halaman governance
bonus, payout Intents, session settings/revoke dan state gasless. Integrasikan overlay
payout ke UI carrier saat P3 dan session settings ke account menu pada fondasi.
Desain sudah menggambarkan state; koneksi wallet, quote, relayer dan receipt belum
diimplementasikan oleh pekerjaan desain ini.

Checklist sebelum publikasi: alur 300, wrong-role, duplicate callbacks, gagal transfer,
race withdraw/advance, overdue saat advance, outage/restart, sponsor/revoke, README fresh
setup dan baseline diff. Tambahkan evidence P3–P5 hanya jika benar-benar dikerjakan.
