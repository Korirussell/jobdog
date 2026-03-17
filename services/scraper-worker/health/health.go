package health

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

type HealthResponse struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Checks    map[string]string `json:"checks"`
}

func HealthHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dbHealthy := checkDatabase(db)

		status := "UP"
		if !dbHealthy {
			status = "DOWN"
		}

		response := HealthResponse{
			Status:    status,
			Timestamp: time.Now(),
			Checks: map[string]string{
				"database": map[bool]string{true: "UP", false: "DOWN"}[dbHealthy],
			},
		}

		w.Header().Set("Content-Type", "application/json")
		if !dbHealthy {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		json.NewEncoder(w).Encode(response)
	}
}

func checkDatabase(db *sql.DB) bool {
	if db == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return db.PingContext(ctx) == nil
}
