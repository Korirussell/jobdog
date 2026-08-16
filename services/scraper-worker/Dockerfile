FROM golang:1.25-alpine AS build
WORKDIR /app

# 1. Copy go.mod AND go.sum (the * makes it optional if it doesn't exist yet)
COPY go.mod go.sum* ./

# 2. Run tidy to automatically fix any missing checksums or dependencies
RUN go mod tidy
RUN go mod download

COPY . .

# 3. Disable CGO so the binaries run perfectly on Alpine Linux
RUN CGO_ENABLED=0 GOOS=linux go build -o scraper-worker .
RUN CGO_ENABLED=0 GOOS=linux go build -o classifier ./cmd/classifier
RUN CGO_ENABLED=0 GOOS=linux go build -o s3sink ./cmd/s3sink

FROM alpine:3.20
WORKDIR /app
COPY --from=build /app/scraper-worker /app/scraper-worker
COPY --from=build /app/classifier /app/classifier
COPY --from=build /app/s3sink /app/s3sink
ENTRYPOINT ["/app/scraper-worker"]
