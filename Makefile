BINARY  := nunudns
VERSION := 1.0.0
LDFLAGS := -ldflags "-s -w -X main.version=$(VERSION)"

.PHONY: build build-windows tidy test clean

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

## clean: remove build artefacts
clean:
	rm -f $(BINARY) $(BINARY).exe $(BINARY)-arm64.exe
