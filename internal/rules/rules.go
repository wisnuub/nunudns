package rules

import (
	"bufio"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/wisnuub/nunudns/internal/config"
)

// Action describes what to do with a matched domain.
type Action int

const (
	ActionRoute   Action = iota // forward to a specific upstream
	ActionBlock                 // block the query
	ActionNoMatch               // no rule matched (only returned by LookupProcess)
)

// Match is the result of evaluating routing rules for a domain.
type Match struct {
	Action   Action
	Upstream string // upstream name (when ActionRoute)
	BlockIP  net.IP // override IP for blocked A/AAAA queries (nil = NXDOMAIN)
}

type rule struct {
	kind     string // "exact", "suffix", "regex", "any"
	pattern  string
	re       *regexp.Regexp
	upstream string
}

type processRule struct {
	process  string // lowercase exe name, "*" = any, or glob pattern
	domain   rule   // compiled domain rule (kind="any" means all domains)
	upstream string
	enabled  bool
}

// Router holds compiled routing rules and a blocklist.
type Router struct {
	routes          []rule
	processRules    []processRule
	blocked         map[string]net.IP // domain → block IP (nil = NXDOMAIN)
	defaultUpstream string
}

// New compiles a Router from config.
func New(cfg config.RulesConfig) (*Router, error) {
	r := &Router{
		defaultUpstream: cfg.DefaultUpstream,
		blocked:         make(map[string]net.IP),
	}

	for _, route := range cfg.Routes {
		compiled, err := compileRule(route.Match, route.Upstream)
		if err != nil {
			return nil, err
		}
		r.routes = append(r.routes, compiled)
	}

	for _, pr := range cfg.ProcessRules {
		if !pr.Enabled {
			continue
		}
		var domainRule rule
		var err error
		if pr.Match == "" || pr.Match == "*" {
			domainRule = rule{kind: "any", upstream: pr.Upstream}
		} else {
			domainRule, err = compileRule(pr.Match, pr.Upstream)
			if err != nil {
				return nil, err
			}
		}
		r.processRules = append(r.processRules, processRule{
			process:  strings.ToLower(pr.Process),
			domain:   domainRule,
			upstream: pr.Upstream,
			enabled:  true,
		})
	}

	for _, bl := range cfg.Blocklists {
		if err := r.loadBlocklist(bl.Path, bl.Action); err != nil {
			return nil, err
		}
	}

	return r, nil
}

func compileRule(pattern, upstream string) (rule, error) {
	switch {
	case strings.HasPrefix(pattern, "/") && strings.HasSuffix(pattern, "/"):
		// Regex pattern: /pattern/
		inner := pattern[1 : len(pattern)-1]
		re, err := regexp.Compile("(?i)" + inner)
		if err != nil {
			return rule{}, err
		}
		return rule{kind: "regex", pattern: pattern, re: re, upstream: upstream}, nil

	case strings.HasPrefix(pattern, "*."):
		// Suffix match: *.example.com
		suffix := strings.ToLower(pattern[2:])
		return rule{kind: "suffix", pattern: suffix, upstream: upstream}, nil

	default:
		// Exact domain match
		return rule{kind: "exact", pattern: strings.ToLower(strings.TrimSuffix(pattern, ".")), upstream: upstream}, nil
	}
}

// LookupProcess checks process-specific rules first. Returns ActionNoMatch if no
// process rule matched, so the caller can fall back to Lookup.
func (r *Router) LookupProcess(domain, processName string) Match {
	if processName == "" || len(r.processRules) == 0 {
		return Match{Action: ActionNoMatch}
	}

	domain = strings.ToLower(strings.TrimSuffix(domain, "."))
	processLower := strings.ToLower(processName)

	for _, pr := range r.processRules {
		if !pr.enabled {
			continue
		}
		if !matchProcess(pr.process, processLower) {
			continue
		}
		if pr.domain.kind == "any" || matchRule(pr.domain, domain) {
			if pr.upstream == "__block__" {
				return Match{Action: ActionBlock}
			}
			return Match{Action: ActionRoute, Upstream: pr.upstream}
		}
	}
	return Match{Action: ActionNoMatch}
}

// matchProcess checks if a process name matches a process pattern.
// Patterns: "*" = any, "chrome.exe" = exact (case-insensitive), "game*.exe" = glob.
func matchProcess(pattern, name string) bool {
	if pattern == "*" {
		return true
	}
	matched, err := filepath.Match(pattern, name)
	if err != nil {
		return pattern == name
	}
	return matched
}

// Lookup finds the routing action for a domain name (FQDN with trailing dot OK).
func (r *Router) Lookup(domain string) Match {
	domain = strings.ToLower(strings.TrimSuffix(domain, "."))

	// Check blocklist first
	if blockIP, blocked := r.blocked[domain]; blocked {
		return Match{Action: ActionBlock, BlockIP: blockIP}
	}

	// Check routes in order (first match wins)
	for _, rule := range r.routes {
		if matchRule(rule, domain) {
			if rule.upstream == "__block__" {
				return Match{Action: ActionBlock}
			}
			return Match{Action: ActionRoute, Upstream: rule.upstream}
		}
	}

	// Fall through to default upstream
	return Match{Action: ActionRoute, Upstream: r.defaultUpstream}
}

func matchRule(r rule, domain string) bool {
	switch r.kind {
	case "any":
		return true
	case "exact":
		return domain == r.pattern
	case "suffix":
		return domain == r.pattern || strings.HasSuffix(domain, "."+r.pattern)
	case "regex":
		return r.re.MatchString(domain)
	}
	return false
}

func (r *Router) loadBlocklist(path, action string) error {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Missing blocklist files are non-fatal — log and continue.
			// The file may be created later or removed intentionally.
			return nil
		}
		return err
	}
	defer f.Close()

	var blockIP net.IP
	if action == "zero" {
		blockIP = net.IPv4zero
	}

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// Support hosts-file format: "0.0.0.0 domain.com" or plain "domain.com"
		fields := strings.Fields(line)
		domain := fields[len(fields)-1]
		domain = strings.ToLower(strings.TrimSuffix(domain, "."))
		r.blocked[domain] = blockIP
	}
	return scanner.Err()
}
