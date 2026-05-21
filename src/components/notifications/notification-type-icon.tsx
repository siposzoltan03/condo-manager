import {
  Bell,
  Megaphone,
  Mail,
  Wrench,
  Wallet,
  Vote,
  AlertTriangle,
  CalendarCheck,
  FileText,
  Briefcase,
  Receipt,
  CheckCircle2,
  XCircle,
  PlayCircle,
} from "lucide-react";

interface Visuals {
  Icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  /** CSS color expression for the icon glyph. */
  color: string;
  /** CSS color expression for the soft halo background ring. */
  halo: string;
}

const TYPE_VISUALS: Record<string, Visuals> = {
  ANNOUNCEMENT_NEW: {
    Icon: Megaphone,
    color: "var(--color-blue)",
    halo: "color-mix(in srgb, var(--color-blue) 14%, transparent)",
  },
  MESSAGE_NEW: {
    Icon: Mail,
    color: "var(--color-ink-soft)",
    halo: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
  },
  MAINTENANCE_STATUS: {
    Icon: Wrench,
    color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
    halo: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
  },
  PAYMENT_REMINDER: {
    Icon: Wallet,
    color: "var(--color-good)",
    halo: "color-mix(in srgb, var(--color-good) 16%, transparent)",
  },
  VOTE_OPEN: {
    Icon: Vote,
    color: "var(--color-ink)",
    halo: "var(--color-bg-3)",
  },
  VOTE_CLOSING: {
    Icon: Vote,
    color: "var(--color-ink)",
    halo: "var(--color-bg-3)",
  },
  COMPLAINT_STATUS: {
    Icon: AlertTriangle,
    color: "var(--color-danger)",
    halo: "color-mix(in srgb, var(--color-danger) 14%, transparent)",
  },
  MEETING_RSVP: {
    Icon: CalendarCheck,
    color: "var(--color-moss)",
    halo: "color-mix(in srgb, var(--color-moss) 16%, transparent)",
  },
  REPORT_READY: {
    Icon: FileText,
    color: "var(--color-moss)",
    halo: "color-mix(in srgb, var(--color-moss) 16%, transparent)",
  },
  MARKETPLACE_NEW_BID: {
    Icon: Briefcase,
    color: "var(--color-ink)",
    halo: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
  },
  MARKETPLACE_MESSAGE_CONTRACTOR: {
    Icon: Mail,
    color: "var(--color-ink-soft)",
    halo: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
  },
  MARKETPLACE_MESSAGE_BOARD: {
    Icon: Mail,
    color: "var(--color-ink-soft)",
    halo: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
  },
  MARKETPLACE_NO_BIDS_AFTER_72H: {
    Icon: AlertTriangle,
    color: "var(--color-ochre)",
    halo: "color-mix(in srgb, var(--color-ochre) 18%, transparent)",
  },
  MARKETPLACE_PROJECT_STATUS: {
    Icon: PlayCircle,
    color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
    halo: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
  },
  MARKETPLACE_INVOICE_NEW: {
    Icon: Receipt,
    color: "var(--color-ink)",
    halo: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
  },
  MARKETPLACE_BID_WON: {
    Icon: CheckCircle2,
    color: "var(--color-good)",
    halo: "color-mix(in srgb, var(--color-good) 16%, transparent)",
  },
  MARKETPLACE_BID_REJECTED: {
    Icon: XCircle,
    color: "var(--color-danger)",
    halo: "color-mix(in srgb, var(--color-danger) 14%, transparent)",
  },
  MARKETPLACE_INVOICE_PAID: {
    Icon: Wallet,
    color: "var(--color-good)",
    halo: "color-mix(in srgb, var(--color-good) 16%, transparent)",
  },
};

const FALLBACK: Visuals = {
  Icon: Bell,
  color: "var(--color-muted)",
  halo: "var(--color-bg-3)",
};

interface NotificationTypeIconProps {
  type: string;
  size?: "sm" | "md";
  /** When true, renders the icon inside a soft halo circle. */
  withHalo?: boolean;
}

/**
 * Notification type → lucide glyph + Tiles-semantic color. Used by the
 * `/notifications` list and the topbar bell dropdown. Unknown types fall
 * back to a generic bell on the muted palette.
 */
export function NotificationTypeIcon({
  type,
  size = "md",
  withHalo = false,
}: NotificationTypeIconProps) {
  const visuals = TYPE_VISUALS[type] ?? FALLBACK;
  const Icon = visuals.Icon;
  const dim = size === "sm" ? 14 : 18;

  if (!withHalo) {
    return (
      <Icon
        style={{ color: visuals.color, width: dim, height: dim, flexShrink: 0 }}
      />
    );
  }

  const ring = size === "sm" ? 28 : 36;
  return (
    <div
      style={{
        width: ring,
        height: ring,
        borderRadius: "50%",
        background: visuals.halo,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon style={{ color: visuals.color, width: dim, height: dim }} />
    </div>
  );
}
