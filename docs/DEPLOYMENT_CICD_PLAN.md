# EduConnect Deployment and CI/CD Plan

> Status: Full Auto-CD via GitHub Actions operational (Release `a1a1bdd` verified live on VPS `103.74.100.232` / `educonnectiuh.duckdns.org` on 2026-10-29).
> All 12 containers running (`--profile ai`), DNS/HTTPS via Caddy, CI gate (1081 backend tests PASS, 16/16 jobs PASS), GHCR publication, PostgreSQL migrations (Flyway Learning V18 & Contract V22 applied with success=true),
> shared demo dataset (49 accounts, 40 classes), and live Sepolia Escrow agreement for Class #41 (4.80 USDC locked) verified.
> Classic Branch Protection on `main` active (PR required, 1 approval, `CI gate` required).
> Audited against repository source, GitHub Actions live workflow runs, and VPS runtime evidence on 2026-10-29.
> Target: Ubuntu 22.04 VPS (2 vCPU, 8 GB RAM, 40 GB disk) behind Caddy reverse proxy.

## 1. Decision

Use this delivery flow:

```text
Developer workstation
  -> GitHub repository (source, Dockerfiles, Compose, Actions workflows)
  -> GitHub Actions (checks and builds application images)
  -> GitHub Container Registry / GHCR (versioned images)
  -> VPS pulls images and runs them with Docker Compose
```

Build images on GitHub-hosted runners, not on this VPS. The VPS has limited CPU, memory and disk and should run the application, not compile the Java services and frontend.

Use Docker Compose on the single VPS. Do not add Kubernetes for this deployment. Keep the existing root `docker-compose.yml` for local infrastructure development and introduce a separate VPS deployment file, initially named `compose.vps.yaml`, so local workflows are not silently changed.

GitHub Actions validates changes, publishes SHA-tagged images, and deploys a
successful `main` release to the VPS automatically. Review and merge provide
the normal human gate. The one-time SSH, release-script and GitHub settings are
documented in [the automatic CD setup](../deploy/AUTO_CD_SETUP.md).

## 2. What the terms mean

| Term | Meaning in this project |
| --- | --- |
| Dockerfile | Build recipe for one deployable application, such as Account Service or Web. |
| Image | Immutable packaged application produced from source and a Dockerfile. |
| Container | A running instance of an image. Each backend, database, broker, and web server has its own container. |
| Docker Compose | YAML configuration declaring which containers run together, their settings, internal network, health checks, ports and persistent volumes. |
| GitHub Actions | CI/CD workflow runner. It checks code, builds images, and can initiate a deployment. |
| GHCR | GitHub's container registry. It stores Docker images; it does not run the application. |
| VPS | The machine that pulls images and runs the containers. |

Do not commit Docker image archives to Git. Commit source, Dockerfiles, Compose files and Actions workflow files. Publish images to GHCR.

## 3. Repository audit and current state

The project uses Service-Based Architecture. Current application components are:

- API Gateway
- Account Service
- Learning Service
- Contract Service
- Notification Service
- AI Service
- React/Vite Web frontend

Current supporting runtime components include PostgreSQL, RabbitMQ, Gotenberg and Qdrant. File workflows use S3 according to the current configuration. Blockchain RPC and Sepolia are external services; do not run an Ethereum node on this VPS. Mobile is excluded from this deployment phase.

Audited facts:

- Root `docker-compose.yml` currently defines PostgreSQL, RabbitMQ, Gotenberg and Qdrant; it does not define the application containers.
- Application Dockerfiles, `.dockerignore`, VPS Compose/Caddy configuration and
  CI/GHCR workflows were added on 2026-10-22. All seven application images build
  locally; Compose base/operator overlays, Caddy configuration, Web health/SPA
  fallback, executable backend manifests, Contract DOCX packaging and AI
  knowledge packaging pass local validation. The workflows have passed
  `actionlint` but have not yet run on GitHub-hosted runners or published GHCR
  images.
- Backend services have service-local Maven wrappers and use Java 21.
- Frontend uses Vite. Its `VITE_*` settings are public build-time browser configuration, not backend runtime secrets.
- `.gitignore` excludes `.env`; keep real credentials out of Git and Docker build contexts.
- Browser authentication uses JWT cookies and CSRF protection. Production Web/API origins, HTTPS, credentialed CORS, cookie flags, and WebSocket origin must work together.
- Contract and Notification share `JWT_SECRET`; the environment guide specifies starting the updated Contract Service before the updated Notification Service during coordinated updates.
- Contract Service performs durable blockchain transaction/event processing. Deploy exactly one operator-enabled Contract Service instance for this single-VPS setup.
- V1 has recorded Sepolia evidence. V2 is documented as source/test ready but not deployed. V2 must not be selected until backend and frontend ABI/interface compatibility is verified.

The current local Compose file must not be copied unchanged to the public VPS: it publishes infrastructure ports and injects the root `.env` into PostgreSQL. The VPS Compose design must keep database/broker/vector-store/document-converter ports private and pass each container only the configuration it needs.

### 3.1 Operational checkpoint — 2026-10-23

- GitHub CI and the GHCR publish workflow passed for the initial immutable
  release `3e8df29f9f473e71e3c7800ff62fe1b995a14136`; the newer
  `21b2c2b8fbcc1134aafce1d97fe8c0b937963805` release is now on the VPS.
- Ubuntu 22.04 VPS provisioning is complete: non-root `deploy` SSH access, 4 GiB
  swap, active UFW rules for SSH/HTTP/HTTPS, Docker Engine and Docker Compose.
- Deployment files and the protected runtime environment are installed under
  `/opt/educonnect`. The VPS pulls published images; it does not build source.
- The base stack is running with ten containers: PostgreSQL, RabbitMQ, Gotenberg,
  Account, Learning, Contract, Notification, Gateway, Web and Caddy. AI/Qdrant and
  the blockchain operator overlay remain deliberately disabled.
- `https://educonnectiuh.duckdns.org` and `/healthz` return HTTP 200. PostgreSQL,
  RabbitMQ, Gotenberg, Gateway and Web report healthy; Flyway created 80 public
  tables and all four service-specific history tables.
- PostgreSQL persists in the named volume `educonnect_postgres_data`. No verified
  off-VPS backup/restore rehearsal exists yet; never use `docker compose down -v`.
- Reference/catalog migrations are present, including administrative locations,
  teaching levels, subject catalogs and catalog levels.
- The shared thesis environment is confirmed to require the repository's selected
  demo accounts and learning dataset. The one-time load order is Account privileged
  accounts, Account Student/Tutor profiles, then Learning demo data. Keep the
  production profile; do not enable the automatic `dev` loaders on the VPS.
- The previous release rejected browser traffic carrying Origin
  `https://educonnectiuh.duckdns.org` with HTTP 403 `Invalid CORS request`.
  The newer release uses the shared `CORS_ALLOWED_ORIGIN_PATTERNS` setting for
  downstream REST and WebSocket handshakes; the production HTTPS origin passed
  an external CORS check. Authenticated login smoke testing is still pending.
- Reown/WalletConnect endpoints currently return HTTP 403 independently of the
  EduConnect API. Verify the production domain allowlist/project configuration after
  core cookie-auth smoke tests pass.

### 3.2 Shared V1 decision and next gate — 2026-10-23

- Keep the deployed Sepolia V1 escrow contract for shared development. Do not
  reset the VPS database or deploy V2 as part of this phase. Existing local
  databases are not a source of truth for the VPS.
- Release `21b2c2b8fbcc1134aafce1d97fe8c0b937963805` is now running on the
  VPS. Its downstream CORS fix was checked against the public HTTPS origin.
  CI builds and publishes images; VPS rollout is still a manual CD step.
- Inventory on 2026-10-23 confirmed `kltn_db` is 12 MB: `users`, `students`,
  `tutors`, `class_rooms`, `class_sessions`, `contract_agreement`,
  `escrow_payment` and `blockchain_transaction` each have zero rows. Flyway
  already loaded 34 provinces, 46 communes, 65 legacy subjects, 144 catalog
  subjects and 667 catalog levels. All four service migration histories have
  zero failed entries. Host had 5.5 GiB available RAM, 4 GiB unused swap and
  23 GiB available disk at inspection time.
- Create a PostgreSQL backup, copy it off-VPS and rehearse an isolated
  restore. Only then load selected
  demo accounts/catalog/learning data after reviewing credentials and side
  effects. Do not run automatic dev-profile seed loaders or seed financial/
  blockchain state.
- The pre-seed backup `educonnect-20261023T062234Z.dump` was created under
  `/home/deploy/educonnect-backups` (289,416 bytes, mode 600), and copied to
  the workstation's Documents backup directory. Both SHA-256 checksums match:
  `e4e3f300fb7ce1441182f2fb7e42a7887b32a3e4bc49cce579936e4d627bc1bb`.
  `pg_restore -l` and a full isolated restore both passed; the temporary
  database was removed after its row/Flyway counts matched the source snapshot.

### 3.3 End-to-end verification and active cutover — 2026-10-23

- Demo seed applied: 49 accounts and 40 classes loaded. Default non-admin passwords set for testing.
- Blockchain operator enabled: `BLOCKCHAIN_ENABLED=true` and `BLOCKCHAIN_OPERATOR_ENABLED=true` configured in VPS `.env`.
- Live Web3 Escrow verified: Tutor and Student signed EIP-712 off-chain via MetaMask; Operator registered agreement on Sepolia Escrow V1 (`0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`); Student deposited USDC on Sepolia. Agreement `2aeca99d-...` transitioned to `ACTIVE` and enrollment to `ENROLLED` for Classroom #41 (`start_date: 2026-10-24`).
- RabbitMQ connection fix: Added `SPRING_RABBITMQ_HOST: rabbitmq` to `contract-service` in `compose.vps.yaml` to ensure outbox events sync seamlessly to `learning-service`.
- AI Profile activated: Executed `docker compose --profile ai up -d`; `qdrant` and `ai-service` are running. Total 12/12 containers are UP.

### 3.4 Full Auto-CD Verification and Branch Protection — 2026-10-25

- **Quy trình triển khai tự động (Full Auto-CD on Merge to `main`)**:
  - Gộp PR vào `main` $\rightarrow$ `ci.yml` kiểm tra toàn bộ 982 tests backend + Web build $\rightarrow$ `publish-images.yml` đóng gói 7 images lên GHCR $\rightarrow$ job `deploy-production` kích hoạt kết nối SSH vào VPS qua khóa mạng `VPS_SSH_KEY`.
  - Trên VPS: thực thi `/usr/local/sbin/educonnect-release deploy <FULL_GIT_SHA>`, tự động tạo bản sao lưu CSDL PostgreSQL vào `/var/backups/educonnect`, kiểm tra dung lượng ổ đĩa, kiểm tra điều kiện an toàn, pull 7 images ứng dụng và khởi động lại container bằng lệnh:
    ```bash
    docker compose --env-file .env --env-file release.env --profile ai -f compose.vps.yaml up -d --remove-orphans
    ```
  - Kiểm chứng live trên VPS: bản phát hành `b57a37c` đã triển khai thành công, cả 12/12 container hoạt động tốt (`Up`), các endpoint công khai `/healthz` và API lớp học đều trả mã HTTP 200.
- **Bảo vệ nhánh `main` (Classic Branch Protection)**:
  - Cấu hình bắt buộc Pull Request với 1 lượt duyệt (`Require approvals: 1`).
  - Bắt buộc vượt qua kiểm thử `CI gate` trước khi cho phép merge.
  - Bật `Require branches to be up to date before merging` và `Do not allow bypassing the above settings`.
  - Tắt force push và xóa nhánh để bảo vệ lịch sử commit.
- **LÀM RÕ CÁC LOẠI KHÓA BẢO MẬT (SECURITY KEYS & CREDENTIALS CLARIFICATION)**:
  - **1. Khóa ví Blockchain Sepolia Operator (`BLOCKCHAIN_OPERATOR_PRIVATE_KEY` / Keystore)**:
    - Mục đích: Dùng để ký các giao dịch Smart Contract on-chain (đăng ký hợp đồng, thanh toán payout 85/15, hoàn tiền cọc) trên mạng Ethereum Sepolia qua ví `0x10dd719B6a13e9d275990d706C2640ab6F1CA28e`.
    - Vị trí: Lưu trữ duy nhất trong file `.env` trên VPS dưới biến `BLOCKCHAIN_OPERATOR_PRIVATE_KEY` (hoặc mount qua keystore file trong `compose.vps.operator.yaml`).
    - Phân quyền: Tuyệt đối KHÔNG đưa vào GitHub Actions Secrets, KHÔNG chia sẻ cho đồng đội.
  - **2. Khóa mạng SSH Deploy (`VPS_SSH_KEY`)**:
    - Mục đích: Cặp khóa mạng SSH chuẩn `ed25519` (`educonnect-gh-actions`) cấp quyền cho robot GitHub Actions đăng nhập vào tài khoản `deploy@103.74.100.232` trên VPS để thực hiện deploy bản dựng mới.
    - Vị trí: Private key lưu tại GitHub Secrets `VPS_SSH_KEY`, Public key lưu tại `~/.ssh/authorized_keys` của tài khoản `deploy` trên VPS, dấu vân tay host lưu tại GitHub Secrets `VPS_KNOWN_HOSTS`, IP VPS lưu tại GitHub Variables `VPS_HOST`.
    - Phân quyền: Khóa này chỉ có quyền SSH chạy lệnh deploy trên hệ điều hành Linux, hoàn toàn độc lập và không có bất kỳ quyền hạn nào đối với ví tiền hay hợp đồng thông minh Web3.

## 4. First deployment topology

Use one Compose project and one private Docker network. A reverse proxy is the only application entry point from the Internet.

```text
Internet
  -> DNS domain + HTTPS reverse proxy (Caddy or equivalent)
       -> Web static-file container
       -> API Gateway container (REST and WebSocket)
            -> Account Service
            -> Learning Service
            -> Contract Service
            -> Notification Service
            -> AI Service (optional resource profile)

Private Compose network:
  PostgreSQL + RabbitMQ + Gotenberg + optional Qdrant

Persistent volumes:
  PostgreSQL data; RabbitMQ data if durable queues require it;
  Qdrant data when AI indexing is enabled; proxy certificate data.

External:
  S3, SMTP provider, Gemini API, Sepolia RPC and Sepolia blockchain.
```

Only the reverse proxy should publish ports 80/443. Do not publish PostgreSQL 5432, RabbitMQ 5672/15672, Qdrant 6333/6334, Gotenberg 3000 or backend service ports to the public interface. SSH is managed by the host firewall separately.

Recommended initial feature profile:

- Core Web: Web, Gateway, Account, Learning, Contract, Notification, PostgreSQL, RabbitMQ, Gotenberg and reverse proxy.
- AI profile: AI Service and Qdrant, enabled when AI matching/chatbot is part of the demo and memory use has been checked.
- Mobile: not deployed in this phase.

If an AI endpoint is disabled, mark AI matching/chatbot as unavailable for that deployment and verify the rest of the Web flow still behaves correctly. Do not imply disabled features are operational.

## 5. Resource plan for the purchased VPS

The purchased 2 vCPU / 8 GB RAM / 40 GB disk machine is suitable for a small, low-concurrency demo, but it is constrained for all application and infrastructure services together.

- Build images on GitHub-hosted runners; no Maven/npm image build on the VPS.
- Start without AI/Qdrant unless needed. The five core Java backend services plus PostgreSQL, RabbitMQ, Gotenberg, Web and reverse proxy still require measurement and JVM memory limits.
- Set explicit per-service JVM heap/memory behavior and container memory/CPU limits after measuring actual startup and demo load. Do not assign one large heap per JVM or let every service consume all available host memory.
- Keep user-uploaded documents in configured S3, not on the 40 GB root disk. PostgreSQL, image layers, logs and caches still consume disk.
- Configure bounded container logs and monitor `free -h`, disk usage, container memory and restarts. Keep capacity for OS updates and image replacement during deploy.
- Enable swap only as an emergency buffer if desired; it is not a replacement for RAM and must not be used to justify an unmeasured full-stack deployment.
- If full feature coverage under concurrent group use cannot fit, first disable optional AI, then raise VPS resources. Avoid fragile per-container micro-optimizations before collecting measurements.

## 6. Image and Compose design

### 6.1 Images

Create one image for each backend application and one for the Web frontend. Use multi-stage builds:

- Backend build stage: Java 21/Maven compiles the service JAR.
- Backend runtime stage: a compatible Java 21 runtime image containing the JAR and runtime files only.
- Web build stage: Node builds Vite static assets.
- Web runtime stage: a small static web server serves those assets; do not run the Vite development server in production.

Add `.dockerignore` entries for `.git`, `.env*` except `.env.example` if needed, `target`, `node_modules`, local logs, backups, runtime data, private keys and generated artifacts. Review the build context so secrets cannot be copied into image layers.

Build each service from a reproducible context that includes its Maven wrapper, POM, source and any required shared files. Verify wrapper executable permissions in Linux. Do not assume the Windows workstation's path/case behavior is identical to Linux.

Publish images with immutable commit tags, for example `ghcr.io/<owner>/educonnect-account:<git-sha>`. Keep the previous known-good tag for rollback. Do not deploy using `latest` as the only version identifier.

### 6.2 VPS Compose file

`compose.vps.yaml` should use `image:` references to GHCR, not `build:` directives. It should define:

- Image and tag variables for each application.
- A private network and named persistent volumes.
- Health checks for infrastructure and application readiness where endpoints support them.
- Restart policies and conservative resource limits.
- `depends_on` health conditions for infrastructure readiness; application code must still retry transient dependency failures.
- Only reverse-proxy public ports.
- Runtime environment passed by explicit variable allow-lists or service-specific env files.
- Exactly one Contract Service/operator instance.

Use a separate root-owned deployment directory on the VPS, such as `/opt/educonnect`. Keep the deployment Compose file and non-secret release tag there or checked out from a controlled deployment revision. Keep real runtime secrets in a VPS-only file with restrictive permissions; never put them in the image or Git.

Do not pass the entire root `.env` to every container. Give each container only its needed variables. In particular, never provide the blockchain operator private key/keystore to Web or unrelated services.

## 7. Runtime configuration map

Inside the Compose network, `localhost` means the current container. Use Compose service DNS names for dependencies.

| Setting | VPS value shape |
| --- | --- |
| `DB_URL` | `jdbc:postgresql://postgres:5432/<database>` |
| `RABBITMQ_HOST` | `rabbitmq` |
| `ACCOUNT_SERVICE_URL` | `http://account-service:8081` |
| `LEARNING_SERVICE_URL` | `http://learning-service:8082` |
| `CONTRACT_SERVICE_URL` | `http://contract-service:8083` |
| `NOTIFICATION_SERVICE_URL` | `http://notification-service:8084` |
| `AI_SERVICE_URL` | `http://ai-service:8085` when AI is enabled |
| `QDRANT_URL` | `http://qdrant:6333` when AI is enabled |
| `CONTRACT_CONVERTER_URL` | `http://gotenberg:3000/forms/libreoffice/convert` |
| `FRONTEND_URL` | Exact HTTPS Web origin used by CORS/cookie configuration |
| `VITE_API_GATEWAY_URL`, `VITE_API_URL` | Public HTTPS origin/path reachable by the browser |
| `VITE_REALTIME_URL` | Public `wss://` WebSocket origin/path |
| `VITE_ESCROW_CONTRACT_ADDRESS` | Confirmed Sepolia contract used for this release |
| `BLOCKCHAIN_ESCROW_ADDRESS` | Same confirmed Sepolia address in Contract Service |
| `BLOCKCHAIN_START_BLOCK` | Block number associated with the selected deployment/cursor plan |

Vite injects `VITE_*` values into generated browser assets at build time. Supply public frontend settings when the Web image is built. Do not place passwords, JWT secrets, RPC keys that must remain private, AWS secrets or operator credentials in `VITE_*`. Browser RPC keys, if used, are public and should be restricted by provider settings.

For cookie authentication, use one HTTPS site/origin for Web and Gateway where possible. Configure exact allowed origins, credentialed CORS, cookie `Secure`/SameSite behavior, CSRF requests and WebSocket proxying. Do not switch to localStorage or Bearer-only auth to simplify deployment.

## 8. CI workflow design

Create a workflow under `.github/workflows/` with these stages:

### Pull Request / CI

1. Check out source.
2. Set up the Java 21 and Node versions required by the repo.
3. Run relevant backend tests/builds and the frontend production build.
4. Validate Dockerfiles and the deployment Compose configuration.
5. Do not publish production tags or access production deployment secrets from untrusted fork Pull Requests.

Start with a reliable full validation path. Once it is stable, use path filters/caching so a Web-only change need not rebuild every backend image. A shared config, base image, or common build change must still rebuild affected images.

### Main branch / image publication

1. Require CI to pass.
2. Build images on GitHub-hosted runners.
3. Use GitHub Actions `GITHUB_TOKEN` with only required `contents: read` and `packages: write` permissions to publish to GHCR.
4. Tag images with commit SHA; optionally add a human release tag. Record image digest in workflow output.
5. Do not include runtime `.env`, database contents, private keys, or operator keystores in build context or build arguments.

If GHCR packages are private, grant the VPS pull-only access. Store any needed token only on the VPS with restrictive permissions. Never use a broad personal credential when a narrowly scoped package-read credential suffices. For publishing, prefer workflow `GITHUB_TOKEN` over a personal access token.

## 9. CD workflow design

For current releases:

1. Publish all seven application images only after the `main` CI run succeeds.
2. The deployment job waits for both image publication jobs and verifies the
   selected SHA is still the head of `main`.
3. GitHub Actions uses a dedicated SSH key to stage only non-secret Compose and
   Caddy files, then invokes a fixed root-owned release command on the VPS.
4. The command keeps the raw operator key in the VPS-only `.env`, uses
   `--profile ai` with the base Compose file, pulls only application images,
   creates a checked PostgreSQL dump, starts containers and runs smoke checks.
5. Preserve the exact current image set and configuration for the first
   rollback, then keep the prior uniform SHA for later rollbacks. An image
   rollback does not undo Flyway migrations.

Prevent overlapping deployments with a workflow concurrency group. Do not
install a GitHub self-hosted runner on this 8 GB VPS; it consumes the same
constrained machine and broadens its CI attack surface.

The deployment command shape is:

```bash
docker compose --env-file .env --env-file release.env --profile ai -f compose.vps.yaml pull account-service learning-service contract-service notification-service api-gateway frontend-web ai-service
docker compose --env-file .env --env-file release.env --profile ai -f compose.vps.yaml up -d --wait --remove-orphans
docker compose --env-file .env --env-file release.env --profile ai -f compose.vps.yaml ps
```

This is a manual fallback shape after `release.env` has been created. The
automatic release script handles validation, backup and checks. Never append
`down -v` to a deployment command, and do not prune old images before the new
release is healthy and the previous image is still available for rollback.

## 10. Database, migrations and recovery

- VPS starts with a separate empty PostgreSQL volume. Do not copy the local Docker database unless the user explicitly decides its development data is needed.
- On first application startup, each owning service runs its Flyway lineage against the shared PostgreSQL database using its own Flyway history table. Preserve current ownership and migration files; never rewrite already-applied migrations to deploy.
- Verify initial reference/catalog data and create the required administrator through the supported application flow or an audited seed process. Do not load development-only seed SQL in the shared demo environment without reviewing its profile/activation rules.
- Before schema-changing releases, take a database backup and confirm it is readable. A migration may not be reversible merely by deploying an older image.
- Schedule backups outside the VPS. A Docker volume protects data from container replacement, not disk loss or VPS deletion.
- `docker compose down` preserves named volumes by default; `docker compose down -v` removes them. Never run the latter on the shared VPS as routine maintenance.
- Keep PostgreSQL, RabbitMQ and Qdrant data on named volumes. Document retention and capacity before storing demo agreements or uploaded documents.

## 11. Blockchain release gate

Blockchain deployment is a separate, deliberate release operation, not part of every application CI/CD run.

1. Choose V1 or V2 only after verifying the Solidity ABI against backend calldata/event handling and Web ABI/actions.
2. For the first app deploy, use the currently documented V1 deployment only for a smoke environment if its address and keys are confirmed. If the goal is a clean shared demo chain state, deploy one fresh compatible contract before the team begins creating official demo agreements.
3. Do not deploy V2 by changing only the address: V2 is documented as not deployed and its application compatibility has not been established by this audit.
4. Keep `BLOCKCHAIN_CHAIN_ID=11155111`, USDC address, contract address, operator role/address, RPC endpoints, start block and frontend public contract address consistent.
5. Keep operator signing material in the VPS-only Contract Service runtime configuration. The active VPS uses a raw key in its private `.env`; the keystore overlay remains an alternative. Never give the key to Web or unrelated services. Sepolia ETH is gas; USDC/ERC-20 test token is the escrow asset.
6. Verify chain ID, deployed bytecode/ABI, roles, USDC, funding and confirmed event ingestion before opening the shared demo to the group.
7. Do not deploy a replacement contract while demo agreements/funds are active without a migration/recovery decision. Existing agreements and funds do not move to a new contract automatically.

## 12. Step-by-step execution checklist

### Phase 0 — Prepare accounts and server

- [ ] Confirm GitHub repository owner/package visibility and who can merge to the deployment branch.
- [ ] Point a domain to the VPS and plan HTTPS before sharing account login with the group.
- [ ] Create a non-root deploy identity and SSH key; restrict SSH access and firewall rules.
- [ ] Configure a 2 GB - 4 GB swapfile on VPS as an emergency OOM buffer.
- [ ] Install Docker Engine and Compose plugin using Docker's official Ubuntu instructions.
- [ ] Confirm free disk/RAM and that local VPS credentials are not reused from source-control secrets.

### Phase 1 — Containerize one service at a time

- [ ] Add `.dockerignore` and production runtime Dockerfiles.
- [ ] Build and run each image locally; first do a simple stateless service, then Gateway, then data-dependent services.
- [ ] Build the Web static image with target domain/API/WebSocket and chain config.
- [ ] Confirm images contain no `.env`, keystore, private key, generated user data or local DB volume.

### Phase 2 — Build the VPS Compose topology

- [ ] Add `compose.vps.yaml`; retain local root Compose unchanged for developer infrastructure.
- [ ] Add the reverse proxy and only publish HTTP/HTTPS.
- [ ] Add core app and infrastructure services, private service DNS, health checks and named volumes.
- [ ] Keep AI/Qdrant an optional profile until resource measurements show it fits.
- [ ] Set container/JVM limits from observed startup memory and test the complete demo flows.
- [ ] Review the resolved Compose config without printing secrets into CI logs.

### Phase 3 — CI and GHCR

- [ ] Add Pull Request checks for Java and Web.
- [ ] Add image build/publish on the protected deployment branch.
- [ ] Use least-privilege workflow token permissions and immutable SHA tags.
- [ ] Confirm GHCR packages link to the correct repository and VPS can pull them.

### Phase 4 — First VPS deployment

- [ ] Place the deployment Compose file and VPS-only secret configuration in the deployment directory.
- [ ] Start infrastructure and wait for health checks.
- [ ] Start Account, Learning, Contract, Gateway and Notification in the documented order where needed; ensure Contract starts before Notification when updating their shared service-token behavior.
- [ ] Start Web and reverse proxy with HTTPS.
- [ ] Verify Flyway migrations, Gateway routes, login/refresh/CSRF, WebSockets, S3 uploads, PDF generation and required service-to-service calls.
- [ ] Monitor memory, CPU, disk and container restart count during the smoke run.

### Phase 5 — Shared demo cutover

- [ ] Decide whether the VPS DB should stay clean or receive selected seed/demo accounts; do not import the entire local test DB by accident.
- [ ] Finalize the compatible Sepolia contract and block cursor before creating official shared agreements.
- [ ] Back up the fresh VPS DB and verify restore instructions.
- [ ] Run Student/Tutor/Admin representative flows and confirm blockchain events are ingested by the same Contract Service/DB.
- [ ] Share the HTTPS Web URL with the team; each person uses an individual account and wallet against the same deployment.

### Phase 6 — Routine release

- [ ] Merge code only after CI is green.
- [ ] Select and deploy an immutable image tag.
- [ ] Check health/logs and smoke flows.
- [ ] Keep the previous working tag available for rollback.
- [ ] Backup before database migrations; never delete persistent volumes to fix an application deploy.
- [ ] Review disk, memory and backup status regularly.

## 13. Acceptance criteria before calling the deployment ready

- [ ] GitHub PR checks run without accessing production secrets.
- [ ] Images build on GitHub-hosted runners and are stored under intended GHCR permissions.
- [ ] The VPS pulls images; it does not need Maven or Node to build the application.
- [ ] Only HTTPS proxy and restricted SSH are publicly reachable; data stores and internal services are private.
- [ ] Restarting/recreating an application container does not lose PostgreSQL data.
- [ ] A database backup can be restored to a clean test database.
- [ ] All configured internal URLs use Compose service DNS, not `localhost`.
- [ ] Web build-time URLs match the real HTTPS Gateway/WebSocket origins.
- [ ] Cookie auth, CSRF, credentialed CORS and WebSocket paths work over HTTPS.
- [ ] Contract address/chain/start block/USDC and backend/Web ABI are verified together.
- [ ] Core demo smoke flows pass; optional AI is either verified on or clearly disabled.
- [ ] CPU/RAM/disk stay within measured limits during the demo and logs do not expose secrets.
- [ ] A previous image version and rollback steps are documented.

## 14. Official references

- [Docker Compose overview](https://docs.docker.com/compose/)
- [Docker Compose application model](https://docs.docker.com/compose/intro/compose-application-model/)
- [Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/)
- [Docker Compose volumes](https://docs.docker.com/reference/compose-file/volumes/)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Engine installation on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [GitHub Actions: publish Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [GitHub Actions deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)

## 15. Related project references

- [Project overview](PROJECT.md)
- [Implementation status](IMPLEMENTATION_STATUS.md)
- [Architecture](ARCHITECTURE.md)
- [Authentication and security](AUTH_SECURITY.md)
- [Environment setup](ENV_SETUP.md)
- [Blockchain deployment and operations](BLOCKCHAIN.md)
