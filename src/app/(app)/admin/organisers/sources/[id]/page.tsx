import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROVIDERS } from "@/lib/instagram/providers";
import { idSchema } from "@/lib/validation";
import { deleteSource, saveSource } from "../../../instagram/actions";
import { SourceForm } from "../../../instagram/SourceForms";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.instagram.editSource };
}

export default async function EditSourcePage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const id = idSchema.safeParse(params.id);
  if (!id.success) notFound();
  const s = await db.instagramSource.findUnique({ where: { id: id.data } });
  if (!s) notFound();
  const { t } = getI18n();
  const S = t.instagram;
  const organisers = await db.organiser.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const providers = Object.keys(PROVIDERS).filter((p) => p !== "mock" || process.env.NODE_ENV !== "production");
  return (
    <>
      <BackLink href="/admin/organisers#instagram">{t.organisers.title}</BackLink>
      <h1 className="page-title mb-4">{S.editSource}</h1>
      <div className="card">
        <SourceForm
          action={saveSource.bind(null, s.id)}
          organisers={organisers}
          providers={providers}
          submitLabel={t.common.save}
          initial={{
            username: s.username,
            displayName: s.displayName ?? "",
            sourceType: s.sourceType,
            feedUrl: s.feedUrl ?? "",
            providerName: s.providerName,
            organiserId: s.organiserId ?? "",
            active: s.active,
          }}
        />
      </div>
      <form action={deleteSource.bind(null, s.id)} className="mt-6">
        <ConfirmButton className="btn-danger w-full sm:w-auto" message={S.deleteConfirm(s.username)}>
          {S.deleteSource}
        </ConfirmButton>
      </form>
    </>
  );
}
