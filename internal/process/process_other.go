//go:build !windows

package process

import "fmt"

// GetPIDByUDPPort is not supported on non-Windows platforms.
func GetPIDByUDPPort(_ uint16) (uint32, error) {
	return 0, fmt.Errorf("process identification is only supported on Windows")
}

// GetProcessName is not supported on non-Windows platforms.
func GetProcessName(_ uint32) (string, error) {
	return "", fmt.Errorf("process identification is only supported on Windows")
}
