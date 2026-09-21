# Mutation Server Protocol Specification

The Mutation Server Protocol (MSP) provides a unified way for IDEs and other tools to communicate with mutation testing frameworks to run mutation testing and report the progress.

> [!NOTE]  
> Inspired by the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/overviews/lsp/overview/)

This document describes the mutation server protocol.

## Base Protocol

The base protocol exchanges [JSON-RPC 2.0](https://www.jsonrpc.org/) messages between the client and the server. The protocol supports two transport modes:

1. **Standard Input/Output (stdio)**
2. **TCP/IP Socket connection**

The server must answer each request from the client with a response. The server may also send notifications to the client. The protocol is designed to be language agnostic and can be used with any programming language.

### Transport Requirements

Mutation server implementations must support both transport modes to ensure consistency and guarantee that all clients and servers can communicate reliably.

### stdio Transport

When using stdio transport:

1. The server reads JSON-RPC requests from standard input
2. The server writes JSON-RPC responses and notifications to standard output

The server must not write any logging or debugging information to standard output. The channel should exclusively be used for JSON-RPC message exchange. Logging and debugging information should be written to standard error (stderr) instead.

### Socket Transport

When using socket transport:

1. The server opens a socket on the **host and port** specified via command line arguments (`--port` and `--address`). If no address is provided, the server defaults to `localhost` as the host.
2. If the specified port is already in use, the server must exit with an error.
3. The server accepts incoming client connections on this socket.
4. JSON-RPC messages are exchanged over the socket connection.

### Server Startup Options

Mutation servers must support the following command-line format:

```bash
./server serve <channel> [--port <port>] [--address <address>] [-- <args>]
```

- `<channel>` - Specify the transport channel: `stdio` or `socket`. (required)
- `--port <port>` - Port number for socket transport (required when using `socket` channel)
- `--address <address>` - Host address for socket transport (optional, defaults to `localhost` when using `socket` channel)
- `[-- <args>]` - Add other arguments here (mutation server specific).

> [!TIP]
> Locations are reported as part of the messages are always 1-based. The first line in a file is 1, and the first column in a line is 1.

### Message Format Example

```
Content-Length: ...\r\n
\r\n
{
	"jsonrpc": "2.0",
	"id": 1,
	"method": "discover",
	"params": {
		...
	}
}
```

The message above shows the standard format for all transport modes. Each message contains a `Content-Length` header that specifies the length of the JSON content part. The message is encoded as UTF-8.

## Position and Location Semantics

Mutation locations and ranges are defined using a `start` and `end` position and must adhere to the [mutation-testing-report-schema](https://github.com/stryker-mutator/mutation-testing-elements/blob/master/packages/report-schema/src/mutation-testing-report-schema.json):

- `start` is **inclusive**: the character at this position is included.
- `end` is **exclusive**: the character at this position is not included.

## Targeting mutants

The `discover` and `mutationTest` methods both support **targeting specific files or code regions**, using structured input in the form of `FileRange` objects.

- The **`discover`** method accepts an optional `files` array of [`FileRange`](#discover) objects, referring to specific files (optionally scoped by a range) or directories.
- The **`mutationTest`** method accepts two optional fields. If both are omitted, mutation testing runs across all discovered files:
  - **`files`**: an array of [`FileRange`](#mutationtest) objects
  - **`mutants`**: a map of specific mutants, discovered via a prior `discover` call.

```ts
type FileRange = {
  /**
   * File or directory path. A path ending in `/` indicates a directory.
   */
  path: string;

  /**
   * Optional code range within the file to limit discovery to.
   * If omitted, the entire file is considered.
   */
  range?: Location;
};
```

The server must gracefully handle non-existent files or directories by ignoring them without returning errors. Files that cannot be mutated should also be ignored during discovery and mutation testing operations.

### FileRange Examples

Examples of how `FileRange` objects can be used in `discover` or `mutationTest` calls:

```ts
// Run on an entire file
{
  path: "src/app.js"
}

// Run on all files in a directory
{
  path: "src/components/"
}

// Run on a specific line and column range within a file
{
  path: "src/app.js",
  range: {
    start: { line: 1, column: 1 },
    end: { line: 11, column: 1 } // exclusive
  }
}
```

## Methods

The MSP defines the following methods:

- [`configure`](#configure): Configure the server. Editor plugins are expected to call this on startup, but it can also be called subsequently to change the configuration.
- [`discover`](#discover): Discovers mutants in the given file paths.
- [`mutationTest`](#mutationtest): The method to start a mutation test run.

### Configure

The `configure` method is used to configure the server. The server must respond with a `ConfigureResult` message.

```ts
export interface ConfigureParams {
  /**
   * The (relative or absolute) path to mutation testing framework's config file to load.
   */
  configFilePath?: string;
}

export interface ConfigureResult {
  /**
   * The mutation testing server protocol major version that the client supports (major)
   * For example, "1"
   */
  version: string;
}
```

### Discover

The `discover` method is used to discover mutants in the given file paths. The server must respond with a `DiscoverResult` message.

The `DiscoveredMutant` type is a subset of the `MutantResult` type. The `MutantResult` is the type that can be found in the [mutation testing report schema](https://github.com/stryker-mutator/mutation-testing-elements/blob/2902d56301cfdaa8ad2be59f3bca07bdf96f89b4/packages/report-schema/src/mutation-testing-report-schema.json#L37).

```ts
type DiscoverParams = {
  /**
   * The files or directories to run discovery on, or undefined to discover all files in the current project.
   * Each scope contains a path and an optional mutation range.
   */
  files?: FileRange[];
};

type DiscoverResult = {
  files: DiscoveredFiles;
};

type DiscoveredFiles = Record<string, DiscoveredFile>;

type DiscoveredFile = {
  mutants: DiscoveredMutant[];
};

type DiscoveredMutant = {
  id: string;
  location: Location;
  description?: string;
  mutatorName: string;
  replacement?: string;
};

type Location = {
  start: Position;
  end: Position;
};

type Position = {
  line: number;
  column: number;
};
```

### MutationTest

The `mutationTest` method starts a mutation test run. The server must respond with a `MutationTestResult` message.

Whenever a partial result is in, the server is expected to send a `reportMutationTestProgress` notification with the partial result as `MutationTestResult`.

> [!NOTE]
> The MutantResult should adhere to the [mutation testing report schema](https://github.com/stryker-mutator/mutation-testing-elements/blob/2902d56301cfdaa8ad2be59f3bca07bdf96f89b4/packages/report-schema/src/mutation-testing-report-schema.json#L37)

```ts
/**
 * The specific targets to run mutation testing on, or if both properties are left undefined: run mutation testing on all files in the current project.
 * Only one of the two properties should be set.
 * If both properties are set, the `mutants` property takes precedence.
 */
type MutationTestParams = {
  /**
   * Specific source files or directories to run mutation testing on, optionally scoped by range.
   * If both `files` and `mutants` are omitted, all discovered files will be tested.
   */
  files?: FileRange[];

  /**
   * Specific previously discovered mutants to run mutation testing on,
   * as returned from the `discover` step.
   */
  mutants?: DiscoveredFiles;
};

type MutationTestResult = {
  files: MutantResultFiles;
};

type MutantResultFiles = Record<string, MutantResultFile>;

type MutantResultFile = {
  mutants: MutantResult[];
};

type MutantResult = DiscoveredMutant & {
  coveredBy?: string[];
  duration?: number;
  killedBy?: string[];
  static?: boolean;
  status: MutantStatus;
  statusReason?: string;
  testsCompleted?: number;
};

type MutantStatus =
  | 'Killed'
  | 'Survived'
  | 'NoCoverage'
  | 'Timeout'
  | 'CompileError'
  | 'RuntimeError';
```

## Error messages

TODO
