import type { Metadata } from "next";
import { BackLink } from "@/components/ui";
import { createProject } from "../actions";
import { ProjectForm } from "../ProjectForm";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <>
      <BackLink href="/projects">Projects</BackLink>
      <h1 className="page-title mb-4">New project</h1>
      <div className="card">
        <ProjectForm action={createProject} cancelHref="/projects" submitLabel="Create project" />
      </div>
    </>
  );
}
