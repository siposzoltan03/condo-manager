"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { Plus } from "lucide-react";
import { ActiveVoteCard } from "./active-vote-card";
import { PastVoteCard } from "./past-vote-card";
import { VoteSidebar } from "./vote-sidebar";
import { MeetingList } from "./meeting-list";
import { CreateVoteModal } from "./create-vote-modal";
import { CreateMeetingModal } from "./create-meeting-modal";

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

export function VotingPage() {
  const t = useTranslations("voting");
  const tCommon = useTranslations("common");
  const { hasRole } = useAuth();
  const isBoardPlus = hasRole("BOARD_MEMBER");

  const [activeTab, setActiveTab] = useState<"votes" | "meetings">("votes");
  const [votes, setVotes] = useState<VoteSummary[]>([]);
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [loading, setLoading] = useState(true);
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
      // silent
    }
  }, []);

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch("/api/voting/meetings?limit=50");
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchVotes(), fetchMeetings()]).finally(() => setLoading(false));
  }, [fetchVotes, fetchMeetings]);

  const activeVotes = votes.filter((v) => v.status === "OPEN");
  const pastVotes = votes.filter((v) => v.status === "CLOSED");
  const upcomingMeetings = meetings.filter(
    (m) => new Date(m.date) >= new Date()
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-[#002045]">
            {t("title")}
          </h1>
          <p className="mt-1 text-slate-600">{t("subtitle")}</p>
        </div>
        {isBoardPlus && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateVote(true)}
              className="flex items-center gap-2 rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90"
            >
              <Plus className="h-4 w-4" />
              {t("createVote")}
            </button>
            <button
              onClick={() => setShowCreateMeeting(true)}
              className="flex items-center gap-2 rounded-md border border-[#002045] px-4 py-2 text-sm font-medium text-[#002045] hover:bg-[#002045]/5"
            >
              <Plus className="h-4 w-4" />
              {t("createMeeting")}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("votes")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "votes"
              ? "border-b-2 border-[#002045] text-[#002045]"
              : "text-slate-500 hover:text-[#002045]"
          }`}
        >
          {t("tabVotes")}
          {activeVotes.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#002045] text-xs text-white">
              {activeVotes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("meetings")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "meetings"
              ? "border-b-2 border-[#002045] text-[#002045]"
              : "text-slate-500 hover:text-[#002045]"
          }`}
        >
          {t("tabMeetings")}
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{tCommon("loading")}</p>
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
                  />
                ))}
              </div>
            )}

            {activeVotes.length === 0 && pastVotes.length === 0 && (
              <div className="flex min-h-[20vh] items-center justify-center rounded-xl bg-white p-8 shadow-sm">
                <p className="text-slate-500">{t("noVotes")}</p>
              </div>
            )}

            {/* Past Votes */}
            {pastVotes.length > 0 && (
              <div>
                <h2 className="mb-4 text-xl font-semibold text-[#002045]">
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
          onClose={() => setShowCreateVote(false)}
          onCreated={() => {
            setShowCreateVote(false);
            fetchVotes();
          }}
        />
      )}
      {showCreateMeeting && (
        <CreateMeetingModal
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
