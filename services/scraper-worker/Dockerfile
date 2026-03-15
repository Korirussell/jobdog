FROM golang:1.24-alpine AS build
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN go build -o scraper-worker .

FROM alpine:3.20
WORKDIR /app
COPY --from=build /app/scraper-worker /app/scraper-worker
ENTRYPOINT ["/app/scraper-worker"]
