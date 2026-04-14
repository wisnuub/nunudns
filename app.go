package main

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/miekg/dns"
	"github.com/wisnuub/nunudns/internal/config"
	"github.com/wisnuub/nunudns/internal/logstream"
	"github.com/wisnuub/nunudns/internal/netsetup"
	"github.com/wisnuub/nunudns/internal/server"
	"github.com/wisnuub/nunudns/internal/service"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// StatusInfo holds the DNS server running state exposed to the frontend.
type StatusInfo struct {
	Running bool   `json:"running"`
	Address string `json:"address"`
}

// ServerCheckResult is the result of a connectivity/latency check.
type ServerCheckResult struct {
	RTT   int64  `json:"rtt"`   // milliseconds, -1 = failed
	Error string `json:"error"`
}

// BuiltinServer is a well-known public DNS server entry.
type BuiltinServer struct {
	Name     string `json:"name"`
	Protocol string `json:"protocol"`
	Address  string `json:"address"`
}

// App is the Wails application backend bound to the frontend.
type App struct {
	ctx          context.Context
	model        *config.Model
	stream       *logstream.Stream
	srv          *server.Server
	mu           sync.Mutex
	running      bool
	cfgPath      string
	recentEvents []logstream.Event
	eventsMu     sync.RWMutex
}

// NewApp constructs the App.
func NewApp(model *config.Model, stream *logstream.Stream, cfgPath string) *App {
	return &App{
		model:        model,
		stream:       stream,
		cfgPath:      cfgPath,
		recentEvents: make([]logstream.Event, 0, 500),
	}
}

// startup is called by Wails after the app is initialised.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Subscribe to the log stream and forward events to the frontend.
	sub := a.stream.Subscribe()
	go func() {
		for ev := range sub {
			a.eventsMu.Lock()
			if len(a.recentEvents) >= 500 {
				a.recentEvents = a.recentEvents[1:]
			}
			a.recentEvents = append(a.recentEvents, ev)
			a.eventsMu.Unlock()
			runtime.EventsEmit(a.ctx, "dns:event", ev)
		}
	}()
}

// shutdown is called by Wails when the app is closing.
func (a *App) shutdown(_ context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.srv != nil {
		a.srv.Stop()
		a.running = false
	}
}

// StartDNS starts the DNS server.
func (a *App) StartDNS() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.running {
		return fmt.Errorf("DNS server is already running")
	}

	cfg := a.model.Get()
	srv, err := server.NewWithStream(&cfg, a.stream)
	if err != nil {
		return fmt.Errorf("creating server: %w", err)
	}
	a.srv = srv
	a.running = true

	go func() {
		if err := srv.Start(); err != nil {
			a.mu.Lock()
			a.running = false
			a.mu.Unlock()
		}
	}()

	return nil
}

// StopDNS stops the DNS server.
func (a *App) StopDNS() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.running || a.srv == nil {
		return fmt.Errorf("DNS server is not running")
	}
	a.srv.Stop()
	a.running = false
	a.srv = nil
	return nil
}

// GetStatus returns the current running state of the DNS server.
func (a *App) GetStatus() StatusInfo {
	a.mu.Lock()
	defer a.mu.Unlock()
	addr := ""
	if a.running {
		addr = a.model.Get().Server.Listen
	}
	return StatusInfo{Running: a.running, Address: addr}
}

// GetConfig returns the full current config.
func (a *App) GetConfig() config.Config {
	return a.model.Get()
}

// GetUpstreams returns all configured upstream servers.
func (a *App) GetUpstreams() []config.UpstreamConfig {
	cfg := a.model.Get()
	if cfg.Upstreams == nil {
		return []config.UpstreamConfig{}
	}
	return cfg.Upstreams
}

// AddUpstream adds a new upstream server.
func (a *App) AddUpstream(u config.UpstreamConfig) error {
	if u.Timeout == 0 {
		u.Timeout = 5
	}
	if u.Protocol == "" {
		u.Protocol = "udp"
	}
	return a.model.AddUpstream(u)
}

// UpdateUpstream replaces an upstream by its old name.
func (a *App) UpdateUpstream(oldName string, u config.UpstreamConfig) error {
	a.model.RemoveUpstream(oldName) //nolint:errcheck
	return a.model.AddUpstream(u)
}

// DeleteUpstream removes an upstream by name.
func (a *App) DeleteUpstream(name string) error {
	return a.model.RemoveUpstream(name)
}

// CheckServer tests connectivity and latency to a DNS server.
func (a *App) CheckServer(protocol, address string) ServerCheckResult {
	start := time.Now()

	switch protocol {
	case "udp", "tcp":
		c := new(dns.Client)
		c.Net = protocol
		c.Timeout = 5 * time.Second

		m := new(dns.Msg)
		m.SetQuestion("example.com.", dns.TypeA)
		m.RecursionDesired = true

		if _, _, err := c.Exchange(m, address); err != nil {
			return ServerCheckResult{RTT: -1, Error: err.Error()}
		}
		return ServerCheckResult{RTT: time.Since(start).Milliseconds()}

	case "dot":
		c := new(dns.Client)
		c.Net = "tcp-tls"
		c.Timeout = 5 * time.Second
		c.TLSConfig = &tls.Config{InsecureSkipVerify: false}

		m := new(dns.Msg)
		m.SetQuestion("example.com.", dns.TypeA)
		m.RecursionDesired = true

		if _, _, err := c.Exchange(m, address); err != nil {
			return ServerCheckResult{RTT: -1, Error: err.Error()}
		}
		return ServerCheckResult{RTT: time.Since(start).Milliseconds()}

	case "doh":
		// Build a minimal DNS wire query for A example.com
		m := new(dns.Msg)
		m.SetQuestion("example.com.", dns.TypeA)
		m.RecursionDesired = true
		wire, err := m.Pack()
		if err != nil {
			return ServerCheckResult{RTT: -1, Error: err.Error()}
		}
		encoded := base64.RawURLEncoding.EncodeToString(wire)

		url := address
		if len(url) > 0 && url[len(url)-1] != '/' {
			url += "?dns=" + encoded
		} else {
			url += "?dns=" + encoded
		}

		client := &http.Client{Timeout: 5 * time.Second}
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return ServerCheckResult{RTT: -1, Error: err.Error()}
		}
		req.Header.Set("Accept", "application/dns-message")

		resp, err := client.Do(req)
		if err != nil {
			return ServerCheckResult{RTT: -1, Error: err.Error()}
		}
		defer resp.Body.Close()
		io.Copy(io.Discard, resp.Body) //nolint:errcheck

		if resp.StatusCode != http.StatusOK {
			return ServerCheckResult{RTT: -1, Error: fmt.Sprintf("HTTP %d", resp.StatusCode)}
		}
		return ServerCheckResult{RTT: time.Since(start).Milliseconds()}

	default:
		return ServerCheckResult{RTT: -1, Error: fmt.Sprintf("unsupported protocol: %s", protocol)}
	}
}

// GetRules returns the current routing rules.
func (a *App) GetRules() []config.RouteRule {
	cfg := a.model.Get()
	if cfg.Rules.Routes == nil {
		return []config.RouteRule{}
	}
	return cfg.Rules.Routes
}

// AddRule appends a routing rule.
func (a *App) AddRule(r config.RouteRule) error {
	return a.model.AddRoute(r)
}

// UpdateRule replaces the rule at index i.
func (a *App) UpdateRule(i int, r config.RouteRule) error {
	cfg := a.model.Get()
	if i < 0 || i >= len(cfg.Rules.Routes) {
		return fmt.Errorf("rule index %d out of range", i)
	}
	cfg.Rules.Routes[i] = r
	return a.model.Set(cfg)
}

// DeleteRule removes the rule at index i.
func (a *App) DeleteRule(i int) error {
	return a.model.RemoveRoute(i)
}

// MoveRuleUp moves the rule at index i one position up (lower index).
func (a *App) MoveRuleUp(i int) error {
	if i <= 0 {
		return fmt.Errorf("rule already at top")
	}
	return a.model.MoveRoute(i, i-1)
}

// MoveRuleDown moves the rule at index i one position down (higher index).
func (a *App) MoveRuleDown(i int) error {
	cfg := a.model.Get()
	if i >= len(cfg.Rules.Routes)-1 {
		return fmt.Errorf("rule already at bottom")
	}
	return a.model.MoveRoute(i, i+1)
}

// GetDefaultUpstream returns the default upstream name.
func (a *App) GetDefaultUpstream() string {
	return a.model.Get().Rules.DefaultUpstream
}

// SetDefaultUpstream updates the default upstream and persists.
func (a *App) SetDefaultUpstream(name string) error {
	cfg := a.model.Get()
	cfg.Rules.DefaultUpstream = name
	return a.model.Set(cfg)
}

// GetPools returns all configured pools.
func (a *App) GetPools() []config.PoolConfig {
	pools := a.model.GetPools()
	if pools == nil {
		return []config.PoolConfig{}
	}
	return pools
}

// AddPool creates a new pool.
func (a *App) AddPool(p config.PoolConfig) error {
	return a.model.AddPool(p)
}

// UpdatePool replaces a pool by name.
func (a *App) UpdatePool(name string, p config.PoolConfig) error {
	return a.model.UpdatePool(name, p)
}

// DeletePool removes a pool by name.
func (a *App) DeletePool(name string) error {
	return a.model.RemovePool(name)
}

// GetRecentEvents returns the last (up to) 500 DNS events.
func (a *App) GetRecentEvents() []logstream.Event {
	a.eventsMu.RLock()
	defer a.eventsMu.RUnlock()
	result := make([]logstream.Event, len(a.recentEvents))
	copy(result, a.recentEvents)
	return result
}

// GetBuiltinServers returns a hardcoded list of well-known public DNS servers.
func (a *App) GetBuiltinServers() []BuiltinServer {
	return []BuiltinServer{
		{"Cloudflare", "doh", "https://cloudflare-dns.com/dns-query"},
		{"Google", "doh", "https://dns.google/dns-query"},
		{"Quad9", "doh", "https://dns.quad9.net/dns-query"},
		{"AdGuard", "doh", "https://dns.adguard.com/dns-query"},
		{"NextDNS", "doh", "https://dns.nextdns.io"},
		{"Cloudflare", "dot", "dns.cloudflare.com:853"},
		{"Google", "dot", "dns.google:853"},
		{"Quad9", "dot", "dns.quad9.net:853"},
		{"AdGuard", "dot", "dns.adguard.com:853"},
		{"Cloudflare", "udp", "1.1.1.1:53"},
		{"Google", "udp", "8.8.8.8:53"},
		{"Quad9", "udp", "9.9.9.9:53"},
		{"OpenDNS", "udp", "208.67.222.222:53"},
		{"Cloudflare Alt", "udp", "1.0.0.1:53"},
		{"Google Alt", "udp", "8.8.4.4:53"},
	}
}

// ImportServers imports a list of servers as upstreams.
func (a *App) ImportServers(servers []BuiltinServer) error {
	existing := a.model.Get().Upstreams
	existingNames := make(map[string]bool, len(existing))
	for _, u := range existing {
		existingNames[u.Name] = true
	}

	for _, s := range servers {
		name := s.Name
		// Deduplicate names
		candidate := name
		for i := 2; existingNames[candidate]; i++ {
			candidate = fmt.Sprintf("%s %d", name, i)
		}
		existingNames[candidate] = true

		u := config.UpstreamConfig{
			Name:     candidate,
			Address:  s.Address,
			Protocol: s.Protocol,
			Timeout:  5,
		}
		if err := a.model.AddUpstream(u); err != nil {
			return fmt.Errorf("importing %q: %w", candidate, err)
		}
	}
	return nil
}

// GetServiceStatus returns the Windows service status or "unsupported" on other platforms.
func (a *App) GetServiceStatus() string {
	// On non-Windows, service.Install will return an error.
	// We detect platform support by calling a no-op check.
	if !serviceSupported() {
		return "unsupported"
	}
	// On Windows we'd check the SCM. For now return "not_installed" as a safe default.
	// The windows service package doesn't expose a query status function yet.
	return "not_installed"
}

// InstallService installs the Windows service.
func (a *App) InstallService() error {
	exePath, err := executablePath()
	if err != nil {
		return err
	}
	return service.Install(exePath, a.cfgPath)
}

// UninstallService uninstalls the Windows service.
func (a *App) UninstallService() error {
	return service.Uninstall()
}

// StartService starts the Windows service.
func (a *App) StartService() error {
	return service.Start()
}

// StopService stops the Windows service.
func (a *App) StopService() error {
	return service.Stop()
}

// GetSettings returns the current server settings.
func (a *App) GetSettings() config.ServerConfig {
	return a.model.Get().Server
}

// SaveSettings persists updated server settings.
func (a *App) SaveSettings(s config.ServerConfig) error {
	cfg := a.model.Get()
	cfg.Server = s
	return a.model.Set(cfg)
}

// ── Process Rules ─────────────────────────────────────────────────────────────

// GetProcessRules returns all per-process DNS routing rules.
func (a *App) GetProcessRules() []config.ProcessRule {
	rules := a.model.GetProcessRules()
	if rules == nil {
		return []config.ProcessRule{}
	}
	return rules
}

// AddProcessRule appends a new per-process rule.
func (a *App) AddProcessRule(pr config.ProcessRule) error {
	return a.model.AddProcessRule(pr)
}

// UpdateProcessRule replaces the process rule at index i.
func (a *App) UpdateProcessRule(i int, pr config.ProcessRule) error {
	return a.model.UpdateProcessRule(i, pr)
}

// DeleteProcessRule removes the process rule at index i.
func (a *App) DeleteProcessRule(i int) error {
	return a.model.RemoveProcessRule(i)
}

// ── Network / System DNS Setup ─────────────────────────────────────────────

// GetAdapters returns all active network adapters and their current DNS settings.
func (a *App) GetAdapters() []netsetup.AdapterInfo {
	adapters, err := netsetup.GetActiveAdapters()
	if err != nil {
		return nil
	}
	return adapters
}

// EnableSystemDNS sets all active adapters to use 127.0.0.1 (this app) as DNS.
// dnsIP should be the listen IP (e.g. "127.0.0.1").
func (a *App) EnableSystemDNS() error {
	if !netsetup.IsAdmin() {
		return fmt.Errorf("administrator privileges are required to change DNS settings")
	}
	adapters, err := netsetup.GetActiveAdapters()
	if err != nil {
		return fmt.Errorf("listing adapters: %w", err)
	}

	cfg := a.model.Get()
	// Extract just the IP part of the listen address
	listenIP := cfg.Server.Listen
	if h, _, err2 := splitHostPort(listenIP); err2 == nil {
		listenIP = h
	}

	for _, ad := range adapters {
		if err := netsetup.SetAdapterDNS(ad.Name, []string{listenIP}); err != nil {
			return fmt.Errorf("setting DNS on %q: %w", ad.Name, err)
		}
	}
	_ = netsetup.FlushDNSCache()
	return nil
}

// DisableSystemDNS resets all active adapters back to DHCP/automatic DNS.
func (a *App) DisableSystemDNS() error {
	if !netsetup.IsAdmin() {
		return fmt.Errorf("administrator privileges are required to change DNS settings")
	}
	adapters, err := netsetup.GetActiveAdapters()
	if err != nil {
		return fmt.Errorf("listing adapters: %w", err)
	}
	for _, ad := range adapters {
		if err := netsetup.ResetAdapterDNS(ad.Name); err != nil {
			return fmt.Errorf("resetting DNS on %q: %w", ad.Name, err)
		}
	}
	_ = netsetup.FlushDNSCache()
	return nil
}

// IsAdmin returns true if NunuDNS is running with administrator privileges.
func (a *App) IsAdmin() bool {
	return netsetup.IsAdmin()
}

// splitHostPort splits "host:port" and returns host, port.
func splitHostPort(addr string) (string, string, error) {
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return addr[:i], addr[i+1:], nil
		}
	}
	return addr, "", fmt.Errorf("no port in address")
}

// executablePath returns the absolute path to the running executable.
func executablePath() (string, error) {
	return "", fmt.Errorf("service install: not implemented on this platform")
}

// serviceSupported returns true on Windows only.
func serviceSupported() bool {
	return false // overridden on Windows via build tags if needed
}

