import source from "../../docs/content/umrah-steps.json" with { type: "json" };

export const umrahStepTitle = id => `umrahStep-${id}`;
export const umrahStepSummary = id => `umrahStep-${id}-summary`;
export const umrahStepNote = (id, index) => `umrahStep-${id}-note-${index + 1}`;

export const umrahStepMessages = Object.fromEntries(source.steps.flatMap(step => [
  [umrahStepTitle(step.id), { en: step.title, bn: step.titleBn }],
  [umrahStepSummary(step.id), { en: step.summary, bn: step.summaryBn }],
  ...(step.notes ?? []).map((en, index) => [umrahStepNote(step.id, index), { en, bn: step.notesBn[index] }]),
]));
