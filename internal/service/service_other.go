//go:build !windows

package service

import "fmt"

const ServiceName = "NunuDNS"

func IsWindowsService() bool { return false }

func QueryStatus() string { return "unsupported" }

func RunAsService(runFn func() error, _ func()) error {
	return fmt.Errorf("Windows service mode is only supported on Windows")
}

func Install(_, _ string) error {
	return fmt.Errorf("service management is only supported on Windows")
}

func Uninstall() error {
	return fmt.Errorf("service management is only supported on Windows")
}

func Start() error {
	return fmt.Errorf("service management is only supported on Windows")
}

func Stop() error {
	return fmt.Errorf("service management is only supported on Windows")
}
