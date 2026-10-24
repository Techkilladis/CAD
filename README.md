# SafeHaven — Flood Shelter & Relief Resource Management System

SafeHaven is a flood-relief coordination platform that helps displaced people find nearby shelters, shelter coordinators manage occupancy and essential resources, and relief administrators monitor shelters across a district.

## Features

- **Public Shelter Finder**: Locate nearby shelters on a map based on your location and check available capacity.
- **Coordinator Dashboard**: Manage check-ins/check-outs, track resource inventory (Food, Water, Medicine, Blankets).
- **Admin Dashboard**: District-wide monitoring, critical alerts (low-stock, overcrowding), and resource transfer management.
- **Local Demo Authentication**: Role-based access control (`x-user-id` header mechanism) for Coordinators and Admins, serving as the baseline for future AWS Cognito migration.

## Tech Stack

### Frontend
- React 18, Vite, TypeScript
- Tailwind CSS for styling
- React Router DOM for routing
- React Leaflet for interactive maps

### Backend
- Node.js, Express, TypeScript
- RESTful API design
- Prisma ORM

### Database
- PostgreSQL (relational schema design)

## Folder Structure

```
safehaven/
├── backend/            # Express.js REST API
│   ├── prisma/         # Database schema & migrations
│   └── src/            # Controllers, Routes, Services, Models
├── frontend/           # React + Vite Application
│   └── src/            # Components, Pages, Layouts, API clients
└── docs/               # System architecture and documentation
```

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)

### 1. Database Setup
Ensure PostgreSQL is running on your machine. Create a new database, e.g., `safehaven`.

### 2. Backend Setup
1. Open a terminal and navigate to the `backend` directory.
2. Run `npm install` to install dependencies.
3. Copy `.env.example` to `.env` and update the `DATABASE_URL` with your local PostgreSQL connection string.
4. Run Prisma migrations: `npx prisma migrate dev --name init`
5. Seed the database: `npx prisma db seed`
6. Start the server: `npm run dev` (API will run on http://localhost:5000)

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend` directory.
2. Run `npm install` to install dependencies.
3. Start the Vite dev server: `npm run dev` (Frontend will run on http://localhost:5173)
4. Open the browser to the provided localhost URL.

## API & Architecture Overview
- Read [architecture.md](./docs/architecture.md) for the high-level system design.
- Read [api.md](./docs/api.md) for the API endpoints documentation.
- Read [database.md](./docs/database.md) for the database schema details.

## Future AWS Migration
This is Phase 1 (Local Prototype). In future phases, this platform will be migrated to AWS using:
- Amazon RDS (PostgreSQL)
- AWS Lambda & API Gateway (Serverless backend)
- Amazon Cognito (Auth)
- Amazon ElastiCache (Redis for nearest shelter caching)
- AWS Step Functions (Transfer workflows)
- Amazon SNS / SES / EventBridge (Alerts)
- Amazon S3 & CloudFront (Frontend hosting)
