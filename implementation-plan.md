# Implementation Plan: Maintenance Performance Monitoring System
## WhatsApp Ticket Tracker + SLA Dashboard (MVP)

> **Scope MVP**: Dashboard yang menampilkan total tiket dari grup WhatsApp, rata-rata response time harian, dan list laporan. Menggunakan OpenClaw sebagai WhatsApp bridge.

---

## Tech Stack

- **Frontend**: Next.js 14+ (App Router) + React + TailwindCSS + shadcn/ui + Recharts
- **Backend**: Bun + Hono + Drizzle ORM
- **Database**: MySQL 8
- **Cache/Realtime**: Redis
- **WhatsApp Bridge**: OpenClaw (self-hosted, Baileys protocol)
- **AI Model**: Claude API (untuk klasifikasi pesan)
- **Uptime Monitor**: UptimeRobot API (free tier)

---

## FASE 0: Project Setup & Infrastruktur
**Estimasi: 1 hari**

- [ ] **0.1** Buat repository baru (monorepo structure: `/apps/web`, `/apps/api`, `/packages/shared`)
- [ ] **0.2** Setup Next.js 14 project di `/apps/web` dengan App Router, TailwindCSS, shadcn/ui
- [ ] **0.3** Setup Bun + Hono project di `/apps/api` dengan Drizzle ORM
- [ ] **0.4** Setup MySQL 8 database bernama `maintenance_monitor`
- [ ] **0.5** Setup Redis instance untuk caching dan realtime SLA tracking
- [ ] **0.6** Setup environment variables (.env) untuk semua service:
  ```
  DATABASE_URL=mysql://user:pass@localhost:3306/maintenance_monitor
  REDIS_URL=redis://localhost:6379
  OPENCLAW_GATEWAY_URL=http://localhost:3000
  ANTHROPIC_API_KEY=sk-ant-...
  UPTIMEROBOT_API_KEY=...
  NEXT_PUBLIC_API_URL=http://localhost:8787
  ```
- [ ] **0.7** Setup Docker Compose file untuk local development (MySQL, Redis)

---

## FASE 1: Database Schema
**Estimasi: 1 hari**

- [ ] **1.1** Buat tabel `users` (anggota tim maintenance):
  ```sql
  CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    whatsapp_jid VARCHAR(50) UNIQUE NOT NULL COMMENT 'WhatsApp JID dari OpenClaw, format: 628xxx@s.whatsapp.net',
    phone VARCHAR(20),
    role ENUM('admin', 'pm', 'maintenance') DEFAULT 'maintenance',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  ```
- [ ] **1.2** Buat tabel `tickets` (tiket laporan dari WhatsApp):
  ```sql
  CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL COMMENT 'Format: TKT-YYYYMMDD-XXXX',
    whatsapp_message_id VARCHAR(100) COMMENT 'Message ID dari WhatsApp untuk referensi',
    reporter_name VARCHAR(100) NOT NULL COMMENT 'Nama pelapor dari WhatsApp',
    reporter_jid VARCHAR(50) NOT NULL COMMENT 'WhatsApp JID pelapor',
    group_jid VARCHAR(50) COMMENT 'JID grup WhatsApp asal laporan',
    group_name VARCHAR(200) COMMENT 'Nama grup WhatsApp',
    
    -- Isi Laporan
    subject VARCHAR(300) NOT NULL COMMENT 'Ringkasan masalah (auto-generated oleh AI)',
    description TEXT NOT NULL COMMENT 'Isi lengkap pesan WhatsApp',
    category ENUM('login_issue', 'system_down', 'bug', 'performance', 'data_issue', 'feature_request', 'other') DEFAULT 'other',
    priority ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',
    
    -- Status & Assignment
    status ENUM('open', 'acknowledged', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
    assigned_to INT NULL COMMENT 'FK ke users.id',
    
    -- Timestamps untuk SLA calculation
    reported_at TIMESTAMP NOT NULL COMMENT 'Waktu pesan WhatsApp masuk',
    first_response_at TIMESTAMP NULL COMMENT 'Waktu respons pertama dari tim',
    resolved_at TIMESTAMP NULL COMMENT 'Waktu tiket resolved',
    closed_at TIMESTAMP NULL COMMENT 'Waktu tiket closed',
    
    -- SLA
    sla_response_target_minutes INT NOT NULL DEFAULT 120 COMMENT 'Target SLA response dalam menit',
    sla_resolution_target_minutes INT NOT NULL DEFAULT 1440 COMMENT 'Target SLA resolution dalam menit',
    sla_response_breached BOOLEAN DEFAULT false,
    sla_resolution_breached BOOLEAN DEFAULT false,
    
    -- Meta
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_reported_at (reported_at),
    INDEX idx_priority (priority),
    INDEX idx_assigned_to (assigned_to)
  );
  ```
- [ ] **1.3** Buat tabel `ticket_messages` (log semua pesan terkait tiket):
  ```sql
  CREATE TABLE ticket_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    sender_jid VARCHAR(50) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    message_text TEXT NOT NULL,
    whatsapp_message_id VARCHAR(100),
    is_from_team BOOLEAN DEFAULT false COMMENT 'true jika pengirim adalah anggota tim maintenance',
    sent_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    INDEX idx_ticket_id (ticket_id),
    INDEX idx_sent_at (sent_at)
  );
  ```
- [ ] **1.4** Buat tabel `uptime_logs` (catatan uptime/downtime):
  ```sql
  CREATE TABLE uptime_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL DEFAULT 'main_app',
    status ENUM('up', 'down') NOT NULL,
    response_time_ms INT COMMENT 'Response time dalam milliseconds',
    status_code INT,
    checked_at TIMESTAMP NOT NULL,
    
    INDEX idx_service_checked (service_name, checked_at),
    INDEX idx_status (status)
  );
  ```
- [ ] **1.5** Buat tabel `downtime_incidents` (rangkuman insiden downtime):
  ```sql
  CREATE TABLE downtime_incidents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL DEFAULT 'main_app',
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NULL,
    duration_minutes INT NULL COMMENT 'Otomatis dihitung saat ended_at diisi',
    root_cause TEXT NULL COMMENT 'Diisi manual oleh tim setelah investigasi',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_service_started (service_name, started_at)
  );
  ```
- [ ] **1.6** Buat tabel `sla_configs` (konfigurasi SLA per priority):
  ```sql
  CREATE TABLE sla_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    priority ENUM('critical', 'high', 'medium', 'low') UNIQUE NOT NULL,
    response_target_minutes INT NOT NULL,
    response_max_minutes INT NOT NULL,
    resolution_target_minutes INT NOT NULL,
    resolution_max_minutes INT NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  
  -- Seed data
  INSERT INTO sla_configs (priority, response_target_minutes, response_max_minutes, resolution_target_minutes, resolution_max_minutes) VALUES
  ('critical', 15, 30, 120, 240),
  ('high', 30, 60, 480, 1440),
  ('medium', 120, 240, 4320, 7200),
  ('low', 1440, 2880, 7200, 14400);
  ```
- [ ] **1.7** Jalankan semua migration dan verifikasi tabel terbuat dengan benar

---

## FASE 2: Backend API (Bun + Hono)
**Estimasi: 3-4 hari**

### 2A: Core API Setup
- [ ] **2.1** Setup Hono app dengan CORS, error handling middleware, dan request logging
- [ ] **2.2** Setup Drizzle ORM schema yang match dengan tabel MySQL di atas
- [ ] **2.3** Setup koneksi Redis client

### 2B: Webhook Endpoint untuk OpenClaw
- [ ] **2.4** Buat endpoint `POST /api/webhook/openclaw` yang menerima inbound message dari OpenClaw:
  - Terima payload message (sender JID, message text, group JID, timestamp, message ID)
  - Validasi bahwa pesan berasal dari grup WhatsApp yang terdaftar
  - Kirim isi pesan ke Claude API untuk klasifikasi: apakah ini laporan masalah atau chat biasa?
  - Prompt Claude: "Analisis pesan WhatsApp berikut. Tentukan apakah ini laporan masalah/bug/error atau chat biasa. Jika laporan, extract: subject (ringkasan singkat), category (login_issue/system_down/bug/performance/data_issue/feature_request/other), priority (critical/high/medium/low). Respond dalam JSON format."
  - Jika terklasifikasi sebagai laporan → buat tiket baru di tabel `tickets`
  - Generate ticket_number format: TKT-YYYYMMDD-XXXX (auto increment per hari)
  - Set `sla_response_target_minutes` dan `sla_resolution_target_minutes` berdasarkan priority dari tabel `sla_configs`
  - Simpan pesan asli ke `ticket_messages`
  - Return tiket ID dan nomor tiket untuk auto-reply

- [ ] **2.5** Buat endpoint `POST /api/webhook/openclaw/response` untuk mendeteksi respons tim:
  - Ketika anggota tim maintenance membalas pesan di grup → cek apakah pesan yang dibalas (quoted reply) terkait tiket yang open
  - Jika ya, dan `first_response_at` masih NULL → set `first_response_at` = sekarang
  - Hitung apakah SLA response breached (bandingkan selisih waktu dengan target)
  - Simpan pesan ke `ticket_messages` dengan `is_from_team = true`

### 2C: Ticket Management API
- [ ] **2.6** Buat endpoint `GET /api/tickets` — list semua tiket dengan filter dan pagination:
  - Query params: `status`, `priority`, `assigned_to`, `date_from`, `date_to`, `page`, `limit`
  - Include calculated fields: `response_time_minutes`, `resolution_time_minutes`, `is_sla_response_ok`, `is_sla_resolution_ok`
  - Sort by `reported_at` descending (terbaru di atas)

- [ ] **2.7** Buat endpoint `GET /api/tickets/:id` — detail satu tiket termasuk semua messages

- [ ] **2.8** Buat endpoint `PATCH /api/tickets/:id` — update tiket:
  - Bisa update: status, priority, assigned_to, category
  - Jika status diubah ke `resolved` → otomatis set `resolved_at`
  - Jika status diubah ke `closed` → otomatis set `closed_at`
  - Hitung `sla_resolution_breached` saat resolved

- [ ] **2.9** Buat endpoint `POST /api/tickets/:id/messages` — tambah pesan manual ke tiket (dari dashboard)

### 2D: Dashboard Data API
- [ ] **2.10** Buat endpoint `GET /api/dashboard/summary` — ringkasan harian:
  ```json
  {
    "date": "2026-02-26",
    "total_tickets_today": 12,
    "total_tickets_yesterday": 8,
    "tickets_change_percent": 50,
    "open_tickets": 5,
    "in_progress_tickets": 3,
    "resolved_today": 4,
    "avg_response_time_minutes": 23.5,
    "avg_resolution_time_minutes": 185.2,
    "sla_response_compliance_percent": 91.7,
    "sla_resolution_compliance_percent": 83.3,
    "critical_open_count": 1,
    "high_open_count": 2
  }
  ```
  - Query: hitung dari tabel `tickets` WHERE `reported_at` = hari ini
  - Avg response time: AVG(TIMESTAMPDIFF(MINUTE, reported_at, first_response_at)) WHERE first_response_at IS NOT NULL
  - SLA compliance: COUNT(WHERE sla_response_breached = false) / COUNT(*) * 100

- [ ] **2.11** Buat endpoint `GET /api/dashboard/uptime` — data uptime hari ini:
  ```json
  {
    "uptime_percent_today": 99.8,
    "uptime_percent_month": 99.5,
    "last_check_status": "up",
    "last_check_at": "2026-02-26T14:30:00Z",
    "total_downtime_minutes_today": 3,
    "total_downtime_minutes_month": 218,
    "active_incidents": []
  }
  ```

- [ ] **2.12** Buat endpoint `GET /api/dashboard/tickets-by-hour` — distribusi tiket per jam (untuk chart):
  ```json
  {
    "data": [
      { "hour": "08:00", "count": 2 },
      { "hour": "09:00", "count": 5 },
      { "hour": "10:00", "count": 3 }
    ]
  }
  ```

- [ ] **2.13** Buat endpoint `GET /api/dashboard/team-performance` — performa per anggota tim:
  ```json
  {
    "data": [
      {
        "user_id": 1,
        "name": "Ahmad",
        "tickets_handled": 8,
        "avg_response_minutes": 15.3,
        "avg_resolution_minutes": 120.5,
        "sla_compliance_percent": 87.5
      }
    ]
  }
  ```

### 2E: SLA Cron Jobs
- [ ] **2.14** Buat cron job (interval: setiap 1 menit) yang mengecek tiket open/acknowledged:
  - Untuk tiap tiket yang belum direspon: hitung elapsed time sejak `reported_at`
  - Jika elapsed > `sla_response_target_minutes` → set `sla_response_breached = true`
  - Simpan data SLA real-time ke Redis key `sla:ticket:{id}` dengan TTL 24 jam

- [ ] **2.15** Buat cron job (interval: setiap 5 menit) untuk sinkronisasi data uptime:
  - Fetch status dari UptimeRobot API
  - Simpan ke tabel `uptime_logs`
  - Jika status berubah dari UP → DOWN: buat record baru di `downtime_incidents`
  - Jika status berubah dari DOWN → UP: update `ended_at` dan `duration_minutes` di incident terakhir

---

## FASE 3: OpenClaw Setup & WhatsApp Integration
**Estimasi: 2 hari**

- [ ] **3.1** Install OpenClaw di server:
  ```bash
  # Install prerequisites
  curl -fsSL https://bun.sh/install | bash
  npm install -g openclaw
  
  # Run onboarding wizard
  openclaw
  ```
- [ ] **3.2** Konfigurasi OpenClaw untuk channel WhatsApp:
  - Siapkan nomor WhatsApp khusus (SIM card baru)
  - Scan QR code untuk link WhatsApp
  - Konfigurasi `openclaw.json`:
    ```json
    {
      "channels": {
        "whatsapp": {
          "enabled": true,
          "dmPolicy": "allowlist",
          "groupPolicy": "allowlist",
          "groupAllowFrom": ["+62xxx"],
          "ackReaction": { "emoji": "👀", "group": "always" }
        }
      }
    }
    ```
- [ ] **3.3** Buat OpenClaw skill/webhook yang meneruskan pesan ke API kita:
  - Setiap pesan masuk dari grup yang terdaftar → POST ke `http://our-api:8787/api/webhook/openclaw`
  - Payload: `{ sender_jid, sender_name, message_text, group_jid, group_name, message_id, quoted_message_id, timestamp }`
- [ ] **3.4** Buat auto-reply skill di OpenClaw:
  - Ketika API mereturn tiket baru → OpenClaw reply di grup:
    "✅ Laporan tercatat — Tiket #TKT-20260226-0001\nPrioritas: Medium\nTim kami akan segera merespon."
  - Ketika tiket resolved → OpenClaw reply:
    "✅ Tiket #TKT-20260226-0001 sudah diselesaikan.\nResponse time: 12 menit | Resolution time: 2 jam 15 menit"
- [ ] **3.5** Buat mapping `users.whatsapp_jid` untuk mengenali anggota tim maintenance:
  - Seed data: masukkan JID WhatsApp semua anggota tim maintenance ke tabel `users`
  - OpenClaw perlu mengenali bahwa reply dari JID ini = respons tim (bukan user biasa)
- [ ] **3.6** Test end-to-end: kirim pesan laporan di grup → cek tiket terbuat di database → cek auto-reply muncul
- [ ] **3.7** Test respons tim: anggota tim reply pesan laporan → cek `first_response_at` terisi di database

---

## FASE 4: Frontend Dashboard (Next.js)
**Estimasi: 4-5 hari**

### 4A: Layout & Navigation
- [ ] **4.1** Buat layout utama dengan sidebar navigation (shadcn/ui sidebar):
  - Menu items: Dashboard, Tiket, Tim, Uptime, Pengaturan
  - Top bar: judul halaman + user avatar
  - Responsive: sidebar collapse di mobile jadi hamburger menu
  - Warna tema: biru gelap (#1B4F72) untuk sidebar, putih untuk content area

### 4B: Halaman Dashboard (Ringkasan Harian)
- [ ] **4.2** Buat 4 stat cards di bagian atas halaman:
  - Card 1: "Total Tiket Hari Ini" — angka besar + perbandingan vs kemarin (↑12% atau ↓5%) + icon tiket
  - Card 2: "Rata-rata Response Time" — angka dalam menit + warna hijau jika < target SLA, merah jika > target
  - Card 3: "SLA Compliance" — persentase + progress ring/donut chart mini
  - Card 4: "Uptime Hari Ini" — persentase + status indicator (hijau/merah)
  - Fetch data dari `GET /api/dashboard/summary` dan `GET /api/dashboard/uptime`

- [ ] **4.3** Buat area chart "Distribusi Tiket per Jam" menggunakan Recharts:
  - X-axis: jam (08:00 - 17:00)
  - Y-axis: jumlah tiket
  - Fetch dari `GET /api/dashboard/tickets-by-hour`
  - Tooltip saat hover menampilkan jumlah tiket di jam tersebut

- [ ] **4.4** Buat tabel "Tiket Terbaru Hari Ini" di bawah chart:
  - Kolom: No Tiket, Pelapor, Masalah (subject), Prioritas (badge warna), Status (badge), Response Time, Assigned To
  - Badge prioritas: Critical=merah, High=orange, Medium=biru, Low=hijau
  - Badge status: Open=merah, Acknowledged=kuning, In Progress=biru, Resolved=hijau, Closed=abu
  - Klik row → navigasi ke detail tiket
  - Fetch dari `GET /api/tickets?date_from=today&limit=20`

- [ ] **4.5** Buat section "Performance Tim" sebagai horizontal bar chart atau tabel:
  - Per anggota: nama, jumlah tiket di-handle, avg response time, SLA compliance %
  - Sort by jumlah tiket descending
  - Fetch dari `GET /api/dashboard/team-performance`

- [ ] **4.6** Buat alert banner di atas halaman jika ada tiket critical yang belum ditangani:
  - Warna merah, icon warning
  - Text: "⚠️ Ada {n} tiket CRITICAL yang belum direspon!"
  - Klik → filter tiket ke status open + priority critical

### 4C: Halaman List Tiket
- [ ] **4.7** Buat halaman `/tickets` dengan tabel lengkap semua tiket:
  - Filter bar di atas: dropdown Status, dropdown Priority, dropdown Assigned To, date range picker
  - Tabel dengan kolom: No Tiket, Waktu Lapor, Pelapor, Grup WA, Subject, Priority, Status, Response Time, Resolution Time, PIC
  - Pagination (10/25/50 per halaman)
  - Export button → download CSV

- [ ] **4.8** Buat halaman `/tickets/:id` detail tiket:
  - Header: nomor tiket, status badge, priority badge
  - Info section: pelapor, grup WA, waktu lapor, kategori, PIC
  - SLA tracker visual: 2 progress bar (response time dan resolution time) dengan indikator target
  - Thread pesan: timeline semua pesan terkait tiket (dari `ticket_messages`), mirip chat history
  - Action buttons: Ubah Status, Ubah Priority, Assign ke Tim, Tambah Catatan

### 4D: Halaman Uptime
- [ ] **4.9** Buat halaman `/uptime`:
  - Stat card besar: Uptime bulan ini (%) + trend vs bulan lalu
  - Uptime calendar heatmap: 30 hari terakhir, warna hijau (100%), kuning (>99%), merah (<99%)
  - Tabel incident history: Waktu Mulai Down, Waktu Pulih, Durasi, Root Cause
  - Line chart: response time trend per hari (dari `uptime_logs`)

### 4E: Auto-refresh & Realtime
- [ ] **4.10** Implementasi auto-refresh dashboard setiap 30 detik menggunakan React Query `refetchInterval`
- [ ] **4.11** Tambahkan indikator "Last updated: xx detik yang lalu" di dashboard
- [ ] **4.12** Tambahkan toast notification ketika ada tiket baru masuk (polling setiap 10 detik)

---

## FASE 5: Testing & Polish
**Estimasi: 2 hari**

- [ ] **5.1** Test skenario lengkap: user kirim pesan → tiket terbuat → tim respon → tiket resolved → data muncul di dashboard
- [ ] **5.2** Test SLA breach: biarkan tiket tanpa respon melewati target → cek breach flag dan alert di dashboard
- [ ] **5.3** Test klasifikasi AI: kirim berbagai jenis pesan (laporan, chat biasa, pertanyaan) → verifikasi akurasi klasifikasi
- [ ] **5.4** Test uptime monitoring: simulasi downtime → cek incident tercatat dan notifikasi terkirim
# Finalizing WhatsApp Integration

Complete the linkage by mapping the user ID and configuring the OpenClaw webhook.

## User Review Required
> [!IMPORTANT]
> Ensure the WhatsApp JID added matches the one linked in OpenClaw.

## Proposed Changes

### [API] Database Seeding

#### [NEW] [add-user.ts](file:///Users/salinovakbar/Downloads/monitoring-maintenance/apps/api/src/scripts/add-user.ts)
A script to add the linked WhatsApp JID to the `users` table.

### [OpenClaw] Webhook Configuration
Provide the command to link OpenClaw to the API webhooks.

## Verification Plan
1. Send a message to the linked WhatsApp group.
2. Verify the ticket is created in the dashboard.
3. Respond to the message from the phone and verify the ticket status updates.
- [ ] **5.5** Responsive testing: dashboard harus bisa diakses dari HP (mobile-friendly)
- [ ] **5.6** Seed data: masukkan 50-100 dummy tickets untuk memastikan dashboard terlihat realistis
- [ ] **5.7** Performance check: pastikan dashboard load < 2 detik, API response < 500ms
- [ ] **5.8** Deploy ke staging server dan test dengan WhatsApp grup nyata (pilot test)

---

## Catatan Penting untuk AI Code Generator

1. **Bahasa UI**: Semua label, button, dan placeholder dalam Bahasa Indonesia
2. **Timezone**: Semua timestamp menggunakan Asia/Jakarta (WIB, UTC+7)
3. **Number format**: Gunakan format Indonesia (titik untuk ribuan: 1.234, koma untuk desimal: 99,5%)
4. **Date format**: DD MMM YYYY HH:mm (contoh: 26 Feb 2026 14:30)
5. **Tidak perlu auth/login** untuk MVP — fokus ke fungsionalitas monitoring dulu
6. **Shadcn/ui components** yang pasti dibutuhkan: Card, Table, Badge, Button, Select, DatePicker, Dialog, Toast, Tabs, Sidebar
7. **Semua API response** gunakan format konsisten:
   ```json
   {
     "success": true,
     "data": { ... },
     "meta": { "page": 1, "limit": 20, "total": 150 }
   }
   ```