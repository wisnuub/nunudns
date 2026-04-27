package upstream

import (
	"fmt"
	"sync/atomic"

	"github.com/miekg/dns"
)

// poolResolver distributes queries across member resolvers using round-robin,
// falling back to the next member on error (failover).
type poolResolver struct {
	name    string
	members []Resolver
	next    atomic.Uint64
}

// NewPool creates a pool resolver from a named list of member resolvers.
func NewPool(name string, members []Resolver) Resolver {
	return &poolResolver{name: name, members: members}
}

func (r *poolResolver) Name() string { return r.name }

func (r *poolResolver) Resolve(req *dns.Msg) (*dns.Msg, error) {
	n := uint64(len(r.members))
	if n == 0 {
		return nil, fmt.Errorf("pool %q has no members", r.name)
	}
	start := r.next.Add(1) - 1
	for i := uint64(0); i < n; i++ {
		member := r.members[(start+i)%n]
		if resp, err := member.Resolve(req); err == nil {
			return resp, nil
		}
	}
	return nil, fmt.Errorf("all members of pool %q failed to resolve", r.name)
}
