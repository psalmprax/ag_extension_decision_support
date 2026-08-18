/**
 * Canonical UUID regex for the backend's write/query boundaries.
 *
 * The farmers.id / fields.farmer_id columns are UUIDs; a non-UUID value would
 * make Postgres throw (invalid input syntax for type uuid) → 500. Must stay in
 * lockstep with the shared `uuidSchema` in @ag-extension/shared — parity is
 * enforced by src/__tests__/apiContract.test.ts.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
