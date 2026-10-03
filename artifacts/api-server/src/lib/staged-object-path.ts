// Only new objects explicitly registered in the ledger enter cleanup. This
// pattern is an identity check, never permission to sweep a storage prefix.
export const stagedObjectPathPattern = /^\/objects\/(?:uploads|imports)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;