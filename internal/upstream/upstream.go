package upstream

import (
	"fmt"
	"time"

	"github.com/miekg/dns"
	"github.com/wisnuub/nunudns/internal/config"
)

// Resolver is an upstream DNS resolver.
type Resolver interface {
	Resolve(req *dns.Msg) (*dns.Msg, error)
	Name() string
}

// New creates a Resolver from config.
func New(cfg config.UpstreamConfig) (Resolver, error) {
	timeout := time.Duration(cfg.Timeout) * time.Second
	if timeout == 0 {
		timeout = 5 * time.Second
	}

	switch cfg.Protocol {
	case "udp", "tcp":
		return newPlain(cfg.Name, cfg.Address, cfg.Protocol, timeout), nil
	case "doh":
		return newDoH(cfg.Name, cfg.Address, timeout), nil
	case "dot":
		return newDoT(cfg.Name, cfg.Address, timeout), nil
	default:
		return nil, fmt.Errorf("unknown protocol: %s", cfg.Protocol)
	}
}
