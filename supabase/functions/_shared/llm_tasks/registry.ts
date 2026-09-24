/**
 * Named LLM task registry — every client-facing Claude call is one of these.
 * The llm-task Edge Function resolves a task by name, enforces its tier gate
 * and the caller's daily quota, then builds the prompt server-side from the
 * client-supplied facts. See core.ts for the task contract.
 */
import { LLMTaskDef } from './core.ts';
import { chartTasks } from './tasks_chart.ts';
import { plannerTasks } from './tasks_planner.ts';
import { dynamicsTasks } from './tasks_dynamics.ts';
import { relationshipTasks } from './tasks_relationship.ts';
import { miscTasks } from './tasks_misc.ts';

export const TASKS: Record<string, LLMTaskDef> = {
  ...chartTasks,
  ...plannerTasks,
  ...dynamicsTasks,
  ...relationshipTasks,
  ...miscTasks,
};
