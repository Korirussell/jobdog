package sink

import (
	"bytes"
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// uploader wraps the S3-compatible client. A thin wrapper mainly so tests
// (and any future swap to a different backend) don't need the full AWS SDK
// surface.
type uploader struct {
	client *s3.Client
	bucket string
}

// newUploader builds a client pointed at cfg.Endpoint with path-style
// addressing — the same combination R2Config.java uses for Cloudflare R2,
// and what every S3-compatible store (MinIO included) expects when it isn't
// real AWS S3 with virtual-hosted-style DNS set up.
func newUploader(ctx context.Context, cfg Config) (*uploader, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.SigningRegion()),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("loading AWS config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		}
		o.UsePathStyle = true
	})

	return &uploader{client: client, bucket: cfg.Bucket}, nil
}

func (u *uploader) upload(ctx context.Context, key string, body []byte) error {
	_, err := u.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(u.bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(body),
	})
	if err != nil {
		return fmt.Errorf("uploading %s: %w", key, err)
	}
	return nil
}
