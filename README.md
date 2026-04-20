#  LibraryOS — Full-Stack Library Management System

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



### Prerequisites
- Node.js 18+
- MySQL 8.0+ (for local dev)
- npm or yarn

---

### 1. Database Setup

```bash
### Database Options
- Option 1: MySQL (Local Development)
mysql -u root -p

Import schema:
source database/mysql_schema.sql;


Option 2: PostgreSQL (Cloud Deployment )

Use Supabase:

Create project
Open SQL Editor
Run postgres_schema.sql

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

##  Features

-  JWT Authentication (Admin login)
-  Dashboard with charts (Recharts)
-  Book CRUD — add, edit, delete, search, filter
-  Member management
-  Issue books with loan period selection
-  Return books with automatic fine calculation
-  Overdue detection & alerts
-  Fine calculation (₹5/day after due date)
-  Full issue records with CSV export
-  Modern UI with Tailwind CSS
-  Pagination & search on all tables

## 🛠 Tech Stack

**Frontend:** React 18, Tailwind CSS, Recharts, Axios, React Router v6, React Hot Toast  
**Backend:** Node.js, Express.js, Sequelize ORM, JWT, bcryptjs  
**Database:** MySQL 8+


## 💡 Key Learning

* Designed a full-stack application using **React, Node.js, and SQL**, following clean architecture (MVC pattern)
* Built a complete **book issuing workflow** with validations (availability, duplicate issue prevention)
* Implemented **fine calculation logic** based on due date and return date
* Managed relational data using **Sequelize ORM with associations** (Books ↔ Members ↔ Issue Logs)
* Migrated database from **MySQL to PostgreSQL (Supabase)** for cloud deployment
* Integrated **cloud database (Supabase)** with secure connection and SSL configuration
* Learned to manage **environment variables securely** using `.env` and avoided exposing secrets
* Deployed backend and frontend using **Render and Vercel**
* Debugged real-world issues like:

  * Schema conflicts with views
  * ORM sync errors
  * Query incompatibility across databases
* Implemented **pagination, search, and filtering** for scalable data handling
* Built a responsive and modern UI using **Tailwind CSS**
* Understood **production-level practices** like API structuring, error handling, and modular code design
