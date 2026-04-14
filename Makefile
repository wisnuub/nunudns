BINARY  := nunudns
VERSION := 1.0.0
LDFLAGS := -ldflags "-s -w -X main.version=$(VERSION)"

.PHONY: build build-windows build-gui-windows tidy test clean

## build: build for the current OS
build:
	go build $(LDFLAGS) -o $(BINARY) ./cmd/nunudns

## build-windows: cross-compile for Windows (amd64)
build-windows:
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) \
		-o $(BINARY).exe ./cmd/nunudns

## build-windows-arm: cross-compile for Windows (arm64)
build-windows-arm:
	GOOS=windows GOARCH=arm64 go build $(LDFLAGS) \
		-o $(BINARY)-arm64.exe ./cmd/nunudns

## tidy: tidy and verify Go modules
tidy:
	go mod tidy
	go mod verify

## test: run unit tests
test:
	go test ./...

## build-gui-windows: cross-compile GUI binary for Windows using fyne-cross (requires fyne-cross or mingw-w64)
## With fyne-cross: fyne-cross windows -arch amd64 ./cmd/nunudns
## With mingw-w64:  CC=x86_64-w64-mingw32-gcc CGO_ENABLED=1 GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(BINARY)-gui.exe ./cmd/nunudns
build-gui-windows:
	@echo "Building GUI binary for Windows..."
	@if command -v fyne-cross >/dev/null 2>&1; then \
		fyne-cross windows -arch amd64 ./cmd/nunudns; \
	elif command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1; then \
		CC=x86_64-w64-mingw32-gcc CGO_ENABLED=1 GOOS=windows GOARCH=amd64 \
		go build $(LDFLAGS) -o $(BINARY)-gui.exe ./cmd/nunudns; \
	else \
		echo "Install fyne-cross (go install fyne.io/fyne/v2/cmd/fyne-cross@latest) or mingw-w64 to build."; \
		exit 1; \
	fi

## clean: remove build artefacts
clean:
	rm -f $(BINARY) $(BINARY).exe $(BINARY)-arm64.exe $(BINARY)-gui.exe
