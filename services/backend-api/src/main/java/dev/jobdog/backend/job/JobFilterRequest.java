package dev.jobdog.backend.job;

public record JobFilterRequest(
        int page,
        int size,
        String location,
        Boolean remote,
        String company,
        String search
) {
    public JobFilterRequest {
        if (page < 0) page = 0;
        if (size < 1 || size > 100) size = 20;
    }
}
