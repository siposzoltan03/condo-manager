/**
 * UML data-model diagram generator (drawio XML).
 *
 * Reads the entity metadata defined below + the relationship list, and emits
 * a multi-tab drawio file:
 *
 *   docs/data-model.drawio.xml
 *
 * Tabs:
 *   1.  Áttekintés         — domain blocks + cross-domain refs
 *   2.  Előfizetés         — Plan, Subscription, Invitation, User
 *   3.  Épület             — Building, Unit, junctions, permissions
 *   4.  Kommunikáció       — Channel, ChannelMessage, Poll, …
 *   5.  Közgyűlés          — Meeting, Vote, Ballot, RSVP, signatures
 *   6.  Pénzügy            — Account, LedgerEntry, MonthlyCharge, Budget
 *   7.  Maintenance        — MaintenanceTicket, Contractor, Scheduled
 *   8.  Piactér            — ContractorOrg, Publication, Bid, Invoice
 *   9.  Panaszok           — Complaint, Category, PendingAgenda
 *   10. Dokumentumok       — DocumentCategory, Document, Version
 *   11. Infrastruktúra     — AuditLog, Task, GeneratedReport, Notification
 *
 * Layout strategy (per domain):
 *   - Auto-grid: ceil(sqrt(N)) columns
 *   - Box width 240, height = 30 + 18*nFields
 *   - 60px horizontal gap, 50px vertical gap
 *   - Cross-domain FK refs shown as muted "ghost" boxes anchored below the row
 *   - Edges routed orthogonally
 *
 * Usage:
 *   node scripts/generate-data-model.mjs
 */

import { writeFileSync } from "node:fs";

// ──────────────────────────────────────────────────────────────────────────
// ENTITY METADATA
// ──────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ name: string, type: string, fk?: string }} Field
 * @typedef {{ name: string, fields: Field[], domain: string }} Entity
 */

/** @type {Entity[]} */
const entities = [
  // ── Subscription / Identity ────────────────────────────────────────────
  {
    name: "Plan",
    domain: "subscription",
    fields: [
      { name: "id", type: "String @id" },
      { name: "name", type: "String" },
      { name: "slug", type: "String @unique" },
      { name: "maxBuildings", type: "Int" },
      { name: "maxUnitsPerBuilding", type: "Int" },
      { name: "features", type: "Json" },
      { name: "priceMonthly", type: "Decimal" },
      { name: "priceYearly", type: "Decimal" },
      { name: "trialDays", type: "Int" },
      { name: "isActive", type: "Boolean" },
    ],
  },
  {
    name: "Subscription",
    domain: "subscription",
    fields: [
      { name: "id", type: "String @id" },
      { name: "name", type: "String" },
      { name: "email", type: "String" },
      { name: "planId", type: "String", fk: "Plan" },
      { name: "ownerId", type: "String", fk: "User" },
      { name: "stripeCustomerId", type: "String?" },
      { name: "stripeSubscriptionId", type: "String?" },
      { name: "subscriptionStatus", type: "SubscriptionStatus" },
      { name: "trialEndsAt", type: "DateTime?" },
    ],
  },
  {
    name: "Invitation",
    domain: "subscription",
    fields: [
      { name: "id", type: "String @id" },
      { name: "email", type: "String" },
      { name: "tokenHash", type: "String @unique" },
      { name: "type", type: "InvitationType" },
      { name: "role", type: "BuildingRole?" },
      { name: "unitId", type: "String?", fk: "Unit" },
      { name: "buildingId", type: "String?", fk: "Building" },
      { name: "subscriptionId", type: "String?", fk: "Subscription" },
      { name: "invitedById", type: "String?", fk: "User" },
      { name: "expiresAt", type: "DateTime" },
      { name: "status", type: "InvitationStatus" },
    ],
  },
  {
    name: "User",
    domain: "subscription",
    fields: [
      { name: "id", type: "String @id" },
      { name: "email", type: "String @unique" },
      { name: "passwordHash", type: "String" },
      { name: "name", type: "String" },
      { name: "language", type: "String" },
      { name: "phone", type: "String?" },
      { name: "totpSecret", type: "String?" },
      { name: "emailVerifiedAt", type: "DateTime?" },
      { name: "deletedAt", type: "DateTime?" },
    ],
  },

  // ── Building ───────────────────────────────────────────────────────────
  {
    name: "Building",
    domain: "building",
    fields: [
      { name: "id", type: "String @id" },
      { name: "name", type: "String" },
      { name: "address", type: "String" },
      { name: "city", type: "String" },
      { name: "zipCode", type: "String" },
      { name: "subscriptionId", type: "String?", fk: "Subscription" },
      { name: "isFrozen", type: "Boolean" },
    ],
  },
  {
    name: "Unit",
    domain: "building",
    fields: [
      { name: "id", type: "String @id" },
      { name: "number", type: "String" },
      { name: "floor", type: "Int" },
      { name: "stairwell", type: "String?" },
      { name: "ownershipShare", type: "Decimal" },
      { name: "size", type: "Decimal" },
      { name: "buildingId", type: "String", fk: "Building" },
    ],
  },
  {
    name: "UserBuilding",
    domain: "building",
    fields: [
      { name: "id", type: "String @id" },
      { name: "userId", type: "String", fk: "User" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "role", type: "BuildingRole" },
      { name: "isActive", type: "Boolean" },
    ],
  },
  {
    name: "UnitUser",
    domain: "building",
    fields: [
      { name: "id", type: "String @id" },
      { name: "userId", type: "String", fk: "User" },
      { name: "unitId", type: "String", fk: "Unit" },
      { name: "relationship", type: "UnitRelationship" },
      { name: "isPrimaryContact", type: "Boolean" },
    ],
  },
  {
    name: "BoardPermission",
    domain: "building",
    fields: [
      { name: "id", type: "String @id" },
      { name: "key", type: "String @unique" },
      { name: "labelKey", type: "String" },
      { name: "sortOrder", type: "Int" },
    ],
  },
  {
    name: "UserBuildingPermission",
    domain: "building",
    fields: [
      { name: "id", type: "String @id" },
      { name: "userBuildingId", type: "String", fk: "UserBuilding" },
      { name: "permissionId", type: "String", fk: "BoardPermission" },
      { name: "grantedAt", type: "DateTime" },
    ],
  },
  {
    name: "BoardResignation",
    domain: "building",
    fields: [
      { name: "id", type: "String @id" },
      { name: "userBuildingId", type: "String", fk: "UserBuilding" },
      { name: "status", type: "ResignationStatus" },
      { name: "reason", type: "String?" },
      { name: "submittedAt", type: "DateTime" },
      { name: "acknowledgedAt", type: "DateTime?" },
    ],
  },

  // ── Communication ──────────────────────────────────────────────────────
  {
    name: "Channel",
    domain: "communication",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "kind", type: "ChannelKind" },
      { name: "name", type: "String?" },
      { name: "isPrivate", type: "Boolean" },
      { name: "isOfficial", type: "Boolean" },
    ],
  },
  {
    name: "ChannelMember",
    domain: "communication",
    fields: [
      { name: "id", type: "String @id" },
      { name: "channelId", type: "String", fk: "Channel" },
      { name: "userId", type: "String", fk: "User" },
      { name: "lastReadMessageId", type: "String?" },
      { name: "isAdmin", type: "Boolean" },
    ],
  },
  {
    name: "ChannelMessage",
    domain: "communication",
    fields: [
      { name: "id", type: "String @id" },
      { name: "channelId", type: "String", fk: "Channel" },
      { name: "authorId", type: "String", fk: "User" },
      { name: "kind", type: "MessageKind" },
      { name: "title", type: "String?" },
      { name: "body", type: "Text?" },
      { name: "parentId", type: "String?", fk: "ChannelMessage" },
      { name: "isPinned", type: "Boolean" },
    ],
  },
  {
    name: "MessageRead",
    domain: "communication",
    fields: [
      { name: "id", type: "String @id" },
      { name: "messageId", type: "String", fk: "ChannelMessage" },
      { name: "userId", type: "String", fk: "User" },
      { name: "readAt", type: "DateTime" },
    ],
  },
  {
    name: "Poll",
    domain: "communication",
    fields: [
      { name: "id", type: "String @id" },
      { name: "messageId", type: "String @unique", fk: "ChannelMessage" },
      { name: "question", type: "String" },
      { name: "allowMultiple", type: "Boolean" },
      { name: "closesAt", type: "DateTime?" },
      { name: "closedAt", type: "DateTime?" },
    ],
  },
  {
    name: "PollOption",
    domain: "communication",
    fields: [
      { name: "id", type: "String @id" },
      { name: "pollId", type: "String", fk: "Poll" },
      { name: "label", type: "String" },
      { name: "position", type: "Int" },
    ],
  },
  {
    name: "PollVote",
    domain: "communication",
    fields: [
      { name: "id", type: "String @id" },
      { name: "pollId", type: "String", fk: "Poll" },
      { name: "optionId", type: "String", fk: "PollOption" },
      { name: "userId", type: "String", fk: "User" },
    ],
  },

  // ── Meetings & Voting ──────────────────────────────────────────────────
  {
    name: "Meeting",
    domain: "voting",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "title", type: "String" },
      { name: "date", type: "DateTime" },
      { name: "time", type: "String" },
      { name: "location", type: "String?" },
      { name: "agenda", type: "Json" },
      { name: "minutes", type: "Text?" },
      { name: "isRepeated", type: "Boolean" },
    ],
  },
  {
    name: "MeetingRsvp",
    domain: "voting",
    fields: [
      { name: "id", type: "String @id" },
      { name: "meetingId", type: "String", fk: "Meeting" },
      { name: "userId", type: "String", fk: "User" },
      { name: "status", type: "RsvpStatus" },
    ],
  },
  {
    name: "MeetingAttendance",
    domain: "voting",
    fields: [
      { name: "id", type: "String @id" },
      { name: "meetingId", type: "String", fk: "Meeting" },
      { name: "unitId", type: "String", fk: "Unit" },
      { name: "checkedIn", type: "Boolean" },
      { name: "checkedInAt", type: "DateTime" },
      { name: "checkedOutAt", type: "DateTime?" },
    ],
  },
  {
    name: "Vote",
    domain: "voting",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "meetingId", type: "String?", fk: "Meeting" },
      { name: "title", type: "String" },
      { name: "voteType", type: "VoteType" },
      { name: "status", type: "VoteStatus" },
      { name: "majorityType", type: "MajorityType" },
      { name: "isSecret", type: "Boolean" },
      { name: "deadline", type: "DateTime" },
    ],
  },
  {
    name: "VoteOption",
    domain: "voting",
    fields: [
      { name: "id", type: "String @id" },
      { name: "voteId", type: "String", fk: "Vote" },
      { name: "label", type: "String" },
      { name: "sortOrder", type: "Int" },
    ],
  },
  {
    name: "Ballot",
    domain: "voting",
    fields: [
      { name: "id", type: "String @id" },
      { name: "voteId", type: "String", fk: "Vote" },
      { name: "optionId", type: "String", fk: "VoteOption" },
      { name: "unitId", type: "String", fk: "Unit" },
      { name: "userId", type: "String?", fk: "User" },
      { name: "weight", type: "Decimal" },
      { name: "receiptHash", type: "String?" },
    ],
  },
  {
    name: "ProxyAssignment",
    domain: "voting",
    fields: [
      { name: "id", type: "String @id" },
      { name: "grantorId", type: "String", fk: "User" },
      { name: "granteeId", type: "String", fk: "User" },
      { name: "voteId", type: "String?", fk: "Vote" },
      { name: "validFrom", type: "DateTime" },
      { name: "validUntil", type: "DateTime?" },
    ],
  },
  {
    name: "MeetingMinutesSignature",
    domain: "voting",
    fields: [
      { name: "id", type: "String @id" },
      { name: "meetingId", type: "String", fk: "Meeting" },
      { name: "signerId", type: "String", fk: "User" },
      { name: "role", type: "MinutesSignatureRole" },
      { name: "signedAt", type: "DateTime" },
    ],
  },

  // ── Finance ────────────────────────────────────────────────────────────
  {
    name: "Account",
    domain: "finance",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "name", type: "String" },
      { name: "type", type: "AccountType" },
      { name: "parentId", type: "String?", fk: "Account" },
    ],
  },
  {
    name: "LedgerEntry",
    domain: "finance",
    fields: [
      { name: "id", type: "String @id" },
      { name: "date", type: "DateTime" },
      { name: "debitAccountId", type: "String", fk: "Account" },
      { name: "creditAccountId", type: "String", fk: "Account" },
      { name: "amount", type: "Decimal" },
      { name: "description", type: "String" },
      { name: "createdById", type: "String", fk: "User" },
    ],
  },
  {
    name: "MonthlyCharge",
    domain: "finance",
    fields: [
      { name: "id", type: "String @id" },
      { name: "unitId", type: "String", fk: "Unit" },
      { name: "month", type: "String" },
      { name: "amount", type: "Decimal" },
      { name: "status", type: "ChargeStatus" },
      { name: "paidAt", type: "DateTime?" },
    ],
  },
  {
    name: "Budget",
    domain: "finance",
    fields: [
      { name: "id", type: "String @id" },
      { name: "year", type: "Int" },
      { name: "accountId", type: "String", fk: "Account" },
      { name: "plannedAmount", type: "Decimal" },
    ],
  },

  // ── Maintenance ────────────────────────────────────────────────────────
  {
    name: "MaintenanceTicket",
    domain: "maintenance",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "reporterId", type: "String", fk: "User" },
      { name: "title", type: "String" },
      { name: "category", type: "MaintenanceCategory" },
      { name: "urgency", type: "Urgency" },
      { name: "status", type: "TicketStatus" },
      { name: "assignedContractorId", type: "String?", fk: "Contractor" },
      { name: "awardedContractorId", type: "String?", fk: "ContractorOrg" },
    ],
  },
  {
    name: "TicketComment",
    domain: "maintenance",
    fields: [
      { name: "id", type: "String @id" },
      { name: "ticketId", type: "String", fk: "MaintenanceTicket" },
      { name: "authorId", type: "String", fk: "User" },
      { name: "body", type: "Text" },
      { name: "isInternal", type: "Boolean" },
    ],
  },
  {
    name: "Contractor",
    domain: "maintenance",
    fields: [
      { name: "id", type: "String @id" },
      { name: "name", type: "String" },
      { name: "specialty", type: "String" },
      { name: "contactInfo", type: "String" },
      { name: "taxId", type: "String?" },
    ],
  },
  {
    name: "ScheduledMaintenance",
    domain: "maintenance",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "title", type: "String" },
      { name: "date", type: "DateTime" },
      { name: "isRecurring", type: "Boolean" },
      { name: "recurrenceMonths", type: "Int?" },
      { name: "leadTimeDays", type: "Int" },
    ],
  },
  {
    name: "ContractorRating",
    domain: "maintenance",
    fields: [
      { name: "id", type: "String @id" },
      { name: "contractorId", type: "String?", fk: "Contractor" },
      { name: "contractorOrgId", type: "String?", fk: "ContractorOrg" },
      { name: "ticketId", type: "String", fk: "MaintenanceTicket" },
      { name: "raterId", type: "String", fk: "User" },
      { name: "rating", type: "Int" },
    ],
  },

  // ── Marketplace ────────────────────────────────────────────────────────
  {
    name: "ContractorOrg",
    domain: "marketplace",
    fields: [
      { name: "id", type: "String @id" },
      { name: "name", type: "String" },
      { name: "taxId", type: "String @unique" },
      { name: "specialties", type: "Json" },
      { name: "regions", type: "Json" },
      { name: "plan", type: "ContractorPlan" },
      { name: "status", type: "ContractorOrgStatus" },
      { name: "stripeCustomerId", type: "String?" },
      { name: "dpaSignedAt", type: "DateTime?" },
    ],
  },
  {
    name: "ContractorUser",
    domain: "marketplace",
    fields: [
      { name: "id", type: "String @id" },
      { name: "orgId", type: "String", fk: "ContractorOrg" },
      { name: "email", type: "String @unique" },
      { name: "passwordHash", type: "String" },
      { name: "name", type: "String" },
      { name: "role", type: "ContractorUserRole" },
    ],
  },
  {
    name: "MarketplacePublication",
    domain: "marketplace",
    fields: [
      { name: "id", type: "String @id" },
      { name: "ticketId", type: "String @unique", fk: "MaintenanceTicket" },
      { name: "status", type: "MarketplacePublishStatus" },
      { name: "scrubbedTitle", type: "String" },
      { name: "category", type: "String" },
      { name: "urgency", type: "String" },
      { name: "city", type: "String" },
      { name: "publishedById", type: "String", fk: "User" },
      { name: "awardedBidId", type: "String?", fk: "MarketplaceBid" },
    ],
  },
  {
    name: "MarketplaceBid",
    domain: "marketplace",
    fields: [
      { name: "id", type: "String @id" },
      { name: "publicationId", type: "String", fk: "MarketplacePublication" },
      { name: "bidderId", type: "String", fk: "ContractorOrg" },
      { name: "amount", type: "Decimal" },
      { name: "etaDays", type: "Int" },
      { name: "status", type: "MarketplaceBidStatus" },
      { name: "decisionReason", type: "Text?" },
    ],
  },
  {
    name: "MarketplaceInvoice",
    domain: "marketplace",
    fields: [
      { name: "id", type: "String @id" },
      { name: "bidId", type: "String @unique", fk: "MarketplaceBid" },
      { name: "invoiceNumber", type: "String" },
      { name: "grossAmount", type: "Decimal" },
      { name: "issuedAt", type: "DateTime" },
      { name: "dueAt", type: "DateTime" },
      { name: "status", type: "MarketplaceInvoiceStatus" },
      { name: "paidAt", type: "DateTime?" },
    ],
  },
  {
    name: "MarketplaceFitScore",
    domain: "marketplace",
    fields: [
      { name: "id", type: "String @id" },
      { name: "publicationId", type: "String", fk: "MarketplacePublication" },
      { name: "bidId", type: "String @unique", fk: "MarketplaceBid" },
      { name: "score", type: "Int" },
      { name: "rationale", type: "Text" },
      { name: "weightsVersion", type: "String" },
    ],
  },

  // ── Complaints ─────────────────────────────────────────────────────────
  {
    name: "Complaint",
    domain: "complaints",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "authorId", type: "String", fk: "User" },
      { name: "categoryId", type: "String", fk: "ComplaintCategory" },
      { name: "respondentUnitId", type: "String?", fk: "Unit" },
      { name: "title", type: "String?" },
      { name: "description", type: "Text" },
      { name: "trackingNumber", type: "String @unique" },
      { name: "status", type: "ComplaintStatus" },
      { name: "isPrivate", type: "Boolean" },
    ],
  },
  {
    name: "ComplaintCategory",
    domain: "complaints",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "slug", type: "String" },
      { name: "name", type: "String" },
      { name: "icon", type: "String?" },
      { name: "isDefault", type: "Boolean" },
      { name: "isActive", type: "Boolean" },
    ],
  },
  {
    name: "ComplaintNote",
    domain: "complaints",
    fields: [
      { name: "id", type: "String @id" },
      { name: "complaintId", type: "String", fk: "Complaint" },
      { name: "authorId", type: "String", fk: "User" },
      { name: "body", type: "Text" },
      { name: "isInternal", type: "Boolean" },
    ],
  },
  {
    name: "ComplaintStatusEvent",
    domain: "complaints",
    fields: [
      { name: "id", type: "String @id" },
      { name: "complaintId", type: "String", fk: "Complaint" },
      { name: "fromStatus", type: "ComplaintStatus?" },
      { name: "toStatus", type: "ComplaintStatus" },
      { name: "actorId", type: "String", fk: "User" },
      { name: "note", type: "Text?" },
    ],
  },
  {
    name: "PendingAgendaItem",
    domain: "complaints",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "kind", type: "PendingAgendaKind" },
      { name: "complaintId", type: "String? @unique", fk: "Complaint" },
      { name: "resignationId", type: "String? @unique", fk: "BoardResignation" },
      { name: "attachedMeetingId", type: "String?", fk: "Meeting" },
      { name: "resolvedAt", type: "DateTime?" },
    ],
  },

  // ── Documents ──────────────────────────────────────────────────────────
  {
    name: "DocumentCategory",
    domain: "documents",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "name", type: "String" },
      { name: "icon", type: "String?" },
      { name: "parentId", type: "String?", fk: "DocumentCategory" },
      { name: "sortOrder", type: "Int" },
    ],
  },
  {
    name: "Document",
    domain: "documents",
    fields: [
      { name: "id", type: "String @id" },
      { name: "categoryId", type: "String", fk: "DocumentCategory" },
      { name: "title", type: "String" },
      { name: "visibility", type: "DocumentVisibility" },
      { name: "tags", type: "Json" },
      { name: "isPinned", type: "Boolean" },
      { name: "expiresAt", type: "DateTime?" },
      { name: "uploadedById", type: "String", fk: "User" },
    ],
  },
  {
    name: "DocumentVersion",
    domain: "documents",
    fields: [
      { name: "id", type: "String @id" },
      { name: "documentId", type: "String", fk: "Document" },
      { name: "versionNumber", type: "Int" },
      { name: "fileUrl", type: "String" },
      { name: "fileName", type: "String" },
      { name: "fileSize", type: "Int" },
      { name: "mimeType", type: "String" },
      { name: "uploadedById", type: "String", fk: "User" },
    ],
  },

  // ── Infrastructure ─────────────────────────────────────────────────────
  {
    name: "AuditLog",
    domain: "infra",
    fields: [
      { name: "id", type: "String @id" },
      { name: "userId", type: "String", fk: "User" },
      { name: "buildingId", type: "String?", fk: "Building" },
      { name: "entityType", type: "String" },
      { name: "entityId", type: "String" },
      { name: "action", type: "String" },
      { name: "oldValue", type: "Json?" },
      { name: "newValue", type: "Json?" },
    ],
  },
  {
    name: "Task",
    domain: "infra",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "title", type: "String" },
      { name: "body", type: "String?" },
      { name: "dueDate", type: "DateTime?" },
      { name: "priority", type: "TaskPriority" },
      { name: "status", type: "TaskStatus" },
      { name: "assigneeId", type: "String?", fk: "User" },
      { name: "createdById", type: "String", fk: "User" },
    ],
  },
  {
    name: "GeneratedReport",
    domain: "infra",
    fields: [
      { name: "id", type: "String @id" },
      { name: "buildingId", type: "String", fk: "Building" },
      { name: "kind", type: "String" },
      { name: "period", type: "String" },
      { name: "status", type: "ReportStatus" },
      { name: "storageKey", type: "String?" },
      { name: "generatedById", type: "String", fk: "User" },
    ],
  },
  {
    name: "Notification",
    domain: "infra",
    fields: [
      { name: "id", type: "String @id" },
      { name: "userId", type: "String?", fk: "User" },
      { name: "contractorUserId", type: "String?", fk: "ContractorUser" },
      { name: "type", type: "String" },
      { name: "title", type: "String" },
      { name: "body", type: "String" },
      { name: "isRead", type: "Boolean" },
    ],
  },
  {
    name: "UserSession",
    domain: "infra",
    fields: [
      { name: "id", type: "String @id" },
      { name: "userId", type: "String", fk: "User" },
      { name: "tokenId", type: "String @unique" },
      { name: "deviceLabel", type: "String?" },
      { name: "lastActiveAt", type: "DateTime" },
      { name: "revokedAt", type: "DateTime?" },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// DOMAIN METADATA
// ──────────────────────────────────────────────────────────────────────────

/** @type {{ key: string, label: string, color: string, stroke: string }[]} */
const domains = [
  { key: "subscription",  label: "Előfizetés & azonosítás", color: "#dae8fc", stroke: "#6c8ebf" },
  { key: "building",      label: "Épület struktúra",       color: "#fff2cc", stroke: "#d6b656" },
  { key: "communication", label: "Kommunikáció",           color: "#d4e1f5", stroke: "#5d7b9d" },
  { key: "voting",        label: "Közgyűlés & szavazás",   color: "#e1d5e7", stroke: "#9673a6" },
  { key: "finance",       label: "Pénzügy",                color: "#fff9e6", stroke: "#b08020" },
  { key: "maintenance",   label: "Maintenance",            color: "#ffe6cc", stroke: "#d79b00" },
  { key: "marketplace",   label: "Vállalkozói piactér",    color: "#d5e8d4", stroke: "#82b366" },
  { key: "complaints",    label: "Panaszok",               color: "#f8cecc", stroke: "#b85450" },
  { key: "documents",     label: "Dokumentumok",           color: "#e6e6e6", stroke: "#666666" },
  { key: "infra",         label: "Infrastruktúra",         color: "#f5f5f5", stroke: "#909090" },
];

function domainOf(name) {
  return entities.find((e) => e.name === name)?.domain;
}

function domainInfo(key) {
  return domains.find((d) => d.key === key);
}

// ──────────────────────────────────────────────────────────────────────────
// XML HELPERS
// ──────────────────────────────────────────────────────────────────────────

const escXml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const BOX_W = 240;
const TITLE_H = 30;
const FIELD_H = 18;
const GHOST_H = 30;

function entityHeight(fields) {
  return TITLE_H + fields.length * FIELD_H + 4;
}

/**
 * Render one UML class box at given (x, y).
 * @param {Entity} ent
 */
function renderClassBox(ent, x, y, opts = {}) {
  const dom = domainInfo(ent.domain);
  const fill = opts.fill ?? dom.color;
  const stroke = opts.stroke ?? dom.stroke;
  const h = entityHeight(ent.fields);

  let xml = "";

  // Container swimlane
  xml += `<mxCell id="${ent.name}" value="${escXml(ent.name)}" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=${TITLE_H};fillColor=${fill};strokeColor=${stroke};fontSize=13;swimlaneFillColor=#ffffff;" vertex="1" parent="1">
    <mxGeometry x="${x}" y="${y}" width="${BOX_W}" height="${h}" as="geometry"/>
  </mxCell>\n`;

  // Field rows
  for (let i = 0; i < ent.fields.length; i++) {
    const f = ent.fields[i];
    const isFK = !!f.fk;
    const label = `${f.name}: ${f.type}`;
    const fontStyle = isFK ? "fontStyle=2;fontColor=#4a5a3e;" : "";
    xml += `<mxCell id="${ent.name}__f${i}" value="${escXml(label)}" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;spacingRight=4;fontSize=11;${fontStyle}" vertex="1" parent="${ent.name}">
      <mxGeometry y="${TITLE_H + i * FIELD_H}" width="${BOX_W}" height="${FIELD_H}" as="geometry"/>
    </mxCell>\n`;
  }

  return xml;
}

/**
 * Render a "ghost" stub for a cross-domain reference.
 * Just the class name in a muted, dashed box.
 */
function renderGhostBox(name, x, y) {
  const dom = domainInfo(domainOf(name));
  const fill = dom ? dom.color : "#f5f5f5";
  const stroke = dom ? dom.stroke : "#999";
  return `<mxCell id="${name}" value="${escXml(name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontSize=12;fontStyle=1;align=center;verticalAlign=middle;dashed=1;opacity=70;" vertex="1" parent="1">
    <mxGeometry x="${x}" y="${y}" width="${BOX_W * 0.7}" height="${GHOST_H}" as="geometry"/>
  </mxCell>\n`;
}

/**
 * Render an FK relationship edge.
 * Source = entity with the FK; target = referenced entity.
 * Adds "*" on source side, "1" or "0..1" on target side based on optional FK.
 */
function renderEdge(id, sourceId, targetId, opts = {}) {
  const optional = opts.optional ?? false;
  const targetMult = optional ? "0..1" : "1";
  const sourceMult = opts.sourceMult ?? "*";
  const dashed = opts.dashed ? "dashed=1;" : "";

  return `<mxCell id="${id}" style="endArrow=open;html=1;edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=0.5;exitY=0;exitDx=0;exitDy=0;entryX=0.5;entryY=1;entryDx=0;entryDy=0;endFill=0;${dashed}" edge="1" parent="1" source="${sourceId}" target="${targetId}">
    <mxGeometry relative="1" as="geometry">
      <Array as="points"/>
    </mxGeometry>
  </mxCell>
  <mxCell id="${id}__lblS" value="${sourceMult}" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];fontSize=10;fontColor=#666;" vertex="1" connectable="0" parent="${id}">
    <mxGeometry x="-0.7" relative="1" as="geometry"><mxPoint as="offset"/></mxGeometry>
  </mxCell>
  <mxCell id="${id}__lblT" value="${targetMult}" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];fontSize=10;fontColor=#666;" vertex="1" connectable="0" parent="${id}">
    <mxGeometry x="0.7" relative="1" as="geometry"><mxPoint as="offset"/></mxGeometry>
  </mxCell>\n`;
}

// ──────────────────────────────────────────────────────────────────────────
// PER-DOMAIN DIAGRAM
// ──────────────────────────────────────────────────────────────────────────

function gridLayout(domEnts, ghosts) {
  // Compute grid columns based on count
  const total = domEnts.length;
  const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(total))));

  const gapX = 80;
  const gapY = 60;
  const startX = 80;
  const startY = 90;

  const positions = new Map();
  let row = 0;
  let col = 0;
  let rowMaxH = 0;
  let rowY = startY;

  for (let i = 0; i < domEnts.length; i++) {
    const ent = domEnts[i];
    const h = entityHeight(ent.fields);
    const x = startX + col * (BOX_W + gapX);
    positions.set(ent.name, { x, y: rowY, h });
    rowMaxH = Math.max(rowMaxH, h);
    col++;
    if (col >= cols) {
      col = 0;
      row++;
      rowY += rowMaxH + gapY;
      rowMaxH = 0;
    }
  }

  // Ghosts row at the bottom
  if (col > 0) rowY += rowMaxH + gapY;
  const ghostStartX = startX;
  const ghostY = rowY + 20;
  const ghostGapX = 30;
  const ghostBoxW = BOX_W * 0.7;
  for (let i = 0; i < ghosts.length; i++) {
    const x = ghostStartX + i * (ghostBoxW + ghostGapX);
    positions.set(ghosts[i], { x, y: ghostY, ghost: true });
  }

  return { positions, ghostStartY: ghostY };
}

function renderDomainTab(domain) {
  const dom = domainInfo(domain);
  const domEnts = entities.filter((e) => e.domain === domain);

  // Find cross-domain FK targets
  const ghostNames = new Set();
  for (const ent of domEnts) {
    for (const f of ent.fields) {
      if (f.fk && domainOf(f.fk) !== domain) {
        ghostNames.add(f.fk);
      }
    }
  }
  const ghosts = Array.from(ghostNames);

  const { positions, ghostStartY } = gridLayout(domEnts, ghosts);

  let xml = "";

  // Title
  xml += `<mxCell id="title" value="&lt;b&gt;${escXml(dom.label)}&lt;/b&gt;" style="text;html=1;align=left;verticalAlign=middle;fontSize=20;fontColor=${dom.stroke};spacingLeft=4;" vertex="1" parent="1">
    <mxGeometry x="40" y="30" width="800" height="36" as="geometry"/>
  </mxCell>\n`;

  // Entities
  for (const ent of domEnts) {
    const pos = positions.get(ent.name);
    xml += renderClassBox(ent, pos.x, pos.y);
  }

  // Ghost boxes
  if (ghosts.length > 0) {
    xml += `<mxCell id="ghosts-label" value="külső entitások (más domain-ekből):" style="text;html=1;align=left;verticalAlign=middle;fontSize=11;fontColor=#666;fontStyle=2;spacingLeft=4;" vertex="1" parent="1">
      <mxGeometry x="80" y="${ghostStartY - 22}" width="400" height="20" as="geometry"/>
    </mxCell>\n`;
    for (const g of ghosts) {
      const pos = positions.get(g);
      xml += renderGhostBox(g, pos.x, pos.y);
    }
  }

  // Edges
  let edgeId = 0;
  for (const ent of domEnts) {
    for (const f of ent.fields) {
      if (!f.fk) continue;
      const optional = f.type.endsWith("?") || f.name.endsWith("?");
      edgeId++;
      xml += renderEdge(`e_${ent.name}_${f.name}_${edgeId}`, ent.name, f.fk, {
        optional,
        dashed: ghostNames.has(f.fk),
      });
    }
  }

  return xml;
}

// ──────────────────────────────────────────────────────────────────────────
// OVERVIEW DIAGRAM
// ──────────────────────────────────────────────────────────────────────────

function renderOverviewTab() {
  let xml = "";

  // Title
  xml += `<mxCell id="title" value="&lt;b&gt;Közös – Adatmodell áttekintés&lt;/b&gt;&lt;br&gt;&lt;span style='font-size:12px;color:#666'&gt;${entities.length} entitás, ${domains.length} domain&lt;/span&gt;" style="text;html=1;align=center;verticalAlign=middle;fontSize=22;fontColor=#16181a;" vertex="1" parent="1">
    <mxGeometry x="500" y="20" width="600" height="60" as="geometry"/>
  </mxCell>\n`;

  // Group entities by domain
  /** @type {Map<string, Entity[]>} */
  const byDomain = new Map();
  for (const dom of domains) byDomain.set(dom.key, []);
  for (const ent of entities) byDomain.get(ent.domain).push(ent);

  // Layout 5 columns × 2 rows
  const cols = 5;
  const boxW = 280;
  const boxH = 200;
  const gapX = 40;
  const gapY = 40;
  const startX = 60;
  const startY = 110;

  /** @type {Map<string, {x:number, y:number, w:number, h:number}>} */
  const domainPos = new Map();

  for (let i = 0; i < domains.length; i++) {
    const dom = domains[i];
    const list = byDomain.get(dom.key);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (boxW + gapX);
    const y = startY + row * (boxH + gapY);
    domainPos.set(dom.key, { x, y, w: boxW, h: boxH });

    // Domain block
    xml += `<mxCell id="dom_${dom.key}" value="&lt;b style='font-size:14px'&gt;${escXml(dom.label)}&lt;/b&gt;&lt;br&gt;&lt;span style='color:#666;font-size:10px'&gt;${list.length} entitás&lt;/span&gt;&lt;hr style='border:0;border-top:1px solid #ccc;margin:6px 0'&gt;&lt;span style='font-size:11px'&gt;${list.map((e) => e.name).join(" · ")}&lt;/span&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${dom.color};strokeColor=${dom.stroke};strokeWidth=2;align=left;verticalAlign=top;spacingLeft=10;spacingTop=10;spacingRight=10;fontSize=11;" vertex="1" parent="1">
      <mxGeometry x="${x}" y="${y}" width="${boxW}" height="${boxH}" as="geometry"/>
    </mxCell>\n`;
  }

  // Cross-domain relationships (aggregated)
  /** @type {Map<string, number>} */
  const xDomainEdges = new Map();
  for (const ent of entities) {
    for (const f of ent.fields) {
      if (f.fk) {
        const srcDom = ent.domain;
        const dstDom = domainOf(f.fk);
        if (srcDom && dstDom && srcDom !== dstDom) {
          const key = `${srcDom}|${dstDom}`;
          xDomainEdges.set(key, (xDomainEdges.get(key) ?? 0) + 1);
        }
      }
    }
  }

  let edgeNum = 0;
  for (const [pair, count] of xDomainEdges.entries()) {
    const [src, dst] = pair.split("|");
    edgeNum++;
    xml += `<mxCell id="ovedge_${edgeNum}" value="${count}" style="endArrow=open;html=1;edgeStyle=orthogonalEdgeStyle;rounded=1;jumpStyle=arc;strokeColor=#888;strokeWidth=1;endFill=0;fontSize=10;fontColor=#666;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="dom_${src}" target="dom_${dst}">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>\n`;
  }

  return xml;
}

// ──────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────

function buildDiagram(id, name, body, width = 2400, height = 1800) {
  return `<diagram id="${id}" name="${escXml(name)}">
    <mxGraphModel dx="2400" dy="1600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${body}
      </root>
    </mxGraphModel>
  </diagram>`;
}

function buildFile() {
  const tabs = [];

  // Overview
  tabs.push(buildDiagram("overview", "Áttekintés", renderOverviewTab(), 1800, 700));

  // Per-domain
  for (const dom of domains) {
    const body = renderDomainTab(dom.key);
    // Width based on entity count + ghosts
    const domEnts = entities.filter((e) => e.domain === dom.key);
    const ghostCount = (() => {
      const s = new Set();
      for (const e of domEnts) for (const f of e.fields) if (f.fk && domainOf(f.fk) !== dom.key) s.add(f.fk);
      return s.size;
    })();
    const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(domEnts.length))));
    const width = Math.max(1400, 80 + cols * (BOX_W + 80) + 200);
    const rows = Math.ceil(domEnts.length / cols);
    const height = Math.max(900, 110 + rows * 320 + (ghostCount > 0 ? 100 : 0));
    tabs.push(buildDiagram(`dom-${dom.key}`, dom.label, body, width, height));
  }

  return `<mxfile host="app.diagrams.net" agent="Claude Code – generator" version="26.0.0">
  <!-- ============================================================ -->
  <!-- Közös – Adatmodell UML                                       -->
  <!-- Generated by scripts/generate-data-model.mjs                  -->
  <!-- Forrás: prisma/schema.prisma                                  -->
  <!-- ============================================================ -->
${tabs.join("\n")}
</mxfile>`;
}

const out = "/Users/siposzoltan/projects/condo-manager/docs/data-model.drawio.xml";
writeFileSync(out, buildFile(), "utf8");
console.log(`Wrote ${out}`);
console.log(`  entities: ${entities.length}`);
console.log(`  domains:  ${domains.length}`);
console.log(`  tabs:     ${1 + domains.length}`);
