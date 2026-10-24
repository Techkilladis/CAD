# Database Schema

SafeHaven uses PostgreSQL for relational data storage, managed via Prisma ORM.

## Models

### `User`
Manages system users including coordinators and administrators. (Will integrate with Cognito in Phase 2).
- `id`: String (UUID), Primary Key
- `name`: String
- `email`: String (Unique)
- `phone`: String?
- `role`: Enum (`COORDINATOR`, `ADMIN`, `VOLUNTEER`)
- `cognitoSub`: String? (For future AWS Cognito integration)
- `createdAt`: DateTime

### `Shelter`
Represents a flood relief shelter.
- `id`: String (UUID), Primary Key
- `name`: String
- `address`: String
- `latitude`: Float
- `longitude`: Float
- `capacityTotal`: Int
- `capacityOccupied`: Int (Default: 0)
- `coordinatorId`: String? (Foreign Key -> User)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### `Resource`
Tracks inventory items at a specific shelter.
- `id`: String (UUID), Primary Key
- `shelterId`: String (Foreign Key -> Shelter)
- `resourceType`: Enum (`FOOD`, `WATER`, `MEDICINE`, `BLANKETS`)
- `quantity`: Int
- `unit`: String (e.g., 'boxes', 'liters')
- `lowStockThreshold`: Int
- `updatedAt`: DateTime

### `Checkin`
Logs individuals or families staying at a shelter.
- `id`: String (UUID), Primary Key
- `shelterId`: String (Foreign Key -> Shelter)
- `personName`: String
- `familySize`: Int
- `medicalFlag`: Boolean (Default: false)
- `checkedInAt`: DateTime (Default: now)
- `checkedOutAt`: DateTime?

### `Transfer`
Records resource transfer requests between shelters.
- `id`: String (UUID), Primary Key
- `fromShelterId`: String (Foreign Key -> Shelter)
- `toShelterId`: String (Foreign Key -> Shelter)
- `resourceType`: Enum (`FOOD`, `WATER`, `MEDICINE`, `BLANKETS`)
- `quantity`: Int
- `status`: Enum (`PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`)
- `requestedBy`: String (Foreign Key -> User)
- `approvedBy`: String? (Foreign Key -> User)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### `AlertLog`
Logs system alerts such as low stock or overcrowding. (Will trigger EventBridge/SNS in Phase 2).
- `id`: String (UUID), Primary Key
- `shelterId`: String (Foreign Key -> Shelter)
- `alertType`: Enum (`LOW_STOCK`, `OVERCROWDING`)
- `triggeredAt`: DateTime (Default: now)
- `notifiedVia`: String? (e.g., 'DASHBOARD', 'EMAIL', 'SMS')
- `acknowledged`: Boolean (Default: false)
