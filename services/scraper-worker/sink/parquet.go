package sink

import (
	"bytes"
	"fmt"

	"github.com/parquet-go/parquet-go"
)

// encodeParquet writes rows as a single Parquet file in memory. Batching
// many rows into one file (rather than one row per file) is deliberate:
// Spark/Databricks reads are dominated by file-open overhead on a bucket
// with thousands of tiny files, so the sink buffers by count/time (see
// Sink.flush) specifically to produce reasonably-sized files instead of one
// per posting.
func encodeParquet(rows []Row) ([]byte, error) {
	buf := new(bytes.Buffer)
	writer := parquet.NewGenericWriter[Row](buf)

	if _, err := writer.Write(rows); err != nil {
		return nil, fmt.Errorf("writing parquet rows: %w", err)
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("closing parquet writer: %w", err)
	}

	return buf.Bytes(), nil
}
