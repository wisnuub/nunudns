package config

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Server    ServerConfig    `toml:"server"`
	Upstreams []UpstreamConfig `toml:"upstreams"`
	Rules     RulesConfig     `toml:"rules"`
}

type ServerConfig struct {
	Listen   string `toml:"listen"`
	LogLevel string `toml:"log_level"`
	Cache    bool   `toml:"cache"`
	CacheTTL int    `toml:"cache_ttl"`
}

type UpstreamConfig struct {
	Name     string `toml:"name"`
	Address  string `toml:"address"`
	Protocol string `toml:"protocol"` // udp, tcp, doh, dot
	Timeout  int    `toml:"timeout"`  // seconds, default 5
}

type PoolConfig struct {
	Name    string   `toml:"name"`
	Members []string `toml:"members"` // upstream names
}

// ProcessRule routes DNS queries from a specific process to a specific upstream.
// Process can be an exact filename ("chrome.exe"), a wildcard ("game*.exe"), or "*" (any).
// Match follows the same syntax as RouteRule.Match (exact, *.suffix, /regex/).
type ProcessRule struct {
	Process  string `toml:"process"`  // process executable name, e.g. "chrome.exe"
	Match    string `toml:"match"`    // domain pattern, "" = match all domains
	Upstream string `toml:"upstream"` // upstream name (or "__block__" to block)
	Enabled  bool   `toml:"enabled"`
}

type RulesConfig struct {
	DefaultUpstream string            `toml:"default_upstream"`
	Routes          []RouteRule       `toml:"routes"`
	Blocklists      []BlocklistConfig `toml:"blocklists"`
	Pools           []PoolConfig      `toml:"pools"`
	ProcessRules    []ProcessRule     `toml:"process_rules"`
}

type RouteRule struct {
	Match    string `toml:"match"`    // domain pattern: exact, *.suffix, or /regex/
	Upstream string `toml:"upstream"` // upstream name
}

type BlocklistConfig struct {
	Path   string `toml:"path"`
	Action string `toml:"action"` // nxdomain or zero
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	var cfg Config
	if _, err := toml.Decode(string(data), &cfg); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}

	if err := validate(&cfg); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	return &cfg, nil
}

func validate(cfg *Config) error {
	if cfg.Server.Listen == "" {
		cfg.Server.Listen = "127.0.0.1:53"
	}
	if cfg.Server.LogLevel == "" {
		cfg.Server.LogLevel = "info"
	}

	upstreamNames := make(map[string]bool)
	for i, u := range cfg.Upstreams {
		if u.Name == "" {
			return fmt.Errorf("upstream #%d missing name", i+1)
		}
		if u.Address == "" {
			return fmt.Errorf("upstream %q missing address", u.Name)
		}
		if u.Protocol == "" {
			cfg.Upstreams[i].Protocol = "udp"
		}
		switch cfg.Upstreams[i].Protocol {
		case "udp", "tcp", "doh", "dot":
		default:
			return fmt.Errorf("upstream %q: unknown protocol %q", u.Name, u.Protocol)
		}
		if u.Timeout == 0 {
			cfg.Upstreams[i].Timeout = 5
		}
		upstreamNames[u.Name] = true
	}

	// Pools are also valid upstream targets in rules.
	poolNames := make(map[string]bool)
	for _, p := range cfg.Rules.Pools {
		if p.Name == "" {
			return fmt.Errorf("a pool is missing a name")
		}
		poolNames[p.Name] = true
	}

	validTarget := func(name string) bool {
		return name == "__block__" || upstreamNames[name] || poolNames[name]
	}

	if cfg.Rules.DefaultUpstream != "" && !validTarget(cfg.Rules.DefaultUpstream) {
		return fmt.Errorf("default_upstream %q not defined in upstreams or pools", cfg.Rules.DefaultUpstream)
	}

	for _, r := range cfg.Rules.Routes {
		if !validTarget(r.Upstream) {
			return fmt.Errorf("route match=%q references unknown upstream or pool %q", r.Match, r.Upstream)
		}
	}

	for _, pr := range cfg.Rules.ProcessRules {
		if !validTarget(pr.Upstream) {
			return fmt.Errorf("process rule process=%q references unknown upstream or pool %q", pr.Process, pr.Upstream)
		}
	}

	return nil
}
