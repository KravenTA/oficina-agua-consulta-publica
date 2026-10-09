# --- Etapa 1: compilar (genera interfaces/DTOs desde el contrato y empaqueta) ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY openapi ./openapi
COPY src ./src
RUN mvn -B -q -DskipTests package

# --- Etapa 2: imagen final, solo con el JRE ---
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --no-create-home appuser
COPY --from=build /build/target/consulta-service-*.jar app.jar
USER appuser
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
