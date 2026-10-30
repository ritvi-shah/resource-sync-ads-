FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
COPY out ./out
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/target/smart-content-manager-1.0.0.jar /app/app.jar
COPY --from=build /workspace/out/benchmark-results.csv /app/out/benchmark-results.csv
ENV PORT=3000
ENV APP_DB_PATH=/app/data/smart-content-manager.db
EXPOSE 3000
ENTRYPOINT ["sh", "-c", "mkdir -p \"$(dirname \"$APP_DB_PATH\")\" && exec java -jar /app/app.jar"]
