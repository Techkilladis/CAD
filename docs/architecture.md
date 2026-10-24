# System Architecture

## Current State (Phase 1 - Local Prototype)

The current implementation of SafeHaven is a local prototype designed with a clean separation of concerns to facilitate a future migration to AWS.

### Components

1. **Frontend**: React SPA (Single Page Application) built with Vite and TypeScript.
   - Hosted locally via Vite dev server.
   - Uses React Router for client-side routing.
   - Communicates with the backend via RESTful HTTP requests using Axios.
2. **Backend**: Express.js REST API with TypeScript.
   - Hosted locally via Node.js/nodemon.
   - Handles business logic, validation, and database interactions.
3. **Database**: PostgreSQL.
   - Accessed via Prisma ORM.

### Request Flow
`Client (Browser) -> Express Server (http://localhost:5000) -> Prisma ORM -> PostgreSQL`

---

## Target State (Phase 2 - AWS Migration)

The application architecture will be migrated to a serverless and managed infrastructure on AWS.

### Planned Components

- **Frontend Hosting**: Amazon S3 (for static assets) distributed via Amazon CloudFront (CDN) for low-latency delivery.
- **API Layer**: Amazon API Gateway routing requests to AWS Lambda functions. Express.js routes will be decomposed into individual Lambda functions or wrapped using serverless-http.
- **Database Layer**: Amazon RDS for PostgreSQL.
- **Authentication**: Amazon Cognito for managing users, coordinators, and admins.
- **Caching**: Amazon ElastiCache (Redis) to cache nearest-shelter calculations and high-frequency read requests.
- **Workflows**: AWS Step Functions to orchestrate the multi-step resource transfer process (Request -> Approve/Reject -> Execute).
- **Notifications**: 
  - Amazon EventBridge to capture system events (e.g., low stock, overcrowding).
  - Amazon SNS for SMS/Push notifications.
  - Amazon SES for email alerts.

### Planned Request Flow (AWS)
`Client -> CloudFront -> S3 (Static UI)`
`Client -> API Gateway -> Lambda -> RDS / ElastiCache`
