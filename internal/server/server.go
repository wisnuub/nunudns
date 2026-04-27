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
	"github.com/wisnuub/nunudns/internal/process"
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

	resolvers := make(map[string]upstream.Resolver, len(cfg.Upstreams)+len(cfg.Rules.Pools))
	for _, u := range cfg.Upstreams {
		r, err := upstream.New(u)
		if err != nil {
			return nil, fmt.Errorf("creating upstream %q: %w", u.Name, err)
		}
		resolvers[u.Name] = r
		slog.Info("upstream registered", "name", u.Name, "protocol", u.Protocol, "address", u.Address)
	}

	// Build pool resolvers from their member upstreams.
	for _, p := range cfg.Rules.Pools {
		members := make([]upstream.Resolver, 0, len(p.Members))
		for _, memberName := range p.Members {
			r, ok := resolvers[memberName]
			if !ok {
				return nil, fmt.Errorf("pool %q references unknown upstream %q", p.Name, memberName)
			}
			members = append(members, r)
		}
		resolvers[p.Name] = upstream.NewPool(p.Name, members)
		slog.Info("pool registered", "name", p.Name, "members", len(members))
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

// identifyProcess attempts to find the process name that sent the DNS query.
// Works on Windows by looking up the source UDP port in the process table.
func (s *Server) identifyProcess(w dns.ResponseWriter) string {
	remoteAddr := w.RemoteAddr()
	if remoteAddr == nil {
		return ""
	}
	udpAddr, ok := remoteAddr.(*net.UDPAddr)
	if !ok || !udpAddr.IP.IsLoopback() {
		return ""
	}
	pid, err := process.GetPIDByUDPPort(uint16(udpAddr.Port))
	if err != nil {
		return ""
	}
	name, err := process.GetProcessName(pid)
	if err != nil {
		return ""
	}
	return name
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

	// Identify which process made this DNS query (Windows only, best-effort)
	processName := s.identifyProcess(w)

	slog.Debug("query received", "domain", domain, "type", qtype, "process", processName)

	// Cache lookup (skip per-process routing for cached responses)
	if s.useCache && s.cache != nil {
		if cached := s.cache.get(domain, q.Qtype); cached != nil {
			cached.Id = req.Id
			_ = w.WriteMsg(cached)
			slog.Debug("cache hit", "domain", domain)
			s.emitEvent(domain, qtype, "CACHED", "", time.Since(start), "NOERROR", true, processName)
			return
		}
	}

	// Process-specific rules take priority over domain rules
	var match rules.Match
	if processName != "" {
		match = s.router.LookupProcess(domain, processName)
	}
	if match.Action == rules.ActionNoMatch {
		match = s.router.Lookup(domain)
	}

	if match.Action == rules.ActionBlock {
		resp := s.buildBlockResponse(req, match.BlockIP)
		_ = w.WriteMsg(resp)
		slog.Info("blocked", "domain", domain, "process", processName)
		s.emitEvent(domain, qtype, "BLOCKED", "", time.Since(start), dns.RcodeToString[resp.Rcode], false, processName)
		return
	}

	// Resolve via upstream
	resolver := s.upstreams[match.Upstream]
	if resolver == nil {
		m := new(dns.Msg)
		m.SetReply(req)
		m.Rcode = dns.RcodeServerFailure
		_ = w.WriteMsg(m)
		slog.Warn("no upstream available", "domain", domain, "upstream", match.Upstream)
		s.emitEvent(domain, qtype, "RESOLVED", match.Upstream, time.Since(start), "SERVFAIL", false, processName)
		return
	}

	resp, err := resolver.Resolve(req)
	if err != nil {
		slog.Warn("upstream resolve failed", "upstream", resolver.Name(), "domain", domain, "error", err)
		m := new(dns.Msg)
		m.SetReply(req)
		m.Rcode = dns.RcodeServerFailure
		_ = w.WriteMsg(m)
		s.emitEvent(domain, qtype, "RESOLVED", resolver.Name(), time.Since(start), "SERVFAIL", false, processName)
		return
	}

	slog.Debug("resolved", "domain", domain, "upstream", resolver.Name(), "process", processName)

	if s.useCache && s.cache != nil && resp.Rcode == dns.RcodeSuccess {
		s.cache.set(domain, q.Qtype, resp)
	}

	resp.Id = req.Id
	_ = w.WriteMsg(resp)
	s.emitEvent(domain, qtype, "RESOLVED", resolver.Name(), time.Since(start), dns.RcodeToString[resp.Rcode], false, processName)
}

func (s *Server) emitEvent(domain, qtype, action, upstreamName string, latency time.Duration, rcode string, cached bool, processName string) {
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
		Process:  processName,
	})
}

func (s *Server) buildBlockResponse(req *dns.Msg, blockIP net.IP) *dns.Msg {
	m := new(dns.Msg)
	m.SetReply(req)

	if blockIP == nil {
		m.Rcode = dns.RcodeNameError
		return m
	}

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
