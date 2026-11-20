# Test and Runtime Evidence

**Generated:** 2026-11-12T14:35+07:00
**Rule:** no database reset, destructive command, commit or push was performed.

## 1. Environment checks

| Capability | Command | Result |
|---|---|---|
| Java | `java -version` | `PASS`, Java 23 |
| Maven PATH | `mvn -version` | `BLOCKED`, command not recognized |
| Maven Wrapper | `backend\ai-service\mvnw.cmd` | `PASS`, wrapper executed |
| Node | `node --version` | `PASS`, v22.13.0 |
| npm | `npm --version` | `PASS`, 11.3.0 |
| Docker daemon | `docker info` with 10s bounded job | `BLOCKED`, timeout after 10s |
| Browser E2E | No Playwright install/run attempted | `NOT_VERIFIED`; audit scope used existing frontend tests/build only |

## 2. Commands executed

### AI matching targeted tests

```powershell
Set-Location 'T:\Nam 5 HKI\KLTN\KLTN_Edu\backend\ai-service'
& .\mvnw.cmd '-Dtest=TutorMatchingServiceTest,NaturalLanguageRequirementAnalyzerTest,CatalogGroundingServiceTest,StudentSemanticSearchServiceTest' test
```

**Exit code:** 0
**Result:** 91 tests, 0 failures, 0 errors, 0 skipped; Maven `BUILD SUCCESS` in 17.530 s.

Coverage represented by test names/source includes:

- correct/wrong subject and level;
- teaching-mode mismatch;
- unapproved tutor;
- budget overlap and distance;
- full/partial/no schedule compatibility;
- day-only and time-of-day schedule;
- relative experience;
- semantic hard-scope validation and authoritative candidate validation;
- natural-language normalization and catalog grounding.

### Frontend tests

```powershell
Set-Location 'T:\Nam 5 HKI\KLTN\KLTN_Edu\frontend-web'
npm run test:admin-operations
npm run test:portal-access
npm run test:pagination-contract
```

**Exit code:** 0 for each command. Results: 5 + 4 + 7 tests, all passed.

### Frontend production build

```powershell
Set-Location 'T:\Nam 5 HKI\KLTN\KLTN_Edu\frontend-web'
npm run build
```

**Exit code:** 0. Vite transformed 5,291 modules and produced a production bundle. No benchmark claim is made from build time.

## 3. Runtime verification verdict

```text
environment:
  docker: UNAVAILABLE — docker info timed out after 10s; daemon readiness unconfirmed
  node: AVAILABLE — v22.13.0
  playwright: NOT_VERIFIED — no browser installation/run in this audit-only scope
  infra-tier: BLOCKED — PostgreSQL/RabbitMQ/Qdrant runtime unavailable
  browser-tier: NOT_VERIFIED — existing Node tests/build only; no browser flow
startup: UNVERIFIED — no service was started because infrastructure readiness was blocked
integration: PASS — exit_code: 0, passed: 91, failed: 0, skipped: 0; AI service unit/service tests, no live external services
e2e: UNVERIFIED — no live Gateway/UI/API flow
overall: NEEDS_SIGNOFF — source and targeted tests pass, but runtime and data-dependent claims are blocked
```

## 4. Required runtime cases not executed

The following cases require authenticated Student context, running Gateway/Account/Learning/AI, and an initialized Qdrant/DB:

1. clear query;
2. ambiguous query and clarification;
3. synonym/topic wording;
4. hard-constraint conflict;
5. unavailable schedule;
6. no-result case;
7. manual search versus AI result comparison;
8. live response latency and sanitized request/response capture.

No fabricated request/response, latency or result count is included.

## 5. Worktree caveat

The audit started with a dirty worktree on `community-moderation-fix`, including AI chatbot files, frontend files and documentation changes unrelated to this audit. Those changes were not reverted, stashed or amended. The reports added by this audit are the only intended new artifacts.
