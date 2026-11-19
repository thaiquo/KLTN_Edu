package iuh.fit.api_gateway.security;

import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.List;

@Component
public class ClientIpResolver {
    private static final String X_FORWARDED_FOR = "X-Forwarded-For";
    private final List<Cidr> trustedProxies;

    public ClientIpResolver(LoginRateLimitProperties properties) {
        this.trustedProxies = properties.getTrustedProxyCidrs().stream()
                .filter(value -> value != null && !value.isBlank())
                .map(Cidr::parse)
                .toList();
    }

    public String resolve(ServerWebExchange exchange) {
        InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
        String remoteIp = remoteAddress == null || remoteAddress.getAddress() == null
                ? "unknown"
                : remoteAddress.getAddress().getHostAddress();

        if (!isTrusted(remoteIp)) {
            return remoteIp;
        }

        List<String> forwarded = exchange.getRequest().getHeaders().getOrEmpty(X_FORWARDED_FOR)
                .stream()
                .flatMap(value -> Arrays.stream(value.split(",")))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toList();
        if (forwarded.isEmpty()) {
            return remoteIp;
        }

        for (int index = forwarded.size() - 1; index >= 0; index--) {
            String candidate = normalize(forwarded.get(index));
            if (candidate == null) return remoteIp;
            if (!isTrusted(candidate)) return candidate;
        }
        return normalize(forwarded.get(0)) == null ? remoteIp : normalize(forwarded.get(0));
    }

    private boolean isTrusted(String address) {
        return trustedProxies.stream().anyMatch(cidr -> cidr.contains(address));
    }

    private String normalize(String value) {
        if (!isIpLiteral(value)) return null;
        try {
            return InetAddress.getByName(value).getHostAddress();
        } catch (UnknownHostException exception) {
            return null;
        }
    }

    private static boolean isIpLiteral(String value) {
        return value != null && !value.isBlank() && value.matches("[0-9a-fA-F:.]+");
    }

    private record Cidr(byte[] network, int prefixLength) {
        static Cidr parse(String value) {
            try {
                String[] parts = value.trim().split("/", 2);
                if (!isIpLiteral(parts[0])) throw new IllegalArgumentException("Address must be an IP literal");
                byte[] address = InetAddress.getByName(parts[0]).getAddress();
                int prefix = parts.length == 2 ? Integer.parseInt(parts[1]) : address.length * 8;
                if (prefix < 0 || prefix > address.length * 8) throw new IllegalArgumentException("Invalid prefix");
                return new Cidr(address, prefix);
            } catch (Exception exception) {
                throw new IllegalArgumentException("Invalid trusted proxy CIDR: " + value, exception);
            }
        }

        boolean contains(String value) {
            if (!isIpLiteral(value)) return false;
            try {
                byte[] candidate = InetAddress.getByName(value).getAddress();
                if (candidate.length != network.length) return false;
                int fullBytes = prefixLength / 8;
                int remainingBits = prefixLength % 8;
                for (int index = 0; index < fullBytes; index++) {
                    if (candidate[index] != network[index]) return false;
                }
                if (remainingBits == 0) return true;
                int mask = 0xFF << (8 - remainingBits);
                return (candidate[fullBytes] & mask) == (network[fullBytes] & mask);
            } catch (UnknownHostException exception) {
                return false;
            }
        }
    }
}
