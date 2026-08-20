-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "lastNudgeAt" TIMESTAMP(3),
ADD COLUMN     "nudgeEmails" BOOLEAN NOT NULL DEFAULT true;
