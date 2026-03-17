package workerpool

import (
	"context"
	"sync"

	"github.com/rs/zerolog/log"
)

type WorkerPool struct {
	maxWorkers int
	taskQueue  chan func(context.Context) error
	wg         sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
}

func NewWorkerPool(maxWorkers int) *WorkerPool {
	ctx, cancel := context.WithCancel(context.Background())
	return &WorkerPool{
		maxWorkers: maxWorkers,
		taskQueue:  make(chan func(context.Context) error, maxWorkers*2),
		ctx:        ctx,
		cancel:     cancel,
	}
}

func (p *WorkerPool) Start() {
	for i := 0; i < p.maxWorkers; i++ {
		p.wg.Add(1)
		go func(workerID int) {
			defer p.wg.Done()
			for {
				select {
				case task, ok := <-p.taskQueue:
					if !ok {
						return
					}
					if err := task(p.ctx); err != nil {
						log.Error().Err(err).Int("worker_id", workerID).Msg("Worker task failed")
					}
				case <-p.ctx.Done():
					return
				}
			}
		}(i)
	}
}

func (p *WorkerPool) Submit(task func(context.Context) error) {
	select {
	case p.taskQueue <- task:
	case <-p.ctx.Done():
		log.Warn().Msg("Worker pool shutting down, task not submitted")
	}
}

func (p *WorkerPool) Shutdown() {
	close(p.taskQueue)
	p.wg.Wait()
	p.cancel()
}
