package upstream

import (
	"crypto/tls"
	"fmt"
	"net"
	"time"

	"github.com/miekg/dns"
)

type dotResolver struct {
	name    string
	address string
	timeout time.Duration
	client  *dns.Client
}

func newDoT(name, address string, timeout time.Duration) *dotResolver {
	// Extract hostname for SNI (strip port if present)
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		host = address
	}

	return &dotResolver{
		name:    name,
		address: address,
		timeout: timeout,
		client: &dns.Client{
			Net:     "tcp-tls",
			Timeout: timeout,
			TLSConfig: &tls.Config{
				ServerName: host,
			},
		},
	}
}

func (r *dotResolver) Name() string { return r.name }

func (r *dotResolver) Resolve(req *dns.Msg) (*dns.Msg, error) {
	resp, _, err := r.client.Exchange(req, r.address)
	if err != nil {
		return nil, fmt.Errorf("DoT exchange: %w", err)
	}
	return resp, nil
}
