import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  ChapterRepository,
  createProjectDatabase,
  PROJECT_DATABASE_FILE,
  runProjectMigrations,
  type ChapterRecord,
  type ChapterVersionRecord,
} from "@story-pilot/db";
import { createNextChapterVersion } from "@story-pilot/domain";

import { ProjectStorageService } from "../storage/project-storage.service.js";

export interface CreateChapterInput {
  readonly projectId: string;
  readonly volumeId: string;
  readonly title: string;
  readonly summary?: string;
  readonly sortOrder?: number;
}

export interface SaveChapterContentInput {
  readonly projectId: string;
  readonly chapterId: string;
  readonly content: string;
  readonly baseVersion: number;
}

export interface ListChapterVersionsInput {
  readonly projectId: string;
  readonly chapterId: string;
}

@Injectable()
export class ChapterService {
  constructor(private readonly projectStorage: ProjectStorageService) {}

  async createChapter(input: CreateChapterInput): Promise<ChapterRecord> {
    const projectDatabase = await this.openProjectDatabase(input.projectId);
    try {
      return new ChapterRepository(projectDatabase).createChapter({
        chapterId: randomUUID(),
        projectId: input.projectId,
        title: input.title,
        volumeId: input.volumeId,
        ...(input.sortOrder === undefined ? {} : { position: input.sortOrder }),
        ...(input.summary === undefined ? {} : { summary: input.summary }),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async getChapter(projectId: string, chapterId: string): Promise<ChapterRecord> {
    const projectDatabase = await this.openProjectDatabase(projectId);
    try {
      const chapter = new ChapterRepository(projectDatabase).getById(projectId, chapterId);
      if (!chapter) {
        throw new Error(`CHAPTER_NOT_FOUND: ${chapterId}`);
      }

      return chapter;
    } finally {
      projectDatabase.close();
    }
  }

  async saveContent(input: SaveChapterContentInput): Promise<ChapterRecord> {
    const projectDatabase = await this.openProjectDatabase(input.projectId);
    try {
      const repository = new ChapterRepository(projectDatabase);
      const chapter = repository.getById(input.projectId, input.chapterId);
      if (!chapter) {
        throw new Error(`CHAPTER_NOT_FOUND: ${input.chapterId}`);
      }

      return repository.saveContent({
        baseVersion: input.baseVersion,
        chapterId: input.chapterId,
        content: input.content,
        nextVersion: createNextChapterVersion(chapter.version),
        projectId: input.projectId,
        source: "user",
        versionId: randomUUID(),
      });
    } finally {
      projectDatabase.close();
    }
  }

  async listVersions(input: ListChapterVersionsInput): Promise<ChapterVersionRecord[]> {
    const projectDatabase = await this.openProjectDatabase(input.projectId);
    try {
      return new ChapterRepository(projectDatabase).listVersions(input.projectId, input.chapterId);
    } finally {
      projectDatabase.close();
    }
  }

  private async openProjectDatabase(projectId: string) {
    const projectRoot = this.projectStorage.getProjectRootPath(projectId);
    const projectDatabase = createProjectDatabase(`${projectRoot}/${PROJECT_DATABASE_FILE}`);
    await runProjectMigrations(projectDatabase);
    return projectDatabase;
  }
}
