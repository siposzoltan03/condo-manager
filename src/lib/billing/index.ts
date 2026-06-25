/**
 * Public surface of the billing domain.
 *
 * Routes import handlers from `@/lib/billing` and the route's only job
 * is signature verification + dispatch — no business logic, no prisma.
 */

export {
  handleCheckoutCompleted,
  handleContractorCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleContractorSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleContractorSubscriptionDeleted,
} from "./webhook-handlers";
