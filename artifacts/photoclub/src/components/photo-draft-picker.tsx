import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Image as ImageIcon, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { imageContentType, MAX_PHOTO_SIZE } from "@/lib/photo-upload";

export function PhotoDraftPicker({
  file, onChange, disabled,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const select = (candidate?: File) => {
    if (disabled || !candidate) return;
    if (!imageContentType(candidate)) {
      toast({ title: t("upload.imagesOnly"), variant: "destructive" });
    } else if (!candidate.size || candidate.size > MAX_PHOTO_SIZE) {
      toast({ title: t("upload.fileTooLarge"), variant: "destructive" });
    } else {
      onChange(candidate);
    }
  };

  return (
    <div className="sticky top-24">
      <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-2">
        {file ? t("upload.preview") : t("upload.uploadPhoto")}
      </div>
      <div
        className="min-h-[280px] aspect-[4/5] bg-secondary/50 rounded-sm border-2 border-dashed border-border flex flex-col items-center justify-center p-6"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          select(event.dataTransfer.files[0]);
        }}
      >
        {file && preview ? (
          <img src={preview} alt={t("upload.preview")} className="w-full min-h-0 flex-1 object-contain" />
        ) : <UploadCloud className="w-12 h-12 text-muted-foreground/30 mb-4" />}
        <p className="text-muted-foreground text-sm text-center mt-3 mb-4">
          {file ? `${file.name} — ${t("upload.reviewPhoto")}` : t("upload.dropHint")}
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button type="button" variant="outline" disabled={disabled} onClick={() => library.current?.click()}>
            <ImageIcon className="w-4 h-4 mr-2" />{t("upload.library")}
          </Button>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => camera.current?.click()}>
            <Camera className="w-4 h-4 mr-2" />{t("upload.camera")}
          </Button>
          {file && <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange(null)}>
            <X className="w-4 h-4 mr-2" />{t("upload.changePhoto")}
          </Button>}
        </div>
        <input ref={library} type="file" accept="image/*" className="sr-only" tabIndex={-1}
          onChange={(event) => { select(event.target.files?.[0]); event.target.value = ""; }} />
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1}
          onChange={(event) => { select(event.target.files?.[0]); event.target.value = ""; }} />
      </div>
    </div>
  );
}