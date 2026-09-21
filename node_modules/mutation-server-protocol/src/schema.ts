/**
 * Use named imports to improve tree-shaking capabilities.
 */
import {
  array,
  number,
  object,
  string,
  enum as enum_,
  type z,
  boolean,
  record,
} from 'zod';

export const ConfigureParams = object({
  /**
   * The (relative or absolute) path to mutation testing framework's config file to load.
   */
  configFilePath: string().optional(),
});
export type ConfigureParams = z.infer<typeof ConfigureParams>;

export const ConfigureResult = object({
  /**
   * The mutation testing server protocol major version that the server supports.
   * For example, "1"
   */
  version: string(),
});

export type ConfigureResult = z.infer<typeof ConfigureResult>;

const Position = object({
  line: number(),
  column: number(),
});

export const Location = object({
  start: Position,
  end: Position,
});

export type Location = z.infer<typeof Location>;

/**
 * Represents a file or directory and an optional range within that file.
 */
export const FileRange = object({
  /**
   * File or directory path. A path ending in `/` indicates a directory.
   */
  path: string(),

  /**
   * Optional code range within the file. If omitted, the entire file is considered.
   */
  range: Location.optional(),
});

export type FileRange = z.infer<typeof FileRange>;

export const DiscoverParams = object({
  /**
   * The files or directories to run discovery on, or undefined to discover all files in the current project.
   */
  files: array(FileRange).optional(),
});

export type DiscoverParams = z.infer<typeof DiscoverParams>;

export const DiscoveredMutant = object({
  id: string(),
  location: Location,
  description: string().optional(),
  mutatorName: string(),
  replacement: string().optional(),
});

export type DiscoveredMutant = z.infer<typeof DiscoveredMutant>;

export const DiscoveredFile = object({ mutants: array(DiscoveredMutant) });

export type DiscoveredFile = z.infer<typeof DiscoveredFile>;

export const DiscoveredFiles = record(string(), DiscoveredFile);

export type DiscoveredFiles = z.infer<typeof DiscoveredFiles>;

export const DiscoverResult = object({
  files: DiscoveredFiles,
});

export type DiscoverResult = z.infer<typeof DiscoverResult>;

/**
 * The specific targets to run mutation testing on, or if both properties are left undefined: run mutation testing on all files in the current project.
 * Only one of the two properties should be set.
 * If both properties are set, the `mutants` property takes precedence.
 */
export const MutationTestParams = object({
  /**
   * Specific source files or directories to run mutation testing on, optionally scoped by range.
   * If both `files` and `mutants` are omitted, all discovered files will be tested.
   */
  files: array(FileRange).optional(),
  /**
   * Specific previously discovered mutants to run mutation testing on,
   * as returned from the `discover` step.
   */
  mutants: DiscoveredFiles.optional(),
});

export type MutationTestParams = z.infer<typeof MutationTestParams>;

const MutantStatus = enum_([
  'Killed',
  'Survived',
  'NoCoverage',
  'CompileError',
  'RuntimeError',
  'Timeout',
  'Ignored',
  'Pending',
]);

export type MutantStatus = z.infer<typeof MutantStatus>;

export const MutantResult = DiscoveredMutant.extend({
  /**
   * The test ids that covered this mutant. If a mutation testing framework doesn't measure this information, it can simply be left out.
   */
  coveredBy: array(string()).optional(),
  /**
   * The net time it took to test this mutant in milliseconds. This is the time measurement without overhead from the mutation testing framework.
   */
  duration: number().optional(),
  /**
   * The test ids that killed this mutant. It is a best practice to "bail" on first failing test, in which case you can fill this array with that one test.
   */
  killedBy: array(string()).optional(),
  /**
   * A static mutant means that it was loaded once at during initialization, this makes it slow or even impossible to test, depending on the mutation testing framework.
   */
  static: boolean().optional(),
  /**
   * The status of the mutant.
   */
  status: MutantStatus,
  /**
   * The reason that this mutant has this status as free-format text. In the case of a killed mutant, this should be filled with the failure message(s) of the failing tests. In case of an error mutant, this should be filled with the error message.
   */
  statusReason: string().optional(),
  /**
   * The number of tests actually completed in order to test this mutant. Can differ from "coveredBy" because of bailing a mutant test run after first failing test.
   */
  testsCompleted: number().optional(),
});

export type MutantResult = z.infer<typeof MutantResult>;

export const MutantResultFile = object({ mutants: array(MutantResult) });

export type MutantResultFile = z.infer<typeof MutantResultFile>;

export const MutationResultFiles = record(string(), MutantResultFile);

export type MutationResultFiles = z.infer<typeof MutationResultFiles>;

export const MutationTestResult = object({
  files: MutationResultFiles,
});

export type MutationTestResult = z.infer<typeof MutationTestResult>;
