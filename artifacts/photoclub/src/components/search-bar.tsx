import type { ChangeEventHandler, FormEventHandler } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  placeholder: string;
  className?: string;
}

export function SearchBar({ value, onChange, onSubmit, placeholder, className }: SearchBarProps) {
  const { t } = useTranslation();

  return (
    <form onSubmit={onSubmit} className={cn("relative w-full max-w-md", className)}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full pl-12 h-14 bg-background border-border/50 text-base focus-visible:ring-primary rounded-full shadow-lg"
      />
      <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-6">
        {t("common.find")}
      </Button>
    </form>
  );
}