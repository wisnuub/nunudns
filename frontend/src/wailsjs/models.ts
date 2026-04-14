export namespace config {
  export interface UpstreamConfig {
    name: string
    address: string
    protocol: string
    timeout: number
  }
  export interface RouteRule {
    match: string
    upstream: string
  }
  export interface ProcessRule {
    process: string   // e.g. "chrome.exe", "game*.exe", or "*"
    match: string     // domain pattern, "" = all domains
    upstream: string  // upstream name or "__block__"
    enabled: boolean
  }
  export interface PoolConfig {
    name: string
    members: string[]
  }
  export interface ServerConfig {
    listen: string
    log_level: string
    cache: boolean
    cache_ttl: number
  }
}

export namespace logstream {
  export interface Event {
    Time: string
    Domain: string
    QType: string
    Action: string   // RESOLVED | BLOCKED | CACHED
    Upstream: string
    Latency: number  // nanoseconds
    Rcode: string
    Cached: boolean
    Process: string  // e.g. "chrome.exe" (Windows only)
  }
}

export namespace netsetup {
  export interface AdapterInfo {
    name: string
    interface_index: number
    status: string
    current_dns: string[]
  }
}

export interface BuiltinServer {
  name: string
  protocol: string
  address: string
}
