/*
  Warnings:

  - You are about to drop the `Announcement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AnnouncementRead` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ConversationParticipant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ForumCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ForumReply` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ForumTopic` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "AnnouncementRead" DROP CONSTRAINT "AnnouncementRead_announcementId_fkey";

-- DropForeignKey
ALTER TABLE "AnnouncementRead" DROP CONSTRAINT "AnnouncementRead_userId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationParticipant" DROP CONSTRAINT "ConversationParticipant_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationParticipant" DROP CONSTRAINT "ConversationParticipant_userId_fkey";

-- DropForeignKey
ALTER TABLE "ForumCategory" DROP CONSTRAINT "ForumCategory_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "ForumReply" DROP CONSTRAINT "ForumReply_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ForumReply" DROP CONSTRAINT "ForumReply_parentReplyId_fkey";

-- DropForeignKey
ALTER TABLE "ForumReply" DROP CONSTRAINT "ForumReply_topicId_fkey";

-- DropForeignKey
ALTER TABLE "ForumTopic" DROP CONSTRAINT "ForumTopic_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ForumTopic" DROP CONSTRAINT "ForumTopic_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropTable
DROP TABLE "Announcement";

-- DropTable
DROP TABLE "AnnouncementRead";

-- DropTable
DROP TABLE "Conversation";

-- DropTable
DROP TABLE "ConversationParticipant";

-- DropTable
DROP TABLE "ForumCategory";

-- DropTable
DROP TABLE "ForumReply";

-- DropTable
DROP TABLE "ForumTopic";

-- DropTable
DROP TABLE "Message";

-- DropEnum
DROP TYPE "ConversationType";

-- DropEnum
DROP TYPE "TargetAudience";
