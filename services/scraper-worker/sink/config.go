package sink

import "strings"

// Config points the sink at an S3-compatible bucket. Deliberately generic —
// "S3-compatible" rather than "AWS S3" — so this can target Cloudflare R2
// (which backend-api already pays for, for resume storage) just as easily
// as real AWS S3 or a local MinIO instance for testing. Zero-value Config
// (empty Bucket) means the sink is disabled.
type Config struct {
	Endpoint   string
	Bucket     string
	AccessKey  string
	SecretKey  string
	Region     string
	PathPrefix string
}

func (c Config) Enabled() bool {
	return c.Bucket != ""
}

// SigningRegion returns the region used to sign requests. Mirrors
// R2Config.java's handling: Cloudflare R2 accepts APP_R2_REGION="auto" as a
// bucket-location hint but rejects it as a *signing* region — AWS SigV4
// needs a real region string, and "us-east-1" is the value R2 accepts
// regardless of where the bucket actually lives.
func (c Config) SigningRegion() string {
	if strings.EqualFold(c.Region, "auto") || c.Region == "" {
		return "us-east-1"
	}
	return c.Region
}
