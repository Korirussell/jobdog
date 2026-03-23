package dev.jobdog.backend.resume;

import java.util.UUID;

public class ResumeUploadedEvent {
    private final UUID resumeId;
    private final byte[] pdfBytes;

    public ResumeUploadedEvent(UUID resumeId, byte[] pdfBytes) {
        this.resumeId = resumeId;
        this.pdfBytes = pdfBytes;
    }

    public UUID getResumeId() {
        return resumeId;
    }

    public byte[] getPdfBytes() {
        return pdfBytes;
    }
}
