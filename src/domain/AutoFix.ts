import type { Location } from './Location.js';

export interface Fix {
  range: {
    start: Location;
    end: Location;
  };
  text: string;
  description: string;
}

export interface AutoFixResult {
  fixed: boolean;
  content: string;
  appliedFixes: Fix[];
}
