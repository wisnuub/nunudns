package config

import (
	"bytes"
	"fmt"
	"os"
	"sync"

	"github.com/BurntSushi/toml"
)

// Model is a thread-safe mutable config that persists changes to disk.
type Model struct {
	mu   sync.RWMutex
	cfg  Config
	path string
}

// NewModel loads config from path and wraps it in a Model.
// If the file does not exist a default config is used (first-run scenario).
func NewModel(path string) (*Model, error) {
	m := &Model{path: path}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// First run — start with a sensible default
			m.cfg = defaultConfig()
			return m, nil
		}
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	var cfg Config
	if _, err := toml.Decode(string(data), &cfg); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}

	// Apply defaults (non-destructive)
	if cfg.Server.Listen == "" {
		cfg.Server.Listen = "127.0.0.1:53"
	}
	if cfg.Server.LogLevel == "" {
		cfg.Server.LogLevel = "info"
	}

	m.cfg = cfg
	return m, nil
}

func defaultConfig() Config {
	return Config{
		Server: ServerConfig{
			Listen:   "127.0.0.1:53",
			LogLevel: "info",
			Cache:    true,
			CacheTTL: 60,
		},
	}
}

// Get returns a copy of the current config.
func (m *Model) Get() Config {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.cfg
}

// Set replaces the config and writes it atomically to disk.
func (m *Model) Set(cfg Config) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// AddUpstream appends an upstream to the config and saves.
func (m *Model) AddUpstream(u UpstreamConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	cfg.Upstreams = append(cfg.Upstreams, u)
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// RemoveUpstream removes the upstream with the given name and saves.
func (m *Model) RemoveUpstream(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	upstreams := cfg.Upstreams[:0]
	for _, u := range cfg.Upstreams {
		if u.Name != name {
			upstreams = append(upstreams, u)
		}
	}
	cfg.Upstreams = upstreams
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// AddRoute appends a route rule and saves.
func (m *Model) AddRoute(r RouteRule) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	cfg.Rules.Routes = append(cfg.Rules.Routes, r)
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// RemoveRoute removes the route at index i and saves.
func (m *Model) RemoveRoute(i int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	if i < 0 || i >= len(cfg.Rules.Routes) {
		return fmt.Errorf("route index %d out of range", i)
	}
	cfg.Rules.Routes = append(cfg.Rules.Routes[:i], cfg.Rules.Routes[i+1:]...)
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// MoveRoute swaps routes at indices i and j and saves.
func (m *Model) MoveRoute(i, j int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	routes := cfg.Rules.Routes
	if i < 0 || i >= len(routes) || j < 0 || j >= len(routes) {
		return fmt.Errorf("route index out of range")
	}
	routes[i], routes[j] = routes[j], routes[i]
	cfg.Rules.Routes = routes
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// AddPool appends a pool and saves.
func (m *Model) AddPool(p PoolConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	for _, existing := range cfg.Rules.Pools {
		if existing.Name == p.Name {
			return fmt.Errorf("pool %q already exists", p.Name)
		}
	}
	cfg.Rules.Pools = append(cfg.Rules.Pools, p)
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// UpdatePool replaces the pool with the given name and saves.
func (m *Model) UpdatePool(name string, p PoolConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	for i, existing := range cfg.Rules.Pools {
		if existing.Name == name {
			cfg.Rules.Pools[i] = p
			if err := m.writeLocked(cfg); err != nil {
				return err
			}
			m.cfg = cfg
			return nil
		}
	}
	return fmt.Errorf("pool %q not found", name)
}

// RemovePool removes the pool with the given name and saves.
func (m *Model) RemovePool(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	pools := cfg.Rules.Pools[:0]
	for _, p := range cfg.Rules.Pools {
		if p.Name != name {
			pools = append(pools, p)
		}
	}
	cfg.Rules.Pools = pools
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// GetPools returns a copy of all pools.
func (m *Model) GetPools() []PoolConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]PoolConfig, len(m.cfg.Rules.Pools))
	copy(result, m.cfg.Rules.Pools)
	return result
}

// GetProcessRules returns a copy of all process rules.
func (m *Model) GetProcessRules() []ProcessRule {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]ProcessRule, len(m.cfg.Rules.ProcessRules))
	copy(result, m.cfg.Rules.ProcessRules)
	return result
}

// AddProcessRule appends a process rule and saves.
func (m *Model) AddProcessRule(pr ProcessRule) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	cfg.Rules.ProcessRules = append(cfg.Rules.ProcessRules, pr)
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// UpdateProcessRule replaces the process rule at index i and saves.
func (m *Model) UpdateProcessRule(i int, pr ProcessRule) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	if i < 0 || i >= len(cfg.Rules.ProcessRules) {
		return fmt.Errorf("process rule index %d out of range", i)
	}
	cfg.Rules.ProcessRules[i] = pr
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// RemoveProcessRule removes the process rule at index i and saves.
func (m *Model) RemoveProcessRule(i int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg := m.cfg
	if i < 0 || i >= len(cfg.Rules.ProcessRules) {
		return fmt.Errorf("process rule index %d out of range", i)
	}
	cfg.Rules.ProcessRules = append(cfg.Rules.ProcessRules[:i], cfg.Rules.ProcessRules[i+1:]...)
	if err := m.writeLocked(cfg); err != nil {
		return err
	}
	m.cfg = cfg
	return nil
}

// writeLocked serialises cfg to m.path atomically.
// Must be called with m.mu held.
func (m *Model) writeLocked(cfg Config) error {
	var buf bytes.Buffer
	enc := toml.NewEncoder(&buf)
	if err := enc.Encode(cfg); err != nil {
		return fmt.Errorf("encoding config: %w", err)
	}

	// Write to a temp file then rename for atomicity
	tmp := m.path + ".tmp"
	if err := os.WriteFile(tmp, buf.Bytes(), 0644); err != nil {
		return fmt.Errorf("writing temp config: %w", err)
	}
	if err := os.Rename(tmp, m.path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("replacing config file: %w", err)
	}
	return nil
}
