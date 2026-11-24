-- The audit chain hashed actor_id, a foreign key that ON DELETE SET NULL clears when an account
-- is deleted, so deleting any account made the log look tampered with. actor_key keeps the actor
-- as written, with no foreign key, and the chain hashes it instead. Copying actor_id into it keeps
-- every existing hash valid: the hashed JSON array is the same text.
ALTER TABLE "audit_logs" ADD COLUMN "actor_key" UUID;
UPDATE "audit_logs" SET "actor_key" = "actor_id" WHERE "chain_seq" IS NOT NULL;

CREATE TABLE "audit_chain_meta" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "audit_chain_meta_pkey" PRIMARY KEY ("key")
);

-- Entries whose account was deleted before this migration no longer match their hash, and who
-- wrote them cannot be recovered. They are listed here, once, so the check reports them as
-- unverifiable rather than changed; an entry that stops matching later is not on the list and
-- is reported as changed. The expression is entryHashSql() in src/services/audit/auditChain.ts.
INSERT INTO "audit_chain_meta" ("key", "value")
SELECT 'actor_lost_seqs', COALESCE(string_agg(a."chain_seq"::text, ',' ORDER BY a."chain_seq"), '')
  FROM "audit_logs" a
 WHERE a."chain_seq" IS NOT NULL
   AND a."actor_id" IS NULL
   AND a."entry_hash" IS DISTINCT FROM encode(sha256(convert_to(jsonb_build_array(
         a.chain_seq, a.prev_hash, a.actor_key, a.actor_role, a.action, a.method, a.path, a.resource_type,
         a.resource_id, a.status_code, a.ip_address, a.user_agent, a.request_body, a.created_at)::text, 'UTF8')), 'hex');
