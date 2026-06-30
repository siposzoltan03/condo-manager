-- Live assembly mode (Közgyűlés mód): session lifecycle + format/vote-mode on Meeting.
CREATE TYPE "MeetingLiveStatus" AS ENUM ('SCHEDULED', 'LIVE', 'CLOSED');
CREATE TYPE "MeetingFormat" AS ENUM ('IN_PERSON', 'HYBRID', 'ONLINE');
CREATE TYPE "MeetingVoteMode" AS ENUM ('DEVICE', 'HANDS');

ALTER TABLE "Meeting"
  ADD COLUMN "currentAgendaIndex" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currentVoteId" TEXT,
  ADD COLUMN "endedAt" TIMESTAMP(3),
  ADD COLUMN "format" "MeetingFormat",
  ADD COLUMN "liveStatus" "MeetingLiveStatus" NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "voteMode" "MeetingVoteMode";
