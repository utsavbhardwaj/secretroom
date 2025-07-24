<h1 align="center" id="title">SecureChat - Anonymous Temporary Chat Rooms</h1>

<p align="center">
  <img src="https://socialify.git.ci/utsavbhardwaj/secretroom/image?custom_description=Automatic+Disposable+Live+Chat+Room&description=1&language=1&name=1&owner=1&theme=Light" />
</p>
---

## 🏁 Overview

**SecureChat** is a privacy-first, mobile-only, real-time chat application that lets users create **temporary, anonymous chat rooms** with advanced privacy protection.

Built with real-time WebSocket messaging, AES-GCM encryption, and privacy overlays, SecureChat ensures conversations remain secure, short-lived, and for-your-eyes-only. No accounts, no traces, no digital footprint.

## Screenshot 

> <p align="center">
  <img src="https://github.com/user-attachments/assets/d4e635c1-2ede-40d8-98f4-94110f154d27" width="400" alt="Screenshot" />
</p>

---

## 📱 Key Features

### 🔐 Privacy & Security
- Anonymous session-based identity (no login)
- Client-side AES-GCM message encryption (optional)
- Screenshot detection & prevention
- Disabled text selection, copy, and context menus
- Visual privacy overlay for suspicious activity
- Mobile-only enforced access

### 💬 Real-Time Chat System
- WebSocket-based real-time messaging
- Typing indicators & live presence tracking
- Temporary in-memory message history
- Configurable room duration and member limit
- QR code sharing for room entry

### 👑 Admin Features
- Room creator gets admin privileges
- Kick members from room
- Visual crown icon for admin
- Modify room settings (duration, limits)

---

## 🧱 System Architecture

### 🖥️ Frontend
- SPA with **Vanilla JavaScript**
- Component-based architecture
- Client-side router
- WebSocket integration
- Mobile-first design with enforced privacy behaviors

### 🧠 Backend
- **Node.js + Express**
- Real-time with native **WebSocket (`ws`)**
- Room/session management with PostgreSQL via **Drizzle ORM**
- Room expiration & cleanup logic

### 🗃️ Database
- Hosted on **Neon** (serverless PostgreSQL)
- Type-safe migrations via **Drizzle Kit**
- Tables: rooms, messages, members (ephemeral)

---

## 🔄 Core Data Flow

### 🔧 Room Creation
1. User configures settings (duration, limits, etc.)
2. Backend generates 8-digit numeric room code
3. Room stored in DB with TTL
4. WebSocket session initiated

### 👥 Joining a Room
1. User enters or scans room code
2. Server validates and joins user to the room
3. Real-time presence established via WebSocket

### 📨 Messaging
1. Message typed → client-side encryption (optional)
2. Message sent via WebSocket
3. Server validates & broadcasts to all connected members
4. Message rendered on UI in real-time

### 🧹 Cleanup Logic
- Cron job every 5 minutes checks expired rooms
- Expired rooms removed from DB
- WebSocket sessions disconnected
- Temporary message storage purged

---

## 🧪 External Dependencies

| Tool | Purpose |
|------|---------|
| **Neon DB** | PostgreSQL-as-a-service |
| **Drizzle ORM** | Type-safe DB interaction |
| **dotenv** | Environment variable management |
| **ws** | Native WebSocket server |
| **Express.js** | HTTP server |

---

## 🚀 Deployment & Setup

### 🔧 Environment Variables

Create a `.env` file in the root:

```env
PORT=8000
DATABASE_URL=postgresql://your-neon-db-url
NODE_ENV=development
```
## Setup

```
# 1. Clone
git clone https://github.com/utsavbhardwaj/secretroom.git
cd secretroom

# 2. Install dependencies
npm install

# 3. Run database migrations (Drizzle)
npx drizzle-kit push

# 4. Start development server
npm run dev 

```
## 🧰 Security & Privacy
No persistent accounts or cookies

- Messages are ephemeral (in-memory only during room lifetime)
- Client-side encryption prevents server-side interception
- HTTPS recommended in production
- Security headers enabled (CSP, Frame Options, Referrer Policy)
- CORS restricted to trusted origins

## ⚙️ Performance & Scalability
- WebSocket keeps data in sync without polling
- Connection pooling via Neon
- Horizontal scalability possible due to stateless session tracking
- Room expiry ensures storage cleanup
- Minimal JS footprint with native DOM rendering

## 📤 Future Improvements
- Optional end-to-end encryption with key exchange
- Self-destruct timers per message
- Audio/Video chat support
- Decentralized peer-to-peer mode (via WebRTC)

## 📞 Contact
📧 Email: utsavjha.me@gmail.com

