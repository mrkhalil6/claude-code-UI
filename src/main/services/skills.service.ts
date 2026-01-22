import { readFile, writeFile, readdir, stat, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { Skill, SkillPayload, SkillMetadata } from '../../shared/types';

export class SkillsService {
  private skillsDir: string;

  constructor() {
    this.skillsDir = join(homedir(), '.claude', 'skills');
  }

  /**
   * Parse YAML frontmatter from SKILL.md content
   */
  private parseFrontmatter(content: string): { metadata: SkillMetadata; body: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { metadata: {}, body: content };
    }

    const frontmatter = match[1];
    const body = content.slice(match[0].length);

    // Simple YAML parser for frontmatter
    const metadata: SkillMetadata = {};
    const lines = frontmatter.split('\n');
    let currentKey: string | null = null;
    let currentArrayValue: string[] | null = null;

    for (const line of lines) {
      // Check for array continuation
      if (line.match(/^\s+-\s+(.*)$/)) {
        const arrayItemMatch = line.match(/^\s+-\s+(.*)$/);
        if (arrayItemMatch && currentKey && currentArrayValue !== null) {
          currentArrayValue.push(arrayItemMatch[1].trim());
        }
        continue;
      }

      // Save previous array if exists
      if (currentKey && currentArrayValue !== null) {
        metadata[currentKey] = currentArrayValue;
        currentArrayValue = null;
        currentKey = null;
      }

      // Check for key: value pair
      const keyValueMatch = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
      if (keyValueMatch) {
        const [, key, value] = keyValueMatch;
        if (value.trim() === '') {
          // Start of array or empty value
          currentKey = key;
          currentArrayValue = [];
        } else {
          metadata[key] = value.trim();
        }
      }
    }

    // Save last array if exists
    if (currentKey && currentArrayValue !== null) {
      metadata[currentKey] = currentArrayValue;
    }

    return { metadata, body };
  }

  /**
   * Ensure the skills directory exists
   */
  private async ensureSkillsDir(): Promise<void> {
    try {
      await mkdir(this.skillsDir, { recursive: true });
    } catch (error) {
      // Directory may already exist
    }
  }

  /**
   * List all skills from ~/.claude/skills/
   */
  async listSkills(): Promise<Skill[]> {
    await this.ensureSkillsDir();

    try {
      const entries = await readdir(this.skillsDir, { withFileTypes: true });
      const skills: Skill[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const skill = await this.getSkill(entry.name);
            if (skill) {
              skills.push(skill);
            }
          } catch (error) {
            // Skip invalid skill folders
            console.warn(`Skipping invalid skill folder: ${entry.name}`, error);
          }
        }
      }

      // Sort by modification time (newest first)
      skills.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

      return skills;
    } catch (error) {
      console.error('Failed to list skills:', error);
      return [];
    }
  }

  /**
   * Get a single skill by folder name
   */
  async getSkill(id: string): Promise<Skill | null> {
    const skillDir = join(this.skillsDir, id);
    const skillMdPath = join(skillDir, 'SKILL.md');

    try {
      const content = await readFile(skillMdPath, 'utf-8');
      const fileStat = await stat(skillMdPath);
      const { metadata } = this.parseFrontmatter(content);

      return {
        id,
        name: metadata.name || id,
        description: metadata.description,
        path: skillDir,
        content,
        metadata,
        modifiedAt: fileStat.mtime
      };
    } catch (error) {
      console.error(`Failed to get skill ${id}:`, error);
      return null;
    }
  }

  /**
   * Create a new skill folder with SKILL.md
   */
  async createSkill(payload: SkillPayload): Promise<Skill> {
    const skillDir = join(this.skillsDir, payload.id);
    const skillMdPath = join(skillDir, 'SKILL.md');

    // Check if skill already exists
    try {
      await stat(skillDir);
      throw new Error(`Skill "${payload.id}" already exists`);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Create the skill directory
    await mkdir(skillDir, { recursive: true });

    // Write the SKILL.md content
    await writeFile(skillMdPath, payload.content, 'utf-8');

    // Return the created skill
    const skill = await this.getSkill(payload.id);
    if (!skill) {
      throw new Error('Failed to create skill');
    }

    return skill;
  }

  /**
   * Update an existing skill's SKILL.md content
   */
  async updateSkill(payload: SkillPayload): Promise<Skill> {
    const skillDir = join(this.skillsDir, payload.id);
    const skillMdPath = join(skillDir, 'SKILL.md');

    // Check if skill exists
    try {
      await stat(skillDir);
    } catch (error) {
      throw new Error(`Skill "${payload.id}" does not exist`);
    }

    // Write the updated SKILL.md content
    await writeFile(skillMdPath, payload.content, 'utf-8');

    // Return the updated skill
    const skill = await this.getSkill(payload.id);
    if (!skill) {
      throw new Error('Failed to update skill');
    }

    return skill;
  }

  /**
   * Delete a skill folder
   */
  async deleteSkill(id: string): Promise<boolean> {
    const skillDir = join(this.skillsDir, id);

    try {
      await rm(skillDir, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`Failed to delete skill ${id}:`, error);
      return false;
    }
  }
}
