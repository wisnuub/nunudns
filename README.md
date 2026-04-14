# NunuDNS

A lightweight, rule-based DNS proxy for Windows with support for DNS-over-HTTPS (DoH), DNS-over-TLS (DoT), plain UDP/TCP upstreams, domain routing, and blocklists.

## Features

- **Multiple upstream protocols** — plain UDP/TCP, DoH, DoT
- **Rule-based routing** — send specific domains to specific upstreams
  - Exact domain match (`example.com`)
  - Wildcard suffix match (`*.corp.example.com`)
  - Regular expression match (`/\.(ru|cn)\.?$/`)
- **Blocklists** — supports plain-domain and hosts-file formats
  - Return `NXDOMAIN` or `0.0.0.0` for blocked domains
- **Response cache** — TTL-aware in-memory cache
- **Windows Service** — install and run as a system service
- **Structured logging** — configurable log levels

## Quick Start

### 1. Download or build

**Pre-built Windows binary** — grab the latest release from the [Releases](../../releases) page.

**Build from source** (requires Go 1.21+):

```powershell
# Windows
make build-windows

# Other platforms (for testing)
make build
```

### 2. Configure

Copy `config.example.toml` to `config.toml` and edit:

```toml
[server]
listen    = "127.0.0.1:53"
log_level = "info"
cache     = true

[[upstreams]]
name     = "cloudflare-doh"
protocol = "doh"
address  = "https://cloudflare-dns.com/dns-query"

[rules]
default_upstream = "cloudflare-doh"

[[rules.routes]]
match    = "*.local"
upstream = "local-router"
```

See `config.example.toml` for all available options.

### 3. Run

```powershell
# Run in foreground (for testing)
.\nunudns.exe -config config.toml

# Debug mode
.\nunudns.exe -config config.toml -log debug
```

### 4. Point Windows DNS at NunuDNS

Set your network adapter's DNS server to `127.0.0.1` in Network Settings, or via PowerShell (run as Administrator):

```powershell
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses "127.0.0.1"
```

## Windows Service

Run as Administrator:

```powershell
# Install the service (auto-starts on boot)
.\nunudns.exe install -config C:\path\to\config.toml

# Start / stop
.\nunudns.exe start
.\nunudns.exe stop

# Remove
.\nunudns.exe uninstall
```

## Routing Rules

Rules are evaluated in order — **first match wins**. If no rule matches, the `default_upstream` is used.

| Pattern | Example | Behaviour |
|---------|---------|-----------|
| Exact | `example.com` | Only `example.com` |
| Wildcard | `*.example.com` | Any subdomain of `example.com` |
| Regex | `/\.(local\|corp)\.?$/` | Full regex on the domain |

## Blocklists

Supports two formats:

**Plain domain list:**
```
ads.example.com
tracking.example.net
```

**Hosts-file format:**
```
0.0.0.0 ads.example.com
0.0.0.0 tracking.example.net
```

Configure with `action = "nxdomain"` (return not-found) or `action = "zero"` (return `0.0.0.0`).

## Configuration Reference

```toml
[server]
listen    = "127.0.0.1:53"  # bind address
log_level = "info"           # debug | info | warn | error
cache     = true             # enable response cache
cache_ttl = 300              # default cache TTL in seconds

[[upstreams]]
name     = "my-upstream"     # unique name referenced by rules
protocol = "doh"             # udp | tcp | doh | dot
address  = "https://..."     # server address
timeout  = 5                 # timeout in seconds

[rules]
default_upstream = "my-upstream"

[[rules.routes]]
match    = "*.local"
upstream = "my-upstream"

[[rules.blocklists]]
path   = "blocklist.txt"
action = "nxdomain"
```

## License

MIT
