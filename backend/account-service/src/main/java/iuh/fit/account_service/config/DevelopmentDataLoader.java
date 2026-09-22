package iuh.fit.account_service.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
@Profile("dev")
public class DevelopmentDataLoader implements ApplicationRunner {

    private final DataSource dataSource;

    public DevelopmentDataLoader(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        populator.addScript(new ClassPathResource("db/dev-data/development_accounts.sql"));
        populator.addScript(new ClassPathResource("db/dev-data/development_users.sql"));
        populator.execute(dataSource);
    }
}
