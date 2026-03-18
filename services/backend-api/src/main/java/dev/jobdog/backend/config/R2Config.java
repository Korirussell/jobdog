package dev.jobdog.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;

@Configuration
public class R2Config {

    @Bean
    public S3Client s3Client(R2Properties properties) {
        // Cloudflare R2 uses an S3-compatible API but requires:
        //   1. The account endpoint as the override URI
        //   2. A real AWS region for request signing — us-east-1 is the R2-accepted value
        //      regardless of what APP_R2_REGION is set to ("auto" is not a valid signing region)
        //   3. forcePathStyle(true) so the bucket name is in the path, not the hostname
        String signingRegion = "auto".equalsIgnoreCase(properties.region()) ? "us-east-1" : properties.region();

        return S3Client.builder()
                .endpointOverride(URI.create(properties.endpoint()))
                .region(Region.of(signingRegion))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(properties.accessKey(), properties.secretKey())
                ))
                .forcePathStyle(true)
                .build();
    }
}
