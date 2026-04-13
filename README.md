# Simple Maps

แอปแผนที่ด้วย Next.js 15, react-leaflet v5, PostgreSQL 16 + PostGIS 3.4

## Tech Stack

| Layer    | Technology              |
| -------- | ----------------------- |
| Frontend | Next.js 15 App Router   |
| Frontend | react-leaflet v5        |
| Frontend | Tailwind CSS v4         |
| Backend  | Next.js API Routes      |
| Database | PostgreSQL 16 + PostGIS |

---

## สิ่งที่ต้องมีก่อน

| เครื่องมือ   | เวอร์ชันขั้นต่ำ | ตรวจสอบ             |
| ------------ | -------------- | ------------------- |
| Docker Desktop | latest       | `docker --version`  |
| Node.js      | 20 LTS         | `node --version`    |

---

## ครั้งแรก (First-time setup)

### 1 — ติดตั้ง dependencies

```bash
npm install
```

### 2 — ตรวจสอบ `.env.local`

ไฟล์นี้ถูกสร้างไว้แล้ว ค่าเริ่มต้น:

```bash
DATABASE_URL=postgresql://mapuser:mappass@localhost:5432/mapdb
```

> ถ้าต้องการเปลี่ยน user/password ให้แก้ทั้ง `.env.local` และ `docker-compose.yml` ให้ตรงกัน

### 3 — เปิด Docker Desktop

รอจนไอคอน whale ใน system tray เปลี่ยนเป็น "Docker Desktop is running"

### 4 — Start ฐานข้อมูล

```bash
docker compose up -d
```

ครั้งแรกจะดึง image และรัน migrations `001` → `009` อัตโนมัติ รอจนสถานะ healthy:

```bash
docker compose ps
# NAME              STATUS
# simple-maps-db    Up (healthy)
```

### 5 — Start frontend

```bash
npm run dev
```

เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

---

## การใช้งานประจำวัน

```bash
# เปิดฐานข้อมูล (ถ้า Docker Desktop เปิดอยู่แล้วข้ามได้)
docker compose up -d

# เปิด frontend
npm run dev

# เมื่อเลิกใช้งาน
docker compose stop    # หยุด container แต่ข้อมูลยังอยู่ใน volume
```

---

## คำสั่ง Docker ที่ใช้บ่อย

```bash
# ดูสถานะ container
docker compose ps

# ดู logs ของ database
docker compose logs db

# ดู logs แบบ real-time
docker compose logs -f db

# เข้า psql ตรงๆ
docker exec -it simple-maps-db psql -U mapuser -d mapdb

# หยุด container (ข้อมูลยังอยู่)
docker compose stop

# ลบ container (ข้อมูลยังอยู่ใน volume)
docker compose down

# ลบทุกอย่างรวม volume — ⚠ ข้อมูลหาย
docker compose down -v
```

---

## ตรวจสอบ migrations และ seed data

หลัง `docker compose up -d` ครั้งแรก ตรวจสอบว่า tables ถูกสร้างแล้ว:

```bash
docker exec -it simple-maps-db psql -U mapuser -d mapdb -c "\dt"
```

ควรเห็น: `areas`, `categories`, `geojson_features`, `geojson_layers`, `places`, `routes`

นับ seed data จาก `008_seed_data.sql`:

```bash
docker exec -it simple-maps-db psql -U mapuser -d mapdb \
  -c "SELECT COUNT(*) FROM places; SELECT COUNT(*) FROM routes; SELECT COUNT(*) FROM areas;"
# 10 places, 2 routes, 2 areas
```

---

## Troubleshooting

| อาการ | สาเหตุ | วิธีแก้ |
| ----- | ------ | ------- |
| `docker compose up` error | Docker Desktop ไม่ได้เปิด | เปิด Docker Desktop แล้วรอ ready |
| Port 5432 ถูกใช้อยู่ | มี PostgreSQL local ติดตั้งอยู่ | เปลี่ยน port ใน `docker-compose.yml` เป็น `"5433:5432"` และแก้ `.env.local` เป็น port 5433 |
| `Server error` ใน API | DB ยัง start ไม่เสร็จ | รอ healthcheck ผ่านก่อน (`docker compose ps` = healthy) |
| Migrations ไม่รัน | Volume มีข้อมูลเก่า | `docker compose down -v` แล้ว `up -d` ใหม่ (ข้อมูลหาย) |
| Map ไม่แสดง | JS error | ตรวจ `ssr: false` และ CSS import order |