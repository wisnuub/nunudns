// Wails auto-generates this file during build.
// This stub enables TypeScript development without the Wails runtime.
import type { config, logstream } from '../../models'

const go = () => (window as any).go.main.App

export function StartDNS(): Promise<void> { return go().StartDNS() }
export function StopDNS(): Promise<void> { return go().StopDNS() }
export function GetStatus(): Promise<{ running: boolean; address: string }> { return go().GetStatus() }
export function GetConfig(): Promise<any> { return go().GetConfig() }
export function GetUpstreams(): Promise<config.UpstreamConfig[]> { return go().GetUpstreams() }
export function AddUpstream(u: config.UpstreamConfig): Promise<void> { return go().AddUpstream(u) }
export function UpdateUpstream(oldName: string, u: config.UpstreamConfig): Promise<void> { return go().UpdateUpstream(oldName, u) }
export function DeleteUpstream(name: string): Promise<void> { return go().DeleteUpstream(name) }
export function CheckServer(protocol: string, address: string): Promise<{ rtt: number; error: string }> { return go().CheckServer(protocol, address) }
export function GetRules(): Promise<config.RouteRule[]> { return go().GetRules() }
export function AddRule(r: config.RouteRule): Promise<void> { return go().AddRule(r) }
export function UpdateRule(i: number, r: config.RouteRule): Promise<void> { return go().UpdateRule(i, r) }
export function DeleteRule(i: number): Promise<void> { return go().DeleteRule(i) }
export function MoveRuleUp(i: number): Promise<void> { return go().MoveRuleUp(i) }
export function MoveRuleDown(i: number): Promise<void> { return go().MoveRuleDown(i) }
export function GetDefaultUpstream(): Promise<string> { return go().GetDefaultUpstream() }
export function SetDefaultUpstream(name: string): Promise<void> { return go().SetDefaultUpstream(name) }
export function GetPools(): Promise<config.PoolConfig[]> { return go().GetPools() }
export function AddPool(p: config.PoolConfig): Promise<void> { return go().AddPool(p) }
export function UpdatePool(name: string, p: config.PoolConfig): Promise<void> { return go().UpdatePool(name, p) }
export function DeletePool(name: string): Promise<void> { return go().DeletePool(name) }
export function GetRecentEvents(): Promise<logstream.Event[]> { return go().GetRecentEvents() }
export function GetBuiltinServers(): Promise<any[]> { return go().GetBuiltinServers() }
export function ImportServers(servers: any[]): Promise<void> { return go().ImportServers(servers) }
export function GetServiceStatus(): Promise<string> { return go().GetServiceStatus() }
export function InstallService(): Promise<void> { return go().InstallService() }
export function UninstallService(): Promise<void> { return go().UninstallService() }
export function StartService(): Promise<void> { return go().StartService() }
export function StopService(): Promise<void> { return go().StopService() }
export function GetSettings(): Promise<config.ServerConfig> { return go().GetSettings() }
export function SaveSettings(s: config.ServerConfig): Promise<void> { return go().SaveSettings(s) }
