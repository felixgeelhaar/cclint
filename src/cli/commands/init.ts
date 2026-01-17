import { Command } from 'commander';
import { existsSync } from 'fs';
import { resolve, basename } from 'path';
import { ProjectDetector } from '../../infrastructure/ProjectDetector.js';
import {
  Scaffolder,
  type TemplateName,
} from '../../infrastructure/Scaffolder.js';

interface InitOptions {
  template?: string;
  detect: boolean;
  force: boolean;
  output: string;
  yes: boolean;
}

/**
 * Validates that a string is a valid template name
 */
function isValidTemplate(name: string): name is TemplateName {
  const valid: TemplateName[] = [
    'minimal',
    'typescript',
    'python',
    'go',
    'monorepo',
    'library',
    'api',
  ];
  return valid.includes(name as TemplateName);
}

export const initCommand = new Command('init')
  .description('Create a new CLAUDE.md file')
  .option(
    '-t, --template <name>',
    'Template to use (minimal, typescript, python, go, monorepo, library, api)'
  )
  .option('--detect', 'Auto-detect project type', false)
  .option('-f, --force', 'Overwrite existing CLAUDE.md', false)
  .option('-o, --output <path>', 'Output path', 'CLAUDE.md')
  .option('-y, --yes', 'Skip confirmation prompts', false)
  .action((options: InitOptions) => {
    try {
      const outputPath = resolve(process.cwd(), options.output);
      const scaffolder = new Scaffolder();

      // Check if file exists
      if (existsSync(outputPath) && !options.force) {
        console.error(
          `Error: ${options.output} already exists. Use --force to overwrite.`
        );
        process.exit(1);
      }

      let template: TemplateName = 'minimal';
      let projectName = basename(process.cwd());
      let projectDescription = 'A brief description of the project.';
      let detectionResult = undefined;

      // Validate template if provided
      if (options.template) {
        if (!isValidTemplate(options.template)) {
          console.error(
            `Error: Invalid template "${options.template}". ` +
              `Available templates: ${scaffolder.listTemplates().join(', ')}`
          );
          process.exit(1);
        }
        template = options.template;
      }

      // Auto-detect project type
      if (options.detect || !options.template) {
        console.log('🔍 Analyzing project...');
        const detector = new ProjectDetector(process.cwd());
        detectionResult = detector.detect();

        if (detectionResult.confidence > 0) {
          console.log(`   Type: ${detectionResult.type}`);
          console.log(`   Structure: ${detectionResult.structure}`);
          console.log(
            `   Confidence: ${Math.round(detectionResult.confidence * 100)}%`
          );
          console.log(`   Evidence: ${detectionResult.evidence.join(', ')}`);

          if (detectionResult.projectName) {
            projectName = detectionResult.projectName;
          }
          if (detectionResult.projectDescription) {
            projectDescription = detectionResult.projectDescription;
          }

          // Use detected template if not explicitly specified
          if (!options.template) {
            template = scaffolder.getTemplateForDetection(detectionResult);
            console.log(`\n📝 Selected template: ${template}`);
          }
        } else {
          console.log(
            '   Could not detect project type, using minimal template.'
          );
        }
        console.log('');
      }

      // Scaffold the file
      console.log(`📄 Creating ${options.output}...`);

      const result = scaffolder.scaffold({
        template,
        projectName,
        projectDescription,
        overwrite: options.force,
        outputPath,
        detection: detectionResult,
      });

      if (result.wasOverwritten) {
        console.log(`✅ Overwrote ${result.path}`);
      } else {
        console.log(`✅ Created ${result.path}`);
      }

      console.log('');
      console.log('Next steps:');
      console.log('  1. Review and customize the generated CLAUDE.md');
      console.log('  2. Run `cclint lint CLAUDE.md` to validate');
      console.log('');
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Error: Unknown error occurred');
      }
      process.exit(1);
    }
  });
