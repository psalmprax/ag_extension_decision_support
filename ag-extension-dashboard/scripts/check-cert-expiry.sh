#!/bin/bash

# ==============================================================================
# AG-Extension SSL Certificate Expiry Monitor
# ==============================================================================
# Checks the Let's Encrypt certificate expiry for www.gpexts.com,
# logs results, and optionally sends email alerts when renewal is due.
#
# Usage:
#   ./scripts/check-cert-expiry.sh          # Run check (logs only)
#   ./scripts/check-cert-expiry.sh --alert  # Run check and send email alerts
# ==============================================================================

set -e

# --- Configuration ---
DOMAIN="www.gpexts.com"
LOG_FILE="/root/cert-monitor.log"
WARN_DAYS=14        # Warning threshold
CRIT_DAYS=7         # Critical threshold (send alert)
ALERT_EMAIL="admin@gpexts.com"
FROM_EMAIL="cert-monitor@gpexts.com"

# --- Functions ---
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

send_alert() {
    local subject="$1"
    local body="$2"

    if ! command -v msmtp &>/dev/null; then
        log "WARN" "msmtp not installed — skipping email alert"
        return 1
    fi

    echo -e "Subject: $subject\nFrom: $FROM_EMAIL\nTo: $ALERT_EMAIL\n\n$body" | msmtp "$ALERT_EMAIL"
    if [ $? -eq 0 ]; then
        log "INFO" "Alert email sent to $ALERT_EMAIL"
    else
        log "ERROR" "Failed to send alert email"
    fi
}

# --- Main ---

log "INFO" "=== Certificate expiry check started for $DOMAIN ==="

# Check cert expiry via openssl
CERT_INFO=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN":443 2>/dev/null | openssl x509 -noout -dates 2>&1)

if [ $? -ne 0 ] || [ -z "$CERT_INFO" ]; then
    log "ERROR" "Failed to retrieve certificate for $DOMAIN"
    send_alert "CRITICAL: Cannot reach $DOMAIN for cert check" \
        "The cert expiry monitor could not connect to $DOMAIN:443 to check the certificate.
This may indicate a network or server issue.

Timestamp: $(date)"
    exit 2
fi

NOT_AFTER=$(echo "$CERT_INFO" | grep 'notAfter=' | sed 's/notAfter=//')
EXPIRY_EPOCH=$(date -d "$NOT_AFTER" +%s 2>/dev/null)
NOW_EPOCH=$(date +%s)

if [ -z "$EXPIRY_EPOCH" ]; then
    log "ERROR" "Could not parse expiry date: $NOT_AFTER"
    exit 2
fi

DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

log "INFO" "Certificate expires on: $NOT_AFTER"
log "INFO" "Days until expiry: $DAYS_LEFT"

# Evaluate thresholds and send alerts if needed
if [ "$DAYS_LEFT" -le 0 ]; then
    log "CRITICAL" "Certificate has ALREADY EXPIRED!"
    send_alert "CRITICAL: SSL cert for $DOMAIN has EXPIRED" \
        "The SSL certificate for $DOMAIN expired on $NOT_AFTER.

Immediate action required — Traefik auto-renewal may have failed.

Timestamp: $(date)"
    exit 1

elif [ "$DAYS_LEFT" -le "$CRIT_DAYS" ]; then
    log "CRITICAL" "Certificate expires in $DAYS_LEFT days (threshold: $CRIT_DAYS)"
    send_alert "CRITICAL: SSL cert for $DOMAIN expires in $DAYS_LEFT days" \
        "The SSL certificate for $DOMAIN will expire in $DAYS_LEFT days.

Expiry date: $NOT_AFTER
Threshold: $CRIT_DAYS days

Check Traefik logs and acme.json for renewal issues.

Timestamp: $(date)"
    exit 1

elif [ "$DAYS_LEFT" -le "$WARN_DAYS" ]; then
    log "WARN" "Certificate expires in $DAYS_LEFT days (threshold: $WARN_DAYS)"
    send_alert "WARNING: SSL cert for $DOMAIN expires in $DAYS_LEFT days" \
        "The SSL certificate for $DOMAIN will expire in $DAYS_LEFT days.

Expiry date: $NOT_AFTER
Warning threshold: $WARN_DAYS days

Traefik should handle renewal automatically, but please monitor.

Timestamp: $(date)"
    exit 1

else
    log "OK" "Certificate is valid for $DAYS_LEFT days — no action needed"
fi

log "INFO" "=== Certificate check completed successfully ==="
exit 0
