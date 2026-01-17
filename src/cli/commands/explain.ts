import { Command } from 'commander';
import {
  getRuleMetadata,
  getAllRuleIds,
  isValidRule,
  type RuleMetadata,
} from '../../infrastructure/RuleMetadata.js';

/**
 * Format rule metadata for display
 */
function formatRuleDetails(rule: RuleMetadata): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('━'.repeat(60));
  lines.push(`📋 ${rule.name} (${rule.id})`);
  lines.push('━'.repeat(60));
  lines.push('');

  // Description and rationale
  lines.push(`📝 Description:`);
  lines.push(`   ${rule.description}`);
  lines.push('');
  lines.push(`💡 Rationale:`);
  wrapText(rule.rationale, 55).forEach(line => {
    lines.push(`   ${line}`);
  });
  lines.push('');

  // Properties
  lines.push(`⚙️  Properties:`);
  lines.push(`   Severity: ${rule.defaultSeverity.toUpperCase()}`);
  lines.push(`   Fixable:  ${rule.fixable ? '✅ Yes' : '❌ No'}`);
  lines.push('');

  // Bad examples
  if (rule.badExamples.length > 0) {
    lines.push(`❌ Bad Examples:`);
    rule.badExamples.forEach((example, idx) => {
      lines.push(`   ${idx + 1}. ${example.explanation}`);
      lines.push('      ```');
      example.code.split('\\n').forEach(codeLine => {
        lines.push(`      ${codeLine}`);
      });
      lines.push('      ```');
    });
    lines.push('');
  }

  // Good examples
  if (rule.goodExamples.length > 0) {
    lines.push(`✅ Good Examples:`);
    rule.goodExamples.forEach((example, idx) => {
      lines.push(`   ${idx + 1}. ${example.explanation}`);
      lines.push('      ```');
      example.code.split('\\n').forEach(codeLine => {
        lines.push(`      ${codeLine}`);
      });
      lines.push('      ```');
    });
    lines.push('');
  }

  // Options
  if (rule.options && rule.options.length > 0) {
    lines.push(`🔧 Configuration Options:`);
    rule.options.forEach(option => {
      lines.push(`   ${option.name} (${option.type})`);
      lines.push(`     Default: ${option.default}`);
      lines.push(`     ${option.description}`);
    });
    lines.push('');
  }

  // Related rules
  if (rule.related && rule.related.length > 0) {
    lines.push(`🔗 Related Rules: ${rule.related.join(', ')}`);
    lines.push('');
  }

  // References
  if (rule.references && rule.references.length > 0) {
    lines.push(`📚 References:`);
    rule.references.forEach(ref => {
      lines.push(`   • ${ref}`);
    });
    lines.push('');
  }

  lines.push('━'.repeat(60));

  return lines.join('\n');
}

/**
 * List all available rules
 */
function formatRuleList(): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('━'.repeat(60));
  lines.push('📋 Available Rules');
  lines.push('━'.repeat(60));
  lines.push('');

  const ruleIds = getAllRuleIds();

  // Group rules by severity
  const errorRules: string[] = [];
  const warningRules: string[] = [];
  const infoRules: string[] = [];

  ruleIds.forEach(id => {
    const rule = getRuleMetadata(id);
    if (rule) {
      switch (rule.defaultSeverity) {
        case 'error':
          errorRules.push(id);
          break;
        case 'warning':
          warningRules.push(id);
          break;
        case 'info':
          infoRules.push(id);
          break;
      }
    }
  });

  if (errorRules.length > 0) {
    lines.push('🔴 Error Rules:');
    errorRules.forEach(id => {
      const rule = getRuleMetadata(id);
      if (rule) {
        const fixable = rule.fixable ? ' [fixable]' : '';
        lines.push(`   • ${id.padEnd(25)} ${rule.name}${fixable}`);
      }
    });
    lines.push('');
  }

  if (warningRules.length > 0) {
    lines.push('🟡 Warning Rules:');
    warningRules.forEach(id => {
      const rule = getRuleMetadata(id);
      if (rule) {
        const fixable = rule.fixable ? ' [fixable]' : '';
        lines.push(`   • ${id.padEnd(25)} ${rule.name}${fixable}`);
      }
    });
    lines.push('');
  }

  if (infoRules.length > 0) {
    lines.push('🔵 Info Rules:');
    infoRules.forEach(id => {
      const rule = getRuleMetadata(id);
      if (rule) {
        const fixable = rule.fixable ? ' [fixable]' : '';
        lines.push(`   • ${id.padEnd(25)} ${rule.name}${fixable}`);
      }
    });
    lines.push('');
  }

  lines.push(`Total: ${ruleIds.length} rules`);
  lines.push('');
  lines.push('Run `cclint explain <rule-id>` for detailed information.');
  lines.push('━'.repeat(60));

  return lines.join('\n');
}

/**
 * Wrap text to specified width
 */
function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);

  return lines;
}

export const explainCommand = new Command('explain')
  .description('Explain a linting rule in detail')
  .argument('[rule-id]', 'The rule ID to explain (omit to list all rules)')
  .option('--json', 'Output as JSON')
  .action((ruleId: string | undefined, options: { json?: boolean }) => {
    if (!ruleId) {
      // List all rules
      if (options.json) {
        const ruleIds = getAllRuleIds();
        const rules = ruleIds.map(id => getRuleMetadata(id));
        console.log(JSON.stringify(rules, null, 2));
      } else {
        console.log(formatRuleList());
      }
      return;
    }

    // Explain specific rule
    if (!isValidRule(ruleId)) {
      console.error(`Error: Unknown rule "${ruleId}".`);
      console.error(`Run 'cclint explain' to see all available rules.`);
      process.exit(1);
    }

    const rule = getRuleMetadata(ruleId);
    if (!rule) {
      console.error(`Error: Could not load metadata for rule "${ruleId}".`);
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify(rule, null, 2));
    } else {
      console.log(formatRuleDetails(rule));
    }
  });
