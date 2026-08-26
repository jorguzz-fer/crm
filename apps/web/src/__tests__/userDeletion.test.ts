import { describe, it, expect } from "vitest";
import {
  describeDeletionBlockers,
  joinBlockers,
  type UserRecordCounts,
} from "@/lib/userDeletion";

const ZERO: UserRecordCounts = {
  activities: 0,
  tasks: 0,
  notes: 0,
  visits: 0,
  attachments: 0,
  consents: 0,
  dataRequests: 0,
  transcriptions: 0,
};

describe("describeDeletionBlockers", () => {
  it("não bloqueia usuário sem vínculos", () => {
    expect(describeDeletionBlockers(ZERO)).toEqual([]);
  });

  it("usa singular para um registro", () => {
    expect(describeDeletionBlockers({ ...ZERO, tasks: 1 })).toEqual(["1 tarefa"]);
    expect(describeDeletionBlockers({ ...ZERO, notes: 1 })).toEqual(["1 anotação"]);
  });

  it("usa plural para mais de um", () => {
    expect(describeDeletionBlockers({ ...ZERO, activities: 3 })).toEqual(["3 atividades"]);
    expect(describeDeletionBlockers({ ...ZERO, transcriptions: 2 })).toEqual(["2 transcrições"]);
  });

  it("lista todos os vínculos que bloqueiam", () => {
    const blockers = describeDeletionBlockers({
      ...ZERO,
      activities: 2,
      tasks: 1,
      attachments: 5,
    });
    expect(blockers).toEqual(["2 atividades", "1 tarefa", "5 anexos"]);
  });

  it("cobre todos os vínculos obrigatórios do schema", () => {
    // Cada um destes tem relação obrigatória com User — o DELETE falharia no banco
    const todos = describeDeletionBlockers({
      activities: 1,
      tasks: 1,
      notes: 1,
      visits: 1,
      attachments: 1,
      consents: 1,
      dataRequests: 1,
      transcriptions: 1,
    });
    expect(todos).toHaveLength(8);
  });
});

describe("joinBlockers", () => {
  it("retorna vazio quando não há nada", () => {
    expect(joinBlockers([])).toBe("");
  });

  it("um item sai sozinho", () => {
    expect(joinBlockers(["1 tarefa"])).toBe("1 tarefa");
  });

  it("dois itens usam 'e'", () => {
    expect(joinBlockers(["1 tarefa", "2 anexos"])).toBe("1 tarefa e 2 anexos");
  });

  it("três ou mais usam vírgula e 'e' no último", () => {
    expect(joinBlockers(["2 atividades", "1 tarefa", "5 anexos"])).toBe(
      "2 atividades, 1 tarefa e 5 anexos"
    );
  });
});
