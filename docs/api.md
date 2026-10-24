# API Documentation

Base URL (Local): `http://localhost:5000`

## Public Endpoints

### `GET /api/shelters`
Returns all active shelters.
- **Response**: `200 OK` Array of Shelter objects.

### `GET /api/shelters/nearest`
Returns nearby shelters sorted by distance using the Haversine formula.
- **Query Params**:
  - `latitude` (float, required)
  - `longitude` (float, required)
- **Response**: `200 OK` Array of Shelter objects including calculated `distance` in kilometers.

### `GET /api/shelters/:id`
Returns detailed shelter information, including available capacity and resources.
- **Response**: `200 OK` Shelter object with populated `resources`.

## Coordinator Endpoints

### `POST /api/shelters`
Creates a new shelter.
- **Body**: `{ name, address, latitude, longitude, capacityTotal, coordinatorId }`
- **Response**: `201 Created`

### `PATCH /api/shelters/:id`
Updates shelter information.
- **Body**: `{ name, address, capacityTotal }`
- **Response**: `200 OK`

### `POST /api/shelters/:id/checkin`
Checks in a person or family.
- **Body**: `{ personName, familySize, medicalFlag }`
- **Rules**: Validates available capacity. Increments occupancy.
- **Response**: `201 Created`

### `POST /api/shelters/:id/checkout`
Checks out a person or family.
- **Body**: `{ checkinId, familySize }`
- **Rules**: Decrements occupancy. Cannot go below zero.
- **Response**: `200 OK`

### `GET /api/shelters/:id/resources`
Get all resources for a specific shelter.
- **Response**: `200 OK` Array of Resource objects.

### `PATCH /api/shelters/:id/resources/:resourceId`
Updates the quantity of a specific resource.
- **Body**: `{ quantity }`
- **Rules**: Triggers LOW_STOCK alert if new quantity <= lowStockThreshold.
- **Response**: `200 OK`

## Transfer Endpoints

### `POST /api/transfers`
Creates a new resource transfer request between shelters.
- **Body**: `{ fromShelterId, toShelterId, resourceType, quantity, requestedBy }`
- **Response**: `201 Created`

### `PATCH /api/transfers/:id/approve`
Approves and completes a transfer.
- **Body**: `{ approvedBy }`
- **Rules**: Deducts from source shelter, adds to destination shelter. Status changes to COMPLETED.
- **Response**: `200 OK`

### `PATCH /api/transfers/:id/reject`
Rejects a transfer.
- **Response**: `200 OK` Status changes to REJECTED.

### `GET /api/transfers`
Lists all transfers.
- **Response**: `200 OK`

## Admin Dashboard

### `GET /api/dashboard`
Returns district-wide aggregated statistics.
- **Response**: `200 OK`
  ```json
  {
    "totalShelters": 5,
    "totalCapacity": 1000,
    "totalOccupied": 750,
    "totalAvailableCapacity": 250,
    "overcrowdedShelters": [...],
    "lowStockAlerts": [...],
    "pendingTransfers": [...],
    "resourceSummary": { ... }
  }
  ```

## System

### `GET /api/health`
Health check endpoint.
- **Response**: `200 OK` `{ "status": "ok" }`
