# AWS Migration Implementation Plan

> **For agentic workers:** This plan is infra provisioning, not application code — steps are `aws`/shell commands run directly against real, billed AWS resources, not code+test cycles. Recommended execution: inline in the main session (see Execution Handoff), not per-task subagent dispatch. Checkbox (`- [ ]`) syntax still tracks progress.

**Goal:** Move the backend stack (Postgres, Redis, backend-api, scraper-worker) from the DigitalOcean droplet to a single AWS EC2 instance, at lowest reasonable cost, with a safe cutover and rollback window.

**Architecture:** One `t4g.small` EC2 instance in the default VPC running the existing `docker-compose.yml` stack unchanged, Elastic IP + nginx/certbot for TLS, secrets in SSM Parameter Store, nightly Postgres backups to S3.

**Tech Stack:** AWS CLI (already installed, `.aws/credentials` configured, account `006876044954`, region `us-east-1`), Amazon Linux 2023 (arm64), Docker/Docker Compose, existing repo `docker-compose.yml`/`nginx-jobdog.conf`.

## Global Constraints

- Region: `us-east-1`. Instance type: `t4g.small`. Key pair: `jobdog` (already registered in AWS, matches local `jobdog.pem`).
- Default VPC: `vpc-0aabb37ad49f306f3`.
- Budget target: ~$15-18/mo total (EC2 + EBS + S3). No RDS/ElastiCache/ALB.
- Secrets (JWT secret, R2 keys, OpenAI key, OAuth secrets) come from the local `digitalocean` file (git-ignored, already populated) — never paste these into chat; read/write them via file redirection only.
- Every step that creates a billed AWS resource is announced before running, with the resource named and its expected cost.

---

### Task 1: Security group + confirm key pair

- [ ] **Step 1: Create a security group in the default VPC**

```bash
aws ec2 create-security-group --group-name jobdog-sg --description "JobDog EC2 security group" --vpc-id vpc-0aabb37ad49f306f3
```
Capture the returned `GroupId`.

- [ ] **Step 2: Open inbound 80/443 to the public, 22 restricted to the operator's current IP**

```bash
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --group-id <GroupId> --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id <GroupId> --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id <GroupId> --protocol tcp --port 22 --cidr ${MY_IP}/32
```

- [ ] **Step 3: Confirm the `jobdog` key pair exists (already verified — `key-0cfe76606793f943a`)**

```bash
aws ec2 describe-key-pairs --key-names jobdog
```

---

### Task 2: Launch the EC2 instance + Elastic IP

- [ ] **Step 1: Look up the latest Amazon Linux 2023 arm64 AMI**

```bash
AMI_ID=$(aws ssm get-parameters --names /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 --query "Parameters[0].Value" --output text)
echo $AMI_ID
```

- [ ] **Step 2: Launch the instance (announce cost before running: ~$12-13/mo)**

```bash
aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t4g.small \
  --key-name jobdog \
  --security-group-ids <GroupId> \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":25,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=jobdog-prod}]' \
  --count 1
```
Capture the `InstanceId`. Wait for it to reach `running`:
```bash
aws ec2 wait instance-running --instance-ids <InstanceId>
```

- [ ] **Step 3: Allocate and associate an Elastic IP (announce: free while attached, ~$3.60/mo if detached — must stay attached)**

```bash
aws ec2 allocate-address --domain vpc
aws ec2 associate-address --instance-id <InstanceId> --allocation-id <AllocationId>
```
Note the returned `PublicIp` — this becomes the DNS cutover target later.

- [ ] **Step 4: Verify SSH access**

```bash
ssh -i jobdog.pem -o StrictHostKeyChecking=accept-new ec2-user@<PublicIp> "echo CONNECTED"
```
Expected: `CONNECTED` (Amazon Linux's default user is `ec2-user`, not `root`).

---

### Task 3: Bootstrap the instance (Docker + repo)

- [ ] **Step 1: Install Docker + Docker Compose plugin + git**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> "sudo dnf install -y docker git && sudo systemctl enable --now docker && sudo usermod -aG docker ec2-user"
ssh -i jobdog.pem ec2-user@<PublicIp> "mkdir -p ~/.docker/cli-plugins && curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 -o ~/.docker/cli-plugins/docker-compose && chmod +x ~/.docker/cli-plugins/docker-compose"
```

- [ ] **Step 2: Copy the repo to the instance**

From the local repo root:
```bash
rsync -av -e "ssh -i jobdog.pem" --exclude '.git' --exclude 'node_modules' --exclude '.aws' --exclude 'digitalocean' --exclude '*.pem' ./ ec2-user@<PublicIp>:~/jobdog/
```
(If `rsync` isn't available in Git Bash, use `scp -r -i jobdog.pem` instead, same excludes applied by copying to a clean staging dir first.)

- [ ] **Step 3: Verify**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> "ls ~/jobdog/docker-compose.yml && docker --version && docker compose version"
```

---

### Task 4: Secrets — SSM Parameter Store + boot-time `.env` population

- [ ] **Step 1: Push each secret from the local `digitalocean` file into SSM as SecureString**

Read the local `digitalocean` file's keys (do not print values to chat) and push each:
```bash
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  aws ssm put-parameter --name "/jobdog/${key}" --value "${value}" --type SecureString --overwrite
done < digitalocean
```

- [ ] **Step 2: Create a boot script on the instance that fetches them into `.env`**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> 'cat > ~/jobdog/fetch-env.sh <<'"'"'EOF'"'"'
#!/bin/bash
set -e
aws ssm get-parameters-by-path --path "/jobdog/" --with-decryption --query "Parameters[*].[Name,Value]" --output text | \
  while IFS=$'"'"'\t'"'"' read -r name value; do
    key=$(basename "$name")
    echo "${key}=${value}"
  done > ~/jobdog/.env
EOF
chmod +x ~/jobdog/fetch-env.sh'
```
Note: the instance needs an IAM role (not the local IAM user) to call SSM — see Step 3.

- [ ] **Step 3: Attach an IAM role to the instance with SSM read access**

```bash
aws iam create-role --role-name jobdog-ec2-role --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name jobdog-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess
aws iam create-instance-profile --instance-profile-name jobdog-ec2-profile
aws iam add-role-to-instance-profile --instance-profile-name jobdog-ec2-profile --role-name jobdog-ec2-role
aws ec2 associate-iam-instance-profile --instance-id <InstanceId> --iam-instance-profile Name=jobdog-ec2-profile
```

- [ ] **Step 4: Run the fetch script and verify `.env` is populated (structure only, don't cat secret values)**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> "cd ~/jobdog && ./fetch-env.sh && wc -l .env"
```

---

### Task 5: Deploy the stack and verify

- [ ] **Step 1: Bring up the stack**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> "cd ~/jobdog && docker compose up -d --build"
```

- [ ] **Step 2: Verify all containers healthy**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> "cd ~/jobdog && docker compose ps"
```
Expected: `postgres`, `redis` show `healthy`; `backend-api`, `scraper-worker` show `running`.

- [ ] **Step 3: Smoke-test the backend directly via the Elastic IP**

```bash
curl -s http://<PublicIp>:8080/api/v1/jobs | head -c 200
```
Expected: JSON job listing response (empty DB is fine at this point — this instance has no data yet, confirmed in Task 6).

---

### Task 6: Data migration (Postgres dump/restore)

- [ ] **Step 1: Dump the DigitalOcean Postgres via the DO web console** (no SSH key available for the old droplet — use console)

In the DO droplet's web console:
```bash
docker exec jobdog-postgres pg_dump -U jobdog jobdog > /tmp/jobdog-dump.sql
```
Then download it off the droplet (e.g. `python3 -m http.server 8899` temporarily in `/tmp`, fetch via the droplet's IP over a browser/curl from the local machine, then kill the server) — a manual step, walk through it live rather than scripting blind.

- [ ] **Step 2: Copy the dump to the new EC2 instance and restore**

```bash
scp -i jobdog.pem jobdog-dump.sql ec2-user@<PublicIp>:~/
ssh -i jobdog.pem ec2-user@<PublicIp> "cat ~/jobdog-dump.sql | docker exec -i jobdog-postgres psql -U jobdog -d jobdog"
```

- [ ] **Step 3: Verify row counts look sane**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> "docker exec jobdog-postgres psql -U jobdog -d jobdog -c 'SELECT count(*) FROM users; SELECT count(*) FROM jobs; SELECT count(*) FROM applications;'"
```
Compare against what you'd expect from the live site (ask the human partner if unsure).

---

### Task 7: Nightly backups to S3

- [ ] **Step 1: Create the backup bucket**

```bash
aws s3api create-bucket --bucket jobdog-db-backups-006876044954 --region us-east-1
aws s3api put-bucket-lifecycle-configuration --bucket jobdog-db-backups-006876044954 --lifecycle-configuration '{"Rules":[{"ID":"expire-30d","Status":"Enabled","Filter":{},"Expiration":{"Days":30}}]}'
```

- [ ] **Step 2: Add S3 write access to the instance role**

```bash
aws iam put-role-policy --role-name jobdog-ec2-role --policy-name jobdog-s3-backup --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:PutObject"],"Resource":"arn:aws:s3:::jobdog-db-backups-006876044954/*"}]}'
```

- [ ] **Step 3: Add a nightly cron job on the instance**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> 'cat > ~/jobdog/backup.sh <<'"'"'EOF'"'"'
#!/bin/bash
set -e
FILE="jobdog-$(date +%Y%m%d-%H%M%S).sql.gz"
docker exec jobdog-postgres pg_dump -U jobdog jobdog | gzip > /tmp/$FILE
aws s3 cp /tmp/$FILE s3://jobdog-db-backups-006876044954/$FILE
rm /tmp/$FILE
EOF
chmod +x ~/jobdog/backup.sh
(crontab -l 2>/dev/null; echo "0 6 * * * ~/jobdog/backup.sh") | crontab -'
```

- [ ] **Step 4: Verify one manual run + one restore test**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> "~/jobdog/backup.sh"
aws s3 ls s3://jobdog-db-backups-006876044954/
```
Restore test: download the object, `gunzip`, restore into a scratch local/EC2 Postgres container (not production), confirm it loads without error.

---

### Task 8: TLS + DNS cutover

- [ ] **Step 1: Install nginx + certbot on the instance**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> "sudo dnf install -y nginx && sudo dnf install -y python3-pip && sudo pip3 install certbot certbot-nginx"
```

- [ ] **Step 2: Copy `nginx-jobdog.conf` into place and point it at the local backend**

The repo's `nginx-jobdog.conf` already proxies `/api/`, `/oauth2/`, `/login/oauth2/`, `/ws/` to `localhost:8080` and `/` to Vercel — copy it to `/etc/nginx/conf.d/jobdog.conf` on the instance, remove the default nginx site, `sudo systemctl restart nginx`.

- [ ] **Step 3: Lower DNS TTL (human partner action — I don't have DNS access)**

Ask the human partner to lower `jobdog.dev`'s A record TTL to 300s now, ahead of cutover, if not already done.

- [ ] **Step 4: Human partner flips DNS A record to the new Elastic IP**

Give them the Elastic IP; they make the change wherever DNS is managed. Wait for propagation (`dig jobdog.dev` from a few networks, or just wait ~TTL).

- [ ] **Step 5: Run certbot once DNS resolves to the new IP**

```bash
ssh -i jobdog.pem ec2-user@<PublicIp> "sudo certbot --nginx -d jobdog.dev -d www.jobdog.dev --non-interactive --agree-tos -m <operator-email>"
```

- [ ] **Step 6: Full smoke test against `https://jobdog.dev`**

Login/register, OAuth, resume upload, job listing, roast/grade endpoint — confirm all work against production DNS now pointing at AWS.

---

### Task 9: Rollback window + decommission

- [ ] **Step 1: Leave the DigitalOcean droplet stopped (not deleted) for ~1 week**

Human partner action in the DO dashboard: stop (don't destroy) the droplet.

- [ ] **Step 2: After the rollback window, decommission**

Human partner action: destroy the DO droplet, cancel the DO billing.

- [ ] **Step 3: Clean up local secrets**

```bash
rm -f digitalocean
```
(The `.aws/credentials` and `jobdog.pem` stay — still needed for ongoing AWS operations.)

---

## Self-Review Notes

- **Spec coverage:** compute (Task 2-3), networking/TLS (Task 1, 8), secrets (Task 4), data migration/cutover (Task 6, 8), backups (Task 7), rollback (Task 9) — all covered.
- **Cost checkpoints:** every resource-creating step in Tasks 1-2, 7 is called out with its expected cost per the Global Constraints budget.
- **Out of scope:** Kafka/Databricks (sized for, not built), RDS/ElastiCache migration (explicitly deferred), frontend (stays on Vercel, untouched).
