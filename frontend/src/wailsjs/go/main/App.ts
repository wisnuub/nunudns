// Wails auto-generates this at build time. This stub provides type safety in dev.
import type { config, logstream, netsetup, BuiltinServer } from '../../models'

const go = (window as any).go?.main?.App

export const StartDNS = (): Promise<void> => go.StartDNS()
export const StopDNS = (): Promise<void> => go.StopDNS()
export const GetStatus = (): Promise<{ running: boolean; address: string }> => go.GetStatus()

export const GetUpstreams = (): Promise<config.UpstreamConfig[]> => go.GetUpstreams()
export const AddUpstream = (u: config.UpstreamConfig): Promise<void> => go.AddUpstream(u)
export const UpdateUpstream = (oldName: string, u: config.UpstreamConfig): Promise<void> => go.UpdateUpstream(oldName, u)
export const DeleteUpstream = (name: string): Promise<void> => go.DeleteUpstream(name)
export const CheckServer = (protocol: string, address: string): Promise<{ rtt: number; error: string }> => go.CheckServer(protocol, address)

export const GetRules = (): Promise<config.RouteRule[]> => go.GetRules()
export const AddRule = (r: config.RouteRule): Promise<void> => go.AddRule(r)
export const UpdateRule = (i: number, r: config.RouteRule): Promise<void> => go.UpdateRule(i, r)
export const DeleteRule = (i: number): Promise<void> => go.DeleteRule(i)
export const MoveRuleUp = (i: number): Promise<void> => go.MoveRuleUp(i)
export const MoveRuleDown = (i: number): Promise<void> => go.MoveRuleDown(i)
export const GetDefaultUpstream = (): Promise<string> => go.GetDefaultUpstream()
export const SetDefaultUpstream = (name: string): Promise<void> => go.SetDefaultUpstream(name)

export const GetProcessRules = (): Promise<config.ProcessRule[]> => go.GetProcessRules()
export const AddProcessRule = (pr: config.ProcessRule): Promise<void> => go.AddProcessRule(pr)
export const UpdateProcessRule = (i: number, pr: config.ProcessRule): Promise<void> => go.UpdateProcessRule(i, pr)
export const DeleteProcessRule = (i: number): Promise<void> => go.DeleteProcessRule(i)

export const GetPools = (): Promise<config.PoolConfig[]> => go.GetPools()
export const AddPool = (p: config.PoolConfig): Promise<void> => go.AddPool(p)
export const UpdatePool = (name: string, p: config.PoolConfig): Promise<void> => go.UpdatePool(name, p)
export const DeletePool = (name: string): Promise<void> => go.DeletePool(name)

export const GetRecentEvents = (): Promise<logstream.Event[]> => go.GetRecentEvents()
export const GetBuiltinServers = (): Promise<BuiltinServer[]> => go.GetBuiltinServers()
export const ImportServers = (servers: BuiltinServer[]): Promise<void> => go.ImportServers(servers)

export const GetAdapters = (): Promise<netsetup.AdapterInfo[]> => go.GetAdapters()
export const EnableSystemDNS = (): Promise<void> => go.EnableSystemDNS()
export const DisableSystemDNS = (): Promise<void> => go.DisableSystemDNS()
export const IsAdmin = (): Promise<boolean> => go.IsAdmin()

export const GetServiceStatus = (): Promise<string> => go.GetServiceStatus()
export const InstallService = (): Promise<void> => go.InstallService()
export const UninstallService = (): Promise<void> => go.UninstallService()
export const StartService = (): Promise<void> => go.StartService()
export const StopService = (): Promise<void> => go.StopService()

export const GetSettings = (): Promise<config.ServerConfig> => go.GetSettings()
export const SaveSettings = (s: config.ServerConfig): Promise<void> => go.SaveSettings(s)
