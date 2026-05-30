# Doc Track / ShipTrack

ระบบติดตามรายการส่งเอกสารและพัสดุภายในสาขา พัฒนาเป็นเว็บแอป React + Vite + PWA และใช้ Google Apps Script เชื่อมกับ Google Sheets/Drive เป็น backend

## Features

- สร้างรายการส่ง พร้อมข้อมูลต้นทาง ปลายทาง รายละเอียด หมายเหตุ และรูปหลักฐาน
- ค้นหาและติดตามสถานะรายการส่งด้วยหมายเลขติดตาม ผู้รับ หรือปลายทาง
- Dashboard สำหรับผู้ดูแลระบบและพนักงานส่ง
- รับงาน เริ่มจัดส่ง คืนงาน และยืนยันส่ง พร้อมบันทึกประวัติการเคลื่อนไหว
- ยืนยันส่งหลายรายการพร้อมกันด้วยรูปหลักฐานเดียว
- แผนที่แสดง GPS จริงของเหตุการณ์หลักในรายการส่ง
- ติดตามงานที่กำลังจัดส่งแบบ near real-time
- รองรับ offline queue สำหรับ action สำคัญ และ PWA สำหรับติดตั้งบนมือถือ
- เก็บ audit log และ parcel activity log สำหรับผู้ดูแลระบบ

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- PWA: `vite-plugin-pwa`
- Maps: Leaflet
- Backend: Google Apps Script
- Storage: Google Sheets และ Google Drive

## Setup

1. ติดตั้ง dependencies

```bash
pnpm install
```

2. คัดลอกไฟล์ environment

```bash
cp .env.example .env
```

3. ตั้งค่าใน `.env`

```env
VITE_GAS_URL=your_google_apps_script_web_app_url
VITE_GAS_API_KEY=your_api_key
```

4. ตั้งค่า API key ใน Google Apps Script ให้ตรงกับ `VITE_GAS_API_KEY`

```js
setupApiKey('your_api_key')
```

หรือบันทึก Script Property ชื่อ `API_KEY`

5. ตั้งค่า initial admin PIN ใน Script Properties ก่อนรัน `setup()`

```text
ADMIN_INITIAL_PIN=your_strong_initial_pin
```

ห้ามใช้ค่าเริ่มต้นใน production หลัง deploy แล้วควรเปลี่ยนรหัสผ่าน admin ทันที

6. ถ้าต้องการเก็บไฟล์/ชีตรายปีใน Google Drive folder เฉพาะ ให้ตั้ง Script Property:

```text
SHIPTRACK_FOLDER_ID
```

7. รันโปรเจกต์

```bash
pnpm run dev
```

ค่า dev server ปกติอยู่ที่ `http://localhost:3000`

## การเข้าใช้งานครั้งแรก (First-time Login)

### 1. ผู้ดูแลระบบ (Admin)
- **รหัสพนักงาน (Employee ID):** `ADMIN`
- **รหัสผ่าน (PIN):** รหัสผ่านที่คุณกำหนดไว้ใน Script Properties ตอนตั้งค่าโครงการ (`ADMIN_INITIAL_PIN`)
- **การเข้าใช้:** ล็อกอินเข้าใช้งานได้ทันทีโดยไม่ต้องผ่านหน้าลงทะเบียน และแนะนำให้เปลี่ยนรหัสผ่านหลังจากเข้าสู่ระบบครั้งแรกเพื่อความปลอดภัย

### 2. ผู้ใช้งานทั่วไป (User / Messenger)
- **การเพิ่มบัญชี:** ผู้ดูแลระบบ (Admin) ต้องเพิ่ม **รหัสพนักงาน (Employee ID)** เข้าในระบบก่อน (ผ่านเมนูจัดการผู้ใช้งานในแอป หรือเพิ่มแถวในชีต `Users` โดยตรง)
- **การตั้งค่ารหัสผ่านครั้งแรก (Initial Setup):**
  1. ให้ผู้ใช้กรอก **รหัสพนักงาน** ของตนเองในหน้าเข้าสู่ระบบ
  2. ระบบจะตรวจพบว่ารหัสพนักงานนี้เพิ่งลงทะเบียนและยังไม่มีรหัสผ่าน จากนั้นจะพาไปยังหน้าตั้งรหัสผ่านต้นทาง
  3. ผู้ใช้กรอก **ชื่อพนักงาน** และตั้ง **รหัสผ่าน (PIN)** ด้วยตนเอง (ยาว 4-20 ตัวอักษร)
- **การเข้าใช้งานครั้งถัดไป:** ใช้ **รหัสพนักงาน** คู่กับ **รหัสผ่าน (PIN)** ที่ตั้งไว้เพื่อล็อกอินตามปกติ

## Google Apps Script

โค้ดต้นทางอยู่ใน `gas-src/` และ bundle รวมอยู่ที่ `google_apps_script.js`

ไฟล์หลัก:

- `gas-src/00_config_schema.gs` - ค่าคงที่, schema, sheet mapping และ config หลัก
- `gas-src/10_storage_utils.gs` - helper อ่าน/เขียน sheet, Drive, sheet รายปี/รายเดือน
- `gas-src/20_auth_users.gs` - validation, password hashing, user/session helper และ setup
- `gas-src/30_entrypoints_routing.gs` - `doPost`/`doGet`, API key, token verification, lock, idempotency และ routing
- `gas-src/40_parcels_delivery.gs` - สร้าง/อ่าน/ค้นหารายการส่ง และข้อมูล assignment
- `gas-src/50_logs.gs` - audit log และ parcel activity log
- `gas-src/52_delivery_handlers.gs` - start/confirm/batch/release delivery
- `gas-src/60_auth_handlers.gs` - login, setup PIN, token, rate limit และ idempotency helper
- `gas-src/70_admin_handlers.gs` - users, branches, admin parcel actions, profile และ system health

หลังแก้ไฟล์ใน `gas-src/` ให้ build bundle:

```bash
pnpm run build:gas
```

จากนั้นนำ `google_apps_script.js` ไป deploy ใน Apps Script และทำตาม [GAS_DEPLOY_CHECKLIST.md](./GAS_DEPLOY_CHECKLIST.md)

## Scripts

- `pnpm run dev` - รัน local development
- `pnpm run build` - build frontend ไปที่ `dist/`
- `pnpm run check` - TypeScript check
- `pnpm run lint` - alias ไปที่ type-check
- `pnpm run test` - รัน test แบบ watch
- `pnpm run test:run` - รัน test ครั้งเดียว
- `pnpm run build:gas` - รวมไฟล์ `gas-src/` เป็น `google_apps_script.js`

## Security Notes

- `VITE_GAS_API_KEY` อยู่ฝั่ง browser จึงไม่ใช่ secret ที่แท้จริง
- Apps Script ต้องตรวจ token, role และ rate limit ทุก action สำคัญ
- Token ฝั่ง client เก็บใน `sessionStorage` เป็นหลัก เพื่อลดการค้างถาวรหลังปิด browser
- ระบบ token เป็น single-session: ถ้า login จากอุปกรณ์ใหม่ session เดิมจะถูกแทนที่
- Write actions ใช้ script lock และ idempotency key เพื่อลดปัญหากดซ้ำหรือส่งซ้ำจาก network delay
- รูปหลักฐานที่บันทึกลง Drive อาจถูกเปิดดูผ่าน link ได้ตามสิทธิ์ folder/file ควรทบทวน retention และ sharing policy ก่อนใช้กับข้อมูลอ่อนไหว

## Offline Data

- Offline queue เก็บ action สำคัญไว้ใน IndexedDB และ fallback ไป localStorage เฉพาะกรณีจำเป็น
- ระบบมี cleanup สำหรับลบข้อมูล offline เก่าที่ล้มเหลวและรูปหลักฐาน orphan ตาม retention เริ่มต้น 30 วัน
- ผู้ใช้สามารถลบรายการ offline ที่ล้มเหลวจาก dialog ได้ หากตรวจสอบแล้วว่าต้องกรอกใหม่

## Deploy To Vercel

ตั้งค่าโปรเจกต์ใน Vercel:

- Framework Preset: `Vite`
- Build Command: `pnpm run build`
- Output Directory: `dist`

Environment Variables:

- `VITE_GAS_URL`
- `VITE_GAS_API_KEY`

โปรเจกต์มี `vercel.json` สำหรับ SPA routing เพื่อให้ refresh หน้า route ต่าง ๆ แล้วไม่เจอ 404
