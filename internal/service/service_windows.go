//go:build windows

package service

import (
	"fmt"
	"log/slog"
	"time"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

const ServiceName = "NunuDNS"
const ServiceDesc = "NunuDNS — Rule-based DNS proxy"

// IsWindowsService reports whether the process is running as a Windows service.
func IsWindowsService() bool {
	ok, err := svc.IsWindowsService()
	return err == nil && ok
}

// RunAsService runs the server loop as a Windows service.
func RunAsService(runFn func() error, stopFn func()) error {
	return svc.Run(ServiceName, &handler{run: runFn, stop: stopFn})
}

type handler struct {
	run  func() error
	stop func()
}

func (h *handler) Execute(_ []string, r <-chan svc.ChangeRequest, s chan<- svc.Status) (bool, uint32) {
	s <- svc.Status{State: svc.StartPending}

	errCh := make(chan error, 1)
	go func() { errCh <- h.run() }()

	s <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}

	for {
		select {
		case err := <-errCh:
			if err != nil {
				slog.Error("server error", "error", err)
			}
			return false, 0
		case c := <-r:
			switch c.Cmd {
			case svc.Stop, svc.Shutdown:
				s <- svc.Status{State: svc.StopPending}
				h.stop()
				return false, 0
			}
		}
	}
}

// Install registers NunuDNS as a Windows service.
func Install(exePath, configPath string) error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connecting to service manager: %w", err)
	}
	defer m.Disconnect()

	s, err := m.OpenService(ServiceName)
	if err == nil {
		s.Close()
		return fmt.Errorf("service %q already exists", ServiceName)
	}

	s, err = m.CreateService(ServiceName, exePath, mgr.Config{
		DisplayName: ServiceName,
		Description: ServiceDesc,
		StartType:   mgr.StartAutomatic,
	}, "-config", configPath)
	if err != nil {
		return fmt.Errorf("creating service: %w", err)
	}
	defer s.Close()

	slog.Info("service installed", "name", ServiceName)
	return nil
}

// Uninstall removes the NunuDNS Windows service.
func Uninstall() error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connecting to service manager: %w", err)
	}
	defer m.Disconnect()

	s, err := m.OpenService(ServiceName)
	if err != nil {
		return fmt.Errorf("opening service: %w", err)
	}
	defer s.Close()

	if err := s.Delete(); err != nil {
		return fmt.Errorf("deleting service: %w", err)
	}

	slog.Info("service uninstalled", "name", ServiceName)
	return nil
}

// Start starts the NunuDNS Windows service.
func Start() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	s, err := m.OpenService(ServiceName)
	if err != nil {
		return err
	}
	defer s.Close()

	return s.Start()
}

// QueryStatus returns the current Windows service state: "running", "stopped", or "not_installed".
func QueryStatus() string {
	m, err := mgr.Connect()
	if err != nil {
		return "not_installed"
	}
	defer m.Disconnect()

	s, err := m.OpenService(ServiceName)
	if err != nil {
		return "not_installed"
	}
	defer s.Close()

	status, err := s.Query()
	if err != nil {
		return "not_installed"
	}

	switch status.State {
	case svc.Running:
		return "running"
	default:
		return "stopped"
	}
}

// Stop stops the NunuDNS Windows service.
func Stop() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	s, err := m.OpenService(ServiceName)
	if err != nil {
		return err
	}
	defer s.Close()

	_, err = s.Control(svc.Stop)
	if err != nil {
		return err
	}

	// Wait until stopped
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		status, err := s.Query()
		if err != nil {
			return err
		}
		if status.State == svc.Stopped {
			return nil
		}
		time.Sleep(300 * time.Millisecond)
	}
	return fmt.Errorf("service did not stop within timeout")
}
