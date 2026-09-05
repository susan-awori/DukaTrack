# ⚡ Dukatrack — Delivery Coordination Platform

[![Angular](https://img.shields.io/badge/Angular-v22-dd0031.svg?style=flat&logo=angular)](https://angular.dev/)
[![NodeJS](https://img.shields.io/badge/Node.js-v24-339933.svg?style=flat&logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v4-000000.svg?style=flat&logo=express)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4-010101.svg?style=flat&logo=socketdotio)](https://socket.io/)
[![Prisma](https://img.shields.io/badge/Prisma-v5-2D3748.svg?style=flat&logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57.svg?style=flat&logo=sqlite)](https://www.sqlite.org/)

**Dukatrack** is a real-time, auditable delivery coordination MVP designed for Kenyan small-to-medium retailers (*Dukas*), central dispatchers, and delivery riders (*Boda Bodas*). 

Traditional delivery workflows in Kenya rely on unrecorded phone calls and WhatsApp messages — leading to lost orders, lack of status visibility, and zero proof of delivery. **Dukatrack** replaces this informal fragmentation with three role-based views connected to a single live, transactional delivery log.

---

## 🏗️ System Architecture

```text
                       +-----------------------------------+
                       |    Angular Frontend (Dukatrack)   |
                       |      (http://localhost:4200)      |
                       +-----------------+-----------------+
                                         |
                        HTTP / REST API  | WebSockets (Socket.io Rooms)
                                         v
                       +-----------------------------------+
                       |     Express Node Backend Server   |
                       |      (http://localhost:3000)      |
                       +-----------------+-----------------+
                                         |
                                    Prisma ORM
                                         v
                       +-----------------------------------+
                       |        SQLite Database            |
                       |         (backend/dev.db)          |
                       +-----------------------------------+
```

---

## 💡 Core Principles & Features

### 1. Immutable Proof-of-Delivery Audit Log
In standard delivery applications, status is merely a mutable column (e.g. `status = 'DELIVERED'`). In **Dukatrack**, every status change writes an immutable `StatusEvent` row inside the **exact same database transaction (`prisma.$transaction`)** as the status update. 

This guarantees an unalterable audit log documenting **WHEN**, **WHO**, and **HOW** (`manual_update` vs `qr_scan`) a package transitioned.

### 2. Mandatory QR Code Proof Constraint
- `DELIVERED` status **CANNOT** be set manually via the standard status endpoint. Any attempt returns an HTTP 400 Bad Request error.
- `DELIVERED` status can **ONLY** be achieved by scanning the customer's unique QR Code token at the `POST /requests/:id/confirm-delivery` endpoint.

### 3. Targeted WebSockets (Socket.io Rooms)
Rather than broadcasting all updates to everyone, Dukatrack uses targeted Socket.io rooms:
- **`dispatchers`**: All connected dispatcher clients receive instant alerts when a retailer creates a new order (`new_request`).
- **`rider_<id>`**: Riders receive private assignment alerts (`assigned`) specifically targeted to their room.
- **`retailer_<id>`**: Retailers receive live status updates (`status_updated`) as their packages move through the delivery pipeline.

---

## 👥 Role-Based Views

### 🛍️ Retailer View
- **Order Dispatch Form**: Create delivery requests with customer details and item descriptions.
- **Live Status Feed**: Real-time list of all retailer orders updating via WebSockets.
- **QR Code Display Modal**: Generates and renders a QR Code image encoded with the order's unique `DUKATRACK-XXXXXXXX` token.
- **Audit Trail Modal**: Displays the complete history of `StatusEvent` entries proving delivery lifecycle chain-of-custody.

### 🏢 Dispatcher View
- **Open Queue**: Live incoming queue of open (`REQUESTED`) deliveries.
- **Rider Assignment**: Select available riders from a dropdown to assign packages in one click.
- **Platform Dashboard**: Table view monitoring active and completed deliveries across the entire network.

### 🏍️ Rider View
- **Assigned Deliveries**: Live order feed pushed directly to the rider's private room (`rider_<id>`).
- **Picked Up Trigger**: One-click action to transition order status to `PICKED_UP`.
- **Camera QR Scanner**: Built-in camera QR scanner (`html5-qrcode`) with a manual token input fallback for confirming delivery.

---

## 🗄️ Data Model Schema

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  phone     String
  role      String   // 'retailer' | 'dispatcher' | 'rider'
  createdAt DateTime @default(now())
}

model DeliveryRequest {
  id               String   @id @default(uuid())
  retailer_id      String
  customer_name    String
  customer_phone   String
  customer_address String
  item_description String
  status           String   @default("REQUESTED") // REQUESTED | ASSIGNED | PICKED_UP | DELIVERED
  assigned_rider_id String?
  qr_code_token    String   @unique
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
}

model StatusEvent {
  id          String   @id @default(uuid())
  delivery_id String
  from_status String?
  to_status   String
  actor_id    String
  actor_role  String
  timestamp   DateTime @default(now())
  method      String   // 'manual_update' | 'qr_scan'
}
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher

### 1. Backend Setup & Server Launch
```bash
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Push database schema & seed initial mock users
npx prisma db push
node prisma/seed.js

# Start backend server
npm start
```
*The backend server will run at `http://localhost:3000`.*

### 2. Frontend Setup & Launch
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start Angular dev server
npx @angular/cli serve
```
*The Angular application will run at `http://localhost:4200`.*

### 3. Run Automated E2E Test Suite
To run the automated backend test verifying REST endpoints, atomic transactions, and QR token validation:
```bash
cd backend
node test-flow.js
```

---

## 📌 Documented Limitations (Design Scope)

- **No Offline Queue for Riders**: Real-time updates rely on active WebSockets. Reconnecting riders fetch current state upon reconnect without local offline event queuing.
- **No Optimistic Locking**: Concurrent dispatcher assignments follow standard last-write-wins without row-level lock overhead.
- **Token Simplicity**: QR code tokens use unique random UUID strings without expiration windowing or geolocation boundaries.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
