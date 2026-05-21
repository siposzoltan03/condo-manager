-- Communication v2: unified Channel + Message tables.
-- Existing Announcement / ForumTopic / Conversation tables remain in place
-- through Phase 1 — a backfill script populates the new tables. The legacy
-- tables are dropped in a later phase once the new hub is live.

CREATE TYPE "ChannelKind" AS ENUM (
    'ANNOUNCEMENT',
    'TOPIC',
    'DM',
    'GROUP_DM',
    'BOARD',
    'PARTNER'
);

CREATE TYPE "MessageKind" AS ENUM ('POST', 'CHAT', 'POLL', 'SYSTEM');

CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "kind" "ChannelKind" NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Channel_buildingId_kind_idx" ON "Channel"("buildingId", "kind");
ALTER TABLE "Channel"
  ADD CONSTRAINT "Channel_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "Building"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Channel"
  ADD CONSTRAINT "Channel_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadMessageId" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelMember_channelId_userId_key" ON "ChannelMember"("channelId", "userId");
CREATE INDEX "ChannelMember_userId_idx" ON "ChannelMember"("userId");
ALTER TABLE "ChannelMember"
  ADD CONSTRAINT "ChannelMember_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelMember"
  ADD CONSTRAINT "ChannelMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ChannelMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'CHAT',
    "title" TEXT,
    "body" TEXT,
    "audience" JSONB,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChannelMessage_channelId_createdAt_idx" ON "ChannelMessage"("channelId", "createdAt");
CREATE INDEX "ChannelMessage_authorId_idx" ON "ChannelMessage"("authorId");
CREATE INDEX "ChannelMessage_parentId_idx" ON "ChannelMessage"("parentId");
CREATE INDEX "ChannelMessage_isPinned_idx" ON "ChannelMessage"("isPinned");
ALTER TABLE "ChannelMessage"
  ADD CONSTRAINT "ChannelMessage_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelMessage"
  ADD CONSTRAINT "ChannelMessage_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannelMessage"
  ADD CONSTRAINT "ChannelMessage_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "ChannelMessage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MessageRead" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageRead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MessageRead_messageId_userId_key" ON "MessageRead"("messageId", "userId");
CREATE INDEX "MessageRead_userId_idx" ON "MessageRead"("userId");
ALTER TABLE "MessageRead"
  ADD CONSTRAINT "MessageRead_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ChannelMessage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageRead"
  ADD CONSTRAINT "MessageRead_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");
ALTER TABLE "MessageAttachment"
  ADD CONSTRAINT "MessageAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ChannelMessage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
