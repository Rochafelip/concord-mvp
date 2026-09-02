# --- Stage 1: build --------------------------------------------------------
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

# Copy the Maven wrapper and pom.xml first so dependency resolution is
# cached in its own Docker layer and only re-runs when the pom changes.
COPY mvnw pom.xml ./
COPY .mvn/ .mvn/
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

# Now copy the rest of the source and build the jar. Tests are skipped here
# because CI already runs the full test suite (see docs/DECISIONS.md D5) —
# the image build just needs to produce the artifact.
COPY src/ src/
RUN ./mvnw -B package -DskipTests

# --- Stage 2: runtime --------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Run as a non-root user rather than the image's default root.
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /workspace/target/*.jar app.jar
RUN chown app:app app.jar
USER app

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
