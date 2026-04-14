package upstream

import (
	"time"

	"github.com/miekg/dns"
)

type plainResolver struct {
	name    string
	address string
	network string
	timeout time.Duration
	client  *dns.Client
}

func newPlain(name, address, network string, timeout time.Duration) *plainResolver {
	return &plainResolver{
		name:    name,
		address: address,
		network: network,
		timeout: timeout,
		client: &dns.Client{
			Net:     network,
			Timeout: timeout,
		},
	}
}

func (r *plainResolver) Name() string { return r.name }

func (r *plainResolver) Resolve(req *dns.Msg) (*dns.Msg, error) {
	resp, _, err := r.client.Exchange(req, r.address)
	if err != nil {
		// Retry over TCP on truncation
		if resp != nil && resp.Truncated && r.network == "udp" {
			tcpClient := &dns.Client{Net: "tcp", Timeout: r.timeout}
			resp, _, err = tcpClient.Exchange(req, r.address)
		}
	}
	return resp, err
}
