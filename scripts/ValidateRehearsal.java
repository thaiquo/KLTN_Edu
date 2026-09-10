import org.flywaydb.core.Flyway;
import java.nio.file.Path;

/** Validate only: no application beans, schedulers, migration or blockchain clients. */
public class ValidateRehearsal {
    public static void main(String[] args) {
        for (String database : new String[]{"kltn_restorecheck", "kltn_rehearsal_fresh"}) {
            for (String service : new String[]{"account", "learning", "contract", "notification"}) {
                String location = Path.of("backend", service + "-service", "src/main/resources/db/migration")
                        .toAbsolutePath().toString().replace('\\', '/');
                Flyway flyway = Flyway.configure()
                        .dataSource("jdbc:postgresql://127.0.0.1:15434/" + database, "postgres", "")
                        .table("flyway_" + service + "_schema_history")
                        .locations("filesystem:" + location).load();
                flyway.validate();
                if (flyway.info().pending().length != 0) throw new IllegalStateException("Pending migrations: " + service);
                System.out.println("VERIFIED " + database + "/" + service);
            }
        }
    }
}
