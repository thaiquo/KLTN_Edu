package iuh.fit.apigateway;

import iuh.fit.apigateway.infrastructure.filter.CorrelationIdFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.gateway.route.RouteDefinitionLocator;

import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ApiGatewayApplicationTests {

    @Autowired
    private RouteDefinitionLocator routeDefinitionLocator;

    @Autowired
    private CorrelationIdFilter correlationIdFilter;

    @Test
    void loadsConfiguredRoutesAndGlobalFilter() {
        Set<String> routeIds = routeDefinitionLocator.getRouteDefinitions()
            .map(route -> route.getId())
            .collect(Collectors.toSet())
            .block();

        assertThat(routeIds)
            .containsExactlyInAnyOrder("account-service", "learning-service", "notification-service");
        assertThat(correlationIdFilter).isNotNull();
    }
}
