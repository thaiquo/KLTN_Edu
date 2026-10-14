package iuh.fit.contract_service.blockchain;

import io.reactivex.Flowable;
import org.junit.jupiter.api.Test;
import org.web3j.protocol.Web3jService;
import org.web3j.protocol.core.BatchRequest;
import org.web3j.protocol.core.BatchResponse;
import org.web3j.protocol.core.Request;
import org.web3j.protocol.core.Response;
import org.web3j.protocol.core.methods.response.EthChainId;
import org.web3j.protocol.websocket.events.Notification;

import java.io.IOException;
import java.math.BigInteger;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

class FailoverWeb3jServiceTest {

    @Test
    void transportFailureUsesFallbackUntilPrimaryCooldownExpires() throws Exception {
        Response<Object> primarySuccess = responseWithoutError();
        Response<Object> fallbackSuccess = responseWithoutError();
        StubService primary = new StubService(new IOException("primary unavailable"), primarySuccess);
        StubService fallback = new StubService(fallbackSuccess, fallbackSuccess);
        AtomicLong clock = new AtomicLong();
        FailoverWeb3jService service = service(primary, fallback, clock);

        assertSame(fallbackSuccess, service.send(request(), Response.class));
        assertSame(fallbackSuccess, service.send(request(), Response.class));
        assertEquals(1, primary.sendCount);
        assertEquals(2, fallback.sendCount);

        clock.set(31);
        assertSame(primarySuccess, service.send(request(), Response.class));
        assertEquals(2, primary.sendCount);
    }

    @Test
    void providerThrottleUsesFallbackButBusinessErrorDoesNot() throws Exception {
        Response<Object> throttle = responseWithError(429, "rate limited");
        Response<Object> fallbackSuccess = responseWithoutError();
        StubService throttledPrimary = new StubService(throttle);
        StubService fallback = new StubService(fallbackSuccess);

        assertSame(fallbackSuccess,
                service(throttledPrimary, fallback, new AtomicLong()).send(request(), Response.class));
        assertEquals(1, fallback.sendCount);

        Response<Object> revert = responseWithError(-32000, "execution reverted");
        StubService revertingPrimary = new StubService(revert);
        StubService unusedFallback = new StubService(fallbackSuccess);

        assertSame(revert,
                service(revertingPrimary, unusedFallback, new AtomicLong()).send(request(), Response.class));
        assertEquals(0, unusedFallback.sendCount);
    }

    @Test
    void rejectsFallbackCandidateOnWrongChainBeforeServingRequest() throws Exception {
        StubService wrongChainPrimary = new StubService(chainId(1));
        Response<Object> fallbackSuccess = responseWithoutError();
        StubService expectedChainFallback = new StubService(chainId(11_155_111), fallbackSuccess);
        FailoverWeb3jService service = new FailoverWeb3jService(
                List.of(
                        new FailoverWeb3jService.Endpoint("wrong.example", wrongChainPrimary),
                        new FailoverWeb3jService.Endpoint("sepolia.example", expectedChainFallback)),
                30,
                System::nanoTime,
                BigInteger.valueOf(11_155_111));

        assertSame(fallbackSuccess, service.send(request(), Response.class));
        assertEquals(1, wrongChainPrimary.sendCount);
        assertEquals(2, expectedChainFallback.sendCount);
    }

    private static FailoverWeb3jService service(
            Web3jService primary, Web3jService fallback, AtomicLong clock) {
        return new FailoverWeb3jService(
                List.of(
                        new FailoverWeb3jService.Endpoint("primary.example", primary),
                        new FailoverWeb3jService.Endpoint("fallback.example", fallback)),
                30,
                clock::get);
    }

    private static Request<?, Response> request() {
        return new Request<>();
    }

    private static Response<Object> responseWithoutError() {
        return new Response<>();
    }

    private static Response<Object> responseWithError(int code, String message) {
        Response<Object> response = new Response<>();
        response.setError(new Response.Error(code, message));
        return response;
    }

    private static EthChainId chainId(long chainId) {
        EthChainId response = new EthChainId();
        response.setResult("0x" + Long.toHexString(chainId));
        return response;
    }

    private static final class StubService implements Web3jService {
        private final Queue<Object> results = new ArrayDeque<>();
        private int sendCount;

        private StubService(Object... results) {
            this.results.addAll(List.of(results));
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T extends Response> T send(Request request, Class<T> responseType) throws IOException {
            sendCount++;
            Object result = results.remove();
            if (result instanceof IOException exception) {
                throw exception;
            }
            return (T) result;
        }

        @Override
        public <T extends Response> CompletableFuture<T> sendAsync(Request request, Class<T> responseType) {
            throw new UnsupportedOperationException();
        }

        @Override
        public BatchResponse sendBatch(BatchRequest batchRequest) {
            throw new UnsupportedOperationException();
        }

        @Override
        public CompletableFuture<BatchResponse> sendBatchAsync(BatchRequest batchRequest) {
            throw new UnsupportedOperationException();
        }

        @Override
        public <T extends Notification<?>> Flowable<T> subscribe(
                Request request, String unsubscribeMethod, Class<T> responseType) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void close() {
        }
    }
}
