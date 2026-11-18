package iuh.fit.api_gateway.reporting;

import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OperationalSlaSchedulerTest {
    @Test
    void schedulerEvaluatesAndPublishesWithoutActionCenterRequest() {
        var workItems = mock(OperationalWorkItemService.class);
        var notifications = mock(OperationalSlaNotificationPublisher.class);
        var item = mock(OperationalWorkItemService.WorkItemV1.class);
        when(workItems.schedulerBatch()).thenReturn(Mono.just(
                new OperationalWorkItemService.SchedulerBatch(List.of(item), List.of())));
        when(notifications.publish(anyList())).thenReturn(Mono.empty());

        new OperationalSlaScheduler(workItems, notifications, true).evaluate();

        verify(workItems).schedulerBatch();
        verify(notifications).publish(List.of(item));
    }

    @Test
    void schedulerFailureIsContained() {
        var workItems = mock(OperationalWorkItemService.class);
        var notifications = mock(OperationalSlaNotificationPublisher.class);
        when(workItems.schedulerBatch()).thenReturn(Mono.error(new IllegalStateException("source failed")));

        new OperationalSlaScheduler(workItems, notifications, true).evaluate();

        verify(workItems).schedulerBatch();
    }
}
