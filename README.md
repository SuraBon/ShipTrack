# Doc Track / ShipTrack

ระบบติดตามรายการส่งเอกสารและพัสดุภายในสาขา พัฒนาเป็นเว็บแอป React + Vite + PWA และใช้ Google Apps Script เชื่อมกับ Google Sheets/Drive เป็น backend

## Features

- สร้างรายการส่ง พร้อมข้อมูลต้นทาง ปลายทาง รายละเอียด และรูปหลักฐาน
- ค้นหาและติดตามสถานะรายการส่งด้วยหมายเลขติดตาม ผู้รับ หรือปลายทาง
- Dashboard สำหรับผู้ดูแลและพนักงานส่ง
- รับงาน/คืนงาน/ยืนยันส่ง พร้อมบันทึกประวัติการเคลื่อนไหว
- ยืนยันส่งหลายรายการพร้อมกัน (Batch Delivery Confirm) ด้วยรูปเดียว
- แผนที่แสดง GPS จริงของรายการส่งและเส้นทางการนำส่ง
- ติดตามงานที่กำลังจัดส่งแบบ near real-time
  - เครื่องคนขับบันทึกพิกัดไว้ในเครื่อง และ sync ขึ้นระบบเมื่อมีอินเทอร์เน็ต
  - คนดูรายการที่กำลังจัดส่งจะเห็นข้อมูลอัปเดตเป็นระยะโดยไม่ต้องปิดเปิดหน้าใหม่
- รองรับ offline queue สำหรับบาง action และ PWA สำหรับติดตั้งบนมือถือ
- ไอคอน PWA ใช้โลโก้ ShipTrack เดียวกับหน้าจอโหลดเข้าแอป

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

5. ถ้าต้องการเก็บไฟล์/ชีตรายปีใน Google Drive folder เฉพาะ ให้ตั้ง Script Property:

```text
SHIPTRACK_FOLDER_ID
```

6. รันโปรเจกต์

```bash
pnpm run dev
```

ค่า dev server ปกติจะอยู่ที่ `http://localhost:3000`

## Google Apps Script

โค้ดต้นทางอยู่ใน `gas-src/` และ bundle รวมอยู่ที่ `google_apps_script.js`

โครงสร้างไฟล์หลักของ GAS:

- `gas-src/00_config_schema.gs` – ค่าคงที่, header schema, การตั้งค่าปี/เดือนของชีต, การ map ไปยังชีตของแต่ละปี
- `gas-src/10_storage_utils.gs` – ฟังก์ชันอ่าน/เขียนชีต, สร้างชีตปี/เดือน, สร้าง/ค้นหา `ParcelEvents` และ `RouteSamples`, การจัดการรูปใน Drive (`saveImagePayloadToDrive`)
- `gas-src/20_auth_users.gs` – การจัดการผู้ใช้, RBAC (`ADMIN`, `MESSENGER`, `GUEST`), การ login/setup PIN, hash password, rate limit login
- `gas-src/30_entrypoints_routing.gs` – `doPost`/`doGet`, ตรวจสอบ API key, ตรวจ token session เดียว, route action ต่าง ๆ, lock + idempotency cache สำหรับ write actions
- `gas-src/40_parcels_delivery.gs` – สร้างรายการ (`handleCreateParcel`), อ่าน/ค้นหาพัสดุ, อ่าน events/route samples, คำนวณ assignment ปัจจุบัน
- `gas-src/50_logs.gs` – Audit log และ Parcel activity log สำหรับผู้ดูแลระบบ
- `gas-src/52_delivery_handlers.gs` – การเริ่มนำส่ง (`startDelivery`/`batchStartDelivery`), ยืนยันส่ง (`confirmReceipt`/`batchConfirmReceipt`), คืนงาน (`releaseDelivery`), เขียน `ParcelEvents`
- `gas-src/60_auth_handlers.gs` – handler ด้านผู้ใช้/สิทธิ์ เช่น `getUsers`, `createUser`, `updateUser`, `updateProfile`, `createBranch`/`deleteBranch`/`renameBranch`
- `google_apps_script.js` – ไฟล์ bundle ที่ได้จากการ build เพื่อนำไปวางใน Apps Script (ไม่ควรแก้ไขตรง ๆ)

หลังแก้ไฟล์ใน `gas-src/` ให้ build bundle:

```bash
pnpm run build:gas
```

จากนั้นนำ `google_apps_script.js` ไป deploy ใน Apps Script และทำตาม [GAS_DEPLOY_CHECKLIST.md](./GAS_DEPLOY_CHECKLIST.md)

## PWA Icons

ไฟล์ไอคอนหลักอยู่ที่:

- `client/public/favicon.svg`
- `client/public/apple-touch-icon-v2.png`
- `client/public/icon-192-v2.png`
- `client/public/icon-512-v2.png`

ถ้าแก้ `favicon.svg` แล้วต้องการสร้าง PNG ใหม่:

```bash
node generateIcons.js
```

หมายเหตุ: มือถือมัก cache ไอคอน PWA เดิมไว้ หากเปลี่ยนไอคอนแล้วเครื่องยังแสดงรูปเก่า ให้ลบ PWA เดิมออกจากหน้าจอ แล้ว Add to Home Screen ใหม่

## Scripts

- `pnpm run dev` - รัน local development
- `pnpm run build` - build frontend ไปที่ `dist/`
- `pnpm run check` - TypeScript check
- `pnpm run lint` - alias ไปที่ type-check
- `pnpm run test` - รัน test แบบ watch
- `pnpm run test:run` - รัน test ครั้งเดียว
- `pnpm run build:gas` - รวมไฟล์ `gas-src/` เป็น `google_apps_script.js`

## Deploy To Vercel

ตั้งค่าโปรเจกต์ใน Vercel:

- Framework Preset: `Vite`
- Build Command: `pnpm run build`
- Output Directory: `dist`

Environment Variables:

- `VITE_GAS_URL`
- `VITE_GAS_API_KEY`

โปรเจกต์มี `vercel.json` สำหรับ SPA routing เพื่อให้ refresh หน้า route ต่าง ๆ แล้วไม่เจอ 404

## Security Notes

- `VITE_GAS_API_KEY` อยู่ฝั่ง browser จึงไม่ใช่ secret ที่แท้จริง
- Apps Script ต้องตรวจ token, role และ rate limit ทุก action ที่สำคัญ
- Action ที่เกี่ยวกับงานส่งและข้อมูลผู้ใช้ควรเรียกผ่านผู้ใช้ที่ login แล้วเท่านั้น
- ระบบ token แบบ session เดียว: ถ้า login จากอุปกรณ์ใหม่ session เดิมจะถูกปิด และทุก action สำคัญจะเช็ค `sessionId` ว่ายังตรงกับที่เก็บไว้ใน Script Properties
- Write actions ใช้ script lock และ idempotency key (เช่น `createParcel`, `confirmReceipt`, `batchConfirmReceipt`, `startDelivery`, `batchStartDelivery`, `releaseDelivery`, `syncRouteSamples`) เพื่อลดปัญหากดซ้ำ/ส่งซ้ำจาก network delay
