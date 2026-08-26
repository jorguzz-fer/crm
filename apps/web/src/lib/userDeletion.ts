/**
 * Regras de exclusão de usuário.
 *
 * Excluir é diferente de desativar: a linha some do banco e o e-mail volta a
 * ficar livre (ele é único globalmente, então um e-mail preso num tenant
 * impede o cadastro da mesma pessoa em outro).
 *
 * Vários vínculos apontam para User com relação obrigatória — Activity, Task,
 * Note, Visit, Attachment, ConsentRecord, DataRequest e Transcription. O
 * Postgres recusaria o DELETE nesses casos, então checamos antes e explicamos,
 * em vez de deixar estourar um erro de foreign key na cara do usuário.
 */

export interface UserRecordCounts {
  activities: number;
  tasks: number;
  notes: number;
  visits: number;
  attachments: number;
  consents: number;
  dataRequests: number;
  transcriptions: number;
}

const LABELS: Record<keyof UserRecordCounts, [singular: string, plural: string]> = {
  activities: ["atividade", "atividades"],
  tasks: ["tarefa", "tarefas"],
  notes: ["anotação", "anotações"],
  visits: ["visita", "visitas"],
  attachments: ["anexo", "anexos"],
  consents: ["registro de consentimento", "registros de consentimento"],
  dataRequests: ["solicitação LGPD", "solicitações LGPD"],
  transcriptions: ["transcrição", "transcrições"],
};

/**
 * Lista legível do que impede a exclusão — vazia quando dá para excluir.
 * Ex.: ["3 atividades", "1 tarefa"]
 */
export function describeDeletionBlockers(counts: UserRecordCounts): string[] {
  return (Object.keys(LABELS) as (keyof UserRecordCounts)[])
    .filter((key) => counts[key] > 0)
    .map((key) => {
      const n = counts[key];
      const [singular, plural] = LABELS[key];
      return `${n} ${n === 1 ? singular : plural}`;
    });
}

/** "3 atividades, 1 tarefa e 2 anexos" */
export function joinBlockers(blockers: string[]): string {
  if (blockers.length === 0) return "";
  if (blockers.length === 1) return blockers[0];
  return `${blockers.slice(0, -1).join(", ")} e ${blockers[blockers.length - 1]}`;
}
