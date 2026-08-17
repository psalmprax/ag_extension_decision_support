# Observability and Integration Status

## Request tracing

The backend assigns or propagates `x-correlation-id` for every request and returns it in the response header. The ID is available to AI provider telemetry through the request-scoped context. Authenticated requests also attach the user ID after optional authentication is resolved.

## AI provider telemetry

Provider attempts are recorded with:

- provider and attempt number
- operation name
- duration
- token usage when returned by the provider
- fallback-used indicator
- success/error status and failure reason
- correlation ID and user ID when available

Telemetry writes to `agent_telemetry` when the database is available and uses a bounded in-memory buffer when it is not. The database table is provisioned with a `correlation_id` column for existing installations.

## Integration status

Outbound integrations must distinguish delivery from intent:

- `not_configured`: credentials are missing; nothing was delivered
- `queued`: a configured provider accepted the work for later dispatch
- `sent`: the provider accepted the message
- `logged`: an explicit non-production log-only mode recorded the attempt
- `failed`: dispatch was attempted but failed

In particular, WhatsApp requests cannot return a successful delivery result when the provider is not configured.

Market-price responses expose `dataStatus`, `source`, `fetchedAt`, and `exchangeRateSource`. The current commodity values are labeled `estimated` because they are derived from a baseline model rather than a live market feed.

Social intelligence returns `not_configured` or `failed` with no sources when verified search data is unavailable. It never substitutes fabricated social posts.

## Recovery

Manual recovery is restricted to registered infrastructure components: database, cache, AI provider, and known agent services. Requests for unknown or unregistered components fail closed. Recovery actions are recorded with success/failure details and are never represented as a generic accepted placeholder.
