# ApplyTrack — Job Application Tracking System

A full-stack job application tracker designed for job seekers to monitor, manage, and optimize their job hunt across multiple stages. Built with Node.js, Express.js, MySQL, and modern responsive JavaScript/CSS.

---

## 🚀 Key Features

- **Authentication & Security**:
  - Secure user registration and login with bcrypt password hashing (10 salt rounds).
  - Stateless JSON Web Token (JWT) authentication with 24-hour expiration.
  - Complete user isolation — users can only view, edit, and delete their own job applications.
  - Uniform authentication error messages to mitigate account enumeration.

- **Job Application Lifecycle (CRUD)**:
  - Add applications with company, role, job link, applied date, interview date, and notes.
  - Status progression tracking across 5 pipeline states: `Applied`, `Interview`, `Offer`, `Rejected`, `Ghosted`.
  - Search applications by company or job role in real time.
  - Filter applications by status badge.
  - Update application details, scheduled interview dates, and notes.
  - Delete applications with confirmation safeguard.

- **Dashboard & Analytics**:
  - Real-time metrics breakdown showing counts across all stages.
  - Interactive cards to filter applications with one click.
  - Responsive layout for desktop, tablet, and mobile browsers.

---

## 🏗️ Project Architecture

```text
ApplyTrack/
├── .gitignore
├── README.md
└── backend/
    ├── .env.example
    ├── .gitignore
    ├── package.json
    ├── package-lock.json
    ├── schema.sql
    ├── public/
    │   ├── index.html        # Interactive Frontend Dashboard & Auth UI
    │   ├── style.css         # SaaS Modern Theme & Responsive Styles
    │   └── app.js            # Client-side State, API Client & Toast Notifications
    ├── src/
    │   ├── server.js         # Express App setup, middleware & static route serving
    │   ├── config/
    │   │   └── db.js         # MySQL2 Connection Pool (local & Railway compatible)
    │   ├── middleware/
    │   │   └── auth.js       # JWT Verification & Token Extraction Middleware
    │   ├── controllers/
    │   │   ├── authController.js        # Register, Login, & Profile logic
    │   │   └── applicationController.js # Scoped CRUD logic & Input Validation
    │   └── routes/
    │       ├── authRoutes.js            # /api/auth routes
    │       └── applicationRoutes.js     # /api/applications routes
    └── test/
        └── api.test.js       # 23 Automated Integration Tests
```

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v22+)
- **Backend Framework**: Express.js (v5)
- **Database**: MySQL / MariaDB (Connection pool via `mysql2/promise`)
- **Authentication**: JWT (`jsonwebtoken`) + `bcrypt`
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Served via Express static assets)
- **Testing**: Native Node.js Test Suite (`assert` + native `fetch`)

---

## ⚙️ Environment Configuration

Create a `.env` file inside `backend/` based on `backend/.env.example`:

```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=applytrack
JWT_SECRET=your_secure_jwt_secret_key
```

*Note: The database configuration also supports single-string deployment URLs like `DATABASE_URL` or `MYSQL_URL` (e.g. from Railway or Render).*

---

## 🏃 Running the Application

### 1. Database Setup
Ensure MySQL is running and initialize the schema:
```bash
mysql -u root -p < backend/schema.sql
```

### 2. Start the Server
Inside `backend/`:
```bash
cd backend
npm install
npm run dev     # Starts server with nodemon auto-reload on port 5000
# or
npm start       # Production start
```

### 3. Open the Web Application
Open your web browser and navigate to:
```
http://localhost:5000
```

---

## 🧪 Running Automated Tests

Run the full integration test suite:
```bash
cd backend
npm test
```
The test suite validates:
- API health check.
- Registration with validation (short passwords, duplicate usernames).
- Secure login and JWT generation.
- Cross-user data isolation (User B cannot access or modify User A's applications).
- Complete CRUD operations (create, list, get by ID, filter, search, update, delete).
- Direct SQL database persistence.

---

## 📡 API Reference

### Health
- `GET /api/health` — System status check.

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new account (`{ username, password }`).
- `POST /api/auth/login` — Login and receive JWT (`{ username, password }`).
- `GET /api/auth/me` — Retrieve current authenticated user profile (`Authorization: Bearer <token>`).

### Applications (`/api/applications`) — *All require `Authorization: Bearer <token>`*
- `POST /api/applications` — Create a new application (`company`, `role`, `applied_date`, optional: `link`, `status`, `interview_date`, `notes`).
- `GET /api/applications` — List user's applications. Supports query parameters `?status=Interview` and `?search=Google`.
- `GET /api/applications/:id` — Retrieve details for a single application.
- `PUT /api/applications/:id` — Update application fields (`company`, `role`, `status`, `link`, `applied_date`, `interview_date`, `notes`).
- `DELETE /api/applications/:id` — Delete an application.
