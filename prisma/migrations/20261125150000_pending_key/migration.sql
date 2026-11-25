-- Add a nullable unique key so SQLite enforces one pending request per customer/video.
ALTER TABLE "AccessRequest" ADD COLUMN "pendingKey" TEXT;

CREATE UNIQUE INDEX "AccessRequest_pendingKey_key" ON "AccessRequest"("pendingKey");
