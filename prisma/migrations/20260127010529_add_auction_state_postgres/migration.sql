-- CreateTable
CREATE TABLE "AuctionState" (
    "id" SERIAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "currentTeamId" INTEGER,
    "currentBid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentBidder" TEXT,
    "bids" TEXT NOT NULL DEFAULT '[]',
    "lastBidTime" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionState_pkey" PRIMARY KEY ("id")
);
