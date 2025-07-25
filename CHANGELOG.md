# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-01-21

### Fixed
- Updated README.md with correct v0.3.0 GitHub Action version reference
- Updated test count from 193 to 221 tests in documentation
- Ensured all documentation reflects the latest features and capabilities

### Documentation
- GitHub Action example now shows `@v0.3.0` for proper version pinning
- Test suite statistics updated to reflect current count (221 tests)
- All features properly documented including Custom Rules API

## [0.3.0] - 2025-01-21

### Added
- 🔌 **Custom Rules API**: Extensible plugin system for creating custom validation rules
  - Abstract `CustomRule` base class for implementing custom validation logic
  - `RuleRegistry` for centralized rule management and discovery
  - `PluginLoader` for dynamic loading of custom rule plugins
  - Plugin validation and error handling with comprehensive error messages
  - Configuration system for enabling/disabling custom rules
  - Category-based rule organization and filtering
  - Plugin metadata and statistics tracking

- 📚 **Plugin Development Kit**: Complete framework for building custom rules
  - Well-defined plugin interface with `Plugin` and `PluginModule` types
  - Example plugin demonstrating best practices (`no-swearing-plugin`)
  - Auto-fix capability support for custom rules
  - Rule options validation and configuration
  - Plugin lifecycle management (load/unload/reload)

- 🛠️ **Enhanced Auto-fix System**: Extended auto-fix to support custom rules
  - Integration of custom rule fixes with built-in fix system
  - Priority-based fix application to avoid conflicts
  - Support for multiple fixes per violation from custom rules
  - Enhanced list marker standardization fixes
  - Improved code block language detection and fixing

### Enhanced
- **CLI Integration**: Seamless integration of custom rules into existing lint command
  - Plugin loading from configuration files
  - Custom rule status reporting and diagnostics
  - Error handling for plugin loading failures
  - Performance metrics for plugin operations

- **Documentation**: Comprehensive guides and examples
  - Custom rule development tutorial
  - Plugin architecture documentation
  - Example configurations and usage patterns
  - API reference for custom rule development

### Technical
- Added 4 new core classes: `CustomRule`, `RuleRegistry`, `PluginLoader`, `PluginModule`
- Enhanced `AutoFixer` with custom rule integration
- Updated CLI command with plugin system support
- Added comprehensive test coverage for all new features (60+ new tests)
- Maintained full backward compatibility with existing configurations

## [0.2.0] - 2025-01-21

### Added
- 🔧 **Configuration File Support**: Load settings from `.cclintrc.json` or `package.json`
  - Customizable rule settings and severity levels
  - Project-specific rule configurations
  - Support for extending configurations
  - Ignore patterns for excluding files
  
- 🛠️ **Auto-fix Functionality**: Automatically fix common formatting issues with `--fix` flag
  - Fix missing spaces after headers
  - Remove trailing whitespace
  - Remove excessive empty lines
  - Intelligent fix application with detailed reporting

- 🪝 **Git Hooks Integration**: Pre-commit validation support
  - Install hooks with `cclint install --hooks`
  - Automatic CLAUDE.md validation before commits
  - Prevent commits with linting errors
  - Easy integration with existing git workflows

- 🤖 **GitHub Action Support**: CI/CD integration for automated linting
  - Ready-to-use GitHub Action via `action.yml`
  - Configurable inputs for files, format, and error handling
  - Detailed output with error and warning counts
  - Example workflows provided

### Changed
- Updated package name from `cc-linter` to `cclint` for consistency
- Enhanced CLI command structure with new `install` command
- Improved error messages and output formatting

### Fixed
- GitHub Actions workflow using correct action versions
- Package-lock.json generation for CI builds

### Developer Experience
- Added comprehensive test coverage for all new features
- Maintained 100% backward compatibility
- Enhanced documentation with configuration examples
- Added example files for quick setup

## [0.1.2] - 2025-01-21

### Fixed
- Initial npm publication setup

## [0.1.1] - 2025-01-21

### Fixed
- GitHub Actions release workflow

## [0.1.0] - 2025-01-21

### Added
- Initial release of CC Linter
- Core linting engine with four built-in rules:
  - **File Size Rule**: Validates file size limits
  - **Structure Rule**: Ensures required sections are present
  - **Content Rule**: Checks for essential content patterns
  - **Format Rule**: Validates Markdown syntax and formatting
- Command-line interface with text and JSON output formats
- TypeScript implementation with clean architecture
- Comprehensive test suite with 91+ tests
- Basic documentation and examples

[0.3.1]: https://github.com/felixgeelhaar/cclint/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/felixgeelhaar/cclint/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/felixgeelhaar/cclint/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/felixgeelhaar/cclint/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/felixgeelhaar/cclint/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/felixgeelhaar/cclint/releases/tag/v0.1.0