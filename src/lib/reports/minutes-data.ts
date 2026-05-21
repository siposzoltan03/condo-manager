import { prisma } from "@/lib/prisma";
import { calculateVoteResult } from "@/lib/voting/quorum";

export interface MinutesData {
  buildingName: string;
  meeting: {
    id: string;
    title: string;
    description: string | null;
    date: string;
    time: string;
    location: string | null;
    isRepeated: boolean;
    minutes: string | null;
  };
  /** Free-form agenda points (Json). */
  agenda: Array<{ title: string; description?: string | null }>;
  /** Owners who actually checked in at the meeting (jelenléti ív). */
  attendance: {
    unitNumber: string;
    ownerName: string;
    ownershipShare: number;
    checkedInAt: string;
  }[];
  totalAttendingShare: number; // 0..1
  totalBuildingShare: number; // 0..1 (effectively 1.0 if shares sum cleanly)
  /** Tht. § 52 quorum threshold flag. */
  isQuorate: boolean;
  /** Each Vote.határozat with full text + tally + statutory verification. */
  resolutions: {
    id: string;
    title: string;
    description: string | null;
    majorityType: string;
    isSecret: boolean;
    options: Array<{
      id: string;
      label: string;
      ballotCount: number;
      weight: number;
    }>;
    totalCastWeight: number;
    ballotCount: number;
    passed: boolean | null;
    statutoryNote: string;
  }[];
  signatures: {
    role: "CHAIR" | "AUTHENTICATOR_1" | "AUTHENTICATOR_2";
    signerName: string | null;
    signedAt: string | null;
    ipAddress: string | null;
  }[];
  /** True only when all three slots are filled. */
  isExecuted: boolean;
}

const MAJORITY_LABEL: Record<string, string> = {
  SIMPLE_MAJORITY: "egyszerű többség",
  TWO_THIRDS: "kétharmados (Tht. § 25/A)",
  FOUR_FIFTHS: "négyötödös",
  UNANIMOUS: "egyhangú",
  PLURALITY: "relatív többség",
};

function statutoryNoteFor(majority: string, passed: boolean | null): string {
  const label = MAJORITY_LABEL[majority] ?? majority;
  if (passed === null) return `Szavazás folyamatban — ${label} szükséges.`;
  if (passed) return `Elfogadva ${label} mellett.`;
  return `Elutasítva — ${label} nem teljesült.`;
}

/**
 * Compute the canonical data payload for a jegyzőkönyv (meeting minutes)
 * PDF. Pulls attendance, votes (rendered as határozatok with statutory
 * majority verification), and the three signature slots.
 */
export async function computeMinutesData(
  meetingId: string,
): Promise<MinutesData> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      building: { select: { name: true } },
      attendances: {
        where: { checkedIn: true },
        include: {
          unit: {
            select: {
              number: true,
              ownershipShare: true,
              unitUsers: {
                where: { relationship: "OWNER" },
                select: { user: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { checkedInAt: "asc" },
      },
      votes: { orderBy: { createdAt: "asc" }, select: { id: true } },
      minutesSignatures: {
        include: { signer: { select: { name: true } } },
      },
    },
  });
  if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

  // Building-wide ownership total (denominator for quorum).
  const allUnits = await prisma.unit.findMany({
    where: { buildingId: meeting.buildingId },
    select: { ownershipShare: true },
  });
  const totalBuildingShare = allUnits.reduce(
    (s, u) => s + Number(u.ownershipShare),
    0,
  );

  const attendance = meeting.attendances.map((a) => ({
    unitNumber: a.unit.number,
    ownerName: a.unit.unitUsers[0]?.user.name ?? "—",
    ownershipShare: Number(a.unit.ownershipShare),
    checkedInAt: a.checkedInAt.toISOString(),
  }));
  attendance.sort((x, y) =>
    x.unitNumber.localeCompare(y.unitNumber, undefined, { numeric: true }),
  );
  const totalAttendingShare = attendance.reduce(
    (s, a) => s + a.ownershipShare,
    0,
  );
  // Repeated meetings are quorate by law (Tht. § 38(3)). Otherwise
  // simple majority of building shares.
  const isQuorate =
    meeting.isRepeated || totalAttendingShare > totalBuildingShare / 2;

  // Resolutions = votes.
  const resolutions = await Promise.all(
    meeting.votes.map(async ({ id }) => {
      const v = await prisma.vote.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          majorityType: true,
          isSecret: true,
        },
      });
      if (!v) return null;
      const result = await calculateVoteResult(id);
      const totalCastWeight = result.options.reduce((s, o) => s + o.weight, 0);
      const ballotCount = result.options.reduce((s, o) => s + o.votes, 0);
      const passed = v.status === "CLOSED" ? result.passed : null;
      return {
        id: v.id,
        title: v.title,
        description: v.description,
        majorityType: v.majorityType,
        isSecret: v.isSecret,
        options: result.options.map((o) => ({
          id: o.id,
          label: o.label,
          ballotCount: o.votes,
          weight: o.weight,
        })),
        totalCastWeight,
        ballotCount,
        passed,
        statutoryNote: statutoryNoteFor(v.majorityType, passed),
      };
    }),
  );
  const filteredResolutions = resolutions.filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  const stripLeadingNumber = (s: string) =>
    s.replace(/^\s*\d+[.)]\s*/, "").trim();
  const agendaRaw = Array.isArray(meeting.agenda) ? meeting.agenda : [];
  const agenda = agendaRaw.map((item) => {
    if (typeof item === "string") return { title: stripLeadingNumber(item) };
    const obj = (item ?? {}) as Record<string, unknown>;
    return {
      title:
        typeof obj.title === "string" ? stripLeadingNumber(obj.title) : "",
      description:
        typeof obj.description === "string" ? obj.description : null,
    };
  });

  // Signature slots — fill all three even if missing, in canonical order.
  const sigByRole = new Map(
    meeting.minutesSignatures.map((s) => [s.role, s]),
  );
  const signatures: MinutesData["signatures"] = (
    ["CHAIR", "AUTHENTICATOR_1", "AUTHENTICATOR_2"] as const
  ).map((roleKey) => {
    const s = sigByRole.get(roleKey);
    return {
      role: roleKey,
      signerName: s?.signer.name ?? null,
      signedAt: s?.signedAt.toISOString() ?? null,
      ipAddress: s?.ipAddress ?? null,
    };
  });
  const isExecuted = signatures.every((s) => s.signerName !== null);

  return {
    buildingName: meeting.building.name,
    meeting: {
      id: meeting.id,
      title: meeting.title,
      description: meeting.description,
      date: meeting.date.toISOString(),
      time: meeting.time,
      location: meeting.location,
      isRepeated: meeting.isRepeated,
      minutes: meeting.minutes,
    },
    agenda,
    attendance,
    totalAttendingShare,
    totalBuildingShare,
    isQuorate,
    resolutions: filteredResolutions,
    signatures,
    isExecuted,
  };
}
