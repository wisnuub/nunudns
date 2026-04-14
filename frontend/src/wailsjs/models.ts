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
    Action: string
    Upstream: string
    Latency: number
    Rcode: string
    Cached: boolean
  }
}
