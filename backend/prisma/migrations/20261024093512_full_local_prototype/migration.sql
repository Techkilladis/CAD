-- CreateEnum
CREATE TYPE "Role" AS ENUM ('COORDINATOR', 'ADMIN', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('FOOD', 'WATER', 'MEDICINE', 'BLANKETS');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'OVERCROWDING', 'FULL_SHELTER', 'CRITICAL_MEDICAL_NEED', 'TRANSFER_REQUIRED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ShelterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FULL', 'EMERGENCY_CLOSED');

-- CreateEnum
CREATE TYPE "CheckinStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReunificationStatus" AS ENUM ('MISSING', 'POTENTIAL_MATCH', 'REUNITED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MedicalPriority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CheckinSource" AS ENUM ('COORDINATOR', 'PUBLIC_REGISTRATION', 'OFFLINE_SYNC');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('SET', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER_RETURN', 'DONATION');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VOLUNTEER',
    "cognitoSub" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "skills" TEXT,
    "languages" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shelter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "capacityTotal" INTEGER NOT NULL,
    "capacityOccupied" INTEGER NOT NULL DEFAULT 0,
    "coordinatorId" TEXT,
    "status" "ShelterStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "contactInfo" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "medicalSupport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shelter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShelterTranslation" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "instructions" TEXT,

    CONSTRAINT "ShelterTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkin" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "familySize" INTEGER NOT NULL DEFAULT 1,
    "phone" TEXT,
    "medicalFlag" BOOLEAN NOT NULL DEFAULT false,
    "criticalMedical" BOOLEAN NOT NULL DEFAULT false,
    "elderlyCount" INTEGER NOT NULL DEFAULT 0,
    "pregnantFlag" BOOLEAN NOT NULL DEFAULT false,
    "disabledFlag" BOOLEAN NOT NULL DEFAULT false,
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "emergencyNotes" TEXT,
    "medicalNotes" TEXT,
    "priority" "MedicalPriority" NOT NULL DEFAULT 'NONE',
    "status" "CheckinStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "CheckinSource" NOT NULL DEFAULT 'COORDINATOR',
    "clientRequestId" TEXT,
    "referenceCode" TEXT,
    "checkedInById" TEXT,
    "checkedOutById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" TIMESTAMP(3),

    CONSTRAINT "Checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "fromShelterId" TEXT NOT NULL,
    "toShelterId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "rejectionReason" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "message" TEXT,
    "resourceType" "ResourceType",
    "dedupeKey" TEXT NOT NULL DEFAULT '',
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedVia" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerShift" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Volunteer shift',
    "task" TEXT,
    "notes" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerAssignment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "receiptRef" TEXT,
    "receiptUrl" TEXT,
    "status" "DonationStatus" NOT NULL DEFAULT 'ACCEPTED',
    "inventoryApplied" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT,
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReunificationCase" (
    "id" TEXT NOT NULL,
    "missingPersonName" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "lastKnownLocation" TEXT,
    "lastKnownShelterId" TEXT,
    "contactPerson" TEXT NOT NULL,
    "contactInfo" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReunificationStatus" NOT NULL DEFAULT 'MISSING',
    "reportedById" TEXT,
    "matchedCheckinId" TEXT,
    "staffNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReunificationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Shelter_status_idx" ON "Shelter"("status");

-- CreateIndex
CREATE INDEX "Shelter_coordinatorId_idx" ON "Shelter"("coordinatorId");

-- CreateIndex
CREATE UNIQUE INDEX "ShelterTranslation_shelterId_locale_key" ON "ShelterTranslation"("shelterId", "locale");

-- CreateIndex
CREATE INDEX "Resource_shelterId_idx" ON "Resource"("shelterId");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_shelterId_resourceType_key" ON "Resource"("shelterId", "resourceType");

-- CreateIndex
CREATE INDEX "StockMovement_resourceId_createdAt_idx" ON "StockMovement"("resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_shelterId_createdAt_idx" ON "StockMovement"("shelterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Checkin_clientRequestId_key" ON "Checkin"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Checkin_referenceCode_key" ON "Checkin"("referenceCode");

-- CreateIndex
CREATE INDEX "Checkin_shelterId_status_idx" ON "Checkin"("shelterId", "status");

-- CreateIndex
CREATE INDEX "Checkin_priority_idx" ON "Checkin"("priority");

-- CreateIndex
CREATE INDEX "Transfer_status_idx" ON "Transfer"("status");

-- CreateIndex
CREATE INDEX "Transfer_fromShelterId_idx" ON "Transfer"("fromShelterId");

-- CreateIndex
CREATE INDEX "Transfer_toShelterId_idx" ON "Transfer"("toShelterId");

-- CreateIndex
CREATE INDEX "AlertLog_dedupeKey_status_idx" ON "AlertLog"("dedupeKey", "status");

-- CreateIndex
CREATE INDEX "AlertLog_shelterId_status_idx" ON "AlertLog"("shelterId", "status");

-- CreateIndex
CREATE INDEX "VolunteerShift_shelterId_startTime_idx" ON "VolunteerShift"("shelterId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerAssignment_shiftId_volunteerId_key" ON "VolunteerAssignment"("shiftId", "volunteerId");

-- CreateIndex
CREATE INDEX "Donation_shelterId_idx" ON "Donation"("shelterId");

-- CreateIndex
CREATE INDEX "Donation_receivedDate_idx" ON "Donation"("receivedDate");

-- CreateIndex
CREATE INDEX "ReunificationCase_status_idx" ON "ReunificationCase"("status");

-- CreateIndex
CREATE INDEX "ReunificationCase_missingPersonName_idx" ON "ReunificationCase"("missingPersonName");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "Shelter" ADD CONSTRAINT "Shelter_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelterTranslation" ADD CONSTRAINT "ShelterTranslation_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "Shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "Shelter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "Shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "Shelter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromShelterId_fkey" FOREIGN KEY ("fromShelterId") REFERENCES "Shelter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toShelterId_fkey" FOREIGN KEY ("toShelterId") REFERENCES "Shelter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "Shelter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerShift" ADD CONSTRAINT "VolunteerShift_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "Shelter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerShift" ADD CONSTRAINT "VolunteerShift_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAssignment" ADD CONSTRAINT "VolunteerAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "VolunteerShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAssignment" ADD CONSTRAINT "VolunteerAssignment_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "Shelter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunificationCase" ADD CONSTRAINT "ReunificationCase_lastKnownShelterId_fkey" FOREIGN KEY ("lastKnownShelterId") REFERENCES "Shelter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunificationCase" ADD CONSTRAINT "ReunificationCase_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunificationCase" ADD CONSTRAINT "ReunificationCase_matchedCheckinId_fkey" FOREIGN KEY ("matchedCheckinId") REFERENCES "Checkin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
