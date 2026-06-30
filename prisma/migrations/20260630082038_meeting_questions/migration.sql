-- Live assembly Q&A: questions + raise-hand requests.
CREATE TYPE "MeetingQuestionType" AS ENUM ('QUESTION', 'HAND');
CREATE TYPE "MeetingQuestionStatus" AS ENUM ('PENDING', 'ADDRESSED');

CREATE TABLE "MeetingQuestion" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MeetingQuestionType" NOT NULL,
    "body" TEXT,
    "agendaIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "MeetingQuestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MeetingQuestion_meetingId_status_idx" ON "MeetingQuestion"("meetingId", "status");
ALTER TABLE "MeetingQuestion" ADD CONSTRAINT "MeetingQuestion_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingQuestion" ADD CONSTRAINT "MeetingQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
