# syntax=docker/dockerfile:1.7
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY backend/api-gateway/pom.xml ./pom.xml
COPY backend/api-gateway/src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -DskipTests package \
    && artifact="$(find target -maxdepth 1 -type f \( -name '*.jar' -o -name '*.war' \) ! -name '*.original' | head -n 1)" \
    && test -n "$artifact" \
    && cp "$artifact" /tmp/app.jar

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S educonnect && adduser -S educonnect -G educonnect
WORKDIR /app
COPY --from=build --chown=educonnect:educonnect /tmp/app.jar ./app.jar
USER educonnect
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
