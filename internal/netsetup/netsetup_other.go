//go:build !windows

package netsetup

import "fmt"

// AdapterInfo describes a network adapter and its current DNS settings.
type AdapterInfo struct {
	Name       string   `json:"name"`
	Index      int      `json:"interface_index"`
	Status     string   `json:"status"`
	CurrentDNS []string `json:"current_dns"`
}

func GetActiveAdapters() ([]AdapterInfo, error) {
	return nil, fmt.Errorf("network adapter management is only supported on Windows")
}

func SetAdapterDNS(_ string, _ []string) error {
	return fmt.Errorf("network adapter management is only supported on Windows")
}

func ResetAdapterDNS(_ string) error {
	return fmt.Errorf("network adapter management is only supported on Windows")
}

func FlushDNSCache() error {
	return fmt.Errorf("DNS cache flush is only supported on Windows")
}

func IsAdmin() bool { return false }
