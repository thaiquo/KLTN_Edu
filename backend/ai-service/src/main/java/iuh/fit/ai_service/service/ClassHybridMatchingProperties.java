package iuh.fit.ai_service.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ClassHybridMatchingProperties {
    private final boolean semanticMatchingEnabled;
    private final double maxSemanticRankBoost;

    public ClassHybridMatchingProperties(
            @Value("${class.semantic.matching.enabled:true}") boolean semanticMatchingEnabled,
            @Value("${class.semantic.matching.max-rank-boost:3.0}") double maxSemanticRankBoost
    ) {
        this.semanticMatchingEnabled = semanticMatchingEnabled;
        this.maxSemanticRankBoost = maxSemanticRankBoost;
    }

    public boolean semanticMatchingEnabled() {
        return semanticMatchingEnabled;
    }

    public double maxSemanticRankBoost() {
        return maxSemanticRankBoost;
    }
}
