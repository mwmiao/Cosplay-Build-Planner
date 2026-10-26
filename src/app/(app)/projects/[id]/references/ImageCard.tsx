import type { ReferenceImage } from "@prisma/client";
import { ConfirmButton } from "@/components/FormBits";
import { LightboxThumb } from "@/components/Lightbox";
import type { Dict } from "@/i18n";
import { hostname } from "@/lib/format";
import { deleteReference, updateReference } from "./actions";
import { CaptionForm } from "./CaptionForm";

/**
 * One private image with its caption, source and edit/delete controls. Used
 * for reference images and for a part's photos (`groups` undefined hides the
 * group field). Must be rendered inside a <LightboxGroup>.
 */
export function ImageCard({
  projectId,
  image,
  index,
  t,
  groups,
}: {
  projectId: string;
  image: ReferenceImage;
  index: number;
  t: Dict;
  groups?: string[];
}) {
  const R = t.refs;
  return (
    <li id={`ref-${image.id}`} className="card flex scroll-mt-4 flex-col gap-2 p-2" data-testid="image-card">
      <LightboxThumb index={index} label={t.lightbox.open(image.caption ?? image.originalName)}>
        <img
          src={`/api/uploads/${image.thumbPath}`}
          alt={image.caption ?? image.originalName}
          loading="lazy"
          width={480}
          height={480}
          className="aspect-square w-full object-cover transition-transform hover:scale-[1.02]"
        />
      </LightboxThumb>
      {image.caption ? <p className="px-1 text-sm font-medium">{image.caption}</p> : null}
      {image.sourceUrl ? (
        <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="link truncate px-1 text-xs">
          {R.source(hostname(image.sourceUrl) ?? image.sourceUrl)}
        </a>
      ) : null}
      <details className="mt-auto px-1 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-zinc-600 dark:text-zinc-400">{R.edit}</summary>
        <div className="space-y-3 pb-2">
          <CaptionForm
            action={updateReference.bind(null, projectId, image.id)}
            caption={image.caption ?? ""}
            sourceUrl={image.sourceUrl ?? ""}
            groupName={groups ? (image.groupName ?? "") : undefined}
            groups={groups}
          />
          <form action={deleteReference.bind(null, projectId, image.id)}>
            <ConfirmButton className="btn-danger w-full" message={R.deleteConfirm}>
              {R.delete}
            </ConfirmButton>
          </form>
        </div>
      </details>
    </li>
  );
}

/** Lightbox entries for private images, in display order. */
export function lightboxImages(images: ReferenceImage[]) {
  return images.map((i) => ({
    id: i.id,
    src: `/api/uploads/${i.filePath}`,
    thumb: `/api/uploads/${i.thumbPath}`,
    caption: i.caption,
    alt: i.caption ?? i.originalName,
  }));
}
