# EV-ChargeOps

**ระบบจัดการตู้ชาร์จ EV, Alarm และงานซ่อมบำรุง**
EV Charging Fleet Alarm & Maintenance Management System

| | |
| --- | --- |
| **วิชา** | การใช้คอมพิวเตอร์ควบคุมระบบการผลิตอัตโนมัติ |
| **ประเภทโครงการ** | เว็บแอปพลิเคชัน (Full-stack Web Application) |
| **เทคโนโลยีหลัก** | Next.js 14 (App Router) + Supabase (PostgreSQL) |
| **ฐานข้อมูล** | Supabase (PostgreSQL 15+) พร้อม Row Level Security |
| **Source Code** | https://github.com/PalaponB/supabase |
| **CI** | https://github.com/PalaponB/supabase/actions — ✅ ผ่าน |
| **Deployment** | https://ev-chargeops-ten.vercel.app |

---

## สารบัญ

1. [ภาพรวมโครงการ](#1-ภาพรวมโครงการ)
2. [ฟังก์ชันหลักและ Tech Stack](#2-ฟังก์ชันหลักและ-tech-stack)
3. [โครงสร้างฐานข้อมูล](#3-โครงสร้างฐานข้อมูล)
4. [การติดตั้งและรันโปรเจกต์ในเครื่อง](#4-การติดตั้งและรันโปรเจกต์ในเครื่อง)
5. [การ Deploy บน Vercel](#5-การ-deploy-บน-vercel)
6. [รายละเอียดการใช้ AI ในการพัฒนา](#6-รายละเอียดการใช้-ai-ในการพัฒนา)
7. [สิทธิ์รายบทบาท](#7-สิทธิ์รายบทบาท)
8. [ความปลอดภัย](#8-ชั้นความปลอดภัย)
9. [โครงสร้างไฟล์](#9-โครงสร้างไฟล์)
10. [ข้อจำกัดและงานต่อเนื่อง](#10-ข้อจำกัดและงานต่อเนื่อง)
11. [ตารางเทียบข้อกำหนดกับสิ่งที่ระบบทำ](#11-ตารางเทียบข้อกำหนดกับสิ่งที่ระบบทำ)

---

## 1. ภาพรวมโครงการ

### 1.1 วัตถุประสงค์

ในการดูแลจุดชาร์จรถยนต์ไฟฟ้า (EV Charging Station) ปัญหาที่พบบ่อยคือ **เมื่อตู้เสีย ช่างไม่รู้ว่าเสียเพราะอะไร และใครเป็นคนซ่อม** ข้อมูลมักกระจายอยู่ในกล่องข้อความหรือกระดาษ ทำให้ตามหลังรอยยาก และตู้ที่มีปัญหาซ้ำต้องรอนาน

โครงการนี้จึงมีเป้าหมายคือ

1. **ลดเวลาตัดสินใจของช่าง** — บันทึกอาการเสียพร้อมค่าที่วัดได้ (แรงดัน/อุณหภูมิ/กระแส) และใช้ AI ช่วยตั้งสมมติฐานสาเหตุ พร้อมรายการขั้นตอนซ่อม
2. **บันทึกประวัติให้ตามรอยได้** — ทุก Alarm และงานซ่อมบำรุงผูกกับเครื่องจักร ทำให้เห็นว่าเครื่องใดเสียบ่อย และใครเป็นผู้ซ่อม
3. **ควบคุมการเข้าถึงข้อมูล** — ผู้ดูแลระบบ ช่าง และผู้สังเกตการณ์ เห็นและแก้ไขข้อมูลได้ไม่เท่ากัน
4. **ป้องกันไม่ให้ความปลอดภัยขึ้นอยู่กับฝั่งเว็บ** — บังคับสิทธิ์ที่ฐานข้อมูลด้วย Row Level Security

### 1.2 ภาพรวมระบบ

```
┌──────────────────────────────────────────────────────────────┐
│  ผู้ใช้งาน (Browser)                                         │
│  Admin ─ Engineer ─ Technician ─ Viewer   ← สิทธิ์รายบทบาท      │
└───────────────┬──────────────────────────────────────────────┘
                │  Next.js 14 App Router (React Server Component)
                │  ┌──────────────────────────────────────────┐
                │  │ UI        ฟอร์ม · ตาราง · ตัวกรอง · กราฟ     │
                │  │ Logic     Server Action · lib/validation   │
                │  │ AI        POST /api/ai-analyze → OpenAI   │
                │  └──────────────────────────────────────────┘
                │  @supabase/ssr  (ยึด session จาก cookie)
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase / PostgreSQL 15                                    │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────────────────┐   │
│  │profiles│ │ machines │ │ alarms │ │ maintenance_records│   │
│  └────────┘ └──────────┘ └────────┘ └────────────────────┘   │
│  + Row Level Security (15 policies)  ← ชั้นบังคับสิทธิ์จริง  │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 กลุ่มผู้ใช้งาน (User Persona)

| บทบาท | ลักษณะงาน | ต้องการจากระบบ |
| --- | --- | --- |
| **Admin** | ผู้จัดการสถานี / หัวหน้าช่าง | ดูภาพรวมทั้งระบบ จัดการตู้ เปิด Alarm และกำหนดสิทธิ์สมาชิก |
| **Engineer** | วิศวกรฝ่ายวิเคราะห์ปัญหา | วิเคราะห์ว่าเครื่องจักรเสียเพราะอะไร บันทึกสาเหตุลงใน Alarm และใช้ AI ช่วยวินิจฉัย โดยไม่ต้องลงมือซ่อมเอง |
| **Technician** | ช่างซ่อมประจำสนาม | เปลี่ยนสถานะ Alarm บันทึกงานซ่อม และดูคำแนะนำจาก AI เพื่อไปแก้ปัญหา |
| **Viewer** | ผู้บริหาร / ฝ่ายตรวจสอบ | ดูสถานะและประวัติ รวมถึงรายงาน CSV โดยไม่แก้ไขข้อมูล |

---

## 2. ฟังก์ชันหลักและ Tech Stack

### 2.1 ฟังก์ชันหลัก

#### A. ระบบล็อกอินและควบคุมสิทธิ์

- ล็อกอินด้วย **ชื่อผู้ใช้ (username) และรหัสผ่าน** ผ่านระบบ Authentication ที่โปรเจกต์สร้างเอง ไม่ใช้ Supabase Auth และไม่มีตารางข้อมูลผู้ใช้ใน schema `auth` (ดูหัวข้อ 2.4)
- 4 บทบาท: `Admin` / `Engineer` / `Technician` / `Viewer` โดยอ่านค่าบทบาทจากตาราง `profiles` **เท่านั้น** (ไม่ใช่จาก token หรือข้อมูลที่ผู้ใช้ส่งมา) ผู้ใช้จึงปลอมเป็น Admin เองไม่ได้ และการลดสิทธิ์มีผลทันทีโดยไม่ต้องรอ token หมดอายุ
- แต่ละหน้าแสดงปุ่มเฉพาะที่บทบาทนั้นกดได้จริง เช่น ช่างจะไม่เห็นปุ่มแก้ไขรายละเอียด Alarm แต่วิศวกรซึ่งบันทึกสาเหตุใน Alarm จะเห็น

#### B. จัดการข้อมูลหลัก (CRUD)

| โมดูล | ความสามารถ |
| --- | --- |
| **เครื่องจักร** | เพิ่ม / แก้ไข / ลบ / เปลี่ยนสถานะ (`Running`, `Stop`, `Alarm`, `Maintenance`) |
| **Alarm** | เปิดใหม่ / แก้ไขรายละเอียด / เปลี่ยนสถานะ / ลบ พร้อมบันทึกค่าที่วัดได้ 3 ช่อง |
| **งานซ่อมบำรุง** | เพิ่ม / แก้ไข / เปลี่ยนสถานะ (`In Progress`, `Completed`, `Waiting Part`) / ลบ โดยช่างแก้ไขได้เฉพาะงานของตัวเอง |

#### C. Dashboard

- การ์ด KPI: ตู้ทั้งหมด / Active Alarms / งานซ่อมที่ค้าง / เครื่องที่มีปัญหา
- การ์ดสถานะเครื่องจักรทั้ง 4 สถานะ (`Running`, `Stop`, `Alarm`, `Maintenance`) พร้อม % ของทั้งหมด กดเพื่อกรองต่อได้
- กราฟโดนัทสถานะเครื่องจักร และกราฟแท่ง Top 5 Alarm ที่พบบ่อย
- ตาราง Alarm ล่าสุด
- หน้าจัดการสมาชิกและเปลี่ยนบทบาท (เฉพาะ Admin)

#### D. การค้นหาและกรองข้อมูล

กรองฝั่ง server จาก query string ไม่ใช่กรองในเบราว์เซอร์ จึงได้ข้อมูลถูกต้องไม่ว่าจะใหญ่แค่ไหน และ **URL ที่กรองแล้วเป็นลิงก์ที่แชร์ต่อได้** (ปุ่มย้อนกลับเดินย้อนตามสถานะตัวกรอง)

| หน้า | เงื่อนไข (รวมกันแบบ AND) |
| --- | --- |
| `/machines` | ค้นหา, สถานะ, สถานที่ตั้ง, ประเภท (4 เงื่อนไข) |
| `/alarms` | ค้นหา, สถานะ, เครื่องจักร, ช่วงวันที่ (5 เงื่อนไข) |
| `/maintenance` | ค้นหา, สถานะ, เครื่องจักร, **ช่างผู้ซ่อม**, ช่วงวันที่ (6 เงื่อนไข) |

จุดที่ออกแบบให้ระวัง:

- ค่าจาก URL ทุกตัวถูกตรวจก่อนนำไปต่อกับ PostgREST — enum ต้องอยู่ในรายการที่อนุญาต, วันที่ต้องเป็น `yyyy-mm-dd`, uuid ต้องมีรูปแบบถูกต้อง และ `%` `_` ในคำค้นถูก escape ไม่ให้กลายเป็น wildcard
- ช่วงวันที่คำนวณจากเขตเวลาของผู้ใช้ โดยส่ง `tz` (UTC offset) ไปกับ URL เพื่อให้วันที่ที่เลือกหมายถึงวันปฏิทินของผู้ใช้จริง ไม่ใช่วัน UTC
- หน้าจอแสดง `แสดง X จาก Y` โดย Y มาจาก query นับทั้งหมดที่ไม่มีตัวกรอง เพื่อให้เห็นว่าตัวกรองซ่อนข้อมูลไปเท่าไร

#### E. ส่งออกรายงาน CSV

ปุ่ม **"ส่งออก CSV"** บนหน้า `/alarms` และ `/maintenance` — ดาวน์โหลดรายงานเป็นไฟล์ CSV ได้จากเบราว์เซอร์

| คุณสมบัติ | รายละเอียด |
| --- | --- |
| ขอบเขต | ส่งออกเฉพาะแถวที่ตรงกับตัวกรองที่ใช้อยู่ และแจ้งจำนวนบนปุ่ม/ข้อความกำกับ ไม่ให้เข้าใจผิดว่าได้ข้อมูลทั้งหมด |
| เข้ารหัส | เติม UTF-8 BOM เพื่อให้ภาษาไทยถูกต้องเมื่อเปิดด้วย Excel |
| ความปลอดภัย | ป้องกัน **CSV formula injection** (ดูรายละเอียดในหัวข้อ 8.2) |
| เวลา | แสดงตามเขตเวลาของผู้ใช้ พร้อมระบุ offset ในค่าด้วย เช่น `2026-09-29T14:30:00+07:00` |
| คอลัมน์ (Alarm) | รหัส Alarm, รหัสเครื่อง, ชื่อเครื่อง, รายละเอียด, สาเหตุ, สถานะ, แรงดัน/อุณหภูมิ/กระแสสูงสุด, เวลาที่เกิด |
| คอลัมน์ (งานซ่อม) | รหัสเครื่อง, ชื่อเครื่อง, รหัส Alarm, **ช่างผู้ซ่อม**, รายละเอียดงาน, สถานะ, เวลาที่บันทึก |

#### F. ประวัติเครื่องจักร (Machine History)

หน้า `/machines/[รหัสเครื่อง]` แสดงประวัติทั้งหมดของตู้หนึ่งตู้ เรียงจากใหม่ไปเก่า

- **ทำไมใช้รหัสเครื่องใน URL** — `machines.machine_id` มี unique constraint จึงใช้เป็นตัวระบุที่คงที่และมีความหมายสำหรับคน (เช่น `/machines/EVB-01`) ลิงก์จึงบันทึกและส่งต่อได้ ต่างจาก UUID ที่อ่านออกไม่รู้เรื่อง
- **การจัดกลุ่ม** — งานซ่อมที่ผูกกับ Alarm จะถูกจัดอยู่ **ใต้ Alarm ตัวนั้น** ไม่ใช่เรียงคู่ขนาน เพราะคำถามที่ผู้ใช้ต้องการคำตอบคือ "เสียเพราะ Alarm อะไร และใครเป็นคนซ่อม"
- **งานซ่อมที่ไม่ผูกกับ Alarm** (งานตามรอบ) จะแสดงเป็นรายการของตัวเอง
- **การ์ดสรุป** — จำนวน Alarm ทั้งหมด, Alarm ที่ยังไม่ปิด, จำนวนงานซ่อม, จำนวนช่างผู้ดูแล, วันที่ซ่อมเสร็จล่าสุด
- วันที่แสดงตามเขตเวลาของผู้ใช้ เหมือนกับตาราง Alarm และงานซ่อมบำรุง

#### G. AI Charging Cable & Module Analyzer

ปุ่ม **"วิเคราะห์ด้วย AI"** ในคอลัมน์จัดการของหน้า `/alarms` วิเคราะห์ Alarm แล้วแสดงผลใน Modal

ผลลัพธ์มีสามส่วนตามที่กำหนด

| ฟิลด์ | ความหมาย |
| --- | --- |
| `primary_cause` | `Cable/Connector`, `Power Module Overheat` หรือ `Insufficient Data` |
| `confidence_score` | ความมั่นใจเป็นเปอร์เซ็นต์ 0-100 |
| `repair_checklist` | 3-5 ขั้นตอนเรียงลำดับสำหรับช่าง |

ข้อมูลที่ส่งให้โมเดลคือ Alarm Code, Description, สาเหตุที่บันทึกไว้, รหัสเครื่องจักร, สถานะ, เวลาที่เกิด และค่าที่วัดได้สามช่อง ได้แก่ `voltage_peak`, `temperature_peak`, `current_peak`

> **เหตุผลที่เพิ่มตัวเลือก `Insufficient Data`** ทั้งที่โจทย์ระบุสองสาเหตุ: ข้อมูลตัวอย่างของระบบมีเคส `ERR-GROUND-FAULT` (สายดิน PE หลวม) ซึ่งไม่ใช่สายชาร์จเสื่อมและไม่ใช่บอร์ดร้อน การบังคับให้เลือกหนึ่งในสองอย่างจะทำให้ AI ตอบอย่างมั่นใจทั้งที่ผิด และช่างอาจไปถอดอะไรผิดชิ้น **การมีทางเลือกที่ซื่อสัตย์กับข้อมูลสำคัญกว่าบังคับให้ตอบครบสองช่อง**

#### H. การตรวจสอบข้อมูลก่อนบันทึก

`lib/validation.ts` เป็นชั้น UX — คืนข้อความภาษาไทยที่ระบุว่าช่องไหนผิด และแสดงผิดกับช่องนั้นในฟอร์มควบคู่กับ toast

- รหัสเครื่องจักร / รหัส Alarm: อังกฤษ ตัวเลข และ `. _ -` เท่านั้น (กันสถานีชื่อ `EVB-01` กับ `EVB 01` ที่ดูเหมือนกันแต่แยกกันได้)
- ค่าที่วัดได้ 3 ช่องเป็นตัวเลขที่ **ไม่บังคับ** ช่องว่างแปลว่า "ไม่ได้รายงาน" ไม่ใช่ศูนย์ และช่วงค่าตรงกับ CHECK constraint ในฐานข้อมูล
- งานซ่อมบำรุงที่ผูกกับ Alarm ต้องเป็น Alarm ของเครื่องเดียวกัน เพราะ `maintenance_records` อ้างอิง `alarms (id, machine_id)` แบบ composite key ระบบตรวจให้ก่อนบันทึก และ dropdown ก็กรอง Alarm ตามเครื่องที่เลือกไว้

### 2.2 Tech Stack

| เทคโนโลยี | เวอร์ชัน | หน้าที่ในโครงการ |
| --- | --- | --- |
| **Next.js** | 14.2.35 (App Router) | เฟรมเวิร์กเว็บแบบ full-stack มี Server Component, Server Action และ Route Handler ในตัว |
| **React** | 18.3.1 | สร้างส่วนติดต่อผู้ใช้ |
| **TypeScript** | 5.6.3 | ตรวจชนิดข้อมูลแบบ static ให้ทั้งโปรเจกต์ |
| **Tailwind CSS** | 3.4.19 | ออกแบบ UI รองรับโหมดสว่าง/มืด |
| **Supabase** | PostgreSQL 15+ | ฐานข้อมูล, Authentication, Row Level Security |
| **@supabase/ssr** | 0.12.7 | ผูก Supabase client กับ session cookie ของ Next.js เพื่อรักษาสถานะล็อกอินระหว่าง RSC ↔ Browser |
| **OpenAI API** | SDK 7.23.0 / `gpt-4o-mini` | วิเคราะห์สาเหตุของ Alarm และจัดทำรายการขั้นตอนซ่อม |
| **Vercel** | — | โฮสต์และ deploy เว็บแอป พร้อมตั้ง Environment Variables และ domain |
| **GitHub Actions** | — | Continuous Integration: ตรวจ lint และ build อัตโนมัติทุก push/PR |
| **Recharts** | 3.10.1 | กราฟบนหน้า Dashboard |
| **lucide-react** | 1.48.0 | ไอคอน SVG |
| **Sonner** | 2.0.8 | ข้อความแจ้งเตือน (toast) |
| **ESLint** | 8.57.1 + `eslint-config-next` | ตรวจคุณภาพโค้ด |

### 2.3 เส้นทางหลักของระบบ

| เส้นทาง | หน้า | ใครใช้ได้ |
| --- | --- | --- |
| `/login` | หน้าเข้าสู่ระบบ | ทุกคน |
| `/dashboard` | ภาพรวม: KPI, กราฟ, Top 5 Alarm, Alarm ล่าสุด | ทุกบทบาท |
| `/machines` | ตู้ชาร์จ: เพิ่ม / แก้ไข / ลบ / เปลี่ยนสถานะ | ดูทุกบทบาท, เขียนเฉพาะ Admin |
| `/machines/[machineId]` | **ประวัติเครื่องจักร** (Timeline Alarm + ช่างผู้ซ่อม) | ทุกบทบาท |
| `/alarms` | Alarm: เปิดใหม่, แก้ไข, เปลี่ยนสถานะ, ลบ, วิเคราะห์ด้วย AI | ดูทุกบทบาท, เปลี่ยนสถานะ Admin+ช่าง, แก้รายละเอียด Admin+วิศวกร |
| `/maintenance` | งานซ่อมบำรุง: เพิ่ม, แก้ไข, เปลี่ยนสถานะ, ลบ | ดูทุกบทบาท, เขียน Admin+ช่าง |
| `/dashboard/team` | สมาชิกและการเปลี่ยนบทบาท | เฉพาะ Admin |
| `/api/ai-analyze` | POST — วิเคราะห์ Alarm ด้วย AI | Admin + Engineer + Technician |
| `/unauthorized` | แจ้งว่าไม่มีสิทธิ์ | ทุกคน |

URL เก่า `/dashboard/machines`, `/dashboard/alarms`, `/dashboard/maintenance` ยังใช้ได้ผ่าน redirect และคง query string เดิมไว้ ทั้งหมดอยู่ใน route group `app/(app)/` ซึ่งมี layout กลางคุม auth guard และเมนูเพียงจุดเดียว

### 2.4 ระบบ Authentication ที่โปรเจกต์สร้างเอง

โปรเจกต์ **ไม่ใช้ Supabase Auth** ทั้งหมด: ไม่มีตารางข้อมูลผู้ใช้ใน schema `auth` ไม่มีการสมัครสมาชิก และไม่มีโค้ดไหนเรียก `supabase.auth.*` การเข้าสู่ระบบประกอบไปด้วย 4 ชิ้นส่วน

**ชิ้นที่ 1 — ข้อมูลเข้ารหัสอยู่ใน `public.profiles`**
`username` + `password_hash` (bcrypt จาก `pgcrypto`) ชิ้นเดียวกับบทบาท `role` เพราะไม่มีระบบ Auth ภายนอกที่จะดูแล credential

**ชิ้นที่ 2 — ฟังก์ชัน `public.login(username, password)`**
ฟังก์ชันเดียวในฐานข้อมูลที่ role `anon` เรียกได้ (`02_rls.sql` revoke `anon` ออกจากตาราง `profiles` แล้ว grant `EXECUTE` เฉพาะฟังก์ชันนี้) เป็น `SECURITY DEFINER` เพราะผู้เรียกไม่มีสิทธิ์อ่านตาราง จึงต้องอ่าน hash แทนผู้เรียก
คืน `jsonb` เมื่อถูกต้อง และคืน `null` ทั้งกรณี "รหัสผิด" และ "ไม่มีชื่อผู้ใช้นี้" เพื่อไม่ให้ตรวจสอบได้ว่ามีบัญชีอยู่จริงหรือไม่ และมีการ hash ทิ้งอีกครั้งในกรณีที่ไม่พบบัญชี เพื่อให้เวลาตอบกลับเท่ากัน

**ชิ้นที่ 3 — session token ที่เซ็นเอง (`lib/session.ts`)**
หลัง login สำเร็จ เซิร์ฟเวอร์สร้าง JWT algorithm **HS256** แล้วเซ็นด้วย `SUPABASE_JWT_SECRET` (ค่าเดียวกับ shared secret ของโปรเจกต์ Supabase) เก็บใน cookie ชื่อ `ev-chargeops-session`, `httpOnly`, `sameSite=lax`, อายุ 8 ชั่วโมง
claim ที่ตั้งใจใส่มีแค่ `sub` (uuid ของผู้ใช้), `role` (ค่า `authenticated` ตามที่ PostgREST คาดหวัง) และ `aud`/`exp` — **ไม่มีบทบาททางธุรกิจใน token** เพราะ `role` ชื่อซ้ำกับ claim มาตรฐานของ PostgREST

**ชิ้นที่ 4 — token เดียวกันถูกใช้เป็นทั้ง session ของแอปและ credential ของฐานข้อมูล**
`lib/supabase/server.ts` ส่ง token นี้เข้า Supabase client ผ่านตัวเลือก `accessToken` PostgREST ตรวจลายเซ็นเอง เปลี่ยน Postgres role เป็น `authenticated` และเปิด `auth.uid()` ให้เท่ากับค่า `sub`
**RLS จึงไม่ต้องแก้แม้แต่บรรทัดเดียว** เพราะทุก policy เดิมตรวจจาก `auth.uid()` เหมือนกัน

```
ผู้ใช้กรอก username/password
        │
        ▼
app/login/actions.ts ──POST /rest/v1/rpc/login (anon)──▶ public.login() ──▶ crypt()
        │                                                          │
        │◀────────────── jsonb { id, username, full_name, role } ──┘
        │
        ▼
lib/session.ts เซ็น HS256 ด้วย SUPABASE_JWT_SECRET
        │
        ▼
cookie ev-chargeops-session (httpOnly, 8 ชม.)
        │
        ├──▶ middleware.ts ตรวจลายเซ็น ก่อนเข้าถึงเส้นทาง
        └──▶ PostgREST ตรวจลายเซ็นเดียวกัน → auth.uid() = sub → RLS ตัดสินใจ
```

**ผลต่อส่วนอื่นของระบบ**

| เรื่อง | ผลกระทบ |
| --- | --- |
| การเปลี่ยนบทบาท | มีผลทันที ทุก request อ่าน `role` จากฐานข้อมูล ไม่ต้องออก token ใหม่ |
| การเพิ่มบัญชี | ต้องรัน SQL เอง ไม่มีหน้า register และไม่มี INSERT policy |
| `auth/callback` | ถูกลบออกทั้งไฟล์ เพราะไม่มี OAuth หรือ magic link ให้รับ |
| Redirect URLs ใน Supabase | ไม่ต้องตั้งค่าแล้ว เพราะไม่มีการ redirect กลับจาก Supabase |
| `service_role` key | ยังไม่ได้ใช้ที่ใด และไม่จำเป็นต่อไป |

> ⚠️ **ต้องมี `SUPABASE_JWT_SECRET`** ค่า secret แบบ HS256 ของโปรเจกต์ (Project Settings → API Keys → JWT Secret) ถ้าโปรเจกต์มีเฉพาะ asymmetric signing key ให้เปิดส่วน "JWT Secret" เพื่อดูหรือสร้างค่านี้ วิธีนี้ใช้ไม่ได้ถ้าไม่มี shared secret

---

## 3. โครงสร้างฐานข้อมูล

ฐานข้อมูลบน Supabase (PostgreSQL 15+) ประกอบด้วย **4 ตาราง** เชื่อมโยงกันด้วย foreign key

### 3.1 แผนผังความสัมพันธ์ (ER Diagram)

```
ตาราง profiles คือตารางผู้ใช้โดยตรง
(ไม่มี auth.users และไม่มี foreign key ไปยัง schema auth)
┌───────────────┐
│   profiles    │◄──────────┐ technician_id
│ ───────────── │           │ (ON DELETE SET NULL)
│ id      (PK)  │           │
│ username (UNI)│           │
│ password_hash │           │
│ full_name     │           │
│ role          │           │
│ created_at    │           │
└───────────────┘           │
                            │
┌───────────────┐           │           ┌────────────────────────┐
│   machines    │           │           │  maintenance_records   │
│ ───────────── │           │           │ ────────────────────── │
│ id         (PK)│◄───┐     │           │ id              (PK)  │
│ machine_id(UNI)│    │     │           │ alarm_id       (FK)  │
│ name          │    │     │           │ machine_id     (FK)  │
│ type          │    │     │           │ technician_id  (FK)──┘
│ location      │    │     │           │ action_taken         │
│ status        │    │     │           │ status               │
│ created_at    │    │     │           │ created_at           │
│ updated_at    │    │     │           │ updated_at           │
└───────────────┘    │     │           └────────────────────────┘
                     │     │                      ▲
                     │     │   composite FK      │
                     │     │  (alarm_id,         │
                     │     │   machine_id)       │
                     │     └─────────────────────┘
                     │
┌───────────────────────┐
│       alarms          │
│ ───────────────────── │
│ id              (PK)  │
│ machine_id      (FK)──┘  (ON DELETE CASCADE)
│ alarm_code
│ description
│ cause
│ status
│ voltage_peak
│ temperature_peak
│ current_peak
│ created_at
│ updated_at
└───────────────────────┘
```

### 3.2 ตาราง `profiles` — บัญชีผู้ใช้ บทบาท และข้อมูลเข้ารหัส

ตารางนี้คือ **ตารางผู้ใช้ของระบบ** ไม่ได้เป็นแค่ตารางข้อมูลเสริม เพราะโปรเจกต์ไม่ได้ใช้ Supabase Auth: บัญชีผู้ใช้และข้อมูลเข้ารหัสอยู่ในตารางนี้ที่เดียว และ **ไม่มีแถวใดใน `auth.users`**

| คอลัมน์ | ชนิดข้อมูล | ข้อจำกัด | คำอธิบาย |
| --- | --- | --- | --- |
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | รหัสผู้ใช้ ใช้เป็น FK ของ `maintenance_records.technician_id` และเป็นค่า `auth.uid()` ที่ RLS ใช้ตรวจสอบ |
| `username` | `text` | NOT NULL, **UNIQUE**<br>CHECK รูปแบบ `^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$` | **ชื่อผู้ใช้ที่ใช้ล็อกอิน** เช่น `admin`, `tech1` |
| `password_hash` | `text` | NOT NULL | **bcrypt hash** จาก `pgcrypto` (`crypt` + `gen_salt('bf')`) ไม่ใช่รหัสผ่านดิบ — `02_rls.sql` สั่ง `REVOKE SELECT` บนคอลัมน์นี้ ทำให้แม้ผู้ล็อกอินแล้วก็อ่านออกมาไม่ได้ |
| `full_name` | `text` | nullable | ชื่อ-นามสกุลที่แสดงในระบบ |
| `role` | `text` | NOT NULL, default `'Viewer'`<br>CHECK ∈ (`Admin`, `Engineer`, `Technician`, `Viewer`) | บทบาทที่กำหนดสิทธิ์ |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | เวลาสร้าง |

> **ไม่มีการสมัครสมาชิกในระบบ** และไม่มี trigger สร้างแถวอัตโนมัติ บัญชีมีอยู่เพราะ Admin สร้างเอง ผ่าน SQL Editor (ดู `03a_users.sql`) และการเปลี่ยนบทบาททำได้จากหน้า `/dashboard/team` โดย Admin เท่านั้น — **ผู้ใช้ไม่สามารถกำหนดบทบาทของตัวเองได้** เพราะแอปไม่มีโค้ดฝั่ง client ที่จะส่งค่า `role` เข้าไป และ `handle_new_user()` ถูกลบออกไปแล้ว

### 3.3 ตาราง `machines` — ข้อมูลตู้ชาร์จ

| คอลัมน์ | ชนิดข้อมูล | ข้อจำกัด | คำอธิบาย |
| --- | --- | --- | --- |
| `id` | `uuid` | **PK**, default `gen_random_uuid()` | คีย์ภายใน ใช้เป็น FK ของตารางอื่น |
| `machine_id` | `text` | NOT NULL, **UNIQUE** | **รหัสประจำตู้** เช่น `EVB-01` ใช้แสดงผลและใช้เป็น URL ของหน้าประวัติ |
| `name` | `text` | NOT NULL | ชื่อสถานี เช่น "ตู้ชาร์จลานจอด B1" |
| `type` | `text` | NOT NULL | ประเภทตู้ เช่น DC Fast Charger, AC Charger |
| `location` | `text` | nullable | สถานที่ตั้ง เช่น "B1 ชั้น 2" |
| `status` | `text` | NOT NULL, default `'Stop'`<br>CHECK ∈ (`Running`, `Stop`, `Alarm`, `Maintenance`) | สถานะปัจจุบันของตู้ |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | เวลาสร้าง |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | อัปเดตอัตโนมัติโดย Trigger `set_updated_at()` |

### 3.4 ตาราง `alarms` — บันทึกการแจ้งเหตุขัดข้อง

| คอลัมน์ | ชนิดข้อมูล | ข้อจำกัด | คำอธิบาย |
| --- | --- | --- | --- |
| `id` | `uuid` | **PK** | รหัส Alarm |
| `machine_id` | `uuid` | NOT NULL, FK → `machines(id)` **ON DELETE CASCADE** | เครื่องจักรที่เกิดเหตุ |
| `alarm_code` | `text` | NOT NULL | รหัสรหัสอาการ เช่น `ERR-CABLE-001` |
| `description` | `text` | NOT NULL | รายละเอียดอาการที่ช่างพิมพ์ |
| `cause` | `text` | nullable | สาเหตุที่บันทึกไว้ |
| `status` | `text` | NOT NULL, default `'Open'`<br>CHECK ∈ (`Open`, `In Progress`, `Closed`) | สถานะการแก้ไข |
| `voltage_peak` | `numeric(7,2)` | nullable, CHECK `0 – 1500` | แรงดันสูงสุดที่วัดได้ (V) |
| `temperature_peak` | `numeric(6,2)` | nullable, CHECK `-50 – 250` | อุณหภูมิสูงสุดที่วัดได้ (°C) |
| `current_peak` | `numeric(7,2)` | nullable, CHECK `0 – 1000` | กระแสสูงสุดที่วัดได้ (A) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | เวลาที่เกิดเหตุ |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | อัปเดตอัตโนมัติ |
| — | — | **UNIQUE (`id`, `machine_id`)** | รองรับ composite FK จาก `maintenance_records` |

> **ทำไมค่าที่วัดได้ต้องเป็น nullable** — เพราะ (1) แถวเก่าที่สร้างก่อนเพิ่มคอลัมน์นี้ และ (2) บางสถานีไม่ได้รายงานทุกช่อง ตัว AI analyzer จึงตีความค่าที่ว่างว่า "ไม่รู้" ไม่ใช่ศูนย์ เพราะโมเดลมักจะตีค่าที่หายไปเป็นค่าปกติ ซึ่งเป็นการสร้างคำตอบที่มั่นใจแต่ไม่มีพื้นฐาน

### 3.5 ตาราง `maintenance_records` — บันทึกงานซ่อมบำรุง

| คอลัมน์ | ชนิดข้อมูล | ข้อจำกัด | คำอธิบาย |
| --- | --- | --- | --- |
| `id` | `uuid` | **PK** | รหัสงานซ่อม |
| `alarm_id` | `uuid` | nullable | Alarm ที่งานนี้แก้ไข (ถ้าเป็นงานตามรอบจะเป็น NULL) |
| `machine_id` | `uuid` | NOT NULL, FK → `machines(id)` **ON DELETE CASCADE** | เครื่องจักรที่ซ่อม |
| `technician_id` | `uuid` | FK → `profiles(id)` **ON DELETE SET NULL** | ช่างผู้ซ่อม (ดึงจาก session เสมอ ไม่รับจากฟอร์ม) |
| `action_taken` | `text` | NOT NULL | รายละเอียดงานที่ทำ |
| `status` | `text` | NOT NULL, default `'In Progress'`<br>CHECK ∈ (`In Progress`, `Completed`, `Waiting Part`) | สถานะงานซ่อม |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | เวลาบันทึก |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | อัปเดตอัตโนมัติ |

**ข้อกำหนดสำคัญ — Composite Foreign Key:**

```sql
constraint maintenance_records_alarm_fkey
  foreign key (alarm_id, machine_id)
  references public.alarms (id, machine_id) on delete restrict
```

ฟอร์เกนสีข้อมูลนี้หมายความว่า **ถ้างานซ่อมผูกกับ Alarm ต้องเป็น Alarm ของเครื่องเดียวกันเสมอ** ป้องกันไม่ให้เกิดกรณีงานซ่อมตู้ A แต่ไปอ้าง Alarm ของตู้ B ซึ่งจะทำให้ประวัติเครื่องผิดเพี้ยน

กฎ `MATCH SIMPLE` ของ PostgreSQL หมายความว่าเมื่อ `alarm_id` เป็น `NULL` ระบบจะข้ามการตรวจ — จึงยังบันทึกงานซ่อมตามรอบที่ไม่ได้มาจาก Alarm ได้ตามปกติ

### 3.6 ฟังก์ชันและ View

**ฟังก์ชัน**

| ฟังก์ชัน | หน้าที่ |
| --- | --- |
| `set_updated_at()` | Trigger อัปเดตคอลัมน์ `updated_at` ทุกครั้งที่มี `UPDATE` |
| `login(p_username, p_password)` | **ฟังก์ชันล็อกอินของโปรเจกต์เอง** คืน `jsonb` เมื่อถูกต้อง คืน `null` เมื่อรหัสผิดหรือไม่มีชื่อผู้ใช้นี้ เป็น `SECURITY DEFINER` เพราะ role `anon` ไม่มีสิทธิ์อ่าน `profiles` |
| `current_role()` | คืนค่าบทบาทของผู้เรียกใช้ จาก `auth.uid()` เท่านั้น |
| `is_admin()` | ตรวจว่าผู้เรียกเป็น Admin หรือไม่ ใช้ใน RLS policy |
| `is_staff()` | ตรวจว่าผู้เรียกเป็น Admin หรือ Technician |
| `is_engineer()` | ตรวจว่าผู้เรียกเป็น Engineer หรือไม่ ใช้ใน `alarms_update` เพียง policy เดียว |

> **`Engineer` ไม่ได้อยู่ใน `is_staff()`** เพราะ `is_staff()` คือตัวที่คุม `maintenance_records_insert` ถ้าใส่ Engineer เข้าไปด้วย วิศวกรจะบันทึกงานซ่อมได้ทันที ซึ่งเป็นสิ่งที่บทบาทนี้ไม่ควรทำ (วิศวกรวิเคราะห์สาเหตุ ส่วนช่างเป็นคนลงมือซ่อม) จึงแยกเป็น `is_engineer()` และเรียกใช้เฉพาะใน `alarms_update` ดูรายละเอียดที่หัวข้อ 5.4

> `handle_new_user()` ถูก**ลบออกไปแล้ว** เพราะระบบไม่มีการสมัครสมาชิก: บัญชีถูกสร้างด้วยการ `INSERT` เข้า `profiles` โดยตรงเท่านั้น ไม่มีทางที่ผู้ใช้ทั่วไปจะสร้างบัญชีหรือกำหนด `role` เองได้

**View สำหรับ Dashboard** (ไฟล์ `04_dashboard_views.sql`)

| View | หน้าที่ |
| --- | --- |
| `machine_status_summary` | สรุปจำนวนตู้แยกตามสถานะ |
| `top_alarm_codes` | สถิติ Alarm ที่พบบ่อย 5 อันดับ |

ทั้งสอง view ใช้ `security_invoker = true` เพื่อให้ RLS ของตารางหลักยังทำงานกับผู้เรียกตามปกติ

### 3.7 ไฟล์ SQL ทั้งหมด

| ไฟล์ | เนื้อหา |
| --- | --- |
| `01_schema.sql` | ตาราง, constraint, index, trigger, ฟังก์ชันช่วยตรวจบทบาท |
| `02_rls.sql` | เปิด RLS และสร้าง policy ทั้ง 15 รายการ **(ไฟล์นี้กำหนดสิทธิ์จริง)** |
| `03a_users.sql` | บัญชีทดลอง 4 บัญชี (หนึ่งบัญชีต่อหนึ่งบทบาท) |
| `03b1_machines.sql` | ข้อมูลตู้ชาร์จตัวอย่าง |
| `03b2_alarms.sql` | ข้อมูล Alarm ตัวอย่างพร้อมค่าที่วัดได้ |
| `03b3_logs.sql` | ข้อมูลงานซ่อมบำรุงตัวอย่าง |
| `04_dashboard_views.sql` | View สำหรับกราฟบนหน้า Dashboard |
| `05_alarm_telemetry.sql` | เพิ่มคอลัมน์ค่าที่วัดได้ (สำหรับฐานข้อมูลที่สร้างจาก `01_schema.sql` เวอร์ชันเก่า) |
| `06_machine_status_migration.sql` | เปลี่ยนสถานะเครื่องเป็น `Running`/`Stop`/`Alarm`/`Maintenance` (สำหรับฐานข้อมูลเวอร์ชันเก่า) |
| `07_custom_auth.sql` | แปลงฐานข้อมูลเดิมจาก Supabase Auth (ฐานข้อมูลเวอร์ชันเก่า) |
| `08_engineer_role.sql` | เพิ่มบทบาท `Engineer` (ฐานข้อมูลเวอร์ชันเก่า) |
| `99_verify_setup.sql` | ตรวจผลการติดตั้ง (read-only รันซ้ำได้) ควรรันหลังสุด |
| `ev_chargeops_ddl.sql` | ไฟล์รวมทุกอย่างไว้ที่เดียว (สะดวกตอนติดตั้งครั้งเดียว) |

---

## 4. การติดตั้งและรันโปรเจกต์ในเครื่อง

### 4.1 สิ่งที่ต้องมีก่อน

| รายการ | หมายเหตุ |
| --- | --- |
| **Node.js 20 ขึ้นไป** | ตรวจด้วย `node -v` |
| **npm 10 ขึ้นไป** | มาพร้อม Node.js 20 |
| **บัญชี Supabase** | สร้างฟรีได้ที่ https://supabase.com |
| **OpenAI API key** *(ถ้าต้องการทดสอบฟีเจอร์ AI)* | สร้างได้ที่ https://platform.openai.com |

### 4.2 ขั้นตอนที่ 1 — ติดตั้ง Supabase Project

1. สร้างโปรเจกต์ที่ https://supabase.com/dashboard
2. เปิด **SQL Editor > New query**
3. รันไฟล์ตามลำดับ **ทีละไฟล์**:

   | ลำดับ | ไฟล์ | หมายเหตุ |
   | --- | --- | --- |
   | 1 | `01_schema.sql` | ตาราง ฟังก์ชัน ทริกเกอร์ ดัชนี และ `public.login()` |
   | 2 | `02_rls.sql` | **สำคัญที่สุด** — เปิด RLS และกำหนดสิทธิ์ |
   | 3 | `03a_users.sql` | สร้างบัญชีทดลอง (4 บัญชี หนึ่งบัญชีต่อหนึ่งบทบาท) |
   | 4 | `03b1_machines.sql` | ข้อมูลตู้ชาร์จ |
   | 5 | `03b2_alarms.sql` | ข้อมูล Alarm |
   | 6 | `03b3_logs.sql` | ข้อมูลงานซ่อมบำรุง |
   | 7 | `04_dashboard_views.sql` | View สำหรับกราฟ |
   | 8 | `05_alarm_telemetry.sql` | คอลัมน์ค่าที่วัดได้ (ถ้าฐานข้อมูลยังไม่มี) |
   | 9 | `06_machine_status_migration.sql` | สถานะเครื่องเวอร์ชันใหม่ (ถ้าฐานข้อมูลเคยใช้ค่าเก่า) |
   | 10 | `99_verify_setup.sql` | ตรวจผลการติดตั้ง (read-only รันซ้ำได้) ควรรันหลังสุด |

   > `04_dashboard_views.sql` ต้องเป็น PostgreSQL 15 ขึ้นไป (Supabase เป็นอยู่แล้ว) ถ้าไม่รันไฟล์นี้ หน้า `/dashboard` จะแสดงผลว่างเพราะไม่มี view ให้อ่าน
   >
   > `05_alarm_telemetry.sql` และ `06_machine_status_migration.sql` ต้องรันเฉพาะฐานข้อมูลเวอร์ชันเก่าเท่านั้น ฐานข้อมูลใหม่ที่รัน `01_schema.sql` เวอร์ชันล่าสุดไม่ต้องรันสองไฟล์นี้ ทุกคำสั่งเป็น idempotent จึงรันซ้ำได้

4. **ถ้าเคยติดตั้งระบบรุ่นเก่าที่ใช้ Supabase Auth** ให้รัน `07_custom_auth.sql` **ก่อนไฟล์อื่นทั้งหมด** ไฟล์นี้แปลงฐานข้อมูลเดิมให้เป็นระบบของโปรเจกต์เอง: ลบ foreign key ไปยัง `auth.users`, ลบ trigger `handle_new_user()`, เพิ่มคอลัมน์ `username` และ `password_hash`, สร้าง `public.login()` และตั้งสิทธิ์ใหม่ ทุกคำสั่ง idempotent และ**เก็บข้อมูลเดิมไว้ทั้งหมด** ยกเว้นรหัสผ่านของผู้ใช้เดิม ซึ่งต้องรัน `03a_users.sql` ต่อเพื่อตั้งรหัสผ่านทดลองใหม่ — ฐานข้อมูลใหม่ไม่ต้องรันไฟล์นี้

5. **ถ้าฐานข้อมูลเดิมยังไม่มีบทบาท `Engineer`** ให้รัน `08_engineer_role.sql` ต่อจาก `07_custom_auth.sql` ไฟล์นี้เพิ่มค่าใน CHECK constraint, สร้าง `is_engineer()` และขยาย `alarms_update` โดยไม่แตะ policy อื่น ทุกคำสั่ง idempotent ฐานข้อมูลใหม่ที่รัน `01_schema.sql` เวอร์ชันล่าสุดไม่ต้องรัน

6. เปิด **Project Settings > API Keys** แล้วจดค่าไว้ 3 ตัว: `Project URL`, `anon public` key และ `JWT Secret`

### 4.3 ขั้นตอนที่ 2 — ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` ที่รากโปรเจกต์ โดยคัดลอกจาก `.env.example`:

```bash
copy .env.example .env.local          # Windows PowerShell
cp .env.example .env.local            # macOS / Linux
```

แก้ค่าให้เป็นของจริง:

```env
# ── Supabase (จำเป็น) ──────────────────────────────────────
# จาก Supabase Dashboard > Project Settings > API Keys
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# ── ระบบ Authentication ของโปรเจกต์ (จำเป็น) ──────────────────
# JWT Secret แบบ HS256 จาก Project Settings > API Keys > JWT Secret
# ใช้เซ็น session token ที่ lib/session.ts สร้าง และเป็นค่าเดียวกับที่
# PostgREST ใช้ตรวจลายเซ็น ทำให้ RLS เดิมทำงานได้โดยไม่ต้องแก้ policy
SUPABASE_JWT_SECRET=<jwt secret>

# ── OpenAI (ใช้เฉพาะฟีเจอร์ AI Analyzer) ─────────────────────
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

> **⚠️ ห้ามเขียน `NEXT_PUBLIC_` นำหน้า `SUPABASE_JWT_SECRET` เด็ดขาด**
>
> นี่เป็นค่าเดียวในรายการนี้ที่เป็น **secret จริง** ถ้ามี prefix `NEXT_PUBLIC_` ค่าจะถูกฝังลง JavaScript bundle แล้วอ่านได้จาก DevTools ใครก็ตาม ซึ่ง**ไม่ใช่แค่เขียนแยกกันแล้วจบ** — ถ้ามีคนก๊อป secret นี้ไป ก็เซ็น token สำหรับบัญชีไหนก็ได้ สิทธิ์ `Admin` ทั้งหมด
> ตัวแปรอีกสองตัวแรกต่างกันตรงนี้: `NEXT_PUBLIC_SUPABASE_ANON_KEY` เป็น public key จริง ๆ และปลอดภัยเพราะข้อมูลถูกคุ้มด้วย RLS ไม่ใช่การซ่อนคีย์ ส่วน `SUPABASE_JWT_SECRET` เป็นกุญแจ ไม่มีอะไรคุ้มนอกจากการไม่เอาไปเปิดเผย
>
> **ห้าม commit `.env.local`** และถ้าเผยแผล่โดยไม่ตั้งใจ ให้เปลี่ยนค่าใน Supabase Dashboard ทันที เพราะ token ที่เซ็นด้วย secret เก่าจะยังใช้ได้ต่อไป
>
> **`service_role` key ไม่ถูกใช้ในโปรเจกต์นี้เลย** การตรวจสิทธิ์ทั้งหมดใช้ anon key ร่วมกับ RLS จึงไม่มีเหตุผลที่จะเก็บ service_role key ไว้ หากวันหนึ่งจำเป็นต้องใช้จริง ๆ ให้ตั้งชื่อ **ไม่มี** prefix `NEXT_PUBLIC_` เก็บไว้เฉพาะ `.env.local` และอ่านจาก server เท่านั้น

### 4.4 ขั้นตอนที่ 3 — ติดตั้งและรัน

```bash
npm install        # ติดตั้ง dependency
npm run dev        # เริ่มเซิร์ฟเวอร์โหมดพัฒนา
```

เปิด http://localhost:3000 แล้วเข้าสู่ระบบด้วย **ชื่อผู้ใช้** (ไม่ใช่อีเมล) และรหัสผ่าน `Password123!` ทั้งหมด

| ชื่อผู้ใช้ | รหัสผ่าน | บทบาท | ชื่อ-นามสกุล |
| --- | --- | --- | --- |
| `admin` | `Password123!` | Admin | Natthawut Srisuwan |
| `tech1` | `Password123!` | Technician | Somchai Jaidee |
| `eng1` | `Password123!` | Engineer | Piyaporn Wongtong |
| `view1` | `Password123!` | Viewer | Anong Chaiyasit |

### 4.5 คำสั่งที่ใช้บ่อย

```bash
npm run dev        # โหมดพัฒนา (hot reload)
npm run build      # build สำหรับ production
npm run start      # รัน production build
npm run lint       # ตรวจด้วย ESLint
npm run typecheck  # ตรวจชนิดข้อมูลด้วย tsc --noEmit
```

### 4.6 แก้ปัญหาที่พบบ่อย

| อาการ | วิธีแก้ |
| --- | --- |
| หน้า "Supabase is not configured" แสดงตอนเปิดเว็บ | ตั้ง `SUPABASE_JWT_SECRET` ให้ครบใน `.env.local` แล้วรีสตาร์ทเซิร์ฟเวอร์ (ดูหัวข้อ 2.4 ว่าค่านี้มาจากไหน) |
| ล็อกอินแล้วถูกดีดรอสกลับ | ตรวจว่า `SUPABASE_JWT_SECRET` ตรงกับค่าใน Supabase Dashboard เป๊ะ ๆ ถ้าไม่ตรง PostgREST จะปฏิเสธ token และ RLS จะมองไม่เห็นข้อมูล |
| ล็อกอินไม่ได้ขึ้นว่า "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" | ตรวจว่ารัน `03a_users.sql` แล้ว และชื่อผู้ใช้ตรงตามตารางข้างต้น (ระบบจะตอบเหมือนกันทั้งชื่อผิดและรหัสผิด โดยเจตนา) |
| หน้า Dashboard แสดงผลว่าง | ยังไม่ได้รัน `04_dashboard_views.sql` |
| เห็นข้อมูลเป็นศูนย์แถวทั้งที่มีข้อมูล | ยังไม่ได้รัน `02_rls.sql` หรือรันผิดลำดับ |
| ปุ่ม "วิเคราะห์ด้วย AI" ไม่ทำงาน | ยังไม่ได้ตั้ง `OPENAI_API_KEY` ใน `.env.local` แล้วรีสตาร์ทเซิร์ฟเวอร์ |
| ขึ้น `Invalid API key` | คัดลอก `anon key` มาผิดตัว (ต้องเป็น `anon public` ไม่ใช่ `service_role`) |
| ฐานข้อมูลเดิมล็อกอินไม่ได้เลย | ยังไม่ได้รัน `07_custom_auth.sql` ดูหัวข้อ 4.2 |

---

## 5. การ Deploy บน Vercel

### 5.1 URL ของโปรเจกต์

> **🔗 Deployment URL:** https://ev-chargeops-ten.vercel.app
>
> ✅ **Deploy แล้ว** — production build ผ่าน (15 routes, lint และ type check ไม่มี error) และเชื่อมต่อ Supabase จริงแล้ว ทดสอบแล้วว่า `/login` ตอบกลับ 200 และหน้าอื่น redirect ไปยังหน้า login ถูกต้อง

### 5.2 ขั้นตอนการ Deploy

**1) นำโค้ดขึ้น GitHub**

```bash
git init
git add .
git commit -m "Initial commit: EV-ChargeOps"
git branch -M main
git remote add origin https://github.com/<username>/ev-chargeops.git
git push -u origin main
```

> ตรวจสอบว่า `.env.local` **ไม่ถูก** commit ขึ้นไป โดย `.gitignore` ต้องมีบรรทัด `.env*.local`

**2) เชื่อมกับ Vercel**

1. เปิด https://vercel.com แล้ว Login ด้วยบัญชี GitHub
2. กด **Add New > Project** แล้วเลือก repository `ev-chargeops`
3. Vercel จะตรวจจาก `package.json` แล้วเติมค่าค่าเริ่มต้นให้ (Framework Preset = Next.js, Build = `npm run build`)
4. กด **Deploy**

**3) ตั้ง Environment Variables**

ไปที่ **Project > Settings > Environment Variables** แล้วเพิ่ม:

| Key | Value | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon key>` | Production, Preview, Development |
| `SUPABASE_JWT_SECRET` | `<jwt secret>` — **secret อย่าตั้ง `NEXT_PUBLIC_` และอย่า commit** | Production, Preview, Development |
| `OPENAI_API_KEY` | `sk-...` | Production, Preview |
| `OPENAI_MODEL` | `gpt-4o-mini` | Production, Preview |

จากนั้นกด **Deployments > ⋮ > Redeploy** เพื่อให้ค่ามีผล

> ⚠️ **`SUPABASE_JWT_SECRET` เป็น secret จริง ไม่ใช่ public key** ตัวแปรอีกสองตัวแรกเปิดเผยได้เพราะ RLS เป็นตัวคุมการเข้าถึง แต่ค่านี้คือกุญแจที่เซ็น session token — ใครก็ตามที่รู้ค่านี้สามารถสร้าง token สำหรับบัญชีใดก็ได้ รวมถึง `Admin` เก็บไว้เฉพาะใน Environment Variables ของ Vercel เท่านั้น ถ้าเผยแผล่ในที่ใดต้องเปลี่ยนค่าใน Supabase Dashboard ทันทีเพราะ token ที่เซ็นด้วย secret เก่ายังใช้ได้
>
> ถ้าเพิ่งเพิ่มตัวแปรนี้หลังจาก deploy ครั้งแรก **ต้อง Redeploy** ค่า env ถูกอ่านตอน build ไม่ใช่ตอนรัน เว็บจะขึ้นหน้า "Supabase is not configured" จนกว่าจะ redeploy

**4) ไม่ต้องตั้งค่า URL Configuration ใน Supabase**

โปรเจกต์นี้ไม่ใช้ Supabase Auth จึง**ไม่มี OAuth และไม่มี magic link** การไม่มี callback URL จาก Supabase จึงไม่ต้องเพิ่ม **Site URL** หรือ **Redirect URLs** ที่ Supabase เลย และการตั้งค่าไว้ก็ไม่มีผลต่อระบบ

**5) ทดสอบหลัง Deploy**

- เปิด URL แล้วล็อกอินได้
- เปลี่ยนเป็นโหมดมือถือเพื่อทดสอบ responsive
- ทดสอบปุ่ม "ส่งออก CSV" และหน้าประวัติเครื่องจักร

### 5.3 การทำงานอัตโนมัติด้วย GitHub Actions

ทุกครั้งที่ push หรือเปิด Pull Request เข้า branch `main` / `master` ระบบจะตรวจสอบอัตโนมัติตามไฟล์ `.github/workflows/ci.yml`

```
┌──────────────────────────────────────────────┐
│  1. Install Dependencies   npm ci            │
│            ▼                                 │
│  2. Build Project          npm run build     │
│            ▼                                 │
│  3. Lint                   npm run lint      │
│            ▼                                 │
│  CI Summary  ✅ / ❌ ตารางผลลัพธ์ในหน้า run     │
└──────────────────────────────────────────────┘
         ถ้าขั้นใดล้มเหลว → ขั้นถัดไปจะไม่รัน
         และ Workflow จะแสดงผล Failed
```

- ทำงานเป็น **job เดียวเรียงตามลำดับ** เพราะข้อกำหนดระบุให้ตรวจสอบตามลำดับ Install → Build → Lint
- เมื่อขั้นใดล้มเหลว ขั้นถัดไปจะไม่รัน จึงไม่มีกรณี Lint เขียวคู่กับ Build แดง
- **Node.js 20** + npm cache → ติดตั้งเร็ว
- ใช้ `npm ci` (ไม่ใช่ `npm install`) เพื่อให้ได้ dependency ตรงกับ lockfile ที่ commit ไว้เสมอ
- สร้างตารางสรุปผล Pass/Fail ในหน้า run ทำให้เห็นผลได้ชัดเจนแม้ขั้นใดขั้นหนึ่งล้มเหลว
- ยกเลิกรอบเก่าอัตโนมัติเมื่อมี push ใหม่เข้า branch เดียวกัน เพื่อไม่เสียเวลา CI
- ไม่มี Secret ถูกส่งเข้า Workflow เลย ใช้เพียงค่า placeholder ที่เป็น public ตอน build

**สถานะการตรวจสอบ**

Workflow ทำงานจริงแล้วและผ่าน — ดู [รอบการรันล่าสุด](https://github.com/PalaponB/supabase/actions) บน GitHub Actions

| รอบ | commit | ผลลัพธ์ |
| --- | --- | --- |
| [`36586154300`](https://github.com/PalaponB/supabase/actions/runs/36586154300) | `34b1862` | ✅ **success** |

ทั้งสามขั้นตอนผ่านทั้งบนเครื่อง (`npm ci` → 442 packages, `npm run lint` → ไม่มี warning, `npm run build` → สำเร็จ 15 routes) และบน runner ของ GitHub

---

## 6. รายละเอียดการใช้ AI ในการพัฒนา

### 6.1 ขอบเขตและหลักการ

โครงการนี้พัฒนาแบบ **AI-assisted** คือใช้ AI (โมเดลภาษา) ช่วยร่างโค้ด เสนอแนวทาง และตรวจทบทวน โดยมีหลักการสำคัญ 3 ข้อ

1. **การตัดสินใจเชิงสถาปัตยกรรมเป็นหน้าที่ของผู้พัฒนา** — เช่น การเลือกใช้ composite foreign key, การออกแบบสิทธิ์รายบทบาท และการเพิ่ม `Insufficient Data` เป็นสาเหตุที่สาม AI ให้เหตุผลประกอบ แต่ผู้พัฒนาเป็นผู้ตัดสินว่าจะรับหรือไม่
2. **ผลลัพธ์จาก AI ต้องผ่านการตรวจสอบเสมอ** — ไม่ว่าจะเป็นการรัน `npm run typecheck`, `npm run lint`, `npm run build` และชุดทดสอบตรรกะ
3. **AI ถูกใช้ในฐานะ "ผู้ช่วย" ไม่ใช่ "ผู้ตัดสิน"** — เมื่อ AI เสนอแนวทางที่ขัดกับข้อกำหนดของโจทย์ หรือสร้างบั๊ก ผู้พัฒนาต้องเป็นผู้แก้

### 6.2 สรุปการใช้ AI แยกตามขั้นตอน

| ขั้นตอน | สิ่งที่ AI ช่วย | สิ่งที่ผู้พัฒนาตรวจ/ตัดสิน |
| --- | --- | --- |
| **วิเคราะห์ Requirement** | แตกข้อกำหนดเป็นงานย่อย, ชี้จุดที่ข้อกำหนดกำกวม | **เทียบกับเอกสารของอาจารย์ทุกครั้ง** — จุดนี้สำคัญที่สุด เพราะพบว่าสถานะเครื่องที่ระบบใช้เดิมไม่ตรงกับที่กำหนด (หัวข้อ 6.3 ข้อ 7) |
| **ออกแบบฐานข้อมูล** | ร่าง DDL, constraint, CHECK ของค่าที่วัดได้, กลยุทธ์ Composite FK, ฟังก์ชันช่วยตรวจบทบาท | ตัดสินใจว่าจะบังคับ (alarm_id, machine_id) ต้องเป็นคู่เดียวกัน, ค่า null ≠ ค่า 0, เขียน migration แบบ idempotent |
| **เขียน SQL** | ร่าง RLS policy, view สำหรับกราฟ, seed data, migration เปลี่ยนสถานะ | ตรวจว่า policy ตรงกับสิทธิ์ใน `lib/permissions.ts` ทุกจุด และจับการ drift ระหว่างไฟล์ |
| **เขียน Source Code** | สร้างหน้า, component, server action, API route, lib ต่าง ๆ | ตรวจด้วย typecheck / lint / build และอ่านโค้ดกลับทุกส่วน |
| **สร้าง UI/UX** | ฟอร์ม, ตาราง, ตัวกรอง, Modal, กราฟ, Dark mode | ปรับ UX ให้ตรงกับผู้ใช้ไทย และตรวจว่าปุ่มที่ซ่อนไปสอดคล้องกับสิทธิ์จริง |
| **เขียน CI Workflow** | ร่าง `.github/workflows/ci.yml` | ทดสอบทุกขั้นตอนจริง (`npm ci` / `build` / `lint`) และตรวจว่าไม่มี secret ถูกฝังใน workflow |
| **Debugging** | ช่วยวิเคราะห์บั๊ก เสนอแนวทางแก้ และเขียนชุดทดสอบ | **ตรวจสอบบั๊กที่ AI พลาด** (ดูหัวข้อ 6.3) |
| **สร้าง Test** | เขียนชุดทดสอบตรรกะ, เทสต์ edge case, สคริปต์ตรวจ README | ตรวจว่าเทสต์ "ผ่าน" จริง ไม่ใช่ผ่านเพราะเงื่อนไขผิด — เจอกรณีนี้จริงในหัวข้อ 6.3 ข้อ 8 |
| **ปรับปรุง / Refactor** | จัดโครงสร้างโค้ด, ตั้งชื่อ, เขียนคอมเมนต์อธิบายเหตุผล | ตรวจว่าการ refactor ไม่ทำให้พฤติกรรมเดิมเปลี่ยน |
| **ทำเอกสาร** | ร่าง README และรายงานการใช้ AI | **เทียบทุกข้อความกับโค้ดจริง** และห้ามอ้างสิ่งที่ยังไม่ได้ทำ เช่น ห้ามเขียนว่า deploy แล้ว |
| **In-App AI Analyzer** | ออกแบบสัญญาข้อมูล (JSON Schema), เขียน prompt, ตัวตรวจผลลัพธ์, กลไก retry และ rate limit | กำหนดหมวดสาเหตุ, ตัดสินใจเพิ่ม `Insufficient Data`, ตรวจว่าไม่รั่วคีย์และไม่ส่งข้อมูลเกินจำเป็น |

### 6.3 ตัวอย่างบั๊กที่พบระหว่างพัฒนา — AI ช่วยระบุได้ แต่ต้องให้คนตรวจซ้ำ

การทดสอบซ้ำ ๆ เป็นสิ่งที่พิสูจน์ว่าการตรวจงาน AI ยังจำเป็น บั๊กเหล่านี้ **ผ่านการรันโค้ดแล้วยังไม่พัง** ถ้าไม่ได้เขียนชุดทดสอบกรณีเฉพาะขึ้นมา

**1. บั๊กเขตเวลาในไฟล์ CSV — ร้ายแรงที่สุด**

โค้ดรุ่นแรกใช้ `date.getHours()` และ `date.getDate()` ซึ่งอ่านเวลาตาม**เขตเวลาของเครื่อง** แต่กลับเขียนป้ายกำกับด้วย **offset ของผู้ใช้** ผลคือบนคอมพิวเตอร์ที่ตั้งเขตเวลาเป็น UTC เวลาทุกแถวจะคลาดไป 7 ชั่วโมง แต่ยังเขียนกำกับว่า `+07:00` ไว้

> แก้โดยเลื่อนเวลาตาม offset แล้วอ่านด้วย `getUTC*()` ซึ่งไม่ขึ้นกับเครื่อง — เพิ่มเทสต์ยืนยันกรณี `+07:00`, `-04:00`, `+05:30` และกรณีข้ามเที่ยงคืน

**2. บั๊กการเรียงลำดับข้อมูลผิด**

ฟังก์ชันแปลงวันที่คืนค่า `+Infinity` เมื่อพบวันที่ผิดรูปแบบ แต่หน้ารายการเรียงจากใหม่ไปเก่า (descending) ค่าที่ใหญ่ที่สุดจึงไปอยู่**หน้าสุด** ผิดตรงกันข้าม นอกจากนี้ค่า `Infinity` ที่ไหลไปถึง `new Date().toISOString()` จะทำให้ **หน้าเว็บล่มทั้งหน้า**

> แก้เป็นค่าต่ำสุดแทน และกรองค่าที่ไม่ใช่ตัวเลขออกก่อนคำนวณสถิติ

**3. บั๊ก "ซ่อมล่าสุด" แสดงผลผิดวัน**

ใช้ `Math.min()` แทน `Math.max()` ทำให้หน้าประวัติเครื่องแสดง "ซ่อมเสร็จล่าสุด" เป็นงานซ่อม**เก่าสุด** แทนใหม่สุด

**4. บั๊กสิทธิ์ด้าน UX**

ปุ่มแก้ไขในหน้างานซ่อมบำรุงเดิมแสดงบนแถวของช่างทุกคน ทำให้ช่างกดแล้วถูกฐานข้อมูลปฏิเสธ แก้โดยซ่อนปุ่มบนแถวที่ไม่ใช่ของตัวเอง (ตรงกับนโยบาย `technician_id = auth.uid()`)

**5. บั๊กความปลอดภัยของไฟล์ CSV**

การส่งออก CSV จากข้อความอิสระที่พนักงานพิมพ์เอง เสี่ยง **CSV formula injection** (CWE-1236) — ถ้าค่าขึ้นต้นด้วย `=`, `+`, `-`, `@` โปรแกรม Excel จะถือเป็นสูตรและรันคำสั่งได้ เช่น ชื่อสถานี `=cmd|'/C calc'!A0`

> แก้ด้วยการขึ้นต้นด้วยเครื่องหมาย `'` เมื่อพบอักขระเหล่านั้น พร้อมเขียนเทสต์ครอบคลุม payload หลายรูปแบบ

**6. DDL ไม่ตรงกับไฟล์ RLS**

`ev_chargeops_ddl.sql` กับ `02_rls.sql` เกิดการ drift (policy ไม่ตรงกัน) เมื่อแก้ฝั่งหนึ่งแล้วลืมอีกฝั่ง

> แก้โดยถือ `02_rls.sql` เป็นตัวกำหนดจริง และเขียนสคริปต์เทียบ policy ทั้ง 15 รายการเพื่อจับการ drift

**7. สถานะเครื่องจักรไม่ตรงกับข้อกำหนดของโจทย์ — สำคัญที่สุด**

ระบบเดิมใช้สถานะ `Available` / `Charging` / `Fault` / `Under Service` ซึ่งเป็นคำที่เหมาะกับตู้ชาร์จ แต่**ข้อกำหนดของอาจารย์ระบุชัดเจนว่า `Running`, `Stop`, `Alarm`, `Maintenance`** การเขียนระบบให้สมบูรณ์โดยไม่ได้เทียบกับเอกสารข้อกำหนด จึงทำให้คะแนน Functional Requirements และ Dashboard หายไปโดยไม่รู้ตัว

> แก้ครบทั้งชั้น: `CHECK` constraint ใน `01_schema.sql`, TypeScript type, ป้ายภาษาไทย, สีบนกราฟ, ค่าเริ่มต้นในฟอร์ม, seed data, การ์ดสรุปบน Dashboard และเพิ่มการ์ดสถานะทั้ง 4 ใบโดยเฉพาะ พร้อมเขียน `06_machine_status_migration.sql` แปลงค่าของฐานข้อมูลเดิมแบบไม่สูญเสียข้อมูล

**8. สคริปต์ตรวจ README รายงาน "ผ่าน" ทั้งที่ตัวตรวจเองผิด**

สคริปต์ที่ใช้ตรวจ README อ้างว่าไฟล์ในผังโครงสร้างและ route ต่าง ๆ มีอยู่จริง แต่ regex ของมันจับได้แค่ชื่อไฟล์ ไม่ใช่พาธเต็ม และตรวจ API route ผิดไฟล์ รวมถึงตัดสระไทยออกจาก anchor ทำให้ลิงก์ที่ถูกต้องถูกรายงานว่าเสีย

> แก้ตัวตรวจเองทั้ง 4 จุด (แยก path ตามระดับการเยื้อง, ตรวจ API route กับ filesystem, ตรวจข้อความโดยตรงแทนการเดาผ่าน regex, เก็บอักขระประสมไทยใน slug) แล้วรันซ้ำจนได้ 109 ข้อผ่านจริง — บั๊กนี้อยู่ในเครื่องมือตรวจ ไม่ใช่ในตัวระบบ แต่ถ้าไม่สังเกตก็จะเข้าใจผิดว่า README ถูกต้อง

> **ข้อสังเกต:** บั๊กข้อ 7 และ 8 ไม่ใช่บั๊กที่ `typecheck`, `lint` หรือ `build` จับได้ ทั้งคู่ต้องใช้การอ่านเทียบกับเอกสารข้อกำหนด และการไม่เชื่อผลรายงานของเครื่องมือ

### 6.4 In-App AI Analyzer — การออกแบบที่คำนึงถึงความปลอดภัย

การเรียก AI ในตัวระบบเป็นส่วนหนึ่งของโครงการโดยตรง (ดูหัวข้อ 2.1 G) สถาปัตยกรรมที่ใช้:

```
ผู้ใช้กดปุ่ม
   │  ส่งเพียง alarm id  (ไม่ส่งข้อความใด ๆ)
   ▼
POST /api/ai-analyze
   ├─ ตรวจ session และสิทธิ์ useAiAnalysis
   ├─ อ่านข้อมูล Alarm จากฐานข้อมูลเอง ผ่าน session ของผู้เรียก
   ├─ จำกัดอัตราการเรียก 10 ครั้ง/ผู้ใช้/นาที
   ▼
OpenAI API  (response_format: json_schema, strict)
   ▼
parseAiAnalysis()  ── ไม่ผ่าน ──▶ ลองใหม่ 1 ครั้ง ──▶ ตอบ error
   │ ผ่าน
   ▼
ส่งผลกลับหน้าจอ
```

**หลักการสำคัญ**

- **client ส่งแค่ id ไม่ส่งข้อความ** — ข้อความใน prompt มาจากฐานข้อมูลเสมอ ผู้ใช้จึงส่ง prompt เองไม่ได้ และวิเคราะห์ Alarm ที่ตัวเองไม่มีสิทธิ์ดูไม่ได้ เพราะ RLS คุมการอ่าน
- **ป้องกัน prompt injection** — Description เป็นข้อความอิสระที่พนักงานพิมพ์เอง จึงถูกปิดไว้ใน `<alarm_code>...</alarm_code>` และสั่งใน system prompt ให้ถือเป็น "ข้อมูล" ไม่ใช่คำสั่ง
- **ไม่เชื่อผลจากโมเดล** — ตรวจทุกฟิลด์: ปฏิเสธสาเหตุที่ไม่อยู่ใน enum, clamp คะแนนเข้า 0-100, ตัดข้อความยาวเกิน, ตัดขั้นตอนซ้ำ และ **ปฏิเสธทั้งรายการ** ถ้า checklist เหลือน้อยกว่า 3 ข้อ
- **คีย์อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น** — `OPENAI_API_KEY` ไม่มี prefix `NEXT_PUBLIC_` อ่านที่ route handler เท่านั้น และไม่มี `dangerouslySetInnerHTML` ใน modal เพราะฉะนั้นผลจากโมเดลถูกเรนเดอร์เป็น text เสมอ
- **ตั้ง `Cache-Control: no-store`** — ผลเป็นการวิเคราะห์ของ Alarm ตัวนั้น ณ เวลานั้น ไม่ควรถูก cache

### 6.5 ข้อจำกัดของการใช้ AI

- ผลลัพธ์เป็น **ข้อเสนอแนะจากโมเดล ไม่ใช่การยืนยันสาเหตุ** หน้าจอแสดงคำเตือนนี้ชัดเจน และ checklist บังคับให้ข้อแรกเป็นการทำความปลอดภัย (ตัดไฟ/ยืนยันว่าไม่มีไฟ) เพราะตู้ชาร์จมีแรงดันสูงและตัวเก็บประจุ
- ตัวจำกัดอัตราการเรียกเก็บในหน่วยความจำของ process จึงนับแยกตาม instance ซึ่งเหมาะกับการกัน loop ค้าง แต่ยังไม่ใช่ตัวควบคุมค่าใช้จ่ายจริง
- การเรียก OpenAI คือการส่งข้อมูลของลูกค้า (รหัสเครื่อง, รายละเอียดอาการ, ค่าที่วัดได้) ออกนอกระบบ ต้องพิจารณานโยบายข้อมูลก่อนใช้งานจริง
- ผลการวิเคราะห์ยังไม่ถูกบันทึกลงฐานข้อมูล — ปิด Modal แล้วผลหายไป

---

## 7. สิทธิ์รายบทบาท

| ความสามารถ | Admin | Engineer | Technician | Viewer |
| --- | :---: | :---: | :---: | :---: |
| ดูข้อมูลทั้งหมด | ✓ | ✓ | ✓ | ✓ |
| ดูประวัติเครื่องจักร | ✓ | ✓ | ✓ | ✓ |
| ส่งออกรายงาน CSV | ✓ | ✓ | ✓ | ✓ |
| CRUD เครื่องจักร | ✓ | — | — | — |
| เปิด Alarm ใหม่ | ✓ | — | — | — |
| แก้ไขรายละเอียด Alarm (เครื่อง/รหัส/สาเหตุ) | ✓ | ✓ | — | — |
| เปลี่ยนสถานะ Alarm | ✓ | — | ✓ | — |
| ลบ Alarm | ✓ | — | — | — |
| สร้างงานซ่อมบำรุง | ✓ | — | ✓ | — |
| แก้ไขงานซ่อมบำรุง | ทุกรายการ | — | เฉพาะของตัวเอง | — |
| ลบงานซ่อมบำรุง | ✓ | — | — | — |
| วิเคราะห์สาเหตุด้วย AI | ✓ | ✓ | ✓ | — |
| เปลี่ยนบทบาทสมาชิก | ✓ | — | — | — |

> เหตุผลที่ **การอ่านข้อมูลและส่งออก CSV เปิดให้ทุกบทบาท** — เพราะเป็นการดูข้อมูลที่ผู้ใช้เห็นอยู่บนหน้าจออยู่แล้ว การซ่อนเฉพาะหน้าแต่ยังส่งออกได้จะไม่เพิ่มความปลอดภัย และการซ่อนทั้งสองอย่างจะทำให้ผู้ที่ต้องการรายงานกลับทำงานไม่ได้
>
> เหตุผลที่ **เครื่องจักรเป็น Admin เท่านั้นที่เขียนได้** — เป็นข้อมูลการตั้งค่าระบบ ไม่ใช่สถานะการปฏิบัติงาน ช่างรายงานอาการเสียและลงมือซ่อม แต่ไม่ย้ายชื่อสถานีหรือเปลี่ยนอุปกรณ์
>
> เหตุผลที่ **แยก Engineer ออกจาก Technician** — ทั้งคู่เป็นคนที่ไม่ได้อยู่ฝั่งบริหาร แต่ทำงานคนละช่วงของวงจรซ่อม: ช่างเป็นคน**ลงมือ** (เปลี่ยนสถานะ Alarm, บันทึกงานที่ทำ) ส่วนวิศวกรเป็นคน**หาสาเหตุ** (บันทึกเหตุและรายละเอียดลง Alarm, ใช้ AI ช่วยวินิจฉัย) ถ้ายุบเป็นบทบาทเดียว ผู้ที่อ่าน Alarm อย่างเดียวเพื่อวิเคราะห์เชิงลึกจะถูกบังคับให้มีสิทธิ์ซ่อมและบันทึกงานด้วย ซึ่งแยกหน้าที่ไม่ได้
>
> บันทึกไว้ตรง ๆ: `useAiAnalysis` เป็นการ**กันปุ่ม** ไม่ใช่การกันความปลอดภัยจริง เพราะ RLS ไม่มี policy ที่เกี่ยวกับมัน แต่ route handler ตรวจสิทธิ์ก่อน แล้วอ่าน Alarm ผ่าน session ของผู้เรียกเอง ตัวจำกัดที่แท้จริงคือ rate limit ที่กันไม่ให้ยิง OpenAI ทีละมาก

---

## 8. ชั้นความปลอดภัย

### 8.1 การตรวจสิทธิ์ 3 ชั้น

โค้ดตรวจสิทธิ์ซ้ำกัน 3 จุด โดยแต่ละชั้นมีหน้าที่ต่างกัน

| ชั้น | กลไก | หน้าที่ |
| --- | --- | --- |
| 1 | **UI** — `lib/permissions.ts` | ซ่อนปุ่มที่กดไม่ได้ เพื่อไม่ให้ผู้ใช้เห็นสิ่งที่จะถูกปฏิเสธ **เป็นชั้นความสะดวกสบาย ไม่ใช่ความปลอดภัย** |
| 2 | **Server** — `requirePermission()` | ทุก server action ตรวจสิทธิ์ก่อนแตะข้อมูลเสมอ |
| 3 | **ฐานข้อมูล** — RLS policies | **ชั้นที่บังคับใช้จริง** |

ชั้นที่ 3 สำคัญที่สุด เพราะ anon key เปิดเผยต่อสาธารณะ ผู้ใช้ที่แก้โค้ดหน้าเว็บ หรือยิง REST API ตรง ๆ ก็ถูก RLS ปฏิเสธเหมือนกัน

### 8.2 การป้องกัน CSV Injection (CWE-1236)

เมื่อส่งออก CSV จากข้อมูลที่พนักงานพิมพ์เอง มีความเสี่ยงที่ค่าในเซลล์จะถูกโปรแกรมสเปรดชีตตีความเป็น**สูตร** เช่น

| ค่าที่กรอก | ผลถ้าไม่ป้องกัน |
| --- | --- |
| `=1+1` | แสดงผลลัพธ์การคำนวณ |
| `=HYPERLINK("http://site","คลิก")` | ลิงก์ที่ผู้อ่านเชื่อถือ |
| `=cmd\|'/C calc'!A0` | อาจรันคำสั่งในบางเวอร์ชัน |
| `+1-(-1+2)` | สูตรที่ซ่อนตัว |

**วิธีป้องกันที่ใช้:** เติมเครื่องหมาย `'` นำหน้าเมื่อค่าขึ้นต้นด้วย `=`, `+`, `-`, `@`, tab หรือ CR (รวมถึงกรณีมีช่องว่างนำหน้า) โปรแกรมสเปรดชีตจะเก็บเป็นข้อความและไม่ประเมิน ขณะที่ตรวจสอบว่า:

- ข้อมูลอ้างอิงและค่าตัวเลข **ไม่** ถูกแก้ไข (ให้ส่งผ่านเป็นตัวเลขโดยตรง)
- ค่าที่เป็น null แสดงเป็นช่องว่าง ไม่ใช่คำว่า `null`
- ช่องที่มีเครื่องหมายจุลภาค เชิลล์ หรือขึ้นบรรทัดใหม่ ถูกครอบด้วยเครื่องหมายคำพูดตามมาตรฐาน RFC 4180
- ไฟล์มี UTF-8 BOM ทำให้ภาษาไทยแสดงผลถูกต้องเมื่อเปิดด้วย Excel

### 8.3 จุดที่ต้องระวังเป็นพิเศษ

- `createMaintenance()` ดึง `technician_id` จาก session เสมอ ไม่รับค่าจากฟอร์ม มิฉะนั้นช่างที่ส่ง `technician_id` ของคนอื่นมาจะผ่านเงื่อนไขใน RLS และแก้ไขงานของคนอื่นได้
- บทบาทอ่านจากตาราง `profiles` ทุก request ไม่ใช่จาก token และไม่ใช่จากค่าที่ผู้ใช้ส่งมา ผู้ใช้จึงปลอมเป็น Admin เองไม่ได้ และการลดสิทธิ์มีผลทันที
- `public.login()` ตอบเหมือนกันหมดทั้งชื่อผู้ใช้ผิดและรหัสผ่านผิด และเสียเวลาประมาณเท่ากัน เพื่อไม่ให้ตรวจสอบได้ว่าชื่อผู้ใช้ใดมีอยู่จริง
- `password_hash` เป็น bcrypt และ `SELECT` ถูก revoke ออกจาก `anon` และ `authenticated` แม้ผู้ล็อกอินแล้วก็อ่านออกมาไม่ได้
- cookie session เป็น `httpOnly` ทำให้ JavaScript บนหน้าเว็บอ่านไม่ได้ จึงติด XSS ไม่ได้ และ middleware ตรวจลายเซ็นก่อนเข้าถึงเส้นทาง
- `logout()` เป็น POST ผ่าน server action ไม่ใช่ลิงก์ GET เพราะ GET สามารถถูกเรียกจากเว็บอื่นด้วย `<img>` ได้
- ค่าจาก URL ทุกตัวถูก validate ก่อนนำไปต่อกับ PostgREST ป้องกัน SQL/LIKE injection
- เมื่อแก้สิทธิ์ใน `lib/permissions.ts` ให้แก้ `02_rls.sql` ให้ตรงกันเสมอ โดยถือว่า `02_rls.sql` เป็นตัวกำหนดจริง

### 8.4 ข้อจำกัดด้านความปลอดภัยที่ทราบแล้ว

> **RLS จำกัดได้ระดับแถว ไม่ได้ระดับคอลัมน์** — `alarms_update` เปิดให้ช่างและวิศวกรอัปเดตได้ทั้งแถว เพราะต้องทำได้ทั้งการเปลี่ยนสถานะ (ช่าง) และการบันทึกสาเหตุ (วิศวกร) ผลคือทั้งสองบทบาทที่ยิง REST API ตรง ๆ (ไม่ผ่าน UI) อาจแก้คอลัมน์ที่ไม่ควรแตะได้ด้วย เช่น ช่างแก้ `cause` หรือวิศวกรเปลี่ยน `status` การจำกัดให้แน่นอนต้องใช้ trigger ที่ตรวจคอลัมน์ ซึ่งยังไม่ได้ทำ — เป็นข้อจำกัดที่บันทึกไว้อย่างตั้งใจ
>
> **RLS บอกได้แค่ว่า "เขียน Alarm ได้" แต่บอกไม่ได้ว่า "เขียนเพื่ออะไร"** — นี่คือเหตุผลที่ `editAlarmDetails` กับ `manageAlarms` ถูกแยกเป็นสองสิทธิ์ใน `lib/permissions.ts` policy เดียวคุมทั้งสองบทบาท แยกได้แค่ฝั่ง UI ซึ่งก็คือจุดที่ `requirePermission()` บังคับก่อนถึง server action
>
> **`useAiAnalysis` ไม่มี RLS รองรับ** — เป็นการอนุญาตให้เรียก OpenAI ซึ่งคิดค่าใช้จ่าย ตัวคุมจริงคือ rate limit ใน route handler ไม่ใช่ policy ฝั่งฐานข้อมูล
>
> **`REVOKE SELECT` ต้องอาศัยการไม่ใช้ `select *`** — RLS คุมระดับแถวเท่านั้น จึงไม่สามารถซ่อนคอลัมน์ `password_hash` ของ `profiles` ด้วย policy ทุก query จึงต้องระบุชื่อคอลัมน์ที่ต้องการเสมอ ถ้าเขียน `select *` คอลัมน์ที่ถูก revoke จะถูกตัดออกจากผลลัพธ์ (ไม่ใช่ error) ซึ่งทำให้โค้ดที่คาดหวังว่าจะได้ hash เงียบ ๆ แทนที่จะล้ม — ระบบนี้ไม่มีโค้ดที่อ่าน hash และมี `99_verify_setup.sql` ข้อ 12 เป็นตัวตรวจ
>
> **ยังไม่มี rate limit หรือ lockout** — `public.login()` ถูกเปิดให้ `anon` เรียกได้ การเดารหัสผ่านถูกชะลอด้วย bcrypt ซึ่งตั้งใจให้ช้า (ไม่กี่ครั้งต่อวินาทีต่อ worker) แต่การใช้งานจริงควรมี rate limit ที่ reverse proxy หรือตารางนับความล้มเหลวต่อบัญชี
>
> **`SUPABASE_JWT_SECRET` คือจุดเดียวที่ระบบทั้งหมดพึ่ง** — ถ้าค่านี้รั่ว ผู้ที่ได้ค่าไปสามารถเซ็น token ที่ `role` = `authenticated` และ `sub` = uuid ของ Admin ได้ ซึ่ง RLS จะผ่านให้เต็มที่ การหมุนค่านี้จึงต้องทำพร้อมกับการ redeploy เพื่อให้ session เดิมหมดอายุพร้อมกัน
>
> **session อายุ 8 ชั่วโมงและยังไม่มีการต่ออายุ** — ยืนยันครั้งเดียวต่อกระบวนการ login ไม่มี refresh token ผู้ใช้ต้องกรอกใหม่เมื่อหมดอายุ ซึ่งตั้งใจเพื่อความเรียบง่าย แต่ถ้าต้องการ UX ที่ดีกว่านี้ควรเพิ่มการต่ออายุ token

---

## 9. โครงสร้างไฟล์

```
.ev-chargeops/
├── .github/
│   └── workflows/
│       └── ci.yml                    GitHub Actions (lint + build)
├── .env.example                      ตัวอย่างค่า environment variable
├── middleware.ts                     ป้องกันเส้นทางด้วยการตรวจลายเซ็น session
├── lib/
│   ├── auth.ts                       getUser, getProfile, requireUser, requirePermission
│   ├── session.ts                    เซ็น/ตรวจ HS256 JWT ด้วย SUPABASE_JWT_SECRET และกำหนด cookie
│   ├── permissions.ts                ตารางสิทธิ์รายบทบาท (ชั้น UX เท่านั้น)
│   ├── validation.ts                 ตรวจฟอร์ม + ActionState ที่ทุก server action คืน
│   ├── filters.ts                    อ่าน/ตรวจ query string, escape LIKE, ช่วงวันที่ตามเขตเวลา
│   ├── options.ts                    ตัวเลือกของ dropdown (เครื่องจักร, Alarm)
│   ├── constants.ts                  ค่าคงที่สถานะและป้ายภาษาไทย
│   ├── format.ts                     จัดรูปแบบวันที่และ CSS class
│   ├── csv.ts                        สร้าง CSV: escaping, ป้องกัน formula injection, UTF-8 BOM
│   ├── history.ts                    รวม Alarm + งานซ่อมเป็น timeline
│   ├── ai.ts                         สัญญาผลวิเคราะห์, JSON schema, prompt, ตัวตรวจผล
│   ├── dashboard.ts                  สีสถานะ, การจัดรูปแบบตัวเลข
│   └── supabase/
│       ├── server.ts                 Server client ที่แนบ session token ผ่าน accessToken
│       ├── config-error.ts           หน้าแจ้งว่าตั้ง env ไม่ครบ
│       └── types.ts                  Database type ที่ตรงกับ 01_schema.sql
├── middleware.ts                     ตรวจลายเซ็น cookie ก่อนเข้าถึงเส้นทาง
├── app/
│   ├── (app)/                        route group: หน้าที่ต้องล็อกอินทั้งหมด
│   │   ├── layout.tsx                ใส่ AppShell (auth guard + เมนู) จุดเดียว
│   │   ├── dashboard/                ภาพรวม + สมาชิก + redirect จาก URL เก่า
│   │   ├── machines/
│   │   │   ├── page.tsx              เครื่องจักร
│   │   │   └── [machineId]/
│   │   │       ├── page.tsx          ประวัติเครื่องจักร
│   │   │       └── not-found.tsx     แจ้งว่าไม่พบรหัสเครื่อง
│   │   ├── alarms/page.tsx           Alarm
│   │   └── maintenance/page.tsx      งานซ่อมบำรุง
│   ├── machines/actions.ts           server actions
│   ├── alarms/actions.ts
│   ├── maintenance/actions.ts
│   ├── api/ai-analyze/route.ts       POST วิเคราะห์ Alarm ด้วย AI
│   ├── login/                        หน้าเข้าสู่ระบบ + server actions
│   ├── unauthorized/                 หน้าแจ้งว่าไม่มีสิทธิ์
│   └── (ไม่มีโฟลเดอร์ auth/callback — ระบบนี้ไม่ใช้ OAuth หรือ magic link)
├── components/
│   ├── csv/ExportCsvButton.tsx       ปุ่มส่งออก CSV (Alarm / งานซ่อม)
│   ├── machines/MachineHistoryTimeline.tsx   การ์ดสรุป + timeline
│   ├── machines/                     ฟอร์ม ตาราง และตัวกรองเครื่องจักร
│   ├── alarms/                       ฟอร์ม ตาราง และตัวกรอง Alarm
│   ├── maintenance/                  ฟอร์ม ตาราง และตัวกรองงานซ่อมบำรุง
│   ├── ai/                           Modal ผลวิเคราะห์ + ปุ่มเรียกใช้
│   ├── filter/                       FilterShell, FilterFields
│   ├── ui/                           Field, StatusBadge, SubmitButton, Toaster
│   ├── shell/                        AppShell, AppNav
│   ├── theme/                        ThemeScript, ThemeToggle
│   └── dashboard/                    KpiCard, กราฟ, ตาราง Alarm ล่าสุด
├── 01_schema.sql                     ตาราง, constraint, public.login() และฟังก์ชันช่วยดูบทบาท
├── 02_rls.sql                        Row Level Security policies (15 รายการ) และสิทธิ์ระดับคอลัมน์
├── 03a_users.sql                     บัญชีทดลอง 4 บัญชี (username + bcrypt)
├── 03b1_machines.sql                 ข้อมูลตู้ชาร์จ
├── 03b2_alarms.sql                   ข้อมูล Alarm
├── 03b3_logs.sql                     ข้อมูลงานซ่อมบำรุง
├── 04_dashboard_views.sql            View สำหรับกราฟ
├── 05_alarm_telemetry.sql            คอลัมน์ค่าที่วัดได้
├── 06_machine_status_migration.sql   เปลี่ยนสถานะเครื่องเป็นชุดใหม่ (ฐานข้อมูลเวอร์ชันเก่า)
├── 07_custom_auth.sql                แปลงฐานข้อมูลเดิมจาก Supabase Auth (ฐานข้อมูลเวอร์ชันเก่า)
├── 08_engineer_role.sql              เพิ่มบทบาท Engineer (ฐานข้อมูลเวอร์ชันเก่า)
├── 99_verify_setup.sql               ตรวจผลการติดตั้ง (read-only)
├── ev_chargeops_ddl.sql              ไฟล์รวมทุกอย่าง
├── package.json
├── AI_USAGE_REPORT.md                 รายงานสั้นการใช้ AI ในการพัฒนา
└── README.md
```

---

## 10. ข้อจำกัดและงานต่อเนื่อง

### 10.1 ข้อจำกัดที่ทราบแล้ว

| ข้อจำกัด | รายละเอียด | แนวทางแก้ |
| --- | --- | --- |
| RLS ระดับคอลัมน์ | ช่างที่ยิง API ตรงอาจแก้ `description`/`cause` ของ Alarm ได้ | เพิ่ม trigger ที่ตรวจคอลัมน์ที่เปลี่ยน |
| ผลการวิเคราะห์ AI ไม่ถูกเก็บ | ปิด Modal แล้วผลหายไป | เพิ่มตาราง `alarm_analyses` |
| ตัวจำกัดอัตราการเรียกอยู่ในหน่วยความจำ | นับแยกตาม instance ของ server | เปลี่ยนเป็น store กลาง (Upstash Redis) เมื่อใช้งานจริง |
| ข้อมูลส่งออกไปยัง OpenAI | เป็นการส่งข้อมูลลูกค้าออกนอกระบบ | ต้องพิจารณานโยบายข้อมูลก่อนใช้งานจริง |
| ช่องโหว่ใน dependency | `npm audit` พบช่องโหว่ใน `next@14.2.35` และ `postcss` ที่ยังไม่มีแพตช์ในสาย 14.x | วางแผนอัปเกรดเป็น Next.js เวอร์ชันใหม่ |

**รายละเอียดช่องโหว่ที่พบ**

- *Next.js Image Optimization RCE เมื่อประมวลผลไฟล์ AVIF* — โปรเจกต์นี้ไม่ได้ใช้ `next/image` กับไฟล์ภายนอก จึงยังไม่กระทบ
- *postcss XSS และ path traversal ผ่าน `sourceMappingURL`* — กระทบตอน build เท่านั้น ไม่กระทบ production runtime

### 10.2 แนวทางพัฒนาต่อ

- เชื่อมกับ OCPP เพื่อรับ Alarm และค่าที่วัดได้จากตู้ชาร์จโดยอัตโนมัติ
- เก็บประวัติการวิเคราะห์ AI และเปรียบเทียบความแม่นยำกับผลจริง
- แจ้งเตือนผ่าน LINE Notify เมื่อมี Alarm ระดับ Critical
- เพิ่มการแบ่งหน้า (pagination) เมื่อข้อมูลมีจำนวนมากขึ้น
- ทดสอบอัตโนมัติด้วย Vitest / Playwright ให้ครบทุกเส้นทาง

---

## 11. ตารางเทียบข้อกำหนดกับสิ่งที่ระบบทำ

ตารางนี้แสดงว่าข้อกำหนดแต่ละข้อถูกทำครบ และอยู่ที่ไหนในโค้ด

| ข้อกำหนด | สถานะ | ตำแหน่งในระบบ |
| --- | --- | --- |
| 3.1 Login / Logout ผ่านระบบ Authentication ของโปรเจกต์เอง | ครบ | `/login`, `lib/session.ts`, `public.login()` |
| 3.1 Login ด้วย username + password | ครบ | `LoginForm.tsx` → `POST /rest/v1/rpc/login` |
| 3.1 ไม่มีข้อมูลผู้ใช้ใน Supabase Auth | ครบ | ไม่มีตารางใน schema `auth`, ไม่มี trigger `handle_new_user()`, ไม่มี `auth/callback` |
| 3.1 Logout | ครบ | `app/login/actions.ts` ลบ cookie (ยกเลิก session ฝั่งเซิร์ฟเวอร์ทันที ไม่ต้องรอหมดอายุ) |
| 3.1 อย่างน้อย 2 Role (Admin, Technician) | ครบ มี 4 | `profiles.role` = `Admin` / `Engineer` / `Technician` / `Viewer` |
| 3.1 Admin จัดการ Machine/Alarm/Maintenance | ครบ | `02_rls.sql` + `lib/permissions.ts` |
| 3.1 Technician ดูเครื่องจักร / บันทึก+แก้ Maintenance / เปลี่ยนสถานะ Alarm / ดู Dashboard | ครบ | policy เขียนแยกต่อบทบาทใน `02_rls.sql` |
| 3.1 Engineer วิเคราะห์เชิงลึก (บันทึกสาเหตุใน Alarm / ใช้ AI) โดยไม่ได้สิทธิ์ซ่อม | ครบ | `is_engineer()` ใน `alarms_update` เท่านั้น + `lib/permissions.ts` |
| 3.1 ควบคุมสิทธิ์ตาม Role | ครบ | RLS บังคับที่ฐานข้อมูล + ซ่อนปุ่มฝั่ง UI |
| 3.2 บันทึก Machine ID / Name / Type / Location / Status | ครบ | ตาราง `machines` |
| 3.2 สถานะ Running, Stop, Alarm, Maintenance | ครบ | `machines_status_check` ใน `01_schema.sql` |
| 3.2 Machine CRUD ครบ | ครบ | หน้า `/machines` + `app/machines/actions.ts` |
| 3.3 บันทึก Machine / Alarm Code / Description / เวลา / Cause / Status | ครบ | ตาราง `alarms` |
| 3.3 สถานะ Open, In Progress, Closed | ครบ | `alarms_status_check` |
| 3.3 Alarm Create / Read / Update | ครบ | หน้า `/alarms` |
| 3.4 Maintenance Create / Read / Update | ครบ | หน้า `/maintenance` |
| 3.5 ค้นหา/กรองอย่างน้อย 2 เงื่อนไข | ครบ มี 4–6 | `/machines` 4 · `/alarms` 5 · `/maintenance` 6 |
| 3.6 จำนวนเครื่องจักรทั้งหมด | ครบ | KPI ตู้ชาร์จทั้งหมด |
| 3.6 จำนวน Running / Stop / Alarm / Maintenance | ครบ | การ์ดสถานะ 4 ใบ + กราฟโดนัท |
| 3.6 จำนวน Alarm และงาน Maintenance | ครบ | KPI Active Alarms และ งานซ่อมที่ค้างอยู่ |
| 3.6 กราฟ/ข้อมูลสรุปเพิ่มเติม | ครบ | กราฟโดนัท, กราฟแท่ง Top 5 Alarm, ตาราง Alarm ล่าสุด |
| 3.7 ช่องสำคัญห้ามว่าง | ครบ | `lib/validation.ts` + `not null` ในฐานข้อมูล |
| 3.7 Machine ID ห้ามซ้ำ | ครบ | `machines_machine_id_key unique` + จับ error `23505` |
| 3.7 รูปแบบถูกต้องและกันค่าไม่เหมาะสม | ครบ | validate ทุกช่อง + CHECK constraint + escape LIKE |
| 3.7 แสดงข้อความแจ้งเตือน | ครบ | แสดง error ใต้ช่อง และ alert บนหน้า |
| 3.8 ใช้ Supabase เป็นฐานข้อมูล | ครบ | `@supabase/supabase-js` |
| 3.8 มีตาราง profiles, machines, alarms, maintenance_records | ครบ | `01_schema.sql` |
| 3.8 กำหนดความสัมพันธ์อย่างเหมาะสม | ครบ | ดูหัวข้อ 3 + ER diagram |
| 3.8 เก็บ Secret ใน Environment Variables ไม่ Commit | ครบ | `.env.local` ถูก `.gitignore` ตัดออก, มีแต่ `.env.example` |
| 3.8 ไม่เปิดเผย Service Role Key ฝั่ง Client | ครบ | ไม่มีการ import service role key ที่ใดเลย |
| 3.8 ไม่เปิดเผย Signing Secret ฝั่ง Client | ครบ | `SUPABASE_JWT_SECRET` ไม่มี prefix `NEXT_PUBLIC_` และอ่านจาก `lib/session.ts` เฉพาะ server |
| 3.9 เก็บ Source Code บน GitHub | ครบ | https://github.com/PalaponB/supabase |
| 3.9 มีประวัติ Commit ระหว่างพัฒนา | ครบ | 14 commits แยกตามฟีเจอร์ ไม่ได้ commit รวมทีเดียวเมื่อทำเสร็จ |
| 3.9 มี README | ครบ | ไฟล์นี้ |
| 3.10 มี GitHub Actions อย่างน้อย 1 Workflow | ครบ | `.github/workflows/ci.yml` |
| 3.10 ลำดับ Install → Build → Lint | ครบ | job `verify` เรียงตามลำดับ |
| 3.10 แสดงผล Passed/Failed ชัดเจน | ครบ | ตารางสรุปในหน้า run + ปุ่ม Fail — ยืนยันแล้วว่ารอบล่าสุดเป็น ✅ success |
| 3.11 Deploy ด้วย Vercel | ครบ | https://ev-chargeops-ten.vercel.app |
| 3.12 README ครบ 6 หัวข้อ | ครบ | หัวข้อ 1–6 |
| 4 รายละเอียดการใช้ AI | ครบ | หัวข้อ 6 + `AI_USAGE_REPORT.md` |

### คะแนนพิเศษที่ได้

| หัวข้อพิเศษ | สถานะ | อยู่ที่ |
| --- | --- | --- |
| เพิ่ม Role `Viewer` | ได้ | `lib/permissions.ts` + RLS |
| เพิ่ม Role `Engineer` | ได้ | `is_engineer()` + `editAlarmDetails` / `useAiAnalysis` |
| เพิ่มกราฟวิเคราะห์ Alarm | ได้ | Top 5 Alarm Codes + กราฟโดนัทสถานะ |
| เพิ่ม Machine History | ได้ | `/machines/[machineId]` |
| เพิ่ม Filter ขั้นสูง | ได้ | 4–6 เงื่อนไขต่อหน้า + ช่วงวันที่ตามเขตเวลาผู้ใช้ |
| Export CSV / Excel | ได้ | ปุ่มส่งออก CSV ทั้ง 2 หน้า |
| สถานะ `Waiting Part` | ได้ | `MAINTENANCE_STATUSES` |
| Responsive UI / Dark Mode | ได้ | Tailwind dark mode + responsive ทุกหน้า |
| Notification | ได้บางส่วน | Toast แจ้งผล แต่ยังไม่มี push/email |

> Audit Log และ Notification แบบส่งอัตโนมัติยังไม่ได้ทำ ถ้าเวลาเหลือควรเพิ่ม เพราะเป็นอีก 2 หัวข้อพิเศษ

---

## ผู้จัดทำ

| | |
| --- | --- |
| **ชื่อ** | ................................................ |
| **รหัสนักศึษา** | ................................................ |
| **อาจารย์ที่ปรึกษา** | ................................................ |
| **วิชา** | Programming in Automation Systems |
| **วันที่** | ................................................ |

---

## สรุปสาระสำคัญ

โครงการ **EV-ChargeOps** พัฒนาระบบจัดการตู้ชาร์จ EV ที่ตอบโจทย์สามข้อคือ ลดเวลาตัดสินใจของช่างด้วย AI ช่วยวิเคราะห์สาเหตุ, บันทึกประวัติการซ่อมให้ตามรอยได้ และควบคุมสิทธิ์การเข้าถึงข้อมูลอย่างเข้มงวด

จุดที่แสดงให้เห็นถึงความสามารถทางเทคนิคและการคิดเชิงวิศวกรรม ได้แก่

- **การออกแบบฐานข้อมูล** ที่ใช้ composite foreign key ป้องกันข้อมูลผิดคู่ตั้งแต่ระดับฐานข้อมูล
- **ความปลอดภัย 3 ชั้น** ที่ยึดหลักฐานข้อมูลเป็นตัวตัดสิน ไม่ใช่การซ่อนปุ่มบนหน้าจอ
- **การป้องกัน CSV injection** ซึ่งเป็นช่องโหว่ที่มักถูกมองข้ามในงานระบบรายงาน
- **การออกแบบ AI ที่ไม่เชื่อผลลัพธ์ของโมเดล** มีการตรวจสอบ schema และจำกัดการเรียกซ้ำ
- **การพัฒนาแบบ AI-assisted** ที่ผสมผสานการใช้ AI กับการตรวจสอบของมนุษย์ และบันทึกข้อผิดพลาดที่พบไว้เป็นหลักฐานของกระบวนการพัฒนา
