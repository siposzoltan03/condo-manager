/**
 * Public surface of the marketplace domain.
 *
 * Routes and RSCs import from this file (`@/lib/marketplace`), never
 * from `./dal` directly. Service functions are re-exported below; the
 * read-only DAL helpers used by routes are also re-exported verbatim —
 * no pass-through wrappers (see plan §1, "Reads vs. writes through
 * `index.ts`").
 *
 * Phase A transitional note: a handful of *write* DAL helpers are also
 * re-exported because the routes that orchestrate them haven't been
 * slimmed yet (the route-slimming work is Phase F). Once those routes
 * move their orchestration into services, the write re-exports here
 * disappear and the rule "writes go through services" becomes
 * physically enforced. Marked `// write — phase F removes` below.
 */

// ── Services ──────────────────────────────────────────────────────────
export {
  createOrUpdateBid,
  awardBid,
  getBidByContractor,
  getBidsForPublication,
  type AwardOutcome,
  type SubmitBidInput,
  type SubmitBidResult,
  type SubmitBidError,
} from "./bidding";

export {
  publishTicketToMarketplace,
  closePublication,
  getOpenPublications,
  getPublicationByTicket,
  type PublishInput,
  type PublishedResult,
  type OpenPublicationsFilter,
} from "./publishing";

export { dispatchAwardOutcome } from "./award-notify";

export {
  createAwardVote,
  resolveAwardVote,
  AWARD_VOTE_QUORUM,
  type CreateAwardVoteResult,
  type ResolveAwardVoteResult,
} from "./award-vote";

export {
  resolveBoardAccess,
  resolveContractorAccess,
  readThread,
  appendMessage,
  type ThreadAccess,
  type ThreadMessage,
  type SenderSide,
} from "./messaging";

export { getHistoricalMedian } from "./median";

export {
  getTrustSummaries,
  type TrustBadgeSlug,
  type TrustSummary,
} from "./trust";

export {
  computeFitScores,
  WEIGHTS_VERSION,
  type FitScore,
  type FactorSnapshot,
} from "./fit-scoring";

export {
  PLAN_CAPS,
  getEffectivePlan,
  isWithinBidThroughput,
  isWithinSpecialtyCap,
  isWithinRegionCap,
  type Plan,
  type PlanCaps,
  type EffectivePlan,
} from "./pricing";

export {
  bidWasSubmitted,
  bidWasUpdated,
  bidWasAwarded,
  bidWasRejected,
  projectStatusAdvanced,
  invoiceWasSubmitted,
  invoiceWasPaid,
  messageFromContractor,
  messageFromBoard,
} from "./events";

// ── Read DAL functions — verbatim re-exports for routes/RSCs ──────────
export {
  findPublicationByTicketId,
  findPublicationForContractorDetail,
  findPublicationPublisher,
  findPublicationTitle,
  findInvoiceFileById,
  findBidForStatusUpdate,
  findBidForInvoiceUpload,
  findLoserBidsForEmail,
  findTicketForAwardRoute,
  findTicketForMarkPaidRoute,
  findContractorOrgOwner,
  findContractorOrgWithOwner,
  // Phase B RSC targets:
  listWonBids,
  getWonBidWithProject,
  findContractorWonBidForPublication,
  getInvoiceForTicketPublication,
  // Phase C RSC targets:
  listAllBidsByOrg,
  countActiveBidsByOrgSince,
  // GDPR export (cross-domain composition at route layer):
  listAllBidsByOrgForExport,
  listAllMessagesByOrgForExport,
} from "./dal";

// ── Write DAL functions — phase F removes ─────────────────────────────
// Routes still orchestrate these directly; once they get slimmed into
// services those services own the writes and these re-exports disappear.
export {
  upsertInvoice, // write — phase F removes
  setInvoicePaid, // write — phase F removes
  setTicketStatus, // write — phase F removes
  runTransaction, // write helper — phase F removes
} from "./dal";
