/**
 * POST /api/transcription
 *
 * Transcreve um arquivo de áudio usando OpenAI Whisper.
 *
 * Body: FormData
 *   - audio        File   (mp3, mp4, wav, webm, ogg, m4a) — máx 25 MB
 *   - entityType   string (opcional) — "note" | "activity" | "visit"
 *   - entityId     string (opcional)
 *   - consentGiven string "true" | "false"
 *   - language     string (opcional, default "pt")
 *
 * Retorna: { transcriptionId, text }
 *
 * Requer: OPENAI_API_KEY configurada para o tenant usar Whisper.
 */

import { NextResponse } from "next/server";
import { requireRole, ROLES_WRITE } from "@/lib/authz";
import { prisma } from "@crm/db";
import { generateUploadUrl, buildObjectKey, deleteObject } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a",
  "audio/wav", "audio/wave", "audio/webm", "audio/ogg",
  "audio/flac", "video/mp4", "video/webm",
]);

export async function POST(req: Request) {
  const { session, error } = await requireRole(ROLES_WRITE);
  if (error) return error;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Transcrição não configurada — OPENAI_API_KEY ausente" },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body inválido — esperado multipart/form-data" }, { status: 400 });
  }

  const audioFile    = formData.get("audio") as File | null;
  const entityType   = (formData.get("entityType") as string | null) ?? undefined;
  const entityId     = (formData.get("entityId") as string | null) ?? undefined;
  const consentGiven = formData.get("consentGiven") === "true";
  const language     = (formData.get("language") as string | null) ?? "pt";

  if (!audioFile || !(audioFile instanceof File)) {
    return NextResponse.json({ error: "Campo 'audio' obrigatório" }, { status: 400 });
  }

  if (audioFile.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `Arquivo muito grande (máx 25 MB, recebido ${(audioFile.size / 1048576).toFixed(1)} MB)` },
      { status: 400 },
    );
  }

  if (!ALLOWED_AUDIO_MIME.has(audioFile.type)) {
    return NextResponse.json(
      { error: `Formato não suportado: ${audioFile.type}` },
      { status: 400 },
    );
  }

  if (!consentGiven) {
    return NextResponse.json(
      { error: "Consentimento obrigatório antes de transcrever (LGPD art. 9º)" },
      { status: 400 },
    );
  }

  const tenantId = session.user.tenantId;
  const userId   = session.user.id;

  // Cria registro com status PENDING
  const audioKey = buildObjectKey({
    tenantId,
    entityType: "audio",
    entityId:   entityId ?? "standalone",
    filename:   audioFile.name,
    mimeType:   audioFile.type,
  });

  const transcription = await prisma.transcription.create({
    data: {
      id:           randomUUID(),
      tenantId,
      userId,
      audioKey,
      filename:     audioFile.name,
      language,
      status:       "PROCESSING",
      entityType:   entityType ?? null,
      entityId:     entityId ?? null,
      consentGiven,
    },
  });

  // Faz upload do áudio para R2
  const uploadUrl = await generateUploadUrl(audioKey, audioFile.type, 300);
  try {
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": audioFile.type },
      body: await audioFile.arrayBuffer(),
    });
    if (!uploadRes.ok) throw new Error(`R2 upload falhou: ${uploadRes.status}`);
  } catch (uploadErr) {
    await prisma.transcription.update({
      where: { id: transcription.id },
      data:  { status: "ERROR", errorMessage: String(uploadErr) },
    });
    return NextResponse.json({ error: "Falha no upload do áudio" }, { status: 500 });
  }

  // Chama Whisper
  let text: string;
  try {
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const audioBuffer = await audioFile.arrayBuffer();
    const file = new File([audioBuffer], audioFile.name, { type: audioFile.type });

    const response = await openai.audio.transcriptions.create({
      file,
      model:    "whisper-1",
      language: language.slice(0, 2), // "pt" → "pt"
      response_format: "text",
    });

    text = typeof response === "string" ? response : (response as { text: string }).text ?? "";
  } catch (whisperErr) {
    await prisma.transcription.update({
      where: { id: transcription.id },
      data:  { status: "ERROR", errorMessage: String(whisperErr) },
    });
    // Apaga o áudio do R2 se Whisper falhou (economia de storage)
    await deleteObject(audioKey).catch(() => {});
    return NextResponse.json({ error: "Falha na transcrição. Tente novamente." }, { status: 502 });
  }

  // Salva o resultado
  await prisma.transcription.update({
    where: { id: transcription.id },
    data:  { status: "DONE", text },
  });

  await logAudit({
    tenantId,
    userId,
    action:   "transcription.create",
    entity:   "Transcription",
    entityId: transcription.id,
    meta:     { filename: audioFile.name, entityType, entityId, chars: text.length },
  });

  return NextResponse.json({ transcriptionId: transcription.id, text }, { status: 201 });
}
