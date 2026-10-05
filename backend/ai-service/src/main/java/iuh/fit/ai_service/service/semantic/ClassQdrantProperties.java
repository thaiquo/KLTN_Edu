package iuh.fit.ai_service.service.semantic;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ClassQdrantProperties {
    private final String url;
    private final String collection;
    private final int vectorSize;
    private final int topK;

    public ClassQdrantProperties(
            @Value("${qdrant.url:http://localhost:6333}") String url,
            @Value("${class.qdrant.collection:public_classes_v1}") String collection,
            @Value("${qdrant.vector-size:768}") int vectorSize,
            @Value("${class.semantic.search.top-k:20}") int topK
    ) {
        this.url = url;
        this.collection = collection;
        this.vectorSize = vectorSize;
        this.topK = topK;
    }

    public String url() {
        return url;
    }

    public String collection() {
        return collection;
    }

    public int vectorSize() {
        return vectorSize;
    }

    public int topK() {
        return topK;
    }
}
