import { pathKey, type UnifiedProject } from "@ai-dashboard/core";
import { useMutationState } from "@tanstack/react-query";
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
  const pendingArchives = useMutationState<string | undefined>({
    filters: { mutationKey: ["archive"], status: "pending" },
    select: (mutation) => mutation.state.variables as string | undefined,
  });
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
              pendingArchives.some(
                (path) => path !== undefined && pathKey(path) === pathKey(project.canonicalPath),
              )
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
