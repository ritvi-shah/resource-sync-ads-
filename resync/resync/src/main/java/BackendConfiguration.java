import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.util.unit.DataSize;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;

@Configuration(proxyBeanMethods = false)
@EnableTransactionManagement
public class BackendConfiguration {
    @Bean
    DataSource dataSource(@Value("${app.db.path:data/smart-content-manager.db}") String dbPath) {
        String normalized = dbPath.trim();
        if (normalized.isEmpty() || normalized.equals(":memory:")) {
            throw new IllegalArgumentException("APP_DB_PATH must name a file-backed SQLite database.");
        }
        Path file = Paths.get(normalized).toAbsolutePath();
        Path parent = file.getParent();
        if (parent != null) {
            try {
                Files.createDirectories(parent);
            } catch (IOException exception) {
                throw new IllegalStateException("Could not create the SQLite data directory.", exception);
            }
        }
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.sqlite.JDBC");
        dataSource.setUrl("jdbc:sqlite:" + file);
        return dataSource;
    }

    @Bean
    JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    ResourceRepository resourceRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        return new SqliteResourceRepository(jdbcTemplate, objectMapper);
    }

    @Bean
    AttachmentRepository attachmentRepository(JdbcTemplate jdbcTemplate) {
        return new SqliteAttachmentRepository(jdbcTemplate);
    }

    @Bean
    AttachmentStorage attachmentStorage(@Value("${app.attachment.storage-dir:data/attachments}") String directory) {
        return new AttachmentStorage(directory);
    }

    @Bean
    AttachmentService attachmentService(
            ResourceRepository resources,
            AttachmentRepository attachments,
            AttachmentStorage storage,
            @Value("${app.attachment.max-file-size:20MB}") String maximumFileSize) {
        return new AttachmentService(resources, attachments, storage, DataSize.parse(maximumFileSize).toBytes());
    }

    @Bean
    SplayTree splayTree(ResourceRepository repository) {
        SplayTree tree = new SplayTree();
        repository.findPage(null, null, null, 0, Integer.MAX_VALUE, "id", "asc")
                .forEach(activity -> tree.insert(activity.resource().id()));
        return tree;
    }

    @Bean
    AccessTracker accessTracker(
            ResourceRepository repository,
            @Value("${app.access-history-limit:20}") int historyLimit) {
        AccessTracker tracker = new AccessTracker(historyLimit);
        repository.findAllAccessEventsChronologically()
                .forEach(event -> tracker.recordAccessAt(event.resourceId(), event.accessedAt()));
        return tracker;
    }

    @Bean
    ResourceAccessService resourceAccessService(SplayTree tree, AccessTracker tracker) {
        return new ResourceAccessService(tree, tracker);
    }

    @Bean
    CatalogService catalogService(
            ResourceRepository repository,
            ResourceAccessService accessService,
            SplayTree tree,
            AccessTracker tracker,
            AttachmentService attachmentService) {
        return new CatalogService(repository, accessService, tree, tracker, attachmentService);
    }

    @Bean
    BenchmarkReportService benchmarkReportService(
            @Value("${app.benchmark-report-path:out/benchmark-results.csv}") String reportPath) {
        return new BenchmarkReportService(Paths.get(reportPath));
    }

    @Bean
    ResourceController resourceController(CatalogService catalogService) {
        return new ResourceController(catalogService);
    }

    @Bean
    ResourceAttachmentController resourceAttachmentController(AttachmentService attachmentService) {
        return new ResourceAttachmentController(attachmentService);
    }

    @Bean
    AnalyticsController analyticsController(CatalogService catalogService, BenchmarkReportService benchmarkReportService) {
        return new AnalyticsController(catalogService, benchmarkReportService);
    }

    @Bean
    ApiExceptionHandler apiExceptionHandler() {
        return new ApiExceptionHandler();
    }

    @Bean
    WebMvcConfigurer corsConfigurer(
            @Value("${app.cors.allowed-origins:http://localhost:5173}") String allowedOrigins) {
        String[] origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toArray(String[]::new);
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins(origins)
                        .allowedMethods("GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("Content-Type", "Accept", "Idempotency-Key")
                        .maxAge(3600);
            }
        };
    }
}
