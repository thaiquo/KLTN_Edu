package iuh.fit.account_service.exception;

import java.util.List;

public class IncompleteTutorApplicationException extends BadRequestException {

    private final List<String> missingItems;

    public IncompleteTutorApplicationException(List<String> missingItems) {
        super("Tutor application is incomplete");
        this.missingItems = missingItems;
    }

    public List<String> getMissingItems() {
        return missingItems;
    }
}
