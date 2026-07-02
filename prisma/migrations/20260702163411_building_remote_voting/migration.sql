-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "remoteVotingAuthorized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remoteVotingParams" JSONB,
ADD COLUMN     "remoteVotingSzmszRef" TEXT;
