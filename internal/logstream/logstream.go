// Package logstream provides a pub/sub event bus for DNS query events.
package logstream

import (
	"sync"
	"time"
)

// Event holds information about a single DNS query handled by the server.
type Event struct {
	Time     time.Time
	Domain   string
	QType    string
	Action   string // RESOLVED, BLOCKED, CACHED
	Upstream string
	Latency  time.Duration
	Rcode    string
	Cached   bool
}

const chanBufSize = 256

// Stream is a goroutine-safe pub/sub bus for DNS events.
type Stream struct {
	mu   sync.Mutex
	subs []chan Event
}

// NewStream creates a new Stream.
func NewStream() *Stream {
	return &Stream{}
}

// Subscribe returns a buffered channel that will receive future events.
// The caller must call Unsubscribe when done.
func (s *Stream) Subscribe() <-chan Event {
	ch := make(chan Event, chanBufSize)
	s.mu.Lock()
	s.subs = append(s.subs, ch)
	s.mu.Unlock()
	return ch
}

// Unsubscribe removes and closes the channel returned by Subscribe.
func (s *Stream) Unsubscribe(ch <-chan Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, sub := range s.subs {
		if sub == ch {
			s.subs = append(s.subs[:i], s.subs[i+1:]...)
			close(sub)
			return
		}
	}
}

// Emit publishes an event to all subscribers.
// If a subscriber's buffer is full the oldest event is dropped to prevent blocking.
func (s *Stream) Emit(ev Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, ch := range s.subs {
		select {
		case ch <- ev:
		default:
			// Drop oldest, then try again
			select {
			case <-ch:
			default:
			}
			select {
			case ch <- ev:
			default:
			}
		}
	}
}
