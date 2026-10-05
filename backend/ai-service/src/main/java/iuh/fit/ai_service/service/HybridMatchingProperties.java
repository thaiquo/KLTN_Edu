package iuh.fit.ai_service.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class HybridMatchingProperties {
    private final boolean semanticMatchingEnabled;
    private final double maxSemanticRankBoost;

    public HybridMatchingProperties(
            @Value("${semantic.matching.enabled:true}") boolean semanticMatchingEnabled,
            @Value("${semantic.matching.max-rank-boost:3.0}") double maxSemanticRankBoost
    ) {
        this.semanticMatchingEnabled = semanticMatchingEnabled;
        this.maxSemanticRankBoost = Math.max(0.0, Math.min(5.0, maxSemanticRankBoost));
    }

    public boolean semanticMatchingEnabled() {
        return semanticMatchingEnabled;
    }

    public double maxSemanticRankBoost() {
        return maxSemanticRankBoost;
    }
}
