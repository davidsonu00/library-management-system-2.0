# 📚 LibraryOS — Full-Stack Library Management System

A production-ready Library Management System built with **React.js**, **Node.js/Express**, and **MySQL**.

---

## 🗂 Project Structure

```
library-app/
├── backend/
│   ├── config/          # Database config (Sequelize)
│   ├── controllers/     # Business logic
│   ├── middleware/      # Auth & error handlers
│   ├── models/          # Sequelize ORM models
│   ├── routes/          # Express routes
│   ├── server.js        # Entry point
│   ├── seed.js          # DB seeder (creates admin)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── context/     # Auth context
│   │   ├── pages/       # Page components
│   │   └── utils/       # Axios instance
│   └── package.json
└── database/
    └── schema.sql       # Enhanced MySQL schema
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm or yarn

---

### 1. Database Setup

```bash
# Login to MySQL
mysql -u root -p

# Run the schema
SOURCE /path/to/library-app/database/schema.sql;
```

---

### 2. Backend Setup

```bash
cd library-app/backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your DB credentials

# Seed the database (creates admin user & syncs tables)
node seed.js

# Start development server
npm run dev
```

Backend runs on: `http://localhost:5000`

---

### 3. Frontend Setup

```bash
cd library-app/frontend

# Install dependencies
npm install

# Start React dev server
npm start
```

Frontend runs on: `http://localhost:3000`

---

## 🔐 Default Login

```
Email:    admin@library.com
Password: Admin@123
```

> ⚠️ Change these in your `.env` file before production!

---

## 🌐 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/auth/profile` | Get profile |
| GET | `/api/books` | List books (search, filter, paginate) |
| POST | `/api/books` | Add book |
| PUT | `/api/books/:id` | Update book |
| DELETE | `/api/books/:id` | Delete book |
| GET | `/api/members` | List members |
| POST | `/api/members` | Add member |
| PUT | `/api/members/:id` | Update member |
| DELETE | `/api/members/:id` | Deactivate member |
| GET | `/api/issues` | All issue records |
| GET | `/api/issues/dashboard` | Dashboard stats |
| POST | `/api/issues` | Issue a book |
| PUT | `/api/issues/:id/return` | Return a book |

---

## ✅ Features

- 🔐 JWT Authentication (Admin login)
- 📊 Dashboard with charts (Recharts)
- 📚 Book CRUD — add, edit, delete, search, filter
- 👥 Member management
- 📖 Issue books with loan period selection
- 🔄 Return books with automatic fine calculation
- ⚠️ Overdue detection & alerts
- 💰 Fine calculation (₹5/day after due date)
- 📋 Full issue records with CSV export
- 📄 Pagination & search on all tables
- 🎨 Modern UI with Tailwind CSS

## 📦 What Was Added vs Original Schema

| Feature | Original | LibraryOS |
|---------|----------|-----------|
| Admin auth table | ❌ | ✅ |
| JWT login | ❌ | ✅ |
| Due date tracking | ❌ | ✅ |
| Fine storage in DB | ❌ | ✅ |
| Issue status field | ❌ | ✅ |
| Member phone/type | ❌ | ✅ |
| Book ISBN/publisher | ❌ | ✅ |
| Full REST API | ❌ | ✅ |
| React frontend | ❌ | ✅ |

---

## 🛠 Tech Stack

**Frontend:** React 18, Tailwind CSS, Recharts, Axios, React Router v6, React Hot Toast  
**Backend:** Node.js, Express.js, Sequelize ORM, JWT, bcryptjs  
**Database:** MySQL 8 (preserved original schema + enhancements)
