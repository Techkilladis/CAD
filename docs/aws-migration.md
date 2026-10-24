# AWS Migration Readiness Review

The current local prototype of SafeHaven is designed with future AWS migration in mind. 
Below is a breakdown of the architectural mappings and where specific AWS services will replace current local implementation details.

## Current Local Architecture
- **Frontend**: React + Vite SPA (served locally)
- **Backend API**: Express.js REST API (running on local Node.js server)
- **Database**: PostgreSQL (running locally)
- **ORM**: Prisma
- **Alerts/Notifications**: Simple database inserts (`AlertLog` table)

## Future AWS Architecture Mapping

### Frontend Hosting
**Current**: Local Vite Dev Server (`npm run dev`)
**Future**: **Amazon S3 + Amazon CloudFront**
- The React application will be compiled into static assets (`npm run build`).
- Assets will be uploaded to an S3 bucket configured for static website hosting.
- Amazon CloudFront will serve as the CDN to distribute the frontend globally with low latency.

### Backend API Layer
**Current**: Express.js Server (`server.ts`)
**Future**: **Amazon API Gateway + AWS Lambda**
- The Express routes will be decoupled from the HTTP server and deployed as serverless functions.
- Tools like `serverless-http` can wrap the existing Express app, OR controllers can be directly mapped to Lambda handlers.
- **Architectural Readiness**: We have abstracted the business logic into `services/` (e.g., `ShelterService`). This means the core logic has zero coupling with the Express HTTP layer, making it trivial to invoke these services directly from an AWS Lambda event handler.

### Database Layer
**Current**: Local PostgreSQL
**Future**: **Amazon RDS (PostgreSQL)**
- The database schema remains strictly PostgreSQL.
- Connection strings in `.env` will simply be updated to point to the RDS cluster endpoint.

### Authentication & Identity
**Current**: Hardcoded/Mock user IDs.
**Future**: **Amazon Cognito**
- Cognito User Pools will manage coordinators and administrators.
- API Gateway will use Cognito Authorizers to validate JWT tokens.
- The `cognitoSub` field already exists in the `User` schema to link Cognito identities to our database records.

### Caching
**Current**: None.
**Future**: **Amazon ElastiCache (Redis)**
- Nearest shelter calculations (Haversine formula) and the public `/api/shelters` list are read-heavy.
- ElastiCache will sit in front of the RDS database to serve these queries instantly.

### Workflows (Transfers)
**Current**: Synchronous state changes via API calls (`PENDING` -> `APPROVED`).
**Future**: **AWS Step Functions**
- Resource transfers are inherently multi-step (Request -> Wait for Approval -> Deduct Source -> Add Destination -> Notify).
- Step Functions will orchestrate this saga, ensuring reliability, retries, and rollback mechanisms if a transaction fails.

### Event-Driven Alerts & Notifications
**Current**: Creating records in `AlertLog` table synchronously during check-ins or resource updates.
**Future**: **Amazon EventBridge + Amazon SNS + Amazon SES**
- When occupancy hits 90% or stock hits the threshold, Lambda will emit a domain event to **Amazon EventBridge** (e.g., `Shelter.Overcrowded`).
- EventBridge will route this event to **Amazon SNS** to push SMS alerts to coordinators.
- **Amazon SES** will send comprehensive email digests to district admins.
- **Amazon CloudWatch** will collect logs and provide dashboards for API metrics and backend health.
