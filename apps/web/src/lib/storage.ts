/**
 * Cloudflare R2 — wrapper sobre AWS SDK S3 v3.
 *
 * R2 é 100% S3-compatible: mesmo SDK, mesma API, só muda o endpoint.
 * Acesso sempre PRIVADO — servimos tudo via signed URLs (TTL 1h).
 *
 * Fluxo de upload:
 *   1. Client → POST /api/upload   (filename, mimeType, size, entityType, entityId)
 *   2. Server → DB record + PUT signed URL
 *   3. Client → PUT direto no R2 (bypassa Next.js, sem limite de 4 MB de body)
 *   4. Client → usa GET /api/upload/[id] para obter URL de download
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import path from "node:path";

// ─── Configuração ─────────────────────────────────────────────────────────────

const R2_ENDPOINT  = process.env.R2_ENDPOINT!;
const R2_BUCKET    = process.env.R2_BUCKET!;
const R2_REGION    = "auto"; // R2 usa sempre "auto"

function getClient(): S3Client {
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials not configured (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region:   R2_REGION,
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    // Força path-style (R2 não suporta virtual-hosted style)
    forcePathStyle: true,
  });
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface StorageUploadParams {
  tenantId:   string;
  entityType: "note" | "visit" | "lead" | "opportunity" | "audio";
  entityId:   string;
  filename:   string;
  mimeType:   string;
}

// ─── Validações ──────────────────────────────────────────────────────────────

/** Tipos MIME aceitos */
const ALLOWED_MIME_PREFIXES = ["image/", "audio/", "video/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export function isAllowedMime(mimeType: string): boolean {
  if (ALLOWED_MIME_EXACT.has(mimeType)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
}

/** Sanitiza o nome do arquivo (remove caracteres perigosos, preserva extensão) */
function sanitizeFilename(filename: string): string {
  const ext  = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const base = path.basename(filename, ext)
    .replace(/[^a-zA-Z0-9_\-. ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return `${base}${ext}`;
}

// ─── Funções principais ───────────────────────────────────────────────────────

/**
 * Gera uma chave R2 única para o objeto:
 * `tenants/{tenantId}/{entityType}/{entityId}/{uuid}_{filename}`
 *
 * O path inclui tenantId para defesa em profundidade (mesmo se a policy do
 * bucket for configurada incorretamente, objetos de tenants diferentes ficam
 * em prefixos distintos).
 */
export function buildObjectKey(params: StorageUploadParams): string {
  const safeFilename = sanitizeFilename(params.filename);
  const uuid = randomUUID().replace(/-/g, "").slice(0, 12);
  return `tenants/${params.tenantId}/${params.entityType}/${params.entityId}/${uuid}_${safeFilename}`;
}

/**
 * Gera uma signed PUT URL para upload direto do browser → R2.
 * TTL: 15 minutos (tempo para o usuário completar o upload).
 */
export async function generateUploadUrl(
  key: string,
  mimeType: string,
  sizeBytes: number,
): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket:        R2_BUCKET,
    Key:           key,
    ContentType:   mimeType,
    ContentLength: sizeBytes,
  });
  return getSignedUrl(client, command, { expiresIn: 15 * 60 });
}

/**
 * Gera uma signed GET URL para download seguro.
 * TTL: 1 hora (suficiente para renderizar a página; nova URL a cada acesso).
 */
export async function generateDownloadUrl(key: string): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key:    key,
  });
  return getSignedUrl(client, command, { expiresIn: 60 * 60 });
}

/**
 * Remove o objeto do R2.
 * Chamado ao deletar um Attachment do banco — garante que não ficam
 * arquivos órfãos cobrando storage.
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
