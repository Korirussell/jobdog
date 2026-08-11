package dev.jobdog.backend.application;

import java.time.LocalDate;

public record UpdateApplicationRequest(String status, LocalDate deadline, String notes, boolean clearDeadline, boolean clearNotes) {
}
