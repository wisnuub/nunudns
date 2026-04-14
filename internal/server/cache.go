package server

import (
	"sync"
	"time"

	"github.com/miekg/dns"
)

type cacheKey struct {
	domain string
	qtype  uint16
}

type cacheEntry struct {
	msg     *dns.Msg
	expires time.Time
}

type cache struct {
	mu      sync.RWMutex
	entries map[cacheKey]*cacheEntry
	ttl     time.Duration
}

func newCache(ttl time.Duration) *cache {
	c := &cache{
		entries: make(map[cacheKey]*cacheEntry),
		ttl:     ttl,
	}
	go c.sweep()
	return c
}

func (c *cache) get(domain string, qtype uint16) *dns.Msg {
	c.mu.RLock()
	e, ok := c.entries[cacheKey{domain, qtype}]
	c.mu.RUnlock()

	if !ok || time.Now().After(e.expires) {
		return nil
	}
	return e.msg.Copy()
}

func (c *cache) set(domain string, qtype uint16, msg *dns.Msg) {
	// Respect the minimum TTL from DNS records
	ttl := c.ttl
	for _, rr := range msg.Answer {
		recordTTL := time.Duration(rr.Header().Ttl) * time.Second
		if recordTTL > 0 && recordTTL < ttl {
			ttl = recordTTL
		}
	}

	c.mu.Lock()
	c.entries[cacheKey{domain, qtype}] = &cacheEntry{
		msg:     msg.Copy(),
		expires: time.Now().Add(ttl),
	}
	c.mu.Unlock()
}

// sweep removes expired entries every minute.
func (c *cache) sweep() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		c.mu.Lock()
		for k, e := range c.entries {
			if now.After(e.expires) {
				delete(c.entries, k)
			}
		}
		c.mu.Unlock()
	}
}
