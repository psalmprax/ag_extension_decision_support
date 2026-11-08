-- Existing derived records have no trustworthy source version and are excluded
-- from retrieval until they are rebuilt.
ALTER TABLE "knowledge_chunks" ADD COLUMN "source_content_hash" TEXT;
ALTER TABLE "knowledge_relationships" ADD COLUMN "source_content_hash" TEXT;
