//go:build windows

package netsetup

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

// AdapterInfo describes a network adapter and its current DNS settings.
type AdapterInfo struct {
	Name       string   `json:"name"`
	Index      int      `json:"interface_index"`
	Status     string   `json:"status"`
	CurrentDNS []string `json:"current_dns"`
}

// GetActiveAdapters returns all Up network adapters and their IPv4 DNS servers.
func GetActiveAdapters() ([]AdapterInfo, error) {
	script := `
$result = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
  $dns = (Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses
  [PSCustomObject]@{
    name            = $_.Name
    interface_index = [int]$_.ifIndex
    status          = $_.Status
    current_dns     = @($dns)
  }
}
$result | ConvertTo-Json -AsArray -Depth 3
`
	out, err := runPS(script)
	if err != nil {
		return nil, fmt.Errorf("listing adapters: %w", err)
	}

	out = []byte(strings.TrimSpace(string(out)))
	if len(out) == 0 || string(out) == "null" {
		return nil, nil
	}

	// ConvertTo-Json wraps a single item as object, not array
	if len(out) > 0 && out[0] == '{' {
		out = append([]byte{'['}, append(out, ']')...)
	}

	var adapters []AdapterInfo
	if err := json.Unmarshal(out, &adapters); err != nil {
		return nil, fmt.Errorf("parsing adapter list: %w\nraw: %s", err, out)
	}
	return adapters, nil
}

// SetAdapterDNS sets static DNS servers for the adapter with the given name.
// dnsServers should be like []string{"127.0.0.1", "1.1.1.1"}.
func SetAdapterDNS(adapterName string, dnsServers []string) error {
	quoted := make([]string, len(dnsServers))
	for i, s := range dnsServers {
		quoted[i] = fmt.Sprintf("'%s'", s)
	}
	script := fmt.Sprintf(
		"Set-DnsClientServerAddress -InterfaceAlias '%s' -ServerAddresses @(%s)",
		adapterName, strings.Join(quoted, ","),
	)
	if _, err := runPS(script); err != nil {
		return fmt.Errorf("setting DNS for %q: %w", adapterName, err)
	}
	return nil
}

// ResetAdapterDNS restores DHCP-assigned DNS for the adapter.
func ResetAdapterDNS(adapterName string) error {
	script := fmt.Sprintf(
		"Set-DnsClientServerAddress -InterfaceAlias '%s' -ResetServerAddresses",
		adapterName,
	)
	if _, err := runPS(script); err != nil {
		return fmt.Errorf("resetting DNS for %q: %w", adapterName, err)
	}
	return nil
}

// FlushDNSCache clears the Windows DNS resolver cache.
func FlushDNSCache() error {
	_, err := runPS("Clear-DnsClientCache")
	return err
}

// IsAdmin returns true if the process is running with administrator privileges.
func IsAdmin() bool {
	out, err := runPS("[bool](([System.Security.Principal.WindowsIdentity]::GetCurrent()).groups -match 'S-1-5-32-544')")
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) == "True"
}

func runPS(script string) ([]byte, error) {
	cmd := exec.Command(
		"powershell",
		"-NoProfile", "-NonInteractive",
		"-ExecutionPolicy", "Bypass",
		"-Command", script,
	)
	out, err := cmd.Output()
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("powershell exit %d: %s", ee.ExitCode(), ee.Stderr)
		}
		return nil, err
	}
	return out, nil
}
