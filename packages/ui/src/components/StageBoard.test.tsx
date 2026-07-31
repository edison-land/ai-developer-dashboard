import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StageBoard } from "./StageBoard";
import { project } from "../test/fixtures";

describe("StageBoard drag workflow", () => {
  it("moves a card to the dropped stage and calls the persistence seam", async () => {
    const onSetStage = vi.fn().mockResolvedValue(undefined);
    render(
      <StageBoard
        projects={[project("Alpha", { stage: "building" })]}
        onOpenProject={vi.fn()}
        onSetStage={onSetStage}
      />,
    );

    const card = screen.getByRole("button", { name: /Alpha/ });
    const doneColumn = screen.getByRole("heading", { name: "完成" }).closest("section");
    expect(doneColumn).not.toBeNull();

    fireEvent.dragStart(card);
    fireEvent.dragOver(doneColumn!);
    fireEvent.drop(doneColumn!);

    await waitFor(() => expect(onSetStage).toHaveBeenCalledWith(expect.stringContaining("Alpha"), "done"));
    expect(screen.getByRole("button", { name: /Alpha/ }).closest("section")).toBe(doneColumn);
  });

  it("returns a card to its original column when persistence fails", async () => {
    const onSetStage = vi.fn().mockRejectedValue(new Error("offline"));
    render(
      <StageBoard
        projects={[project("Alpha", { stage: "building" })]}
        onOpenProject={vi.fn()}
        onSetStage={onSetStage}
      />,
    );

    const card = screen.getByRole("button", { name: /Alpha/ });
    const doneColumn = screen.getByRole("heading", { name: "完成" }).closest("section");
    const buildingColumn = screen.getByRole("heading", { name: "开发中" }).closest("section");
    fireEvent.dragStart(card);
    fireEvent.drop(doneColumn!);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("阶段更新失败"));
    expect(screen.getByRole("button", { name: /Alpha/ }).closest("section")).toBe(buildingColumn);
  });
});
