package upstream

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/miekg/dns"
)

type dohResolver struct {
	name    string
	url     string
	timeout time.Duration
	client  *http.Client
}

func newDoH(name, url string, timeout time.Duration) *dohResolver {
	return &dohResolver{
		name:    name,
		url:     url,
		timeout: timeout,
		client:  &http.Client{Timeout: timeout},
	}
}

func (r *dohResolver) Name() string { return r.name }

func (r *dohResolver) Resolve(req *dns.Msg) (*dns.Msg, error) {
	// Encode query as DNS wire format
	packed, err := req.Pack()
	if err != nil {
		return nil, fmt.Errorf("packing DNS query: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPost, r.url, bytes.NewReader(packed))
	if err != nil {
		return nil, fmt.Errorf("creating HTTP request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/dns-message")
	httpReq.Header.Set("Accept", "application/dns-message")

	resp, err := r.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("DoH server returned HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 65535))
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	msg := new(dns.Msg)
	if err := msg.Unpack(body); err != nil {
		return nil, fmt.Errorf("unpacking DNS response: %w", err)
	}

	return msg, nil
}
