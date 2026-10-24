// Typed API models. String unions instead of enums (erasableSyntaxOnly).

export type Role = 'ADMIN' | 'COORDINATOR' | 'VOLUNTEER';
export type ResourceType = 'FOOD' | 'WATER' | 'MEDICINE' | 'BLANKETS';
export type ShelterStatus = 'ACTIVE' | 'INACTIVE' | 'FULL' | 'EMERGENCY_CLOSED';
export type StockStatus = 'HEALTHY' | 'LOW' | 'CRITICAL' | 'EMPTY';
export type CheckinStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_OUT' | 'CANCELLED';
export type MedicalPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CheckinSource = 'COORDINATOR' | 'PUBLIC_REGISTRATION' | 'OFFLINE_SYNC';
export type AlertType = 'LOW_STOCK' | 'OVERCROWDING' | 'FULL_SHELTER' | 'CRITICAL_MEDICAL_NEED' | 'TRANSFER_REQUIRED';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type TransferStatus = 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';
export type StockMovementType = 'SET' | 'ADJUSTMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'TRANSFER_RETURN' | 'DONATION';
export type OccupancyClass = 'AVAILABLE' | 'CRITICAL' | 'FULL' | 'INACTIVE';

export const RESOURCE_TYPES: ResourceType[] = ['FOOD', 'WATER', 'MEDICINE', 'BLANKETS'];
export const SHELTER_STATUSES: ShelterStatus[] = ['ACTIVE', 'FULL', 'INACTIVE', 'EMERGENCY_CLOSED'];

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
}

export interface ManagedShelterRef {
  id: string;
  name: string;
  status: ShelterStatus;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  skills: string | null;
  languages: string | null;
  isActive: boolean;
  managedShelters: ManagedShelterRef[];
}

/** Public-safe shelter projection (no occupant data). */
export interface PublicResource {
  resourceType: ResourceType;
  stockStatus: StockStatus;
  unit: string;
}

export interface PublicShelter {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacityTotal: number;
  capacityOccupied: number;
  availableCapacity: number;
  occupancyPercent: number;
  status: ShelterStatus;
  description: string | null;
  contactInfo: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  medicalSupport: boolean;
  languages: string[];
  resources: PublicResource[];
  distance?: number;
}

export interface ShelterTranslation {
  id?: string;
  locale: string;
  name: string | null;
  description: string | null;
  instructions: string | null;
}

export interface PublicShelterDetail extends PublicShelter {
  translationLocale: string | null;
  translation: { name: string | null; description: string | null; instructions: string | null } | null;
}

/** Staff list/detail row. */
export interface StaffShelter {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacityTotal: number;
  capacityOccupied: number;
  availableCapacity: number;
  occupancyPercent: number;
  status: ShelterStatus;
  description: string | null;
  contactInfo: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  medicalSupport: boolean;
  coordinatorId: string | null;
  coordinator: { id: string; name: string } | null;
  languages?: string[];
  translations?: ShelterTranslation[];
}

export interface ShelterInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacityTotal: number;
  coordinatorId?: string | null;
  status?: ShelterStatus;
  description?: string | null;
  contactInfo?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  medicalSupport?: boolean;
}

export interface Checkin {
  id: string;
  shelterId: string;
  personName: string;
  familySize: number;
  phone: string | null;
  medicalFlag: boolean;
  criticalMedical: boolean;
  elderlyCount: number;
  pregnantFlag: boolean;
  disabledFlag: boolean;
  childrenCount: number;
  emergencyNotes: string | null;
  medicalNotes: string | null;
  priority: MedicalPriority;
  status: CheckinStatus;
  source: CheckinSource;
  referenceCode: string | null;
  confirmedAt: string | null;
  createdAt: string;
  checkedInAt: string;
  checkedOutAt: string | null;
}

export interface OccupantInput {
  personName: string;
  familySize: number;
  phone?: string | null;
  medicalFlag?: boolean;
  criticalMedical?: boolean;
  elderlyCount?: number;
  pregnantFlag?: boolean;
  disabledFlag?: boolean;
  childrenCount?: number;
  emergencyNotes?: string | null;
  medicalNotes?: string | null;
  clientRequestId?: string;
}

export interface RegistrationReceipt {
  referenceCode: string;
  status: CheckinStatus;
  shelterId: string;
  shelterName: string;
  familySize: number;
  message: string;
}

export interface Resource {
  id: string;
  shelterId: string;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  isActive: boolean;
  stockStatus: StockStatus;
  updatedAt: string;
}

export interface ResourceUpdate {
  quantity?: number;
  delta?: number;
  lowStockThreshold?: number;
  unit?: string;
  isActive?: boolean;
  note?: string;
}

export interface StockMovement {
  id: string;
  type: StockMovementType;
  delta: number;
  quantityAfter: number;
  note: string | null;
  createdAt: string;
  resource: { resourceType: ResourceType; unit: string };
  user: { id: string; name: string } | null;
}

export interface AlertRow {
  id: string;
  shelterId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string | null;
  triggeredAt: string;
}

export interface PriorityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  pregnant: number;
  disabled: number;
  elderly: number;
  children: number;
}

/** GET /shelters/:id/overview (staff). Transfers, shifts and donations are typed loosely until their phases. */
export interface ShelterOverview {
  shelter: Omit<StaffShelter, 'capacityTotal' | 'capacityOccupied' | 'availableCapacity' | 'occupancyPercent' | 'coordinatorId' | 'languages'>;
  capacity: { total: number; occupied: number; available: number; percent: number };
  asOf: string;
  pendingRegistrations: number;
  activeOccupants: Checkin[];
  medicalOccupants: Checkin[];
  medicalCounts: PriorityCounts;
  resources: Resource[];
  alerts: AlertRow[];
  incomingTransfers: unknown[];
  outgoingTransfers: unknown[];
  shifts: unknown[];
  donations: unknown[];
}

export interface DistrictShelter {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: ShelterStatus;
  capacityTotal: number;
  capacityOccupied: number;
  available: number;
  occupancyPercent: number;
  classification: OccupancyClass;
}

export interface DistrictOccupancy {
  asOf: string;
  totals: {
    shelters: number;
    operationalShelters: number;
    totalCapacity: number;
    totalOccupied: number;
    totalAvailable: number;
    occupancyPercent: number;
    criticalShelters: number;
    fullShelters: number;
  };
  shelters: DistrictShelter[];
  critical: DistrictShelter[];
  full: DistrictShelter[];
}

export interface ResourceMatrixCell {
  resourceId: string;
  shelterId: string;
  shelterName: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  stockStatus: StockStatus;
}

export interface ResourceMatrix {
  asOf: string;
  shelters: { id: string; name: string; status: ShelterStatus }[];
  types: {
    resourceType: ResourceType;
    unit: string | null;
    total: number;
    shelters: ResourceMatrixCell[];
    lowCount: number;
    criticalCount: number;
    emptyCount: number;
  }[];
}

export interface PublicStats {
  openShelters: number;
  totalCapacity: number;
  totalOccupied: number;
  availableCapacity: number;
  sheltersWithSpace: number;
  asOf: string;
}

// ---- Phase B: transfers & alerts ----
export interface TransferActions {
  approve: boolean;
  reject: boolean;
  transit: boolean;
  receive: boolean;
  cancel: boolean;
}

export interface Transfer {
  id: string;
  fromShelterId: string;
  toShelterId: string;
  fromShelter: { id: string; name: string };
  toShelter: { id: string; name: string };
  resourceType: ResourceType;
  quantity: number;
  status: TransferStatus;
  reason: string | null;
  rejectionReason: string | null;
  requestedById: string;
  requestedBy: { id: string; name: string; role: Role };
  approvedBy: { id: string; name: string } | null;
  receivedBy: { id: string; name: string } | null;
  cancelledBy: { id: string; name: string } | null;
  createdAt: string;
  approvedAt: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  actions: TransferActions;
}

export interface TransferInput {
  fromShelterId: string;
  toShelterId: string;
  resourceType: ResourceType;
  quantity: number;
  reason?: string | null;
}

export interface Alert {
  id: string;
  shelterId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string | null;
  resourceType: ResourceType | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  shelter: { id: string; name: string };
  acknowledgedBy: { id: string; name: string } | null;
  resolvedBy: { id: string; name: string } | null;
}

export interface AlertCheckResult {
  scanned: number;
  created: number;
  resolved: number;
}

// ---- Phase C: volunteers, donations, medical ----
export interface Shift {
  id: string;
  shelterId: string;
  shelter: { id: string; name: string };
  title: string;
  task: string | null;
  notes: string | null;
  startTime: string;
  endTime: string;
  requiredCount: number;
  status: 'OPEN' | 'CANCELLED';
  filledCount: number;
  openSlots: number;
  isFull: boolean;
  hasStarted: boolean;
  signedUp: boolean;
  /** Present only for staff who manage the shelter. */
  assignments?: { id: string; volunteer: { id: string; name: string; phone: string | null; skills: string | null } }[];
}

export interface ShiftInput {
  shelterId: string;
  title: string;
  task?: string | null;
  notes?: string | null;
  startTime: string;
  endTime: string;
  requiredCount: number;
}

export type DonationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface Donation {
  id: string;
  shelterId: string;
  shelter: { id: string; name: string };
  donorName: string;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  receivedDate: string;
  notes: string | null;
  receiptRef: string | null;
  receiptUrl: string | null;
  status: DonationStatus;
  inventoryApplied: boolean;
  recordedBy: { id: string; name: string } | null;
  acceptedBy: { id: string; name: string } | null;
  acceptedAt: string | null;
}

export interface DonationInput {
  shelterId: string;
  donorName: string;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  receivedDate?: string;
  notes?: string | null;
  receiptRef?: string | null;
  receiptFileName?: string | null;
  applyToInventory?: boolean;
}

export interface MedicalCounts extends PriorityCounts {}

export interface MedicalCase extends Checkin {
  shelterName: string;
}

export interface MedicalSummary {
  asOf: string;
  totals: PriorityCounts;
  perShelter: { id: string; name: string; medicalSupport: boolean; status: ShelterStatus; counts: PriorityCounts }[];
  cases: MedicalCase[];
}

export interface VolunteerUser {
  id: string;
  name: string;
  phone: string | null;
  skills: string | null;
  languages: string | null;
}
