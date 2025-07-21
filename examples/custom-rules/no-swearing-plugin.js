/**
 * Example Custom Rule Plugin: No Swearing Rule
 * 
 * This plugin demonstrates how to create custom rules for cclint.
 * It detects inappropriate language and provides auto-fix suggestions.
 */

import { CustomRule } from '@felixgeelhaar/cclint';

class NoSwearingRule extends CustomRule {
  constructor() {
    super('no-swearing', 'Detects and flags inappropriate language', {
      category: 'content',
      version: '1.0.0',
    });

    // List of words to flag (keeping it mild for example)
    this.forbiddenWords = [
      'damn',
      'crap',
      'stupid',
      'dumb',
    ];

    // Replacement suggestions
    this.replacements = {
      'damn': 'darn',
      'crap': 'stuff',
      'stupid': 'unwise',
      'dumb': 'unclear',
    };
  }

  validateInternal(file) {
    const violations = [];
    const lines = file.lines;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();

      for (const word of this.forbiddenWords) {
        const index = lowerLine.indexOf(word);
        if (index !== -1) {
          violations.push({
            ruleId: this.id,
            message: `Inappropriate language detected: "${word}"`,
            severity: 'warning', // warning level
            location: {
              line: i + 1,
              column: index + 1,
            },
          });
        }
      }
    }

    return violations;
  }

  generateFixes(violations, content) {
    const fixes = [];
    const lines = content.split('\n');

    for (const violation of violations) {
      if (violation.ruleId !== this.id) continue;

      const lineIndex = violation.location.line - 1;
      const line = lines[lineIndex];
      
      // Extract the forbidden word from the message
      const wordMatch = violation.message.match(/detected: "(.+?)"/);
      if (wordMatch && wordMatch[1]) {
        const forbiddenWord = wordMatch[1];
        const replacement = this.replacements[forbiddenWord];
        
        if (replacement) {
          const wordIndex = line.toLowerCase().indexOf(forbiddenWord.toLowerCase());
          if (wordIndex !== -1) {
            fixes.push({
              range: {
                start: { line: violation.location.line, column: wordIndex + 1 },
                end: { line: violation.location.line, column: wordIndex + forbiddenWord.length + 1 },
              },
              text: replacement,
              description: `Replace "${forbiddenWord}" with "${replacement}"`,
            });
          }
        }
      }
    }

    return fixes;
  }

  validateOptions(options) {
    // Custom validation for plugin options
    if (options.customWords && !Array.isArray(options.customWords)) {
      return false;
    }
    return true;
  }
}

class LinkCheckerRule extends CustomRule {
  constructor() {
    super('check-links', 'Validates that HTTP links use HTTPS', {
      category: 'security',
      version: '1.0.0',
    });
  }

  validateInternal(file) {
    const violations = [];
    const lines = file.lines;
    const httpLinkRegex = /http:\/\/[^\s\)]+/gi;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      while ((match = httpLinkRegex.exec(line)) !== null) {
        violations.push({
          ruleId: this.id,
          message: `Insecure HTTP link detected: ${match[0]}`,
          severity: 'error',
          location: {
            line: i + 1,
            column: match.index + 1,
          },
        });
      }
    }

    return violations;
  }

  generateFixes(violations, content) {
    const fixes = [];
    const lines = content.split('\n');

    for (const violation of violations) {
      if (violation.ruleId !== this.id) continue;

      const lineIndex = violation.location.line - 1;
      const line = lines[lineIndex];
      
      // Find HTTP links and suggest HTTPS replacements
      const httpMatch = line.match(/http:\/\/[^\s\)]+/gi);
      if (httpMatch) {
        for (const httpUrl of httpMatch) {
          const httpsUrl = httpUrl.replace('http://', 'https://');
          const startIndex = line.indexOf(httpUrl);
          
          fixes.push({
            range: {
              start: { line: violation.location.line, column: startIndex + 1 },
              end: { line: violation.location.line, column: startIndex + httpUrl.length + 1 },
            },
            text: httpsUrl,
            description: `Replace HTTP with HTTPS: ${httpsUrl}`,
          });
        }
      }
    }

    return fixes;
  }
}

// Plugin export
export default {
  name: 'example-content-rules',
  version: '1.0.0',
  description: 'Example custom rules for content validation',
  author: 'cclint team',
  rules: [
    new NoSwearingRule(),
    new LinkCheckerRule(),
  ],
  dependencies: [],
};