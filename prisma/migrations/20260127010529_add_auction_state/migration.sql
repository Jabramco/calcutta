-- CreateTable
CREATE TABLE "AuctionState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "currentTeamId" INTEGER,
    "currentBid" REAL NOT NULL DEFAULT 0,
    "currentBidder" TEXT,
    "bids" TEXT NOT NULL DEFAULT '[]',
    "lastBidTime" BIGINT,
    "updatedAt" DATETIME NOT NULL
);
