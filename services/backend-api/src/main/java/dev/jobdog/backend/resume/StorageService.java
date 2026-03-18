package dev.jobdog.backend.resume;

public interface StorageService {

    void putObject(String key, String contentType, byte[] content);

    byte[] getObject(String key);
}
