# KLTN_Edu

Service-Based Architecture for the KLTN_Edu graduation project.

## Development Environment

Java 21 is the only supported Java runtime for this repository. Maven builds are guarded by the Maven Enforcer Plugin and fail immediately on Java versions outside `[21,22)`.

Required tools:

- JDK 21
- Maven 3.9.x, or the Maven Wrapper included in each Java service
- PostgreSQL 18 with database `kltn_db`

Windows PowerShell example:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
java -version
mvn -version
mvn clean test
```

Linux/macOS example:

```bash
export JAVA_HOME=/opt/jdk-21
export PATH="$JAVA_HOME/bin:$PATH"
java -version
mvn -version
mvn clean test
```

The root `pom.xml` is an aggregator for all Java backend services, so `mvn clean test` from the repository root validates the Java service set.

## Run Backend Without Docker

The default local PostgreSQL connection is:

```text
host: localhost
port: 5432
database: kltn_db
username: postgres
password: quocthai
```

All domain services use the same database and own separate schemas:

```text
account-service      -> account
learning-service     -> learning
contract-service     -> contract
notification-service -> notification
```

Start each application in a separate PowerShell terminal:

```powershell
cd backend/api-gateway; .\mvnw.cmd spring-boot:run
cd backend/account-service; .\mvnw.cmd spring-boot:run
cd backend/learning-service; .\mvnw.cmd spring-boot:run
cd backend/contract-service; .\mvnw.cmd spring-boot:run
cd backend/notification-service; .\mvnw.cmd spring-boot:run
```

When opening a service directly in IntelliJ, open its `pom.xml` as a Maven project and use JDK 21 for the Project SDK, Module SDK, Maven Runner JRE, and Spring Boot run configuration. Reload the Maven project after changing `pom.xml`.

Default ports are `8080`, `8081`, `8082`, `8083`, and `8084` in the same order. Database connection values can be overridden with `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD`.

The web client sends `/api/*` to API Gateway on port `8080`. Gateway removes the local `/api` development prefix and routes Account paths to `8081`, Learning paths to `8082`, and Notification/Chat paths to `8084`. Do not point the frontend directly at a domain service.

## File Storage

Certificate upload uses the private S3 bucket configured in `backend/.env` by default. Account Service loads that file automatically when started from the repository root, `backend`, or `backend/account-service`:

```powershell
$env:AWS_S3_BUCKET = "your-private-bucket"
$env:AWS_REGION = "ap-southeast-1"
$env:AWS_ACCESS_KEY_ID = "your-iam-access-key"
$env:AWS_SECRET_ACCESS_KEY = "your-iam-secret-key"
```

Set `STORAGE_PROVIDER=local` explicitly only when local storage is required for development. When access keys are omitted, credentials are read from the AWS SDK standard provider chain, such as an AWS CLI profile or IAM role. Storage prefixes for certificates, direct/group chat, avatars, assignments, and submissions are documented in `docs/storage-key-conventions.md`.

RabbitMQ outbox publishing is disabled for local development by default. When RabbitMQ is available, enable it with `AUTH_OUTBOX_RELAY_ENABLED=true`; pending events stored in PostgreSQL will then be published and marked as completed.

## Structure

- `backend/api-gateway`: API entrypoint for frontend clients.
- `backend/account-service`: Authentication, account identity, profile, role, and tutor domains.
- `backend/learning-service`: Tutor, student, subject, request, matching, classroom, session, and assignment domains.
- `backend/contract-service`: Contract, payment, and wallet domains.
- `backend/notification-service`: Notification, email, and chat domains.
- `frontend-web`: Web frontend project.
- `mobile-app`: Mobile frontend project.
- `database`: PostgreSQL schema, migration, seed, and diagrams.
- `docs`: Architecture, API, and AI context documentation.
- `docker`: Deployment-related Docker assets.

## Rules

Domain implementation belongs inside each service module package and must follow `Plan/start02.md`.
