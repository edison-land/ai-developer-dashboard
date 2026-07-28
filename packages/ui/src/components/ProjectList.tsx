import type { UnifiedProject } from "@ai-dashboard/core";
import { useArchive } from "../hooks";
import { ProjectListRow } from "./ProjectListRow";

export function ProjectList({
  projects,
  onOpenProject,
}: {
  projects: UnifiedProject[];
  onOpenProject: (project: UnifiedProject) => void;
}) {
  const now = Date.now();
  const archive = useArchive();
  return (
    <>
      <div className="ui-panel overflow-hidden">
        {projects.map((project) => (
          <ProjectListRow
            key={project.canonicalPath}
            project={project}
            now={now}
            onOpen={() => onOpenProject(project)}
            onArchive={() => archive.mutate(project.canonicalPath)}
            archivePending={
              archive.isPending && archive.variables === project.canonicalPath
            }
          />
        ))}
      </div>
      {archive.isError && (
        <p role="alert" className="mt-3 text-sm ui-danger">
          项目归档失败，请稍后重试。
        </p>
      )}
    </>
  );
}
