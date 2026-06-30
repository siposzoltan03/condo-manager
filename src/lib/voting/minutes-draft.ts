import type { MeetingDetailData, MeetingVoteResult } from "@/lib/dal";

/**
 * Auto-generates a jegyzőkönyv (minutes) draft from a finished live assembly.
 * Pulls the real session record — quorum, closed-vote resolutions with
 * tallies, and the Q&A log — into a Markdown skeleton the képviselő then
 * edits and has authenticated (the existing signature flow).
 *
 * The body is a Hungarian legal document by nature (Tht. §43), so its section
 * labels are fixed Hungarian — same convention as the manual `buildTemplate`
 * in minutes-editor.tsx. Only UI chrome goes through next-intl.
 */

const FORMAT_LABEL: Record<string, string> = {
  IN_PERSON: "Személyes",
  HYBRID: "Hibrid",
  ONLINE: "Online",
};

const MAJORITY_LABEL: Record<string, string> = {
  SIMPLE_MAJORITY: "egyszerű többség",
  TWO_THIRDS: "minősített többség (2/3)",
  FOUR_FIFTHS: "minősített többség (4/5)",
  UNANIMOUS: "egyhangú",
  PLURALITY: "relatív többség",
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "0,0%";
  return `${((part / whole) * 100).toLocaleString("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function agendaTitles(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it, i) => {
    if (typeof it === "string") return it;
    const o = (it ?? {}) as Record<string, unknown>;
    return typeof o.title === "string" ? o.title : `${i + 1}. napirendi pont`;
  });
}

function renderResolution(v: MeetingVoteResult, index: number): string[] {
  const lines: string[] = [];
  lines.push(`### ${index}. határozati javaslat — ${v.title}`);
  lines.push("");

  if (v.status !== "CLOSED") {
    lines.push(`*A szavazás nem zárult le (állapot: ${v.status}).*`);
    lines.push("");
    return lines;
  }

  lines.push(`Szavazás módja: ${MAJORITY_LABEL[v.majorityType] ?? v.majorityType}. Leadott szavazatok: ${v.ballotCount}.`);
  lines.push("");
  lines.push("| Választás | Szavazat | Tulajdoni hányad |");
  lines.push("| --- | ---: | ---: |");
  for (const o of v.options) {
    lines.push(`| ${o.label} | ${o.votes} | ${pct(o.weight, v.totalWeight)} |`);
  }
  lines.push("");

  if (v.isAwardVote && v.award) {
    if (v.award.outcome === "AWARDED") {
      const amount =
        v.award.winnerAmount != null
          ? ` (${v.award.winnerAmount.toLocaleString("hu-HU")} Ft)`
          : "";
      lines.push(`**Eredmény: a közgyűlés a megbízást a(z) „${v.award.winnerLabel}" ajánlatnak ítélte oda${amount}.**`);
    } else if (v.award.outcome === "NO_QUORUM") {
      lines.push("**Eredmény: a szavazás határozatképtelen volt (a részvétel nem érte el az 50%-ot).**");
    } else {
      lines.push("**Eredmény: a közgyűlés egyik ajánlatot sem fogadta el.**");
    }
  } else if (v.passed === true) {
    lines.push("**Eredmény: a közgyűlés a javaslatot ELFOGADTA.**");
  } else if (v.passed === false) {
    lines.push("**Eredmény: a közgyűlés a javaslatot ELUTASÍTOTTA.**");
  } else {
    lines.push("*Eredmény: nem megállapítható.*");
  }
  lines.push("");
  return lines;
}

export function buildMinutesDraft(m: MeetingDetailData): string {
  const lines: string[] = [];

  lines.push(`# Jegyzőkönyv — ${m.title}`);
  lines.push("");
  lines.push(`**Időpont:** ${fmtDateTime(m.date)} ${m.time}`);
  if (m.location) lines.push(`**Helyszín:** ${m.location}`);
  if (m.format) lines.push(`**A közgyűlés formája:** ${FORMAT_LABEL[m.format] ?? m.format}`);
  lines.push(`**Megnyitás:** ${fmtDateTime(m.startedAt)} · **Berekesztés:** ${fmtDateTime(m.endedAt)}`);
  lines.push("");
  lines.push("> Ezt a jegyzőkönyv-tervezetet a rendszer a közgyűlés mód alapján automatikusan készítette. Kérjük, ellenőrizze és egészítse ki, mielőtt hitelesítteti.");
  lines.push("");

  // ── Határozatképesség ────────────────────────────────────────────────
  lines.push("## Határozatképesség");
  lines.push("");
  lines.push(
    `Jelen lévő tulajdonostársak: ${m.quorum.presentUnitCount} / ${m.quorum.totalUnitCount} albetét, ` +
      `a tulajdoni hányadok ${m.quorum.presentPercentage.toLocaleString("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%-a. ` +
      `A közgyűlés ${m.quorum.isQuorate ? "**határozatképes**" : "**határozatképtelen**"}.`,
  );
  lines.push("");

  // ── Napirend ─────────────────────────────────────────────────────────
  const agenda = agendaTitles(m.agenda);
  if (agenda.length > 0) {
    lines.push("## Napirend");
    lines.push("");
    agenda.forEach((title, i) => lines.push(`${i + 1}. ${title}`));
    lines.push("");
  }

  // ── Határozatok ──────────────────────────────────────────────────────
  lines.push("## Határozatok");
  lines.push("");
  if (m.votes.length === 0) {
    lines.push("*A közgyűlésen nem született szavazással hozott határozat.*");
    lines.push("");
  } else {
    m.votes.forEach((v, i) => lines.push(...renderResolution(v, i + 1)));
  }

  // ── Kérdések és hozzászólások ────────────────────────────────────────
  const questions = m.questions.filter((q) => q.type === "QUESTION" && q.body);
  const hands = m.questions.filter((q) => q.type === "HAND");
  if (questions.length > 0 || hands.length > 0) {
    lines.push("## Kérdések és hozzászólások");
    lines.push("");
    for (const q of questions) {
      lines.push(`- **${q.userName}** (${q.agendaIndex + 1}. napirendi pont): ${q.body}`);
    }
    if (hands.length > 0) {
      const names = hands.map((h) => h.userName).join(", ");
      lines.push(`- Szót kért: ${names}`);
    }
    lines.push("");
  }

  // ── Hitelesítés ──────────────────────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push("*A jegyzőkönyvet hitelesítette:*");
  lines.push("");
  lines.push("- Levezető elnök: ____________________");
  lines.push("- Jegyzőkönyv-hitelesítő 1.: ____________________");
  lines.push("- Jegyzőkönyv-hitelesítő 2.: ____________________");
  lines.push("");

  return lines.join("\n");
}
