/**
 * Public surface of the contractor domain — data-access layer.
 *
 * Routes and RSCs import from this file (`@/lib/contractor`) instead of
 * reaching into `./dal` directly (per §1 of the refactor plan). The
 * other modules in this folder (`session`, `taxonomy`, `activation`,
 * etc.) remain separately importable until their own consolidation —
 * they're service code, not data access.
 */

export {
  getOrgStatus,
  getOrgName,
  findOrgByTaxId,
  findContractorUserById,
  setContractorUserEmailVerified,
  findContractorUserByEmail,
  createContractorOrgWithOwner,
  getOrgForReadiness,
  getOrgForActivation,
  setOrgStatusActive,
  getOrgSpecialties,
  getOrgForBillingPage,
  getOrgForBillingCheckout,
  getOrgForOnboardingWizard,
  getOrgForFinalize,
  getOrgForGdprExport,
  updateOrgProfile,
  updateOrgSpecialties,
  updateOrgRegions,
  setOrgDpaSigned,
  setOrgNavConfirmed,
  activateOrgViaDevCheckout,
  listOrgDocuments,
  createOrgDocument,
  getOrgDocument,
  deleteOrgDocument,
} from "./dal";
