# EduConnect automatic VPS deployment

The existing `CI` workflow validates a pull request and checks `main` again after
merge. `Publish images` builds seven GHCR images tagged with that full commit SHA.
Its `Deploy VPS` job then stages only `compose.vps.yaml` and `deploy/Caddyfile`
and asks the VPS to release that SHA. Mobile and Solidity contracts are not
deployed by this workflow.

The active VPS operator uses `BLOCKCHAIN_OPERATOR_PRIVATE_KEY` in its VPS-only
`.env`. The workflow never uploads, reads, or prints that file. It uses the base
Compose file with `--profile ai`; it does not use `compose.vps.operator.yaml`.
The GitHub SSH key described below is separate from the Sepolia operator key.

## 1. Verify the current VPS state (owner, one time)

SSH to the VPS as `deploy`, then run these read-only checks. Do not paste the
private key or the full `.env` into a terminal transcript or GitHub issue.

```bash
cd /opt/educonnect
grep '^RELEASE_TAG=' .env
grep -q '^BLOCKCHAIN_ENABLED=true$' .env && echo 'Blockchain enabled'
grep -q '^BLOCKCHAIN_OPERATOR_ENABLED=true$' .env && echo 'Operator enabled'
grep -q '^BLOCKCHAIN_OPERATOR_PRIVATE_KEY=.' .env && echo 'Operator key configured'
sudo docker compose --profile ai -f compose.vps.yaml config --quiet
sudo docker compose --profile ai -f compose.vps.yaml ps
sudo docker inspect "$(sudo docker compose --profile ai -f compose.vps.yaml ps -q api-gateway)" --format '{{.Config.Image}}'
```

Inventory on 2026-10-25 shows a **mixed** application release: `.env` says
`06c67b9a659829306fe6ce42709b9c7d341dd12e`, Web and Learning use that
tag, while Account, AI, Gateway, Contract and Notification still use
`21b2c2b8fbcc1134aafce1d97fe8c0b937963805`. This is expected input to
the preflight command below. It saves all seven exact image references as a
special `baseline` rollback target before CD replaces them. Keep the existing
GHCR pull credentials working for root's Docker client. Once CD has run,
`release.env` records the current uniform SHA and overrides the original value
in `.env`.

## 2. Create a dedicated SSH key (owner, one time)

On your Windows workstation, in PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\educonnect-gh-actions" -C "educonnect-gh-actions"
```

Press Enter twice for an empty passphrase because GitHub Actions cannot answer
an interactive prompt. This creates an SSH key for deployment access; it is not
the blockchain wallet key.

Add only the **public** key to the existing `deploy` account. This command asks
for your current VPS login password once:

```powershell
Get-Content "$env:USERPROFILE\.ssh\educonnect-gh-actions.pub" |
  ssh deploy@103.74.100.232 "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
ssh -o BatchMode=yes -i "$env:USERPROFILE\.ssh\educonnect-gh-actions" deploy@103.74.100.232 "whoami"
```

The last command should print `deploy` without a password prompt.

Pin the VPS SSH host key. First, on the VPS, record the fingerprint:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Then on Windows, fetch the public host key and compare its fingerprint with
the value shown on the VPS. Stop if they differ:

```powershell
ssh-keyscan -t ed25519 103.74.100.232 |
  Set-Content -Encoding ascii "$env:USERPROFILE\.ssh\educonnect-vps-known-hosts"
ssh-keygen -lf "$env:USERPROFILE\.ssh\educonnect-vps-known-hosts"
```

## 3. Install the fixed release command (owner, one time)

From any PowerShell directory on your Windows workstation:

```powershell
scp "D:\KL\khoaluan\KLTN_Edu\deploy\vps-release.sh" deploy@103.74.100.232:/home/deploy/vps-release.sh
```

SSH to the VPS as `deploy` and install the script with root ownership. These
commands need your existing sudo password one time:

```bash
sudo install -o root -g root -m 0750 /home/deploy/vps-release.sh /usr/local/sbin/educonnect-release
printf '%s\n' 'deploy ALL=(root) NOPASSWD: /usr/local/sbin/educonnect-release' |
  sudo tee /etc/sudoers.d/educonnect-release >/dev/null
sudo chmod 0440 /etc/sudoers.d/educonnect-release
sudo visudo -cf /etc/sudoers.d/educonnect-release
sudo -n -l /usr/local/sbin/educonnect-release
current_sha=$(sudo sed -n 's/^RELEASE_TAG=//p' /opt/educonnect/.env | head -n 1 | tr -d '\r')
sudo -n /usr/local/sbin/educonnect-release check "$current_sha"
```

The `check` operation creates the root-owned `release.env` if needed, checks
the current 12-service stack, and saves the current mixed image set as
`baseline`. It does not update any container.

The release script accepts only `check`, `deploy` or `rollback` and a full
lowercase Git SHA. It validates Compose, pulls the seven application images, makes a checked
PostgreSQL backup under `/var/backups/educonnect`, starts the stack, checks all
12 containers and tests the public Web and class-search endpoints. A failed
release leaves a marker in `/opt/educonnect/.release-state/pending.env`; inspect
the failure before starting another deployment. A prior application's image
cannot undo a Flyway migration.

The root-owned script is intentionally installed once and is not replaced by
the workflow. If `deploy/vps-release.sh` changes later, the owner repeats the
`scp` and `sudo install` commands after reviewing the change.

## 4. Set GitHub variables and secrets (owner, one time)

In the repository's **Settings → Secrets and variables → Actions**, create:

| Type | Name | Value |
| --- | --- | --- |
| Variable | `VPS_HOST` | `103.74.100.232` (or the exact hostname used in the known-hosts file) |
| Secret | `VPS_SSH_KEY` | The complete contents of `educonnect-gh-actions`, the SSH **private** key |
| Secret | `VPS_KNOWN_HOSTS` | The complete contents of `educonnect-vps-known-hosts` |

On Windows, copy each file to the clipboard separately, then paste it into
the corresponding GitHub secret field. Do not print or paste the private key
into a chat or terminal transcript:

```powershell
Get-Content -Raw "$env:USERPROFILE\.ssh\educonnect-gh-actions" | Set-Clipboard
Get-Content -Raw "$env:USERPROFILE\.ssh\educonnect-vps-known-hosts" | Set-Clipboard
```

Run the first command and save `VPS_SSH_KEY` before running the second command
to save `VPS_KNOWN_HOSTS`. The workflow accepts Windows or Unix line endings.

Keep the existing `PRODUCTION_ORIGIN`, `PRODUCTION_REALTIME_ORIGIN`, Web3 and
WalletConnect variables required by `publish-images.yml`. Never put
`BLOCKCHAIN_OPERATOR_PRIVATE_KEY`, database passwords, `.env`, database dumps,
or the VPS login password into GitHub Actions secrets for this deployment.

The repository owner has an active GitHub Pro student benefit, so private
branch protection is available. After the first PR has run `CI gate`, open the
repository's **Settings → Branches → Add classic branch protection rule** and
set the branch name pattern to `main`:

1. Enable **Require a pull request before merging** and require **1 approval**.
2. Enable **Dismiss stale pull request approvals** and **Require approval of the
   most recent reviewable push**. With two people, the PR author asks the other
   person to review.
3. Enable **Require status checks to pass before merging**, choose `CI gate`,
   and require the branch to be up to date before merging.
4. Enable **Require conversation resolution** and **Do not allow bypassing the
   above settings**, including for the repository owner.
5. Leave force pushes and deletions disabled. Do not require a successful
   production deployment *before* merge: this CD job runs only *after* merge.

Review changes to `.github/workflows/`, `deploy/vps-release.sh`, Compose and
Dockerfiles carefully because merged code can use the deployment SSH secret or
read runtime configuration on the VPS. Do not enable **Require review from Code
Owners** until a CODEOWNERS policy for both team members is agreed; a sole
owner cannot approve their own PR.

## 5. First release and routine operation

Create a feature branch and stage only the CI/CD files. This working tree may
also contain generated `frontend-web/dist` files and unrelated local notes;
do not use `git add .` for this PR. On Windows, from the repository root:

```powershell
git switch -c chore/automatic-cd
git add .github/workflows/ci.yml .github/workflows/publish-images.yml .gitignore deploy/vps-release.sh deploy/AUTO_CD_SETUP.md deploy/production.env.example
git diff --cached --check
git diff --cached --stat
git commit -m "feat(ci): deploy successful main releases to VPS"
git push -u origin chore/automatic-cd
```

Open the PR and wait for `CI gate`. Configure the `main` protection rule from
step 4 after that check appears. Complete VPS and GitHub SSH setup **before**
merging the PR. The first merge to `main` runs CI, publishes all seven images,
and then deploys.
Watch the `Publish images → Deploy VPS` job in GitHub Actions. After it passes,
check the site, log in, and try one ordinary read-only feature. Do not use a
real escrow transaction as an automated smoke test.

For later feature work, open a PR, wait for `CI gate`, review, and merge. The
teammate needs no VPS password or SSH session. The workflow skips an older SHA
if another commit has already become the head of `main`.

If a release fails after containers start, inspect the Actions log and VPS
backup before deciding whether an image rollback is compatible with the
database migration. The owner can then run, on the VPS:

```bash
previous_id=$(sudo cat /opt/educonnect/.release-state/previous.id)
sudo -n /usr/local/sbin/educonnect-release rollback "$previous_id"
```

For the first uniform release, `previous.id` is `baseline`, which restores the
exact mixed image set recorded by the preflight command. Later releases record
the previous uniform SHA.

`/var/backups/educonnect` is on the VPS. Continue making off-VPS backups and
periodically rehearse a full restore; local backups alone do not cover VPS
disk loss. The script stops if less than 3 GiB remains before pulling images;
move verified old backups off the VPS and review image retention as disk fills.
