//go:build windows

package process

import (
	"encoding/binary"
	"fmt"
	"path/filepath"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	modiphlpapi             = windows.NewLazySystemDLL("iphlpapi.dll")
	procGetExtendedUdpTable = modiphlpapi.NewProc("GetExtendedUdpTable")
)

const (
	udpTableOwnerPID = 1
	afINET           = 2
)

// GetPIDByUDPPort returns the PID that owns the given local UDP port.
func GetPIDByUDPPort(port uint16) (uint32, error) {
	var size uint32
	// First call: get required buffer size (expected to fail with ERROR_INSUFFICIENT_BUFFER)
	procGetExtendedUdpTable.Call(0, uintptr(unsafe.Pointer(&size)), 1, afINET, udpTableOwnerPID, 0) //nolint:errcheck
	if size < 4 {
		size = 4096
	}

	for attempt := 0; attempt < 3; attempt++ {
		buf := make([]byte, size)
		ret, _, _ := procGetExtendedUdpTable.Call(
			uintptr(unsafe.Pointer(&buf[0])),
			uintptr(unsafe.Pointer(&size)),
			1, // bOrder = sorted
			afINET,
			udpTableOwnerPID,
			0,
		)
		if ret == 122 { // ERROR_INSUFFICIENT_BUFFER
			size *= 2
			continue
		}
		if ret != 0 {
			return 0, fmt.Errorf("GetExtendedUdpTable: error %d", ret)
		}

		// Layout: [numEntries uint32][rows: LocalAddr uint32, LocalPort uint32, PID uint32] ...
		if len(buf) < 4 {
			return 0, fmt.Errorf("buffer too small")
		}
		numEntries := binary.LittleEndian.Uint32(buf[:4])

		const rowSize = 12
		for i := uint32(0); i < numEntries; i++ {
			off := 4 + i*rowSize
			if int(off+rowSize) > len(buf) {
				break
			}
			// Port is stored big-endian in the low 16 bits of a uint32 field
			rawPort := binary.LittleEndian.Uint32(buf[off+4 : off+8])
			entryPort := uint16(rawPort>>8) | uint16(rawPort&0xff)<<8
			if entryPort == port {
				pid := binary.LittleEndian.Uint32(buf[off+8 : off+12])
				return pid, nil
			}
		}
		return 0, fmt.Errorf("port %d not found in UDP table", port)
	}
	return 0, fmt.Errorf("GetExtendedUdpTable: buffer never large enough")
}

// GetProcessName returns the executable filename (e.g. "chrome.exe") for a PID.
func GetProcessName(pid uint32) (string, error) {
	handle, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return "", fmt.Errorf("OpenProcess %d: %w", pid, err)
	}
	defer windows.CloseHandle(handle)

	var buf [windows.MAX_PATH]uint16
	size := uint32(len(buf))
	if err := windows.QueryFullProcessImageName(handle, 0, &buf[0], &size); err != nil {
		return "", fmt.Errorf("QueryFullProcessImageName: %w", err)
	}

	fullPath := windows.UTF16ToString(buf[:size])
	return filepath.Base(fullPath), nil
}
