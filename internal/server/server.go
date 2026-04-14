package server

import (
	"fmt"
	"log/slog"
	"net"
	"sync"
	"time"

	"github.com/miekg/dns"
	"github.com/wisnuub/nunudns/internal/config"
	"github.com/wisnuub/nunudns/internal/logstream"
	"github.com/wisnuub/nunudns/internal/rules"
	"github.com/wisnuub/nunudns/internal/upstream"
)

// Server is the NunuDNS server.
type Server struct {
	cfg       *config.Config
	router    *rules.Router
	upstreams map[string]upstream.Resolver

	udpServer *dns.Server
	tcpServer *dns.Server

	cache    *cache
	useCache bool

	stream *logstream.Stream

	mu sync.RWMutex
}

// New creates a new Server from config.
func New(cfg *config.Config) (*Server, error) {
	return NewWithStream(cfg, nil)
}

// NewWithStream creates a new Server from config and attaches a log stream.
func NewWithStream(cfg *config.Config, stream *logstream.Stream) (*Server, error) {
	router, err := rules.New(cfg.Rules)
	if err != nil {
		return nil, fmt.Errorf("building router: %w", err)
	}

	resolvers := make(map[string]upstream.Resolver, len(cfg.Upstreams))
	for _, u := range cfg.Upstreams {
		r, err := upstream.New(u)
		if err != nil {
			return nil, fmt.Errorf("creating upstream %q: %w", u.Name, err)
		}
		resolvers[u.Name] = r
		slog.Info("upstream registered", "name", u.Name, "protocol", u.Protocol, "address", u.Address)
	}

	srv := &Server{
		cfg:       cfg,
		router:    router,
		upstreams: resolvers,
		useCache:  cfg.Server.Cache,
		stream:    stream,
	}

	if cfg.Server.Cache {
		ttl := time.Duration(cfg.Server.CacheTTL) * time.Second
		if ttl == 0 {
			ttl = 60 * time.Second
		}
		srv.cache = newCache(ttl)
	}

	return srv, nil
}

// Start begins listening for DNS queries on UDP and TCP.
func (s *Server) Start() error {
	mux := dns.NewServeMux()
	mux.HandleFunc(".", s.handleQuery)

	s.udpServer = &dns.Server{
		Addr:    s.cfg.Server.Listen,
		Net:     "udp",
		Handler: mux,
	}
	s.tcpServer = &dns.Server{
		Addr:    s.cfg.Server.Listen,
		Net:     "tcp",
		Handler: mux,
	}

	errCh := make(chan error, 2)

	go func() { errCh <- s.udpServer.ListenAndServe() }()
	go func() { errCh <- s.tcpServer.ListenAndServe() }()

	slog.Info("NunuDNS listening", "address", s.cfg.Server.Listen)

	// Return first fatal error
	return <-errCh
}

// Stop gracefully shuts down both servers.
func (s *Server) Stop() {
	if s.udpServer != nil {
		_ = s.udpServer.Shutdown()
	}
	if s.tcpServer != nil {
		_ = s.tcpServer.Shutdown()
	}
}

func (s *Server) handleQuery(w dns.ResponseWriter, req *dns.Msg) {
	start := time.Now()

	if len(req.Question) == 0 {
		dns.HandleFailed(w, req)
		return
	}

	q := req.Question[0]
	domain := q.Name
	qtype := dns.TypeToString[q.Qtype]

	slog.Debug("query received", "domain", domain, "type", qtype)

	// Cache lookup
	if s.useCache && s.cache != nil {
		if cached := s.cache.get(domain, q.Qtype); cached != nil {
			cached.Id = req.Id
			_ = w.WriteMsg(cached)
			slog.Debug("cache hit", "domain", domain)
			s.emitEvent(domain, qtype, "CACHED", "", time.Since(start), "NOERROR", true)
			return
		}
	}

	// Route lookup
	match := s.router.Lookup(domain)

	if match.Action == rules.ActionBlock {
		resp := s.buildBlockResponse(req, match.BlockIP)
		_ = w.WriteMsg(resp)
		slog.Info("blocked", "domain", domain)
		rcode := dns.RcodeToString[resp.Rcode]
		s.emitEvent(domain, qtype, "BLOCKED", "", time.Since(start), rcode, false)
		return
	}

	// Resolve upstream
	resolver := s.upstreams[match.Upstream]
	if resolver == nil {
		// No upstream configured — SERVFAIL
		m := new(dns.Msg)
		m.SetReply(req)
		m.Rcode = dns.RcodeServerFailure
		_ = w.WriteMsg(m)
		slog.Warn("no upstream available", "domain", domain, "upstream", match.Upstream)
		s.emitEvent(domain, qtype, "RESOLVED", match.Upstream, time.Since(start), "SERVFAIL", false)
		return
	}

	resp, err := resolver.Resolve(req)
	if err != nil {
		slog.Warn("upstream resolve failed", "upstream", resolver.Name(), "domain", domain, "error", err)
		m := new(dns.Msg)
		m.SetReply(req)
		m.Rcode = dns.RcodeServerFailure
		_ = w.WriteMsg(m)
		s.emitEvent(domain, qtype, "RESOLVED", resolver.Name(), time.Since(start), "SERVFAIL", false)
		return
	}

	slog.Debug("resolved", "domain", domain, "upstream", resolver.Name(), "answers", len(resp.Answer))

	// Cache successful responses
	if s.useCache && s.cache != nil && resp.Rcode == dns.RcodeSuccess {
		s.cache.set(domain, q.Qtype, resp)
	}

	resp.Id = req.Id
	_ = w.WriteMsg(resp)

	rcode := dns.RcodeToString[resp.Rcode]
	s.emitEvent(domain, qtype, "RESOLVED", resolver.Name(), time.Since(start), rcode, false)
}

func (s *Server) emitEvent(domain, qtype, action, upstreamName string, latency time.Duration, rcode string, cached bool) {
	if s.stream == nil {
		return
	}
	s.stream.Emit(logstream.Event{
		Time:     time.Now(),
		Domain:   domain,
		QType:    qtype,
		Action:   action,
		Upstream: upstreamName,
		Latency:  latency,
		Rcode:    rcode,
		Cached:   cached,
	})
}

func (s *Server) buildBlockResponse(req *dns.Msg, blockIP net.IP) *dns.Msg {
	m := new(dns.Msg)
	m.SetReply(req)

	if blockIP == nil {
		m.Rcode = dns.RcodeNameError // NXDOMAIN
		return m
	}

	// Return zero IP for A/AAAA queries
	q := req.Question[0]
	switch q.Qtype {
	case dns.TypeA:
		ip4 := blockIP.To4()
		if ip4 == nil {
			ip4 = net.IPv4zero.To4()
		}
		m.Answer = append(m.Answer, &dns.A{
			Hdr: dns.RR_Header{Name: q.Name, Rrtype: dns.TypeA, Class: dns.ClassINET, Ttl: 60},
			A:   ip4,
		})
	case dns.TypeAAAA:
		m.Answer = append(m.Answer, &dns.AAAA{
			Hdr:  dns.RR_Header{Name: q.Name, Rrtype: dns.TypeAAAA, Class: dns.ClassINET, Ttl: 60},
			AAAA: net.IPv6zero,
		})
	default:
		m.Rcode = dns.RcodeNameError
	}

	return m
}
