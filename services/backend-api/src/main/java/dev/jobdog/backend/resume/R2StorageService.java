package dev.jobdog.backend.resume;

import dev.jobdog.backend.config.R2Properties;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Service
public class R2StorageService implements StorageService {

    private final S3Client s3Client;
    private final R2Properties r2Properties;

    public R2StorageService(S3Client s3Client, R2Properties r2Properties) {
        this.s3Client = s3Client;
        this.r2Properties = r2Properties;
    }

    @Override
    public void putObject(String key, String contentType, byte[] content) {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(r2Properties.bucket())
                .key(key)
                .contentType(contentType)
                .build();
        s3Client.putObject(request, RequestBody.fromBytes(content));
    }

    @Override
    public byte[] getObject(String key) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(r2Properties.bucket())
                .key(key)
                .build();
        ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(request);
        return response.asByteArray();
    }

    @Override
    public void deleteObject(String key) {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(r2Properties.bucket())
                .key(key)
                .build();
        s3Client.deleteObject(request);
    }
}
