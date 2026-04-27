//go:build !windows

package main

import "fmt"

func executablePath() (string, error) {
	return "", fmt.Errorf("service install is only supported on Windows")
}

func serviceSupported() bool {
	return false
}
