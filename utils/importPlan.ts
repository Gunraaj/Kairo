import type { Project, Task } from '../types';

export type ImportedPlan = {
  projectName: string;
  targetProjectId?: string;
  deadline?: string;
  tasks: Array<{
    name: string;
    targetRounds: number;
    subTasks: Array<{ id: string; name: string; completed: boolean }>;
  }>;
};

const makeTasks = (tasks: ImportedPlan['tasks'], id: () => string): Task[] =>
  tasks.map(t => ({
    id: id(),
    name: t.name,
    completed: false,
    timeSpent: 0,
    status: 'todo',
    targetRounds: t.targetRounds,
    estimatedRounds: t.targetRounds,
    subTasks: t.subTasks.map(st => ({ id: id(), name: st.name, completed: false })),
  }));

/**
 * Adds an imported plan to the project list: into an existing project when
 * `targetProjectId` matches, otherwise as a new first project. A deadline on the
 * plan is applied to the project (an existing deadline is kept if the plan has none).
 */
export const applyImportedPlan = (
  projects: Project[],
  imported: ImportedPlan,
  id: () => string = () => crypto.randomUUID(),
): { projects: Project[]; firstTaskId: string | null; projectId: string } => {
  const list = Array.isArray(projects) ? projects : [];
  const tasks = makeTasks(imported.tasks, id);

  if (imported.targetProjectId && list.some(p => p.id === imported.targetProjectId)) {
    return {
      projects: list.map(p => p.id !== imported.targetProjectId ? p : {
        ...p,
        deadline: imported.deadline ?? p.deadline,
        tasks: [...(p.tasks || []), ...tasks],
      }),
      firstTaskId: tasks[0]?.id ?? null,
      projectId: imported.targetProjectId,
    };
  }

  const project: Project = {
    id: id(),
    name: imported.projectName,
    tasks,
    subProjects: [],
    isExpanded: true,
    deadline: imported.deadline,
  };
  return { projects: [project, ...list], firstTaskId: tasks[0]?.id ?? null, projectId: project.id };
};
