package iuh.fit.contract_service.document;

import java.util.Map;

public interface ContractDocxRenderer {
    byte[] render(Map<String, Object> model);
}
