# KLTN_Edu

Service-Based Architecture for the KLTN_Edu graduation project.

## Development Environment

Java 21 is the only supported Java runtime for this repository. Maven builds are guarded by the Maven Enforcer Plugin and fail immediately on Java versions outside `[21,22)`.

Required tools:

- JDK 21
- Maven 3.9.x, or the Maven Wrapper included in each Java service

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

## Structure

- `backend/api-gateway`: API entrypoint for frontend clients.
- `backend/auth-service`: Authentication and account identity.
- `backend/learning-service`: Tutor, student, subject, request, matching, classroom, session, and assignment domains.
- `backend/contract-service`: Contract, payment, and wallet domains.
- `backend/notification-service`: Notification, email, and chat domains.
- `frontend-web`: Web frontend project.
- `mobile-app`: Mobile frontend project.
- `database`: MySQL schema, migration, seed, and diagrams.
- `docs`: Architecture, API, and AI context documentation.
- `docker`: Deployment-related Docker assets.

## Rules

No business code is generated in this scaffold. Domain implementation should be added inside each service module package.
