export interface RefreshTokenRecord {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IRefreshTokenRepository {
  create(data: { token: string; userId: string; expiresAt: Date }): Promise<RefreshTokenRecord>;
  findByToken(token: string): Promise<RefreshTokenRecord | null>;
  deleteByToken(token: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
