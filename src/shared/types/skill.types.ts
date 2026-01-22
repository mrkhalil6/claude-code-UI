export interface SkillMetadata {
  name?: string;
  description?: string;
  'allowed-tools'?: string[];
  [key: string]: unknown;
}

export interface Skill {
  id: string;           // Folder name
  name: string;         // Display name from frontmatter or folder name
  description?: string;
  path: string;
  content: string;      // Raw SKILL.md content
  metadata: SkillMetadata;
  modifiedAt: Date;
}

export interface SkillPayload {
  id: string;
  content: string;
}
