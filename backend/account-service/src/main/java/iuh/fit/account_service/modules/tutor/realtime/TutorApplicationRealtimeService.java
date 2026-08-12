package iuh.fit.account_service.modules.tutor.realtime;

import iuh.fit.account_service.modules.tutor.dto.TutorApplicationResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.scheduling.annotation.Scheduled;
import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TutorApplicationRealtimeService {
    private final ConcurrentHashMap<UUID, Set<SseEmitter>> userEmitters = new ConcurrentHashMap<>();
    private final Set<SseEmitter> adminEmitters = ConcurrentHashMap.newKeySet();

    public SseEmitter connectUser(UUID userId) { return register(userEmitters.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet())); }
    public SseEmitter connectAdmin() { return register(adminEmitters); }
    public void publish(UUID userId, TutorApplicationResponse application) {
        send(userEmitters.get(userId), application);
        send(adminEmitters, application);
    }
    private SseEmitter register(Set<SseEmitter> emitters) {
        SseEmitter emitter = new SseEmitter(0L); emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter)); emitter.onTimeout(() -> emitters.remove(emitter));
        try { emitter.send(SseEmitter.event().name("connected").data("ok")); }
        catch (IOException exception) { emitters.remove(emitter); }
        return emitter;
    }

    @Scheduled(fixedDelay = 5_000)
    public void heartbeat() {
        userEmitters.values().forEach(this::sendHeartbeat);
        sendHeartbeat(adminEmitters);
    }

    private void sendHeartbeat(Set<SseEmitter> emitters) {
        for (SseEmitter emitter : emitters) try { emitter.send(SseEmitter.event().comment("heartbeat")); }
        catch (IOException exception) { emitters.remove(emitter); }
    }
    private void send(Set<SseEmitter> emitters, TutorApplicationResponse application) {
        if (emitters == null) return;
        for (SseEmitter emitter : emitters) try { emitter.send(SseEmitter.event().name("tutor-application.updated").data(application)); }
        catch (IOException exception) { emitters.remove(emitter); }
    }
}
