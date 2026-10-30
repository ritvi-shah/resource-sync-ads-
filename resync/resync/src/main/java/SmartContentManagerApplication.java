import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.context.annotation.Import;

@SpringBootConfiguration
@EnableAutoConfiguration
@Import(BackendConfiguration.class)
public class SmartContentManagerApplication {
    public static void main(String[] args) {
        SpringApplication.run(SmartContentManagerApplication.class, args);
    }
}
