"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/use-auth";
import type { VotesData } from "@/lib/dal";
import { Plus } from "lucide-react";
import { ActiveVoteCard } from "./active-vote-card";
import { PastVoteCard } from "./past-vote-card";
import { VoteSidebar } from "./vote-sidebar";
import { MeetingList } from "./meeting-list";

const CreateVoteModal = dynamic(() => import("./create-vote-modal").then((m) => m.CreateVoteModal));
const CreateMeetingModal = dynamic(() => import("./create-meeting-modal").then((m) => m.CreateMeetingModal));

interface VoteOption {
  id: string;
  label: string;
  sortOrder: number;
}

interface VoteSummary {
  id: string;
  title: string;
  description: string | null;
  voteType: string;
  status: string;
  isSecret: boolean;
  majorityType?: string;
  quorumRequired: number;
  deadline: string;
  createdBy: { id: string; name: string };
  options: VoteOption[];
  ballotCount: number;
  myBallot: { optionId: string; receiptHash: string | null } | null;
  createdAt: string;
}

interface MeetingSummary {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  location: string | null;
  rsvpCounts: { attending: number; notAttending: number; proxy: number; total: number };
  myRsvp: string | null;
  voteCount: number;
  createdAt: string;
}

interface VotingPageProps {
  initialVotes: VotesData;
}

export function VotingPage({ initialVotes }: VotingPageProps) {
  const t = useTranslations("voting");
  const tCommon = useTranslations("common");
  const { can } = useAuth();
  const router = useRouter();
  const isBoardPlus = can("view.boardContext");

  const [activeTab, setActiveTab] = useState<"votes" | "meetings">("votes");
  const [votes, setVotes] = useState<VoteSummary[]>(initialVotes.votes as VoteSummary[]);
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateVote, setShowCreateVote] = useState(false);
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);

  const fetchVotes = useCallback(async () => {
    try {
      const res = await fetch("/api/voting/votes?limit=50");
      if (res.ok) {
        const data = await res.json();
        setVotes(data.votes);
      }
    } catch {
      toast.error(t("somethingWentWrong"));
    }
  }, [t]);

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch("/api/voting/meetings?limit=50");
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings);
      }
    } catch {
      toast.error(t("somethingWentWrong"));
    }
  }, [t]);

  // Fetch meetings client-side (votes come from server)
  useEffect(() => {
    setLoading(true);
    fetchMeetings().finally(() => setLoading(false));
  }, [fetchMeetings]);

  const activeVotes = votes.filter((v) => v.status === "OPEN");
  const pastVotes = votes.filter((v) => v.status === "CLOSED");
  const upcomingMeetings = meetings.filter(
    (m) => new Date(m.date) >= new Date()
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            {t("title")}
          </span>
          <h1 className="mt-1 font-display text-3xl text-ink leading-tight">
            {t("subtitle")}
          </h1>
        </div>
        {isBoardPlus && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateVote(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              {t("createVote")}
            </button>
            <button
              onClick={() => setShowCreateMeeting(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-ink/20 bg-card px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-bg-3 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("createMeeting")}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-ink/10">
        <button
          onClick={() => setActiveTab("votes")}
          className={`flex items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-wider transition-colors ${
            activeTab === "votes"
              ? "border-b-2 border-ink text-ink"
              : "text-muted hover:text-ink"
          }`}
        >
          {t("tabVotes")}
          {activeVotes.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 font-mono text-[10.5px] text-bg">
              {activeVotes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("meetings")}
          className={`flex items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-wider transition-colors ${
            activeTab === "meetings"
              ? "border-b-2 border-ink text-ink"
              : "text-muted hover:text-ink"
          }`}
        >
          {t("tabMeetings")}
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-muted">{tCommon("loading")}</p>
        </div>
      ) : activeTab === "votes" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main content - col-span-2 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Votes */}
            {activeVotes.length > 0 && (
              <div className="space-y-4">
                {activeVotes.map((vote) => (
                  <ActiveVoteCard
                    key={vote.id}
                    vote={vote}
                    onVoted={fetchVotes}
                    canClose={isBoardPlus}
                  />
                ))}
              </div>
            )}

            {activeVotes.length === 0 && pastVotes.length === 0 && (
              <div className="flex min-h-[20vh] items-center justify-center rounded-xl border border-ink/8 bg-card p-8">
                <p className="text-muted">{t("noVotes")}</p>
              </div>
            )}

            {/* Past Votes */}
            {pastVotes.length > 0 && (
              <div>
                <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-muted">
                  {t("pastVotes")}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {pastVotes.map((vote) => (
                    <PastVoteCard key={vote.id} vote={vote} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - col-span-1 */}
          <div className="lg:col-span-1">
            <VoteSidebar
              activeVotes={activeVotes}
              nextMeeting={upcomingMeetings[0] ?? null}
            />
          </div>
        </div>
      ) : (
        <MeetingList
          meetings={meetings}
          onRsvpChanged={fetchMeetings}
        />
      )}

      {/* Modals */}
      {showCreateVote && (
        <CreateVoteModal
          open
          onClose={() => setShowCreateVote(false)}
          onCreated={() => {
            setShowCreateVote(false);
            fetchVotes();
          }}
        />
      )}
      {showCreateMeeting && (
        <CreateMeetingModal
          open
          onClose={() => setShowCreateMeeting(false)}
          onCreated={() => {
            setShowCreateMeeting(false);
            fetchMeetings();
          }}
        />
      )}
    </div>
  );
}
