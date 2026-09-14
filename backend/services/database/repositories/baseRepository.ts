/**
 * @file baseRepository.ts
 * @description Canonical Base Repository for Drizzle ORM Database Boundaries.
 * Conforms to APP_ARCHITECTURE_SPEC Section 20 & < 200 lines.
 */

export interface RepositoryEntity {
  id: string;
  createdAt?: number;
  updatedAt?: number;
}

export abstract class BaseRepository<T extends RepositoryEntity> {
  protected items: Map<string, T> = new Map();

  public async findById(id: string): Promise<T | null> {
    return this.items.get(id) || null;
  }

  public async findAll(): Promise<T[]> {
    return Array.from(this.items.values());
  }

  public async create(entity: T): Promise<T> {
    this.items.set(entity.id, entity);
    return entity;
  }

  public async update(id: string, partial: Partial<T>): Promise<T | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...partial, updatedAt: Date.now() };
    this.items.set(id, updated);
    return updated;
  }

  public async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}
