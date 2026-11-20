import source from "../../docs/content/umrah-steps.json" with { type: "json" };

export const umrahStepTitle = id => `umrahStep-${id}`;
export const umrahStepNote = (id, index) => `umrahStep-${id}-note-${index + 1}`;

export const umrahStepMessages = Object.fromEntries(source.steps.flatMap(step => [
  [umrahStepTitle(step.id), { en: step.title, bn: step.titleBn }],
  ...(step.notes ?? []).map((en, index) => [umrahStepNote(step.id, index), { en, bn: step.notesBn[index] }]),
]));
