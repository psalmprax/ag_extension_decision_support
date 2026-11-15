#!/usr/bin/env bash
# One-time, per host, as root: prepare a non-root user for the GitHub Actions
# deploys, so root SSH login can be switched off.
#
# Scope, honestly: the deploy user joins the `docker` group, and docker access
# is root-equivalent. What this buys is no direct root login over SSH (you can
# then set `PermitRootLogin no`), a dedicated account in the auth logs, and an
# explicit, reviewable list of the few host-level commands deploys run via sudo.
#
# What it does (idempotent; safe to re-run):
#   1. creates the user (default: deploy) and adds it to the docker group;
#   2. installs root's authorized_keys for it (the key the
#      SSH_PRIVATE_KEY_* secrets already use) unless it has its own;
#   3. copies the repo checkout from /root (kept in place, so switching back to
#      root still works) and creates an empty build cache dir — the first build
#      as this user is a cold-cache build;
#   4. installs /etc/sudoers.d/ag-deploy allowing exactly the commands the
#      deploy workflows run via `sudo -n`, validated with visudo first.
# It does NOT touch sshd_config; the steps for that are printed at the end.
#
# Usage: sudo ./scripts/provision-deploy-user.sh [user]
set -euo pipefail

USER_NAME="${1:-deploy}"
SRC_HOME="${SRC_HOME:-/root}"
SUDOERS_FILE="${SUDOERS_FILE:-/etc/sudoers.d/ag-deploy}"
REPO_DIR=ag_extension_decision_support

die() { echo "FATAL: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "run as root"
getent group docker >/dev/null || die "no 'docker' group on this host — is Docker installed?"
command -v visudo >/dev/null || die "visudo not found (install sudo first)"

if id "$USER_NAME" >/dev/null 2>&1; then
  echo "user $USER_NAME exists"
else
  useradd --create-home --shell /bin/bash "$USER_NAME"
  echo "created user $USER_NAME"
fi
usermod -aG docker "$USER_NAME"
DEST_HOME="$(getent passwd "$USER_NAME" | cut -d: -f6)"
GROUP="$(id -gn "$USER_NAME")"

install -d -m 700 -o "$USER_NAME" -g "$GROUP" "$DEST_HOME/.ssh"
if [ -s "$DEST_HOME/.ssh/authorized_keys" ]; then
  echo "keeping existing $DEST_HOME/.ssh/authorized_keys"
elif [ -s "$SRC_HOME/.ssh/authorized_keys" ]; then
  install -m 600 -o "$USER_NAME" -g "$GROUP" "$SRC_HOME/.ssh/authorized_keys" "$DEST_HOME/.ssh/authorized_keys"
  echo "installed root's authorized_keys for $USER_NAME"
else
  die "no $SRC_HOME/.ssh/authorized_keys to copy; add the deploy public key to $DEST_HOME/.ssh/authorized_keys and re-run"
fi

if [ -d "$DEST_HOME/$REPO_DIR" ]; then
  echo "keeping existing $DEST_HOME/$REPO_DIR"
elif [ -d "$SRC_HOME/$REPO_DIR" ]; then
  cp -a "$SRC_HOME/$REPO_DIR" "$DEST_HOME/$REPO_DIR"
  echo "copied $SRC_HOME/$REPO_DIR (with its .env) to $DEST_HOME/$REPO_DIR"
else
  echo "no checkout in $SRC_HOME; the first deploy will clone into $DEST_HOME/$REPO_DIR"
fi
[ -d "$DEST_HOME/$REPO_DIR" ] && chown -R "$USER_NAME:$GROUP" "$DEST_HOME/$REPO_DIR"
install -d -o "$USER_NAME" -g "$GROUP" "$DEST_HOME/docker-cache"

# sudo matches the absolute path it resolves through secure_path; mirror the
# default Debian/Ubuntu secure_path order so the rules name the same binaries.
resolve() {
  local d
  for d in /usr/local/sbin /usr/local/bin /usr/sbin /usr/bin /sbin /bin; do
    [ -x "$d/$1" ] && { echo "$d/$1"; return 0; }
  done
  return 1
}
MKDIR="$(resolve mkdir)" || die "mkdir not found"
TEE="$(resolve tee)" || die "tee not found"
SYSTEMCTL="$(resolve systemctl)" || die "systemctl not found"
IPT="$(resolve iptables)" || die "iptables not found"

# Exactly the commands the workflows and scripts/free-web-ports.sh run via sudo -n.
cmds=(
  "$MKDIR -p /etc/docker"
  "$TEE /etc/docker/daemon.json"
  "$SYSTEMCTL restart docker"
  "$SYSTEMCTL stop apache2" "$SYSTEMCTL disable apache2"
  "$SYSTEMCTL stop nginx" "$SYSTEMCTL disable nginx"
  "$IPT -C FORWARD -s 172.17.0.0/16 -p udp --dport 53 -j ACCEPT"
  "$IPT -I FORWARD 1 -s 172.17.0.0/16 -p udp --dport 53 -j ACCEPT"
  "$IPT -C FORWARD -d 172.17.0.0/16 -p udp --sport 53 -j ACCEPT"
  "$IPT -I FORWARD 1 -d 172.17.0.0/16 -p udp --sport 53 -j ACCEPT"
  "$IPT -C OUTPUT -s 172.17.0.0/16 -p udp --dport 53 -j ACCEPT"
  "$IPT -I OUTPUT 1 -s 172.17.0.0/16 -p udp --dport 53 -j ACCEPT"
)
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
{
  echo "# Managed by scripts/provision-deploy-user.sh — exactly the host-level"
  echo "# commands the deploy workflows run via 'sudo -n'. Edit there, not here."
  printf '%s ALL=(root) NOPASSWD: ' "$USER_NAME"
  printf '%s' "${cmds[0]}"
  for c in "${cmds[@]:1}"; do printf ', \\\n    %s' "$c"; done
  echo
} > "$tmp"
visudo -cf "$tmp" >/dev/null || die "generated sudoers file failed visudo validation"
install -m 0440 -o root -g root "$tmp" "$SUDOERS_FILE"
echo "installed $SUDOERS_FILE (${#cmds[@]} commands)"

cat <<EOF

Next steps for this host:
  1. In GitHub → Settings → Secrets and variables → Actions → Variables, set
     PROD_DEPLOY_SSH_USER=$USER_NAME (production host) or
     TEST_DEPLOY_SSH_USER=$USER_NAME (test/stage host).
  2. Run a deploy and check it end to end. Unset the variable to fall back to
     root; $SRC_HOME/$REPO_DIR was left in place for that.
  3. Once a deploy as $USER_NAME has succeeded, disable root SSH login:
       sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
       sshd -t && systemctl reload ssh   # keep this session open until verified
  4. After that, $SRC_HOME/$REPO_DIR and $SRC_HOME/docker-cache can be deleted.
EOF
