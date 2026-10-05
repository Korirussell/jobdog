#!/usr/bin/env bash
# One-time hardening for the JobDog EC2 host. Safe to re-run.
#
#   scp -i jobdog.pem scripts/ec2-harden.sh ec2-user@<host>:/tmp/ && \
#   ssh -i jobdog.pem ec2-user@<host> 'bash /tmp/ec2-harden.sh'
#
# Three things the 1.8GB t4g.small kept needing and did not have:
#
#   1. Swap. With none, the first memory spike went straight to the kernel's OOM
#      killer. A little swap turns "killed" into "briefly slow".
#   2. A watchdog. Twice the backend's JVM died and Docker kept reporting its
#      container as running while nothing listened on :8080 — the site was down
#      until someone noticed. This checks the real health endpoint and restarts it.
#   3. Nothing else: container memory caps and log rotation live in
#      docker-compose.yml, where they are versioned with the services.
set -euo pipefail

echo "== swap =="
if swapon --show | grep -q /swapfile; then
  echo "swapfile already active"
else
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo "2G swapfile created and enabled"
fi
# Prefer RAM; only spill to swap under real pressure.
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-jobdog.conf >/dev/null
sudo sysctl -q -p /etc/sysctl.d/99-jobdog.conf

echo "== watchdog =="
sudo tee /usr/local/bin/jobdog-watchdog.sh >/dev/null <<'WATCHDOG'
#!/bin/sh
# Restart backend-api if its health endpoint doesn't answer three times in a row.
for attempt in 1 2 3; do
  if curl -sf -m 5 http://localhost:8080/actuator/health >/dev/null; then
    exit 0
  fi
  sleep 10
done
logger -t jobdog-watchdog "backend-api not answering on :8080 - restarting"
docker kill jobdog-backend-api >/dev/null 2>&1 || true
cd /home/ec2-user/jobdog && docker compose up -d backend-api
WATCHDOG
sudo chmod +x /usr/local/bin/jobdog-watchdog.sh

sudo tee /etc/systemd/system/jobdog-watchdog.service >/dev/null <<'UNIT'
[Unit]
Description=Restart JobDog backend-api if it stops answering

[Service]
Type=oneshot
ExecStart=/usr/local/bin/jobdog-watchdog.sh
UNIT

sudo tee /etc/systemd/system/jobdog-watchdog.timer >/dev/null <<'TIMER'
[Unit]
Description=Run the JobDog backend watchdog every 2 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=2min
AccuracySec=15s

[Install]
WantedBy=timers.target
TIMER

sudo systemctl daemon-reload
sudo systemctl enable --now jobdog-watchdog.timer
echo "watchdog timer active:"
systemctl list-timers jobdog-watchdog.timer --no-pager | head -3

echo "== done =="
free -h
