package dev.jobdog.backend.resume;

public interface StorageService {

    void putObject(String key, String contentType, byte[] content);
}
