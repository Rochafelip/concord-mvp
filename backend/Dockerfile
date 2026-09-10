# --- Stage 1: build --------------------------------------------------------
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY mvnw pom.xml ./
COPY .mvn/ .mvn/
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

COPY src/ src/
RUN ./mvnw -B package -DskipTests


# --- Stage 2: runtime ------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Create non-root user. UID/GID are pinned to 1000 to match the chown done by
# the backend-init container on the shared uploads volume (docker-compose.yml)
# — leaving them to Alpine's default system-user allocation (uid 100/gid 101)
# desyncs the two and the app can't write to /app/uploads.
RUN addgroup -g 1000 -S app && adduser -S -D -H -u 1000 -G app app

# Create directories that the application needs
RUN mkdir -p /app/uploads \
    && chown -R app:app /app

COPY --from=build /workspace/target/*.jar app.jar

RUN chown app:app app.jar

USER app

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]