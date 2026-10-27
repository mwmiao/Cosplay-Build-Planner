import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { deleteOrganiser, saveOrganiser } from "../../events/actions";
import { OrganiserForm } from "../OrganiserForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.organisers.edit };
}

export default async function EditOrganiserPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const id = idSchema.safeParse(params.id);
  if (!id.success) notFound();
  const o = await db.organiser.findUnique({ where: { id: id.data } });
  if (!o) notFound();
  const { t } = getI18n();
  const O = t.organisers;
  return (
    <>
      <BackLink href="/admin/organisers">{O.title}</BackLink>
      <h1 className="page-title mb-4">{O.edit}</h1>
      <div className="card">
        <OrganiserForm
          action={saveOrganiser.bind(null, o.id)}
          submitLabel={t.common.save}
          initial={{
            name: o.name,
            website: o.website ?? "",
            city: o.city ?? "",
            usualVenue: o.usualVenue ?? "",
            usualAddress: o.usualAddress ?? "",
            eventType: o.eventType,
            active: o.active,
          }}
        />
      </div>
      <form action={deleteOrganiser.bind(null, o.id)} className="mt-6">
        <ConfirmButton className="btn-danger w-full sm:w-auto" message={O.deleteConfirm(o.name)}>
          {O.delete}
        </ConfirmButton>
      </form>
    </>
  );
}
