package iuh.fit.learning_service.exception;

public class StudentScheduleConflictException extends BadRequestException {
    private final Long conflictingClassId;
    private final String conflictingClassName;
    private final Integer dayOfWeek;
    private final String startTime;
    private final String endTime;

    public StudentScheduleConflictException(String message, Long conflictingClassId,
            String conflictingClassName, Integer dayOfWeek, String startTime, String endTime) {
        super(message);
        this.conflictingClassId = conflictingClassId;
        this.conflictingClassName = conflictingClassName;
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public Long getConflictingClassId() { return conflictingClassId; }
    public String getConflictingClassName() { return conflictingClassName; }
    public Integer getDayOfWeek() { return dayOfWeek; }
    public String getStartTime() { return startTime; }
    public String getEndTime() { return endTime; }
}
