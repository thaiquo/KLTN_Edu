package iuh.fit.contract_service.blockchain;

import io.reactivex.Flowable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.web3j.protocol.Web3jService;
import org.web3j.protocol.core.BatchRequest;
import org.web3j.protocol.core.BatchResponse;
import org.web3j.protocol.core.Request;
import org.web3j.protocol.core.Response;
import org.web3j.protocol.core.methods.response.EthChainId;
import org.web3j.protocol.http.HttpService;
import org.web3j.protocol.websocket.events.Notification;

import java.io.IOException;
import java.net.URI;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.atomic.AtomicIntegerArray;
import java.util.function.LongSupplier;

/**
 * HTTP JSON-RPC transport with ordered provider failover.
 *
 * <p>Only transport failures and provider throttling responses trigger a switch.
 * Contract reverts and other deterministic JSON-RPC errors are returned unchanged.
 */
public final class FailoverWeb3jService implements Web3jService {
    private static final Logger log = LoggerFactory.getLogger(FailoverWeb3jService.class);

    private final List<Endpoint> endpoints;
    private final long primaryRetryDelayNanos;
    private final LongSupplier nanoTime;
    private final BigInteger expectedChainId;
    private final AtomicIntegerArray chainValidation;
    private volatile int activeEndpoint;
    private volatile long primaryRetryAfterNanos;

    public static FailoverWeb3jService create(
            List<URI> rpcUrls, long primaryRetryDelayMs, long expectedChainId) {
        List<Endpoint> endpoints = rpcUrls.stream()
                .map(uri -> new Endpoint(describe(uri), new HttpService(uri.toString())))
                .toList();
        return new FailoverWeb3jService(
                endpoints,
                primaryRetryDelayMs * 1_000_000L,
                System::nanoTime,
                BigInteger.valueOf(expectedChainId));
    }

    FailoverWeb3jService(
            List<Endpoint> endpoints,
            long primaryRetryDelayNanos,
            LongSupplier nanoTime) {
        this(endpoints, primaryRetryDelayNanos, nanoTime, BigInteger.ZERO);
    }

    FailoverWeb3jService(
            List<Endpoint> endpoints,
            long primaryRetryDelayNanos,
            LongSupplier nanoTime,
            BigInteger expectedChainId) {
        if (endpoints == null || endpoints.isEmpty()) {
            throw new IllegalArgumentException("At least one RPC endpoint is required");
        }
        this.endpoints = List.copyOf(endpoints);
        this.primaryRetryDelayNanos = primaryRetryDelayNanos;
        this.nanoTime = Objects.requireNonNull(nanoTime);
        this.expectedChainId = Objects.requireNonNull(expectedChainId);
        this.chainValidation = new AtomicIntegerArray(endpoints.size());
    }

    public String primaryDescription() {
        return endpoints.getFirst().description();
    }

    @Override
    public <T extends Response> T send(Request request, Class<T> responseType) throws IOException {
        IOException lastTransportFailure = null;
        T lastThrottleResponse = null;
        for (int index : attemptOrder()) {
            Endpoint endpoint = endpoints.get(index);
            try {
                validateEndpointChain(index);
                T response = endpoint.service().send(request, responseType);
                if (isProviderThrottle(response) && endpoints.size() > 1) {
                    lastThrottleResponse = response;
                    markFailure(index, "provider throttling");
                    continue;
                }
                markSuccess(index);
                return response;
            } catch (IOException exception) {
                lastTransportFailure = exception;
                markFailure(index, exception.getClass().getSimpleName());
            }
        }
        if (lastThrottleResponse != null) {
            return lastThrottleResponse;
        }
        throw lastTransportFailure != null
                ? lastTransportFailure
                : new IOException("All configured RPC endpoints failed");
    }

    @Override
    public <T extends Response> CompletableFuture<T> sendAsync(Request request, Class<T> responseType) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return send(request, responseType);
            } catch (IOException exception) {
                throw new CompletionException(exception);
            }
        });
    }

    @Override
    public BatchResponse sendBatch(BatchRequest batchRequest) throws IOException {
        IOException lastFailure = null;
        BatchResponse lastThrottleResponse = null;
        for (int index : attemptOrder()) {
            try {
                validateEndpointChain(index);
                BatchResponse response = endpoints.get(index).service().sendBatch(batchRequest);
                if (response.getResponses().stream().anyMatch(FailoverWeb3jService::isProviderThrottle)
                        && endpoints.size() > 1) {
                    lastThrottleResponse = response;
                    markFailure(index, "provider throttling");
                    continue;
                }
                markSuccess(index);
                return response;
            } catch (IOException exception) {
                lastFailure = exception;
                markFailure(index, exception.getClass().getSimpleName());
            }
        }
        if (lastThrottleResponse != null) {
            return lastThrottleResponse;
        }
        throw lastFailure != null ? lastFailure : new IOException("All configured RPC endpoints failed");
    }

    @Override
    public CompletableFuture<BatchResponse> sendBatchAsync(BatchRequest batchRequest) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return sendBatch(batchRequest);
            } catch (IOException exception) {
                throw new CompletionException(exception);
            }
        });
    }

    @Override
    public <T extends Notification<?>> Flowable<T> subscribe(
            Request request, String unsubscribeMethod, Class<T> responseType) {
        return Flowable.error(new UnsupportedOperationException(
                "HTTP RPC transport does not support subscriptions"));
    }

    @Override
    public void close() throws IOException {
        IOException failure = null;
        for (Endpoint endpoint : endpoints) {
            try {
                endpoint.service().close();
            } catch (IOException exception) {
                if (failure == null) {
                    failure = exception;
                } else {
                    failure.addSuppressed(exception);
                }
            }
        }
        if (failure != null) {
            throw failure;
        }
    }

    private List<Integer> attemptOrder() {
        int current = activeEndpoint;
        boolean retryPrimary = current == 0 || nanoTime.getAsLong() >= primaryRetryAfterNanos;
        List<Integer> order = new ArrayList<>(endpoints.size());
        if (retryPrimary) {
            order.add(0);
        } else {
            order.add(current);
        }
        for (int index = 1; index < endpoints.size(); index++) {
            if (!order.contains(index)) {
                order.add(index);
            }
        }
        if (!order.contains(0)) {
            order.add(0);
        }
        return order;
    }

    private void markSuccess(int index) {
        int previous = activeEndpoint;
        activeEndpoint = index;
        if (index == 0) {
            primaryRetryAfterNanos = 0;
        }
        if (previous != index) {
            log.info("Blockchain RPC switched to {}", endpoints.get(index).description());
        }
    }

    private void validateEndpointChain(int index) throws IOException {
        if (expectedChainId.signum() <= 0 || chainValidation.get(index) == 1) {
            return;
        }
        if (chainValidation.get(index) == -1) {
            throw new IOException("RPC endpoint previously failed chain ID validation");
        }
        Endpoint endpoint = endpoints.get(index);
        Request<Object, EthChainId> request = new Request<>(
                "eth_chainId", List.of(), endpoint.service(), EthChainId.class);
        EthChainId response = endpoint.service().send(request, EthChainId.class);
        if (response.hasError()) {
            throw new IOException("RPC endpoint did not return its chain ID");
        }
        boolean matches;
        try {
            matches = expectedChainId.equals(response.getChainId());
        } catch (RuntimeException malformedResponse) {
            throw new IOException("RPC endpoint returned a malformed chain ID", malformedResponse);
        }
        if (!matches) {
            chainValidation.set(index, -1);
            log.error("Blockchain RPC {} is not on expected chainId={}; endpoint disabled",
                    endpoint.description(), expectedChainId);
            throw new IOException("RPC endpoint chain ID does not match configured blockchain.chain-id");
        }
        chainValidation.set(index, 1);
    }

    private void markFailure(int index, String reason) {
        if (index == 0 && endpoints.size() > 1) {
            primaryRetryAfterNanos = nanoTime.getAsLong() + primaryRetryDelayNanos;
        }
        log.warn("Blockchain RPC {} failed ({}); trying another configured endpoint",
                endpoints.get(index).description(), reason);
    }

    private static boolean isProviderThrottle(Response<?> response) {
        if (response == null || !response.hasError() || response.getError() == null) {
            return false;
        }
        int code = response.getError().getCode();
        return code == 429 || code == -32005;
    }

    private static String describe(URI uri) {
        int port = uri.getPort();
        return port < 0 ? uri.getHost() : uri.getHost() + ":" + port;
    }

    record Endpoint(String description, Web3jService service) {
        Endpoint {
            Objects.requireNonNull(description);
            Objects.requireNonNull(service);
        }
    }
}
